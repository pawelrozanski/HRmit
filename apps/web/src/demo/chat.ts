import {
  PIPELINE_STAGES,
  anonymize,
  candidateLabel,
  isLocalProvider,
  type AiLang,
  type ChatContext,
  type ChatRefs,
  type ChatToolName,
} from '@hrmit/shared'
import { fixtures } from '@hrmit/shared'
import { store } from './store.ts'

/**
 * Recorded chat answers for the demo (docs/ARCHITECTURE.md §4.2): no model runs on GitHub
 * Pages, so each suggested question maps to a scenario whose text is built from the demo store,
 * in the UI language. A pseudo tool event precedes the text, like the real endpoint sends.
 * With a cloud provider picked in the demo settings the text uses "Candidate #N" and the
 * refs carry the names, exactly as the server would do.
 */
export type DemoAnswer = { tool: ChatToolName | null; text: string; refs: ChatRefs }

type Scenario =
  | 'today'
  | 'longest'
  | 'teamIt'
  | 'best'
  | 'thisRecruitment'
  | 'longestHere'
  | 'summarize'
  | 'averages'
  | 'meetings'
  | 'recruitments'

const DAY = 86_400_000

/** First match wins; the chips' own text matches before the looser keywords. */
const KEYWORDS: [Scenario, RegExp][] = [
  ['best', /najlep|best|hire|zatrudn|odrzuc|reject|rank/i],
  ['summarize', /stre[śs][ćc]|summar|podsumuj/i],
  ['averages', /[śs]redni|average|ocen|score/i],
  ['teamIt', /zesp|team/i],
  ['longestHere', /(czeka|wait|longest|najd[łl]u[żz]ej).*(tu|here)/i],
  ['longest', /czeka|wait|longest|najd[łl]u[żz]ej|stuck|utkn/i],
  ['meetings', /kiedy|when/i],
  ['today', /dzi[śs]|today|jutro|tomorrow|rozmow|interview|meeting|spotka/i],
  ['thisRecruitment', /(ta|this).*(rekrutacj|recruitment)|jak idzie|how is/i],
  ['recruitments', /rekrutacj|recruitment|otwarte|open/i],
]

export function pickScenario(question: string): Scenario | null {
  return KEYWORDS.find(([, re]) => re.test(question))?.[0] ?? null
}

const t = (lang: AiLang, en: string, pl: string) => (lang === 'pl' ? pl : en)

