import { HttpResponse, delay, http } from 'msw'
import {
  aiActionBodySchema,
  aiSettingsSchema,
  anonymize,
  candidateInputSchema,
  fixtures,
  interviewQuestionInputSchema,
  jobInputSchema,
  moveStageSchema,
  pipelineStageSchema,
  isLocalProvider,
  type AiPreview,
  type AiSummary,
  type AiTestResult,
  type Health,
  type InterviewQuestionInput,
  type QuestionsProposal,
} from '@hrmit/shared'
import { save, store } from './store.ts'

const base = import.meta.env.BASE_URL.replace(/\/$/, '')
const notFound = () => HttpResponse.json({ error: 'not found' }, { status: 404 })
const invalid = () => HttpResponse.json({ error: 'invalid body' }, { status: 400 })
const nextId = (rows: { id: number }[]) => Math.max(0, ...rows.map((r) => r.id)) + 1
export const demoCv = (c: { firstName: string; lastName: string; email: string; phone: string }) =>
  `${c.firstName} ${c.lastName}
${c.email} | ${c.phone}

${fixtures.cvText}`

const jobQuestions = (jobId: number) =>
  store.questions
    .filter((q) => q.jobId === jobId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
/** Same contract as the server: the whole list is replaced, sortOrder is the index. */
function replaceQuestions(jobId: number, inputs: InterviewQuestionInput[]) {
  store.questions = store.questions.filter((q) => q.jobId !== jobId)
  let id = nextId(store.questions)
  store.questions.push(...inputs.map((q, sortOrder) => ({ id: id++, jobId, sortOrder, ...q })))
  save()
  return jobQuestions(jobId)
}

/** One handler per server route. Must return shapes that pass the shared zod schemas. */
export const handlers = [
  http.get(`${base}/api/health`, () =>
    HttpResponse.json<Health>({ ok: true, mode: 'demo', version: '0.0.0' }),
  ),
  http.get(`${base}/api/jobs`, () => HttpResponse.json(store.jobs)),
  http.post(`${base}/api/jobs`, async ({ request }) => {
    const body = jobInputSchema.safeParse(await request.json())
    if (!body.success) return invalid()
    const job = { id: nextId(store.jobs), ...body.data, createdAt: new Date().toISOString() }
    store.jobs.push(job)
    save()
    return HttpResponse.json(job, { status: 201 })
  }),
  http.put(`${base}/api/jobs/:id`, async ({ params, request }) => {
    const body = jobInputSchema.safeParse(await request.json())
    if (!body.success) return invalid()
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
]
