import { HttpResponse, delay, http } from 'msw'
import {
  JITSI_PREFIX,
  addMembersSchema,
  aiActionBodySchema,
  employeeInputSchema,
  employeeNoteInputSchema,
  aiPromptsSchema,
  aiSettingsSchema,
  anonymize,
  candidateInputSchema,
  emailTemplateInputSchema,
  evaluationSchema,
  fixtures,
  interviewQuestionInputSchema,
  jobInputSchema,
  meetingInputSchema,
  moveStageSchema,
  pipelineStageSchema,
  renderTemplate,
  sendEmailInputSchema,
  sendEmployeeEmailInputSchema,
  sendTeamEmailInputSchema,
  setMemberRoleSchema,
  smtpSettingsSchema,
  teamInputSchema,
  isLocalProvider,
  type AiPreview,
  type AiSummary,
  type AiModels,
  type AiTestResult,
  chatRequestSchema,
  type ChatEvent,
  type CvImport,
  type Dashboard,
  type EmployeeEmail,
  type TeamSendResult,
  type Email,
  type EmailTemplate,
  type EmailPreview,
  type Health,
  type InterviewQuestionInput,
  type Meeting,
  type MeetingPreview,
  type MeetingResult,
  type QuestionsProposal,
  type Scorecard,
  type SmtpTestResult,
  type Team,
  type TeamDetail,
  type TemplateVars,
  PIPELINE_STAGES,
  VERSION,
} from '@hrmit/shared'
import { demoAnswer } from './chat.ts'
import { save, store } from './store.ts'

const base = import.meta.env.BASE_URL.replace(/\/$/, '')
const notFound = () => HttpResponse.json({ error: 'not found' }, { status: 404 })
const invalid = () => HttpResponse.json({ error: 'invalid body' }, { status: 400 })
/** What a typical Ollama install reports; the demo has no Ollama to ask. */
const DEMO_OLLAMA_MODELS = ['qwen2.5:7b-instruct', 'llama3.1:8b', 'gemma3:4b']
const nextId = (rows: { id: number }[]) => Math.max(0, ...rows.map((r) => r.id)) + 1
const newestFirst = <T extends { id: number; sentAt: string }>(rows: T[]) =>
  [...rows].sort((a, b) => b.sentAt.localeCompare(a.sentAt) || b.id - a.id)

/** The demo outbox for employee messages: same placeholders as the server, status 'demo'. */
function recordEmployeeEmail(
  to: { id: number; firstName: string; lastName: string },
  text: { subject: string; body: string },
  teamId: number | null,
  sentAt: string,
): EmployeeEmail {
  const vars = {
    firstName: to.firstName,
    lastName: to.lastName,
    companyName: store.smtpSettings.companyName,
  }
  const row: EmployeeEmail = {
    id: nextId(store.employeeEmails),
    employeeId: to.id,
    teamId,
    subject: renderTemplate(text.subject, vars),
    body: renderTemplate(text.body, vars),
    status: 'demo',
    error: null,
    sentAt,
  }
  store.employeeEmails.push(row)
  return row
}
export const demoCv = (c: { firstName: string; lastName: string; email: string; phone: string }) =>
  `${c.firstName} ${c.lastName}
${c.email} | ${c.phone}

${fixtures.cvText}`

const nameConflict = () => HttpResponse.json({ error: 'name taken' }, { status: 409 })
const templateNameTaken = (name: string, key = '') =>
  store.templates.some((t) => t.key !== key && t.name?.toLowerCase() === name.toLowerCase())
const listTemplates = () =>
  [...store.templates].sort(
    (a, b) => Number(b.builtIn) - Number(a.builtIn) || (a.name ?? '').localeCompare(b.name ?? ''),
  )