export function demoAnswer(question: string, context: ChatContext, lang: AiLang): DemoAnswer {
  const local = isLocalProvider(store.aiSettings)
  const refs: ChatRefs = { candidates: {}, recruitments: {} }
  const job = (id: number) => store.jobs.find((j) => j.id === id)
  const title = (id: number) => {
    const j = job(id)
    if (j) refs.recruitments[id] = { title: j.title }
    return j?.title ?? '?'
  }
  const name = (c: { id: number; firstName: string; lastName: string; jobId: number }) => {
    refs.candidates[c.id] = { name: `${c.firstName} ${c.lastName}`, jobId: c.jobId }
    return local ? `${c.firstName} ${c.lastName}` : candidateLabel(c.id)
  }
  const days = (iso: string) => Math.floor((Date.now() - Date.parse(iso)) / DAY)
  const when = (iso: string) =>
    new Date(iso).toLocaleString(lang, { weekday: 'long', hour: '2-digit', minute: '2-digit' })
  const stageName = (s: string) =>
    t(
      lang,
      s,
      {
        applied: 'zgłoszenie',
        screening: 'selekcja',
        interview: 'rozmowa',
        offer: 'oferta',
        rejected: 'odrzucenie',
      }[s] ?? s,
    )
  const contextJob =
    context.view === 'recruitment'
      ? job(context.id!)
      : context.view === 'candidate'
        ? job(store.candidates.find((c) => c.id === context.id)?.jobId ?? -1)
        : undefined
  const open = store.jobs.filter((j) => j.status === 'open')
  const active = store.candidates.filter(
    (c) => job(c.jobId)?.status === 'open' && c.stage !== 'rejected',
  )

  const scenario = pickScenario(question)
  const answer = (tool: ChatToolName | null, text: string): DemoAnswer => ({ tool, text, refs })

  switch (scenario) {
    case 'today':
    case 'meetings': {
      const who = context.view === 'candidate' ? context.id : undefined
      const rows = store.meetings
        .filter(
          (m) =>
            (who === undefined || m.candidateId === who) && Date.parse(m.startsAt) >= Date.now(),
        )
        .filter((m) => Date.parse(m.startsAt) < Date.now() + 7 * DAY)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      if (rows.length === 0)
        return answer(
          'upcomingMeetings',
          t(lang, 'No interviews in the next 7 days.', 'Brak rozmów w najbliższych 7 dniach.'),
        )
      const lines = rows.map((m) => {
        const c = store.candidates.find((x) => x.id === m.candidateId)!
        return `- ${when(m.startsAt)}: ${name(c)}, ${title(c.jobId)}, ${m.durationMin} min`
      })
      return answer(
        'upcomingMeetings',
        t(
          lang,
          `Interviews in the next 7 days:\n${lines.join('\n')}`,
          `Rozmowy w najbliższych 7 dniach:\n${lines.join('\n')}`,
        ),
      )
    }
    case 'longest':
    case 'longestHere': {
      const j = scenario === 'longestHere' ? contextJob : undefined
      const rows = active
        .filter((c) => !j || c.jobId === j.id)
        .filter((c) => days(c.stageChangedAt) >= 7)
        .sort((a, b) => a.stageChangedAt.localeCompare(b.stageChangedAt))
      if (rows.length === 0)
        return answer(
          'stuckCandidates',
          t(
            lang,
            'Nobody has waited 7 days or more in a stage.',
            'Nikt nie czeka 7 dni lub dłużej na etapie.',
          ),
        )
      const lines = rows.map(
        (c) =>
          `- ${name(c)}, ${title(c.jobId)}, ${stageName(c.stage)}: ${t(lang, `${days(c.stageChangedAt)} days`, `${days(c.stageChangedAt)} dni`)}`,
      )
      return answer(
        'stuckCandidates',
        t(
          lang,
          `Waiting the longest without a stage change:\n${lines.join('\n')}`,
          `Najdłużej bez zmiany etapu czekają:\n${lines.join('\n')}`,
        ),
      )
    }
    case 'teamIt': {
      const team = store.teams.find((x) => /it/i.test(x.name)) ?? store.teams[0]
      if (!team)
        return answer(
          'teamOverview',
          t(lang, 'There are no teams yet.', 'Nie ma jeszcze zespołów.'),
        )
      const members = store.teamMembers.filter((m) => m.teamId === team.id).length
      const jobs = open.filter((x) => x.teamId === team.id).map((x) => title(x.id))
      return answer(
        'teamOverview',
        t(
          lang,
          `The ${team.name} team has ${members} members and ${jobs.length} open recruitment${jobs.length === 1 ? '' : 's'}${jobs.length ? `: ${jobs.join(', ')}` : ''}.`,
          `Zespół ${team.name} ma ${members} członków i ${jobs.length} otwartych rekrutacji${jobs.length ? `: ${jobs.join(', ')}` : ''}.`,
        ),
      )
    }
    case 'best': {
      // The portfolio moment: facts, no ranking, the decision named as the recruiter's.
      const j = contextJob ?? open[0]
      if (!j)
        return answer(
          null,
          t(
            lang,
            'I do not rank candidates, and there is no open recruitment to describe.',
            'Nie rankinguję kandydatów, a nie ma otwartej rekrutacji do opisania.',
          ),
        )
      const late = store.candidates.filter(
        (c) => c.jobId === j.id && (c.stage === 'interview' || c.stage === 'offer'),
      )
      const facts = late.map((c) => {
        const qs = store.questions.filter((q) => q.jobId === j.id)
        const scored = store.evaluations.filter((e) => e.candidateId === c.id && e.score !== null)
        const byComp = new Map<string, number[]>()
        for (const e of scored) {
          const q = qs.find((x) => x.id === e.questionId)
          if (q) byComp.set(q.competency, [...(byComp.get(q.competency) ?? []), e.score!])
        }
        const avg = [...byComp]
          .map(([comp, s]) => `${comp} ${(s.reduce((a, b) => a + b, 0) / s.length).toFixed(1)}`)
          .join(', ')
        return `- ${name(c)}, ${stageName(c.stage)}, ${t(lang, `${scored.length} of ${qs.length} questions scored`, `ocenione ${scored.length} z ${qs.length} pytań`)}${avg ? ` (${avg})` : ''}`
      })
      return answer(
        'getRecruitment',
        t(
          lang,
          `I do not rank or recommend candidates: that decision is yours. Here are the facts for ${title(j.id)}:\n${facts.join('\n') || '- nobody in interview or offer yet'}\nThe averages are per competency and come from your interviewers' scores, not from me.`,
          `Nie rankinguję ani nie polecam kandydatów: ta decyzja należy do Ciebie. Fakty dla rekrutacji ${title(j.id)}:\n${facts.join('\n') || '- nikogo jeszcze na etapie rozmowy lub oferty'}\nŚrednie są per kompetencja i pochodzą z ocen Twoich rekruterów, nie ode mnie.`,
        ),
      )
    }
    case 'thisRecruitment': {
      const j = contextJob ?? open[0]
      if (!j)
        return answer(
          'listRecruitments',
          t(lang, 'No open recruitments.', 'Brak otwartych rekrutacji.'),
        )
      const counts = PIPELINE_STAGES.map(
        (s) =>
          `${stageName(s)} ${store.candidates.filter((c) => c.jobId === j.id && c.stage === s).length}`,
      ).join(', ')
      return answer(
        'getRecruitment',
        t(
          lang,
          `${title(j.id)} is ${j.status}. Candidates per stage: ${counts}.`,
          `${title(j.id)}: ${j.status === 'open' ? 'otwarta' : 'zamknięta'}. Kandydaci na etapach: ${counts}.`,
        ),
      )
    }
    case 'recruitments': {
      const lines = open.map(
        (j) =>
          `- ${title(j.id)}: ${store.candidates.filter((c) => c.jobId === j.id).length} ${t(lang, 'candidates', 'kandydatów')}`,
      )
      return answer(
        'listRecruitments',
        t(
          lang,
          `Open recruitments:\n${lines.join('\n')}`,
          `Otwarte rekrutacje:\n${lines.join('\n')}`,
        ),
      )
    }
    case 'summarize':
    case 'averages': {
      const c =
        context.view === 'candidate' ? store.candidates.find((x) => x.id === context.id) : undefined
      if (!c)
        return answer(
          null,
          t(
            lang,
            'Open a candidate first, then ask about them.',
            'Najpierw otwórz kandydata, potem zapytaj o niego.',
          ),
        )
      const stored =
        c.aiSummaryJson?.summary?.summary ??
        (c.cvText ? fixtures.ai[c.id]?.summary.summary : undefined)
      const qs = store.questions.filter((q) => q.jobId === c.jobId)
      const scored = store.evaluations.filter((e) => e.candidateId === c.id && e.score !== null)
      const byComp = new Map<string, number[]>()
      for (const e of scored) {
        const q = qs.find((x) => x.id === e.questionId)
        if (q) byComp.set(q.competency, [...(byComp.get(q.competency) ?? []), e.score!])
      }
      const avg = [...byComp].map(
        ([comp, s]) => `- ${comp}: ${(s.reduce((a, b) => a + b, 0) / s.length).toFixed(1)} / 5`,
      )
      const head = t(
        lang,
        `${name(c)} applied for ${title(c.jobId)} and is in the ${stageName(c.stage)} stage for ${days(c.stageChangedAt)} days.`,
        `${name(c)}: rekrutacja ${title(c.jobId)}, etap ${stageName(c.stage)} od ${days(c.stageChangedAt)} dni.`,
      )
      const summary = stored
        ? t(
            lang,
            `Stored AI summary: ${local ? stored : anonymize(stored, c).text}`,
            `Zapisane streszczenie AI: ${local ? stored : anonymize(stored, c).text}`,
          )
        : t(
            lang,
            'No AI summary stored yet: upload a CV and use "Summarize CV" in the drawer.',
            'Brak zapisanego streszczenia AI: wgraj CV i użyj „Streść CV” w szufladzie.',
          )
      const scores = avg.length
        ? t(
            lang,
            `Interview averages per competency (${scored.length} of ${qs.length} scored):\n${avg.join('\n')}`,
            `Średnie z rozmowy per kompetencja (ocenione ${scored.length} z ${qs.length}):\n${avg.join('\n')}`,
          )
        : t(lang, 'No interview scores yet.', 'Brak jeszcze ocen z rozmowy.')
      return answer(
        'getCandidate',
        scenario === 'summarize' ? `${head}\n${summary}\n${scores}` : `${head}\n${scores}`,
      )
    }
    default:
      return answer(
        null,
        t(
          lang,
          'In the demo the assistant answers the suggested questions only; the full chat with a local model works in the local version. Start a new conversation to see the suggestions again.',
          'W wersji demo asystent odpowiada tylko na podpowiedzi; pełny czat z lokalnym modelem działa w wersji lokalnej. Zacznij nową rozmowę, żeby znów zobaczyć podpowiedzi.',
        ),
      )
  }
}
