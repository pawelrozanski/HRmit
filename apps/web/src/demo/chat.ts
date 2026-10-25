import {
  PIPELINE_STAGES,
  anonymize,
  candidateLabel,
  employeeLabel,
  isLocalProvider,
  type AiLang,
  type ChatContext,
  type ChatProposal,
  type ChatRefs,
  type ChatToolName,
} from '@hrmit/shared'
import { fixtures, type JobLevel } from '@hrmit/shared'
import { salaryRange } from '../features/recruitments/salary.ts'
import { store } from './store.ts'

const LEVEL_PL: Record<JobLevel, string> = {
  intern: 'stażysta',
  junior: 'junior',
  mid: 'specjalista (mid)',
  senior: 'senior',
  lead: 'lead / ekspert',
  manager: 'kierownik',
  director: 'dyrektor',
}

/**
 * Recorded chat answers for the demo (docs/ARCHITECTURE.md §4.2): no model runs on GitHub
 * Pages, so each suggested question maps to a scenario whose text is built from the demo store,
 * in the UI language. A pseudo tool event precedes the text, like the real endpoint sends.
 * With a cloud provider picked in the demo settings the text uses "Candidate #N" and the
 * refs carry the names, exactly as the server would do.
 */
export type DemoAnswer = {
  tool: ChatToolName | null
  text: string
  refs: ChatRefs
  /** A note draft for the proposal card (ADR 0009); saved only when the visitor clicks Save. */
  proposal?: ChatProposal
}

type Scenario =
  | 'today'
  | 'longest'
  | 'teamIt'
  | 'best'
  | 'thisRecruitment'
  | 'longestHere'
  | 'summarize'
  | 'averages'
  | 'scorecard'
  | 'noteSummary'
  | 'requirements'
  | 'notes'
  | 'employeeRole'
  | 'meetings'
  | 'recruitments'

const DAY = 86_400_000