/** Same substitution as the server: one template rendered for one candidate. */
function rendered(candidateId: number, key: string, extra: TemplateVars = {}) {
  const candidate = store.candidates.find((c) => c.id === candidateId)
  const job = store.jobs.find((j) => j.id === candidate?.jobId)
  const template = store.templates.find((t) => t.key === key)
  if (!candidate || !job || !template) return undefined
  const vars: TemplateVars = {
    firstName: candidate.firstName,
    lastName: candidate.lastName,
    jobTitle: job.title,
    companyName: store.smtpSettings.companyName,
    ...extra,
  }
  return {
    subject: renderTemplate(template.subject, vars),
    body: renderTemplate(template.body, vars),
  }
}
const newRoom = () => `${JITSI_PREFIX}${crypto.randomUUID()}`
const humanUtc = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`

const jobQuestions = (jobId: number) =>
  store.questions
    .filter((q) => q.jobId === jobId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
/**
 * Same contract as the server: the whole list is replaced, sortOrder is the index, rows with
 * unchanged text keep their id (and their evaluations), the rest are dropped with theirs.
 */
function replaceQuestions(jobId: number, inputs: InterviewQuestionInput[]) {
  const key = (q: InterviewQuestionInput) => `${q.competency}\n${q.question}`
  const existing = new Map(jobQuestions(jobId).map((q) => [key(q), q]))
  let id = nextId(store.questions)
  const next = inputs.map((q, sortOrder) => {
    const row = existing.get(key(q))
    existing.delete(key(q))
    return row ? { ...row, sortOrder } : { id: id++, jobId, sortOrder, ...q }
  })
  store.questions = [...store.questions.filter((q) => q.jobId !== jobId), ...next]
  const live = new Set(store.questions.map((q) => q.id))
  store.evaluations = store.evaluations.filter((e) => live.has(e.questionId))
  save()
  return jobQuestions(jobId)
}

const scorecard = (candidateId: number, jobId: number): Scorecard => ({
  candidateId,
  evaluations: jobQuestions(jobId).map(({ id, competency, question }) => {
    const e = store.evaluations.find((x) => x.candidateId === candidateId && x.questionId === id)
    return { questionId: id, competency, question, score: e?.score ?? null, note: e?.note ?? '' }
  }),
})

const byName = <T extends { lastName: string; firstName: string }>(a: T, b: T) =>
  a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)
const employeeTeams = (employeeId: number) =>
  store.teamMembers
    .filter((m) => m.employeeId === employeeId)
    .map((m) => ({ ...store.teams.find((t) => t.id === m.teamId)!, role: m.role }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ id, name, role }) => ({ id, name, role }))
const withTeams = (e: (typeof store.employees)[number]) => ({
  ...e,
  teams: employeeTeams(e.id),
  noteCount: store.employeeNotes.filter((n) => n.employeeId === e.id).length,
})
const teamCounts = (t: (typeof store.teams)[number]): Team => ({
  ...t,
  memberCount: store.teamMembers.filter((m) => m.teamId === t.id).length,
  openJobCount: store.jobs.filter((j) => j.teamId === t.id && j.status === 'open').length,
})
const teamDetail = (id: number): TeamDetail | undefined => {
  const team = store.teams.find((t) => t.id === id)
  if (!team) return undefined
  const members = store.teamMembers
    .filter((m) => m.teamId === id)
    .map((m) => ({ ...store.employees.find((e) => e.id === m.employeeId)!, role: m.role }))
    .sort((a, b) => Number(b.role === 'lead') - Number(a.role === 'lead') || byName(a, b))
  return { ...teamCounts(team), members, jobs: store.jobs.filter((j) => j.teamId === id) }
}
const nameTaken = (name: string, exceptId?: number) =>
  store.teams.some((t) => t.id !== exceptId && t.name.toLowerCase() === name.toLowerCase())
const teamIdParam = (request: Request) => {
  const raw = new URL(request.url).searchParams.get('teamId')
  if (raw === null) return undefined
  const teamId = Number(raw)
  return Number.isInteger(teamId) ? teamId : NaN
}

/**
 * Same rules as the server route (apps/server/src/routes/dashboard.ts), computed from the store so
 * a move on the board shows up here at once.
 */
function dashboard(stuckDays: number): Dashboard {
  const DAY = 86_400_000
  const now = Date.now()
  const openJobs = store.jobs.filter((j) => j.status === 'open')
  const jobOf = (c: { jobId: number }) => store.jobs.find((j) => j.id === c.jobId)!
  const person = (c: (typeof store.candidates)[number]) => ({
    candidateId: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    jobId: c.jobId,
    jobTitle: jobOf(c).title,
  })
  const active = store.candidates.filter(
    (c) => jobOf(c).status === 'open' && c.stage !== 'rejected',
  )
  const meetings = store.meetings
    .filter((m) => {
      const t = Date.parse(m.startsAt)
      return t >= now && t < now + 7 * DAY
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .map((m) => {
      const c = store.candidates.find((x) => x.id === m.candidateId)!
      return {
        ...person(c),
        id: m.id,
        startsAt: m.startsAt,
        durationMin: m.durationMin,
        jitsiUrl: m.jitsiUrl,
      }
    })
  const stuck = active
    .filter((c) => now - Date.parse(c.stageChangedAt) >= stuckDays * DAY)
    .sort((a, b) => a.stageChangedAt.localeCompare(b.stageChangedAt))
    .map((c) => ({
      ...person(c),
      stage: c.stage,
      days: Math.floor((now - Date.parse(c.stageChangedAt)) / DAY),
    }))
  const missingScores = active
    .filter((c) => c.stage === 'interview' || c.stage === 'offer')
    .map((c) => ({
      ...person(c),
      scored: store.evaluations.filter((e) => e.candidateId === c.id && e.score !== null).length,
      total: store.questions.filter((q) => q.jobId === c.jobId).length,
    }))
    .filter((r) => r.total > 0 && r.scored < r.total)
  const since = now - 30 * DAY
  const failedEmails: Dashboard['failedEmails'] = [
    ...store.emails
      .filter((e) => e.status === 'failed' && Date.parse(e.sentAt) > since)
      .map((e) => ({
        kind: 'candidate' as const,
        id: e.id,
        targetId: e.candidateId,
        jobId: store.candidates.find((c) => c.id === e.candidateId)?.jobId ?? null,
        teamId: null,
        subject: e.subject,
        sentAt: e.sentAt,
      })),
    ...store.employeeEmails
      .filter((e) => e.status === 'failed' && Date.parse(e.sentAt) > since)
      .map((e) => ({
        kind: 'employee' as const,
        id: e.id,
        targetId: e.employeeId,
        jobId: null,
        teamId: e.teamId,
        subject: e.subject,
        sentAt: e.sentAt,
      })),
  ].sort((a, b) => b.sentAt.localeCompare(a.sentAt))
  return {
    counts: {
      openJobs: openJobs.length,
      activeCandidates: active.length,
      meetingsThisWeek: meetings.length,
      teams: store.teams.length,
    },
    meetings,
    stuck,
    missingScores,
    openJobs: openJobs.map((j) => ({
      id: j.id,
      title: j.title,
      teamName: store.teams.find((t) => t.id === j.teamId)?.name ?? null,
      stages: Object.fromEntries(
        PIPELINE_STAGES.map((s) => [
          s,
          store.candidates.filter((c) => c.jobId === j.id && c.stage === s).length,
        ]),
      ) as Dashboard['openJobs'][number]['stages'],
    })),
    failedEmails,
  }
}

/** One handler per server route. Must return shapes that pass the shared zod schemas. */
export const handlers = [
  http.get(`${base}/api/health`, () =>
    HttpResponse.json<Health>({ ok: true, mode: 'demo', version: VERSION }),
  ),
  http.get(`${base}/api/dashboard`, ({ request }) => {
    const raw = new URL(request.url).searchParams.get('stuckDays')
    const stuckDays = raw === null ? 7 : Number(raw)
    if (!Number.isInteger(stuckDays) || stuckDays < 1 || stuckDays > 365)
      return HttpResponse.json({ error: 'invalid stuckDays' }, { status: 400 })
    return HttpResponse.json<Dashboard>(dashboard(stuckDays))
  }),
  http.get(`${base}/api/jobs`, ({ request }) => {
    const teamId = teamIdParam(request)
    if (Number.isNaN(teamId)) return HttpResponse.json({ error: 'invalid teamId' }, { status: 400 })
    return HttpResponse.json(
      teamId === undefined ? store.jobs : store.jobs.filter((j) => j.teamId === teamId),
    )
  }),
  http.post(`${base}/api/jobs`, async ({ request }) => {
    const body = jobInputSchema.safeParse(await request.json())
    if (!body.success) return invalid()
    if (body.data.teamId !== null && !store.teams.some((t) => t.id === body.data.teamId))
      return invalid()
    const job = { id: nextId(store.jobs), ...body.data, createdAt: new Date().toISOString() }
    store.jobs.push(job)
    save()
    return HttpResponse.json(job, { status: 201 })
  }),
  http.put(`${base}/api/jobs/:id`, async ({ params, request }) => {
    const body = jobInputSchema.safeParse(await request.json())
    if (!body.success) return invalid()
    if (body.data.teamId !== null && !store.teams.some((t) => t.id === body.data.teamId))
      return invalid()
    const job = store.jobs.find((j) => j.id === Number(params.id))
    if (!job) return notFound()
    Object.assign(job, body.data)
    save()
    return HttpResponse.json(job)
  }),
  http.get(`${base}/api/jobs/:id/candidates`, ({ params, request }) => {
    const jobId = Number(params.id)
    const raw = new URL(request.url).searchParams.get('stage')
    const stage = raw === null ? undefined : pipelineStageSchema.safeParse(raw)
    if (stage && !stage.success)
      return HttpResponse.json({ error: 'invalid stage' }, { status: 400 })
    return HttpResponse.json(
      store.candidates.filter((c) => c.jobId === jobId && (!stage || c.stage === stage.data)),
    )
  }),
  http.get(`${base}/api/jobs/:id/questions`, ({ params }) => {
    const jobId = Number(params.id)
    if (!store.jobs.some((j) => j.id === jobId)) return notFound()
    return HttpResponse.json(jobQuestions(jobId))
  }),
  http.put(`${base}/api/jobs/:id/questions`, async ({ params, request }) => {
    const body = interviewQuestionInputSchema.array().safeParse(await request.json())
    if (!body.success) return invalid()
    const jobId = Number(params.id)
    if (!store.jobs.some((j) => j.id === jobId)) return notFound()
    return HttpResponse.json(replaceQuestions(jobId, body.data))
  }),
  http.post(`${base}/api/candidates`, async ({ request }) => {
    const body = candidateInputSchema.safeParse(await request.json())
    if (!body.success) return invalid()
    const now = new Date().toISOString()
    const candidate = {
      id: nextId(store.candidates),
      ...body.data,
      stageChangedAt: now,
      cvFilename: null,
      cvText: null,
      aiSummaryJson: null,
      createdAt: now,
    }
    store.candidates.push(candidate)
    save()
    return HttpResponse.json(candidate, { status: 201 })
  }),
  http.put(`${base}/api/candidates/:id`, async ({ params, request }) => {
    const body = candidateInputSchema.safeParse(await request.json())
    if (!body.success) return invalid()
    const candidate = store.candidates.find((c) => c.id === Number(params.id))
    if (!candidate) return notFound()
    if (body.data.stage !== candidate.stage) candidate.stageChangedAt = new Date().toISOString()
    Object.assign(candidate, body.data)
    save()
    return HttpResponse.json(candidate)
  }),
  http.delete(`${base}/api/candidates/:id`, ({ params }) => {
    const i = store.candidates.findIndex((c) => c.id === Number(params.id))
    if (i < 0) return notFound()
    store.candidates.splice(i, 1)
    store.evaluations = store.evaluations.filter((e) => e.candidateId !== Number(params.id))
    store.emails = store.emails.filter((e) => e.candidateId !== Number(params.id))
    store.meetings = store.meetings.filter((m) => m.candidateId !== Number(params.id))
    save()
    return new HttpResponse(null, { status: 204 })
  }),
  http.patch(`${base}/api/candidates/:id/stage`, async ({ params, request }) => {
    const body = moveStageSchema.safeParse(await request.json())
    if (!body.success) return HttpResponse.json({ error: 'invalid stage' }, { status: 400 })
    const candidate = store.candidates.find((c) => c.id === Number(params.id))
    if (!candidate) return notFound()
    candidate.stage = body.data.stage
    candidate.stageChangedAt = new Date().toISOString()
    save()
    return HttpResponse.json(candidate)
  }),
  // Demo upload: the file is accepted and ignored; a fixture CV text is attached instead,
  // headed by the candidate's contact line so the anonymization preview has something to do.
  http.post(`${base}/api/candidates/:id/cv`, async ({ params, request }) => {
    const file = (await request.formData()).get('file')
    if (!(file instanceof File)) return invalid()
    const candidate = store.candidates.find((c) => c.id === Number(params.id))
    if (!candidate) return notFound()
    candidate.cvFilename = file.name
    candidate.cvText = demoCv(candidate)
    save()
    return HttpResponse.json(candidate)
  }),
  // No files are stored in the demo, so there is nothing to download.
  http.get(`${base}/api/candidates/:id/cv`, () => notFound()),
  http.get(`${base}/api/candidates/:id/scorecard`, ({ params }) => {
    const candidate = store.candidates.find((c) => c.id === Number(params.id))
    if (!candidate) return notFound()
    return HttpResponse.json(scorecard(candidate.id, candidate.jobId))
  }),
  http.put(`${base}/api/candidates/:id/scorecard`, async ({ params, request }) => {
    const body = evaluationSchema.array().safeParse(await request.json())
    if (!body.success) return invalid()
    const candidate = store.candidates.find((c) => c.id === Number(params.id))
    if (!candidate) return notFound()
    const valid = new Set(jobQuestions(candidate.jobId).map((q) => q.id))
    if (body.data.some((e) => !valid.has(e.questionId)))
      return HttpResponse.json({ error: 'question not in this job' }, { status: 400 })
    for (const e of body.data) {
      const row = store.evaluations.find(
        (x) => x.candidateId === candidate.id && x.questionId === e.questionId,
      )
      if (row) Object.assign(row, e)
      else store.evaluations.push({ candidateId: candidate.id, ...e })
    }
    save()
    return HttpResponse.json(scorecard(candidate.id, candidate.jobId))
  }),
  http.get(`${base}/api/settings/ai`, () => HttpResponse.json(store.aiSettings)),
  // Same key rules as the server, but only the boolean is kept: the demo never stores a key.
  http.put(`${base}/api/settings/ai`, async ({ request }) => {
    const body = aiSettingsSchema.safeParse(await request.json())
    if (!body.success) return invalid()
    const { apiKey, ...fields } = body.data
    const hasApiKey = apiKey === null ? false : apiKey ? true : store.aiSettings.hasApiKey
    store.aiSettings = { ...fields, hasApiKey }
    save()
    return HttpResponse.json(store.aiSettings)
  }),
  http.get(`${base}/api/settings/prompts`, () => HttpResponse.json(store.prompts)),
  http.put(`${base}/api/settings/prompts`, async ({ request }) => {
    const body = aiPromptsSchema.safeParse(await request.json())
    if (!body.success) return invalid()
    store.prompts = body.data
    save()
    return HttpResponse.json(store.prompts)
  }),
  // The demo has no Ollama: a fixed list after a short pause, empty for other providers.
  // No model on GitHub Pages: a scenario built from the store, streamed like the server does
  // (a pseudo tool status, then the text in small pieces), so the panel code is the same.
  http.post(`${base}/api/ai/chat`, async ({ request }) => {
    const body = chatRequestSchema.safeParse(await request.json())
    if (!body.success) return invalid()
    const { messages, context, lang } = body.data
    const { tool, text, refs } = demoAnswer(messages.at(-1)!.content, context, lang)
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = async (e: ChatEvent, ms: number) => {
          controller.enqueue(encoder.encode(JSON.stringify(e) + '\n'))
          await delay(ms)
        }
        if (tool) await send({ type: 'tool', name: tool }, 700)
        for (const piece of text.split(/(?<=s)/)) await send({ type: 'text', text: piece }, 25)
        await send({ type: 'refs', refs }, 0)
        await send({ type: 'done' }, 0)
        controller.close()
      },
    })
    return new HttpResponse(stream, {
      headers: { 'content-type': 'application/x-ndjson; charset=utf-8' },
    })
  }),
  http.get(`${base}/api/ai/models`, async () => {
    await delay(300)
    return HttpResponse.json<AiModels>({
      models: store.aiSettings.provider === 'ollama' ? DEMO_OLLAMA_MODELS : [],
    })
  }),
  // No model in the demo: the connection test always succeeds after a short pause.
  http.post(`${base}/api/ai/test`, async () => {
    await delay(600)
    return HttpResponse.json<AiTestResult>({
      ok: true,
      model: store.aiSettings.model,
      latencyMs: 600,
    })
  }),
  // Pre-recorded answers (fixtures.ai) after a model-like pause; new candidates reuse entry 1.
  ...(['summary', 'competencies'] as const).map((key) =>
    http.post(
      `${base}/api/ai/${key === 'summary' ? 'summarize' : key}/:candidateId`,
      async ({ params, request }) => {
        if (!aiActionBodySchema.safeParse(await request.json()).success) return invalid()
        const candidate = store.candidates.find((c) => c.id === Number(params.candidateId))
        if (!candidate) return notFound()
        if (!candidate.cvText) return HttpResponse.json({ error: 'no cv text' }, { status: 422 })
        await delay(1200)
        const recorded = (fixtures.ai[candidate.id] ?? fixtures.ai[1])![key]
        const aiSummaryJson: AiSummary = {
          ...candidate.aiSummaryJson,
          [key]: {
            ...recorded,
            generatedAt: new Date().toISOString(),
            model: store.aiSettings.model,
          },
        }
        candidate.aiSummaryJson = aiSummaryJson
        save()
        return HttpResponse.json(candidate)
      },
    ),
  ),
  // The fixture set of the job (new jobs reuse job 1's) after a model-like pause.
  http.post(`${base}/api/ai/questions/:jobId`, async ({ params, request }) => {
    if (!aiActionBodySchema.safeParse(await request.json()).success) return invalid()
    const jobId = Number(params.jobId)
    if (!store.jobs.some((j) => j.id === jobId)) return notFound()
    await delay(1200)
    const questions = (fixtures.questions[jobId] ?? fixtures.questions[1])!
    const applied = jobQuestions(jobId).length === 0
    if (applied) replaceQuestions(jobId, questions)
    return HttpResponse.json<QuestionsProposal>({ questions, applied })
  }),
  // Import from CV: whatever file is dropped, the demo "reads" the same fictional person.
  http.post(`${base}/api/ai/parse-cv`, async ({ request }) => {
    const file = (await request.formData()).get('file')
    if (!(file instanceof File)) return invalid()
    await delay(800)
    const f = fixtures.cvImport
    return HttpResponse.json<CvImport>({
      fields: f,
      cvText: `${f.firstName} ${f.lastName}\n${f.email} | ${f.phone}\n\n${fixtures.cvText}`,
      source: 'ai',
    })
  }),
  // The real anonymize() runs in the browser: it is pure and lives in packages/shared.
  http.get(`${base}/api/ai/preview/:candidateId`, ({ params }) => {
    const candidate = store.candidates.find((c) => c.id === Number(params.candidateId))
    if (!candidate) return notFound()
    if (!candidate.cvText) return HttpResponse.json({ error: 'no cv text' }, { status: 422 })
    const { text, replacements } = anonymize(candidate.cvText, candidate)
    return HttpResponse.json<AiPreview>({
      original: candidate.cvText,
      anonymized: text,
      replacements,
      provider: isLocalProvider(store.aiSettings) ? 'local' : 'cloud',
    })
  }),
  http.delete(`${base}/api/ai/summary/:candidateId`, ({ params }) => {
    const candidate = store.candidates.find((c) => c.id === Number(params.candidateId))
    if (!candidate) return notFound()
    candidate.aiSummaryJson = null
    save()
    return HttpResponse.json(candidate)
  }),
  http.get(`${base}/api/settings/smtp`, () => HttpResponse.json(store.smtpSettings)),
  // Same password rules as the server, but only the boolean is kept.
  http.put(`${base}/api/settings/smtp`, async ({ request }) => {
    const body = smtpSettingsSchema.safeParse(await request.json())
    if (!body.success) return invalid()
    const { pass, ...fields } = body.data
    const hasPass = pass === null ? false : pass ? true : store.smtpSettings.hasPass
    store.smtpSettings = { ...fields, hasPass }
    save()
    return HttpResponse.json(store.smtpSettings)
  }),
  // No mail server in the demo: the test always succeeds after a short pause.
  http.post(`${base}/api/settings/smtp/test`, async () => {
    await delay(600)
    return HttpResponse.json<SmtpTestResult>({ ok: true })
  }),
  // Templates (docs §6): built-ins first, custom ones by name, same rules as the server route.
  http.get(`${base}/api/templates`, () => HttpResponse.json(listTemplates())),
  http.post(`${base}/api/templates`, async ({ request }) => {
    const body = emailTemplateInputSchema.safeParse(await request.json())
    if (!body.success) return invalid()
    if (templateNameTaken(body.data.name)) return nameConflict()
    const row: EmailTemplate = { key: crypto.randomUUID(), builtIn: false, ...body.data }
    store.templates.push(row)
    save()
    return HttpResponse.json(row, { status: 201 })
  }),
  http.put(`${base}/api/templates/:key`, async ({ params, request }) => {
    const body = emailTemplateInputSchema.safeParse(await request.json())
    if (!body.success) return invalid()
    const row = store.templates.find((t) => t.key === params.key)
    if (!row) return notFound()
    if (templateNameTaken(body.data.name, row.key)) return nameConflict()
    Object.assign(row, body.data)
    save()
    return HttpResponse.json(row)
  }),
  http.delete(`${base}/api/templates/:key`, ({ params }) => {
    const row = store.templates.find((t) => t.key === params.key)
    if (!row) return notFound()
    if (row.builtIn) return HttpResponse.json({ error: 'built-in template' }, { status: 400 })
    store.templates = store.templates.filter((t) => t !== row)
    save()
    return new HttpResponse(null, { status: 204 })
  }),
  http.post(`${base}/api/templates/:key/restore`, ({ params }) => {
    const fixture = fixtures.emailTemplates.find((t) => t.key === params.key)
    const row = store.templates.find((t) => t.key === params.key)
    if (!fixture || !row) return notFound()
    Object.assign(row, fixture)
    save()
    return HttpResponse.json(row)
  }),
  http.get(`${base}/api/candidates/:id/emails`, ({ params }) => {
    if (!store.candidates.some((c) => c.id === Number(params.id))) return notFound()
    return HttpResponse.json(store.emails.filter((e) => e.candidateId === Number(params.id)))
  }),
  http.get(`${base}/api/candidates/:id/emails/preview`, ({ params, request }) => {
    const key = new URL(request.url).searchParams.get('template') ?? ''
    const r = rendered(Number(params.id), key)
    if (!r) return notFound()
    return HttpResponse.json<EmailPreview>({ templateKey: key, ...r })
  }),
  // Nothing is sent: the row lands in the candidate's history as the Outbox (docs §4.2).
  http.post(`${base}/api/candidates/:id/emails`, async ({ params, request }) => {
    const body = sendEmailInputSchema.safeParse(await request.json())
    if (!body.success) return invalid()
    if (!store.candidates.some((c) => c.id === Number(params.id))) return notFound()
    const email: Email = {
      id: nextId(store.emails),
      candidateId: Number(params.id),
      ...body.data,
      status: 'demo',
      sentAt: new Date().toISOString(),
      error: null,
    }
    store.emails.push(email)
    save()
    return HttpResponse.json(email, { status: 201 })
  }),
  http.get(`${base}/api/candidates/:id/meetings`, ({ params }) => {
    if (!store.candidates.some((c) => c.id === Number(params.id))) return notFound()
    return HttpResponse.json(
      store.meetings.filter((m) => m.candidateId === Number(params.id)).sort((a, b) => b.id - a.id),
    )
  }),
  http.get(`${base}/api/candidates/:id/meetings/preview`, ({ params, request }) => {
    const startsAt = new URL(request.url).searchParams.get('startsAt') ?? ''
    if (Number.isNaN(Date.parse(startsAt))) return invalid()
    const jitsiUrl = newRoom()
    const r = rendered(Number(params.id), 'invite', { jitsiUrl, startsAt: humanUtc(startsAt) })
    if (!r) return notFound()
    return HttpResponse.json<MeetingPreview>({ ...r, jitsiUrl })
  }),
  // The invite lands in the outbox and the meeting on the candidate page (docs §4.2).
  http.post(`${base}/api/candidates/:id/meetings`, async ({ params, request }) => {
    const body = meetingInputSchema.safeParse(await request.json())
    if (!body.success) return invalid()
    const candidateId = Number(params.id)
    const jitsiUrl = body.data.jitsiUrl ?? newRoom()
    const r = rendered(candidateId, 'invite', { jitsiUrl, startsAt: humanUtc(body.data.startsAt) })
    if (!r) return notFound()
    const email: Email = {
      id: nextId(store.emails),
      candidateId,
      templateKey: 'invite',
      subject: body.data.subject ?? r.subject,
      body: body.data.body ?? r.body,
      status: 'demo',
      sentAt: new Date().toISOString(),
      error: null,
    }
    const meeting: Meeting = {
      id: nextId(store.meetings),
      candidateId,
      startsAt: body.data.startsAt,
      durationMin: body.data.durationMin,
      jitsiUrl,
      emailId: email.id,
    }
    store.emails.push(email)
    store.meetings.push(meeting)
    save()
    return HttpResponse.json<MeetingResult>({ meeting, email }, { status: 201 })
  }),
  http.get(`${base}/api/employees`, ({ request }) => {
    const teamId = teamIdParam(request)
    if (Number.isNaN(teamId)) return HttpResponse.json({ error: 'invalid teamId' }, { status: 400 })
    const q = (new URL(request.url).searchParams.get('q') ?? '').trim().toLowerCase()
    const inTeam = new Set(
      store.teamMembers.filter((m) => m.teamId === teamId).map((m) => m.employeeId),
    )
    const rows = store.employees
      .filter((e) => teamId === undefined || inTeam.has(e.id))
      .filter(
        (e) => !q || [e.firstName, e.lastName, e.position].some((s) => s.toLowerCase().includes(q)),
      )
      .sort(byName)
    return HttpResponse.json(rows.map(withTeams))
  }),
  http.post(`${base}/api/employees`, async ({ request }) => {
    const body = employeeInputSchema.safeParse(await request.json())
    if (!body.success) return invalid()
    const employee = {
      id: nextId(store.employees),
      ...body.data,
      createdAt: new Date().toISOString(),
    }
    store.employees.push(employee)
    save()
    return HttpResponse.json(withTeams(employee), { status: 201 })
  }),
  http.get(`${base}/api/employees/:id`, ({ params }) => {
    const employee = store.employees.find((e) => e.id === Number(params.id))
    return employee ? HttpResponse.json(withTeams(employee)) : notFound()
  }),
  http.put(`${base}/api/employees/:id`, async ({ params, request }) => {
    const body = employeeInputSchema.safeParse(await request.json())
    if (!body.success) return invalid()
    const employee = store.employees.find((e) => e.id === Number(params.id))
    if (!employee) return notFound()
    Object.assign(employee, body.data)
    save()
    return HttpResponse.json(withTeams(employee))
  }),
  http.delete(`${base}/api/employees/:id`, ({ params }) => {
    const id = Number(params.id)
    const i = store.employees.findIndex((e) => e.id === id)
    if (i < 0) return notFound()
    store.employees.splice(i, 1)
    store.teamMembers = store.teamMembers.filter((m) => m.employeeId !== id)
    store.employeeNotes = store.employeeNotes.filter((n) => n.employeeId !== id)
    store.employeeEmails = store.employeeEmails.filter((m) => m.employeeId !== id)
    save()
    return new HttpResponse(null, { status: 204 })
  }),
  http.get(`${base}/api/employees/:id/notes`, ({ params }) => {
    const id = Number(params.id)
    if (!store.employees.some((e) => e.id === id)) return notFound()
    const rows = store.employeeNotes
      .filter((n) => n.employeeId === id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
    return HttpResponse.json(rows)
  }),
  http.post(`${base}/api/employees/:id/notes`, async ({ params, request }) => {
    const id = Number(params.id)
    if (!store.employees.some((e) => e.id === id)) return notFound()
    const body = employeeNoteInputSchema.safeParse(await request.json())
    if (!body.success) return invalid()
    const note = {
      id: nextId(store.employeeNotes),
      employeeId: id,
      title: body.data.title || null,
      body: body.data.body,
      createdAt: new Date().toISOString(),
    }
    store.employeeNotes.push(note)
    save()
    return HttpResponse.json(note, { status: 201 })
  }),
  http.delete(`${base}/api/employees/:id/notes/:noteId`, ({ params }) => {
    const i = store.employeeNotes.findIndex(
      (n) => n.id === Number(params.noteId) && n.employeeId === Number(params.id),
    )
    if (i < 0) return notFound()
    store.employeeNotes.splice(i, 1)
    save()
    return new HttpResponse(null, { status: 204 })
  }),
  http.get(`${base}/api/employees/:id/emails`, ({ params }) => {
    const id = Number(params.id)
    if (!store.employees.some((e) => e.id === id)) return notFound()
    return HttpResponse.json(newestFirst(store.employeeEmails.filter((m) => m.employeeId === id)))
  }),
  // Nothing is sent: the row lands in the employee's history with status 'demo' (docs §4.2).
  http.post(`${base}/api/employees/:id/emails`, async ({ params, request }) => {
    const body = sendEmployeeEmailInputSchema.safeParse(await request.json())
    if (!body.success) return invalid()
    const employee = store.employees.find((e) => e.id === Number(params.id))
    if (!employee) return notFound()
    const row = recordEmployeeEmail(employee, body.data, null, new Date().toISOString())
    save()
    return HttpResponse.json(row, { status: 201 })
  }),
  http.get(`${base}/api/teams`, () =>
    HttpResponse.json(store.teams.map(teamCounts).sort((a, b) => a.name.localeCompare(b.name))),
  ),
  http.post(`${base}/api/teams`, async ({ request }) => {
    const body = teamInputSchema.safeParse(await request.json())
    if (!body.success) return invalid()
    if (nameTaken(body.data.name))
      return HttpResponse.json({ error: 'name taken' }, { status: 409 })
    const team = { id: nextId(store.teams), ...body.data, createdAt: new Date().toISOString() }
    store.teams.push(team)
    save()
    return HttpResponse.json(teamDetail(team.id), { status: 201 })
  }),
  http.get(`${base}/api/teams/:id`, ({ params }) => {
    const team = teamDetail(Number(params.id))
    return team ? HttpResponse.json(team) : notFound()
  }),
  http.put(`${base}/api/teams/:id`, async ({ params, request }) => {
    const body = teamInputSchema.safeParse(await request.json())
    if (!body.success) return invalid()
    const team = store.teams.find((t) => t.id === Number(params.id))
    if (!team) return notFound()
    if (nameTaken(body.data.name, team.id))
      return HttpResponse.json({ error: 'name taken' }, { status: 409 })
    Object.assign(team, body.data)
    save()
    return HttpResponse.json(teamDetail(team.id))
  }),
  // Jobs keep existing without a team; memberships go with the team.
  http.delete(`${base}/api/teams/:id`, ({ params }) => {
    const id = Number(params.id)
    const i = store.teams.findIndex((t) => t.id === id)
    if (i < 0) return notFound()
    store.teams.splice(i, 1)
    store.teamMembers = store.teamMembers.filter((m) => m.teamId !== id)
    for (const job of store.jobs) if (job.teamId === id) job.teamId = null
    save()
    return new HttpResponse(null, { status: 204 })
  }),
  http.get(`${base}/api/teams/:id/emails`, ({ params }) => {
    const teamId = Number(params.id)
    if (!store.teams.some((t) => t.id === teamId)) return notFound()
    const rows = newestFirst(store.employeeEmails.filter((m) => m.teamId === teamId)).map((m) => {
      const e = store.employees.find((x) => x.id === m.employeeId)
      return { ...m, name: e ? `${e.firstName} ${e.lastName}` : '' }
    })
    return HttpResponse.json(rows)
  }),
  http.post(`${base}/api/teams/:id/emails`, async ({ params, request }) => {
    const body = sendTeamEmailInputSchema.safeParse(await request.json())
    if (!body.success) return invalid()
    const teamId = Number(params.id)
    const team = teamDetail(teamId)
    if (!team) return notFound()
    const ids = [...new Set(body.data.employeeIds)]
    const members = team.members.filter((m) => ids.includes(m.id))
    if (members.length !== ids.length) return invalid()
    const sentAt = new Date().toISOString()
    const result: TeamSendResult = {
      sent: members.map((m) => recordEmployeeEmail(m, body.data, teamId, sentAt)),
      failed: [],
    }
    save()
    return HttpResponse.json(result, { status: 201 })
  }),
  http.post(`${base}/api/teams/:id/members`, async ({ params, request }) => {
    const body = addMembersSchema.safeParse(await request.json())
    if (!body.success) return invalid()
    const teamId = Number(params.id)
    if (!store.teams.some((t) => t.id === teamId)) return notFound()
    const ids = new Set(body.data.employeeIds)
    if (![...ids].every((id) => store.employees.some((e) => e.id === id))) return invalid()
    for (const employeeId of ids)
      if (!store.teamMembers.some((m) => m.teamId === teamId && m.employeeId === employeeId))
        store.teamMembers.push({ teamId, employeeId, role: 'member' })
    save()
    return HttpResponse.json(teamDetail(teamId))
  }),
  http.patch(`${base}/api/teams/:id/members/:employeeId`, async ({ params, request }) => {
    const body = setMemberRoleSchema.safeParse(await request.json())
    if (!body.success) return invalid()
    const link = store.teamMembers.find(
      (m) => m.teamId === Number(params.id) && m.employeeId === Number(params.employeeId),
    )
    if (!link) return notFound()
    link.role = body.data.role
    save()
    return HttpResponse.json(teamDetail(link.teamId))
  }),
  http.delete(`${base}/api/teams/:id/members/:employeeId`, ({ params }) => {
    const i = store.teamMembers.findIndex(
      (m) => m.teamId === Number(params.id) && m.employeeId === Number(params.employeeId),
    )
    if (i < 0) return notFound()
    store.teamMembers.splice(i, 1)
    save()
    return new HttpResponse(null, { status: 204 })
  }),
]