/** First match wins; the chips' own text matches before the looser keywords. */
const KEYWORDS: [Scenario, RegExp][] = [
  ['best', /najlep|best|hire|zatrudn|odrzuc|reject|rank/i],
  ['noteSummary', /zanotuj|note down|write down|zapisz notatk/i],
  ['requirements', /wymaga|requirement|wide[łl]k|salary|wynagrodz|zarob|poziom|level|seniority/i],
  ['notes', /notatk|notes/i],
  ['scorecard', /poka[żz] oceny|ratings|scorecard/i],
  ['employeeRole', /rol[ęea]\b|role\b|stanowisk|position/i],
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
  const refs: ChatRefs = { candidates: {}, recruitments: {}, employees: {} }
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
  const staff = (e: { id: number; firstName: string; lastName: string }) => {
    refs.employees[e.id] = { name: `${e.firstName} ${e.lastName}` }
    return local ? `${e.firstName} ${e.lastName}` : employeeLabel(e.id)
  }
  /** Cloud: people's text loses every candidate's and employee's name, like the server does. */
  const scrub = (text: string) =>
    local
      ? text
      : [
          ...store.candidates.map((c) => ({ ...c, label: candidateLabel(c.id) })),
          ...store.employees.map((e) => ({ ...e, phone: '', label: employeeLabel(e.id) })),
        ].reduce((t, p) => anonymize(t, p, { inflected: true, label: p.label }).text, text)
  const employeesAllowed = local || store.aiSettings.chatEmployees
  const employeesOff = t(
    lang,
    'Employee data is not available to the assistant with a cloud provider. You can turn it on in Settings → AI ("Employee data in the assistant").',
    'Dane pracowników nie są dostępne dla asystenta przy dostawcy chmurowym. Możesz to włączyć w Ustawieniach → AI („Dane pracowników w asystencie”).',
  )
  const date = (iso: string) => new Date(iso).toLocaleDateString(lang, { dateStyle: 'medium' })
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

  const contextCandidate =
    context.view === 'candidate' ? store.candidates.find((c) => c.id === context.id) : undefined
  const contextEmployee =
    context.view === 'employee' ? store.employees.find((e) => e.id === context.id) : undefined
  /** Per competency: question, human rating and comment, plus the averages. Never a total. */
  const scorecardOf = (c: { id: number; jobId: number }) => {
    const qs = store.questions.filter((q) => q.jobId === c.jobId)
    const rows = qs.map((q) => {
      const e = store.evaluations.find((x) => x.candidateId === c.id && x.questionId === q.id)
      return { ...q, rating: e?.score ?? null, comment: e?.note ?? '' }
    })
    const byComp = new Map<string, number[]>()
    for (const r of rows)
      if (r.rating !== null)
        byComp.set(r.competency, [...(byComp.get(r.competency) ?? []), r.rating])
    const averages = [...byComp].map(([competency, s]) => ({
      competency,
      average: (s.reduce((a, b) => a + b, 0) / s.length).toFixed(1),
      answered: s.length,
      total: rows.filter((r) => r.competency === competency).length,
    }))
    return { rows, averages, scored: rows.filter((r) => r.rating !== null).length }
  }

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
          .map(
            ([comp, s]) =>
              `${comp} ${(s.reduce((a, b) => a + b, 0) / s.length).toFixed(1)} (${s.length}/${qs.filter((q) => q.competency === comp).length})`,
          )
          .join(', ')
        return `- ${name(c)}, ${stageName(c.stage)}, ${t(lang, `${scored.length} of ${qs.length} questions rated`, `ocenione ${scored.length} z ${qs.length} pytań`)}${avg ? ` (${avg})` : ''}`
      })
      return answer(
        'getRecruitment',
        t(
          lang,
          `I do not rank or recommend candidates: that decision is yours. Here are the facts from the scorecards for ${title(j.id)}:\n${facts.join('\n') || '- nobody in interview or offer yet'}\nThe averages are per competency (rated/total questions) and come from your interviewers' ratings, not from me; I do not add them up into one number.`,
          `Nie rankinguję ani nie polecam kandydatów: ta decyzja należy do Ciebie. Fakty ze scorecardów dla rekrutacji ${title(j.id)}:\n${facts.join('\n') || '- nikogo jeszcze na etapie rozmowy lub oferty'}\nŚrednie są per kompetencja (ocenione/wszystkie pytania) i pochodzą z ocen Twoich rekruterów, nie ode mnie; nie sumuję ich w jedną liczbę.`,
        ),
      )
    }
    case 'scorecard': {
      const c = contextCandidate
      if (!c)
        return answer(
          null,
          t(
            lang,
            'Open a candidate first, then ask about their scorecard.',
            'Najpierw otwórz kandydata, potem zapytaj o jego oceny.',
          ),
        )
      const { rows, averages, scored } = scorecardOf(c)
      if (scored === 0)
        return answer(
          'getScorecard',
          t(
            lang,
            `${name(c)} has no interview ratings yet (${rows.length} questions in the guide).`,
            `${name(c)} nie ma jeszcze ocen z rozmowy (${rows.length} pytań w przewodniku).`,
          ),
        )
      const lines = rows
        .filter((r) => r.rating !== null)
        .map(
          (r) =>
            `- ${r.competency}: "${r.question}" — ${r.rating}/5${r.comment ? `, ${scrub(r.comment)}` : ''}`,
        )
      const avg = averages
        .map((a) => `${a.competency} ${a.average} (${a.answered}/${a.total})`)
        .join(', ')
      return answer(
        'getScorecard',
        t(
          lang,
          `Interview ratings for ${name(c)}, entered by your interviewers (${scored} of ${rows.length} questions):\n${lines.join('\n')}\nAverages per competency: ${avg}. These are their ratings, not mine; I do not add them up or compare candidates.`,
          `Oceny z rozmowy dla ${name(c)}, wpisane przez Twoich rekruterów (${scored} z ${rows.length} pytań):\n${lines.join('\n')}\nŚrednie per kompetencja: ${avg}. To ich oceny, nie moje; nie sumuję ich ani nie porównuję kandydatów.`,
        ),
      )
    }
    case 'noteSummary': {
      const c = contextCandidate
      if (!c)
        return answer(
          null,
          t(
            lang,
            'Open a candidate first, then ask me to note something down.',
            'Najpierw otwórz kandydata, potem poproś o notatkę.',
          ),
        )
      const { rows, averages, scored } = scorecardOf(c)
      const comments = rows.filter((r) => r.comment).map((r) => `${r.competency}: ${r.comment}`)
      const body = scrub(
        t(
          lang,
          `Interview summary, ${date(new Date().toISOString())}. Stage: ${stageName(c.stage)}. ${scored} of ${rows.length} questions rated${averages.length ? `; averages per competency: ${averages.map((a) => `${a.competency} ${a.average}`).join(', ')}` : ''}.${comments.length ? ` Interviewer comments: ${comments.join('; ')}.` : ''}`,
          `Podsumowanie rozmowy, ${date(new Date().toISOString())}. Etap: ${stageName(c.stage)}. Ocenione ${scored} z ${rows.length} pytań${averages.length ? `; średnie per kompetencja: ${averages.map((a) => `${a.competency} ${a.average}`).join(', ')}` : ''}.${comments.length ? ` Komentarze rekruterów: ${comments.join('; ')}.` : ''}`,
        ),
      )
      return {
        ...answer(
          'proposeNote',
          t(
            lang,
            `Here is a draft note for ${name(c)} with the facts from the scorecard. Nothing is saved until you click Save.`,
            `Oto szkic notatki dla ${name(c)} z faktami ze scorecardu. Nic nie jest zapisane, dopóki nie klikniesz Zapisz.`,
          ),
        ),
        proposal: {
          target: 'candidate',
          id: c.id,
          title: t(lang, 'Interview summary', 'Podsumowanie rozmowy'),
          body,
        },
      }
    }
    case 'requirements': {
      const j = contextJob ?? open[0]
      if (!j)
        return answer(
          'listRecruitments',
          t(lang, 'No open recruitments.', 'Brak otwartych rekrutacji.'),
        )
      const qs = store.questions.filter((q) => q.jobId === j.id)
      const comps = [...new Set(qs.map((q) => q.competency))]
      const team = store.teams.find((x) => x.id === j.teamId)
      const members = team ? store.teamMembers.filter((m) => m.teamId === team.id).length : 0
      const list = (text: string) =>
        text
          .split('\n')
          .filter((l) => l.trim())
          .map((l) => `- ${scrub(l.trim())}`)
          .join('\n')
      const salary = salaryRange(j, lang)
      const facts = [
        j.level && t(lang, `Level: ${j.level}.`, `Poziom: ${LEVEL_PL[j.level]}.`),
        j.location &&
          t(lang, `Location: ${scrub(j.location)}.`, `Lokalizacja: ${scrub(j.location)}.`),
        j.contract && t(lang, `Contract: ${scrub(j.contract)}.`, `Umowa: ${scrub(j.contract)}.`),
        salary &&
          t(
            lang,
            `Salary: ${salary} per ${j.salaryPeriod}.`,
            `Widełki: ${salary} ${{ month: 'miesięcznie', year: 'rocznie', hour: 'za godzinę' }[j.salaryPeriod]}.`,
          ),
        j.requirements.trim() && t(lang, 'Requirements:\n', 'Wymagania:\n') + list(j.requirements),
        j.niceToHave.trim() && t(lang, 'Nice to have:\n', 'Mile widziane:\n') + list(j.niceToHave),
      ].filter(Boolean)
      return answer(
        'getRecruitment',
        t(
          lang,
          `${title(j.id)}: ${scrub(j.description)}\n${facts.join('\n')}\nThe interview guide covers ${comps.length} competencies (${comps.join(', ')}) in ${qs.length} questions.${team ? ` Hiring team: ${team.name} (${members} members).` : ' No hiring team assigned.'}`,
          `${title(j.id)}: ${scrub(j.description)}\n${facts.join('\n')}\nPrzewodnik rozmowy obejmuje ${comps.length} kompetencji (${comps.join(', ')}) w ${qs.length} pytaniach.${team ? ` Zespół rekrutujący: ${team.name} (${members} osób).` : ' Bez przypisanego zespołu.'}`,
        ),
      )
    }
    case 'notes': {
      if (contextEmployee) {
        if (!employeesAllowed) return answer('getNotes', employeesOff)
        const e = contextEmployee
        const rows = store.employeeNotes
          .filter((n) => n.employeeId === e.id)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        if (rows.length === 0)
          return answer(
            'getNotes',
            t(lang, `No notes on ${staff(e)} yet.`, `Brak notatek o ${staff(e)}.`),
          )
        const lines = rows.map(
          (n) =>
            `- ${date(n.createdAt)}${n.title ? `, ${scrub(n.title)}` : ''}: ${scrub(n.body)}${n.source === 'assistant' ? t(lang, ' (drafted by the assistant)', ' (szkic asystenta)') : ''}`,
        )
        return answer(
          'getNotes',
          t(
            lang,
            `Notes on ${staff(e)}:\n${lines.join('\n')}`,
            `Notatki o ${staff(e)}:\n${lines.join('\n')}`,
          ),
        )
      }
      const c = contextCandidate
      if (!c)
        return answer(
          null,
          t(
            lang,
            'Open a candidate or an employee first, then ask about the notes.',
            'Najpierw otwórz kandydata lub pracownika, potem zapytaj o notatki.',
          ),
        )
      const rows = store.candidateNotes
        .filter((n) => n.candidateId === c.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      if (rows.length === 0)
        return answer(
          'getNotes',
          t(lang, `No notes on ${name(c)} yet.`, `Brak notatek o ${name(c)}.`),
        )
      const lines = rows.map(
        (n) =>
          `- ${date(n.createdAt)}${n.title ? `, ${scrub(n.title)}` : ''}: ${scrub(n.body)}${n.source === 'assistant' ? t(lang, ' (drafted by the assistant)', ' (szkic asystenta)') : ''}`,
      )
      return answer(
        'getNotes',
        t(
          lang,
          `Notes on ${name(c)}:\n${lines.join('\n')}`,
          `Notatki o ${name(c)}:\n${lines.join('\n')}`,
        ),
      )
    }
    case 'employeeRole': {
      const e = contextEmployee
      if (!e)
        return answer(
          null,
          t(
            lang,
            'Open an employee first, then ask about their role.',
            'Najpierw otwórz pracownika, potem zapytaj o jego rolę.',
          ),
        )
      if (!employeesAllowed) return answer('searchEmployees', employeesOff)
      const teams = store.teamMembers
        .filter((m) => m.employeeId === e.id)
        .map((m) => {
          const team = store.teams.find((x) => x.id === m.teamId)
          return `${team?.name ?? '?'}${m.role === 'lead' ? t(lang, ' (lead)', ' (lider)') : ''}`
        })
      return answer(
        'searchEmployees',
        t(
          lang,
          `${staff(e)} is ${e.position}.${e.duties ? ` Duties: ${scrub(e.duties).replace(/\n+/g, '; ')}.` : ''} ${teams.length ? `Teams: ${teams.join(', ')}.` : 'Not in any team.'}`,
          `${staff(e)}: ${e.position}.${e.duties ? ` Obowiązki: ${scrub(e.duties).replace(/\n+/g, '; ')}.` : ''} ${teams.length ? `Zespoły: ${teams.join(', ')}.` : 'Bez zespołu.'}`,
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
