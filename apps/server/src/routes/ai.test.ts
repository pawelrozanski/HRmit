import { expect, test, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import {
  AI_SETTINGS_DEFAULTS,
  aiModelsSchema,
  aiPreviewSchema,
  aiTestResultSchema,
  candidateSchema,
  fixtures,
  interviewQuestionSchema,
  questionsProposalSchema,
} from '@hrmit/shared'

// No Ollama in CI: the model call is mocked, the route and its sanitizer are real.
const generateText = vi.fn()
const generateObject = vi.fn()
vi.mock('ai', () => ({ generateText, generateObject }))
// Opt-in prompt log: must be set before the route module reads it.
process.env.HRMIT_LOG_PROMPTS = '1'
const { app } = await import('../app.ts')
const { db } = await import('../db/index.ts')
const { candidates, jobs } = await import('../db/schema.ts')

const KEY = 'sk-live-secret-123'
const testAi = async () =>
  aiTestResultSchema.parse(await (await app.request('/api/ai/test', { method: 'POST' })).json())
const putSettings = (json: object) =>
  app.request('/api/settings/ai', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(json),
  })
const CLOUD = { provider: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', model: 'm' }
const amelia = fixtures.candidates[0]!
// The CV as a real one would look: the fixture text plus a header with the contact details.
const CV = `${amelia.firstName} ${amelia.lastName}
${amelia.email} | ${amelia.phone}

${fixtures.cvText}`

test('POST /api/ai/test reports ok with the model and latency', async () => {
  generateText.mockResolvedValueOnce({ text: 'OK' })
  const result = await testAi()
  expect(result).toMatchObject({ ok: true, model: 'qwen2.5:7b-instruct' })
  if (result.ok) expect(result.latencyMs).toBeGreaterThanOrEqual(0)
  expect(generateText.mock.calls[0]?.[0]).toMatchObject({ prompt: 'Reply with OK' })
})

test('POST /api/ai/test sanitizes failures: no key, no stack, no URL credentials', async () => {
  await putSettings({ ...CLOUD, apiKey: KEY })
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  generateText.mockRejectedValueOnce(
    new Error(
      `401 Unauthorized for https://user:${KEY}@api.example.com/v1 with key ${KEY}\n  at x`,
    ),
  )
  const result = await testAi()
  expect(result.ok).toBe(false)
  if (!result.ok) {
    expect(result.error).not.toContain(KEY)
    expect(result.error).not.toContain('at x')
    expect(result.error).toContain('[redacted]')
  }
  expect(warn.mock.calls[0]?.[0]).not.toContain(KEY)
  warn.mockRestore()
})

const act = (kind: string, id: number) =>
  app.request(`/api/ai/${kind}/${id}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ lang: 'pl' }),
  })

test('AI actions: 404, 422 without CV text, then summary and competencies merged and discarded', async () => {
  expect((await act('summarize', 9999)).status).toBe(404)
  expect((await act('summarize', 1)).status).toBe(422)
  expect((await app.request('/api/ai/preview/1')).status).toBe(422)
  await db.update(candidates).set({ cvText: CV }).where(eq(candidates.id, 1))

  // Cloud provider (set by the previous test): the captured prompt is anonymized.
  const summary = fixtures.ai[1]!.summary
  generateObject.mockResolvedValueOnce({ object: summary })
  const res = await act('summarize', 1)
  expect(res.status).toBe(200)
  const c1 = candidateSchema.parse(await res.json())
  expect(c1.aiSummaryJson?.summary).toMatchObject({ ...summary, model: 'm' })
  expect(c1.aiSummaryJson?.competencies).toBeUndefined()
  const prompt = generateObject.mock.calls[0]?.[0].prompt as string
  expect(prompt).toContain(fixtures.cvText)
  expect(prompt).toContain(fixtures.jobs[0]!.title)
  expect(prompt).toContain('Polish')
  expect(prompt).toContain('Candidate #1')
  expect(prompt).toContain('[email]')
  expect(prompt).toContain('[phone]')
  const note = fixtures.candidateNotes.find((n) => n.candidateId === amelia.id)!.body
  for (const pii of [amelia.firstName, amelia.lastName, amelia.email, amelia.phone, note])
    expect(prompt).not.toContain(pii)

  const competencies = fixtures.ai[1]!.competencies
  generateObject.mockResolvedValueOnce({ object: competencies })
  const c2 = candidateSchema.parse(await (await act('competencies', 1)).json())
  expect(c2.aiSummaryJson?.summary).toEqual(c1.aiSummaryJson?.summary)
  expect(c2.aiSummaryJson?.competencies).toMatchObject(competencies)

  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  generateObject.mockRejectedValueOnce(new Error('ECONNREFUSED 127.0.0.1:11434\n  at x'))
  const failed = await act('summarize', 1)
  expect(failed.status).toBe(502)
  expect(await failed.json()).toEqual({ error: 'ECONNREFUSED 127.0.0.1:11434' })
  warn.mockRestore()

  // Local provider: the full CV is sent, nothing is replaced. The debug log still only
  // ever sees the anonymized prompt.
  await putSettings(AI_SETTINGS_DEFAULTS)
  const logged = vi.spyOn(console, 'log').mockImplementation(() => {})
  generateObject.mockResolvedValueOnce({ object: summary })
  await act('summarize', 1)
  const localPrompt = generateObject.mock.calls.at(-1)?.[0].prompt as string
  expect(localPrompt).toContain(CV)
  expect(localPrompt).not.toContain('Candidate #1')
  const line = logged.mock.calls.map((c) => String(c[0])).find((l) => l.includes('ai prompt'))
  expect(line).toContain('Candidate #1')
  expect(line).not.toContain(amelia.lastName)
  logged.mockRestore()

  const gone = await app.request('/api/ai/summary/1', { method: 'DELETE' })
  expect(candidateSchema.parse(await gone.json()).aiSummaryJson).toBeNull()
  expect((await app.request('/api/ai/summary/9999', { method: 'DELETE' })).status).toBe(404)
})

test('POST /api/ai/requirements: numbered prompt, answer zipped with the job lines, 422 without requirements', async () => {
  await putSettings({ ...CLOUD, apiKey: KEY })
  // The model answers line 3 first, repeats 1 and invents 99: order and text come from the job.
  generateObject.mockResolvedValueOnce({
    object: {
      items: [
        { index: 3, status: 'partial', evidence: 'WCAG audits at an agency.' },
        { index: 1, status: 'met', evidence: 'Four years of React.' },
        { index: 1, status: 'missing', evidence: 'ignored duplicate' },
        { index: 99, status: 'met', evidence: 'made up' },
      ],
    },
  })
  const c = candidateSchema.parse(await (await act('requirements', 1)).json())
  const job = fixtures.jobs[0]!
  const [first, , third] = job.requirements.split('\n')
  expect(c.aiSummaryJson?.requirements?.items).toEqual([
    { requirement: first, kind: 'required', status: 'met', evidence: 'Four years of React.' },
    {
      requirement: third,
      kind: 'required',
      status: 'partial',
      evidence: 'WCAG audits at an agency.',
    },
  ])
  const prompt = generateObject.mock.calls.at(-1)?.[0].prompt as string
  expect(prompt).toContain(`1. ${first}`)
  expect(prompt).toContain('5. Testing Library or Playwright (nice to have)')
  expect(prompt).toContain('Candidate #1')
  for (const pii of [amelia.lastName, amelia.email, amelia.phone]) expect(prompt).not.toContain(pii)
  expect(prompt).not.toContain(String(job.salaryMin))

  // A job without requirements has nothing to compare against.
  await db.update(jobs).set({ requirements: '', niceToHave: '' }).where(eq(jobs.id, 1))
  expect((await act('requirements', 1)).status).toBe(422)
  await db
    .update(jobs)
    .set({ requirements: job.requirements, niceToHave: job.niceToHave })
    .where(eq(jobs.id, 1))
  await putSettings(AI_SETTINGS_DEFAULTS)
})

test('any catalog cloud provider gets the anonymized prompt (openai)', async () => {
  expect((await putSettings({ provider: 'openai', baseUrl: '', model: 'gpt-x' })).status).toBe(400)
  await putSettings({ provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-x' })
  generateObject.mockResolvedValueOnce({ object: fixtures.ai[1]!.summary })
  expect((await act('summarize', 1)).status).toBe(200)
  const prompt = generateObject.mock.calls.at(-1)?.[0].prompt as string
  expect(prompt).toContain('Candidate #1')
  expect(prompt).not.toContain(amelia.lastName)
  await putSettings(AI_SETTINGS_DEFAULTS)
})

test('GET /api/ai/models lists Ollama tags, empty for cloud, sanitized on failure', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch')
  fetchMock.mockResolvedValueOnce(
    Response.json({ models: [{ name: 'qwen2.5:7b-instruct' }, { name: 'gemma3:4b' }] }),
  )
  const res = await app.request('/api/ai/models')
  expect(res.status).toBe(200)
  expect(aiModelsSchema.parse(await res.json())).toEqual({
    models: ['qwen2.5:7b-instruct', 'gemma3:4b'],
  })
  expect(fetchMock).toHaveBeenLastCalledWith('http://localhost:11434/api/tags')

  fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED 127.0.0.1:11434\n  at x'))
  const failed = await app.request('/api/ai/models')
  expect(failed.status).toBe(502)
  expect(await failed.json()).toEqual({ error: 'ECONNREFUSED 127.0.0.1:11434' })

  fetchMock.mockClear()
  await putSettings({ ...CLOUD, apiKey: KEY })
  expect(await (await app.request('/api/ai/models')).json()).toEqual({ models: [] })
  expect(fetchMock).not.toHaveBeenCalled()
  fetchMock.mockRestore()
  await putSettings(AI_SETTINGS_DEFAULTS)
})

test('GET /api/ai/preview/:id shows original next to anonymized and names the provider', async () => {
  expect((await app.request('/api/ai/preview/9999')).status).toBe(404)
  const local = aiPreviewSchema.parse(await (await app.request('/api/ai/preview/1')).json())
  expect(local.provider).toBe('local')
  expect(local.original).toBe(CV)
  expect(local.anonymized).toContain('Candidate #1')
  expect(local.anonymized).not.toContain(amelia.lastName)
  expect(local.replacements).toEqual([
    { kind: 'email', count: 1 },
    { kind: 'phone', count: 1 },
    { kind: 'name', count: 1 },
  ])
  await putSettings(CLOUD)
  const cloud = aiPreviewSchema.parse(await (await app.request('/api/ai/preview/1')).json())
  expect(cloud.provider).toBe('cloud')
})

test('POST /api/ai/questions/:jobId: job fields only in the prompt, applied only to an empty list', async () => {
  expect((await act('questions', 9999)).status).toBe(404)
  const set = fixtures.questions[1]!
  // Job 1 is seeded with questions: the result is a proposal and the list is untouched.
  // Settings are still cloud (previous test): the description is anonymized, the title is kept.
  const job = fixtures.jobs[0]!
  await db
    .update(jobs)
    .set({ description: `${job.description} Contact jobs@example.com.` })
    .where(eq(jobs.id, 1))
  generateObject.mockResolvedValueOnce({ object: { questions: set } })
  const proposal = questionsProposalSchema.parse(await (await act('questions', 1)).json())
  expect(proposal).toEqual({ questions: set, applied: false })
  const before = interviewQuestionSchema
    .array()
    .parse(await (await app.request('/api/jobs/1/questions')).json())
  expect(before.map((q) => q.question)).toEqual(set.map((q) => q.question))
  const prompt = generateObject.mock.calls.at(-1)?.[0].prompt as string
  expect(prompt).toContain(job.title)
  expect(prompt).toContain(job.description)
  expect(prompt).toContain('Level: mid')
  expect(prompt).toContain('Requirements:\nAt least 2 years')
  expect(prompt).toContain('Nice to have:\nTesting Library')
  expect(prompt).not.toContain('14000')
  expect(prompt).toContain('[email]')
  expect(prompt).toContain('Polish')
  for (const c of fixtures.candidates)
    for (const pii of [c.firstName, c.lastName, c.email, c.phone]) expect(prompt).not.toContain(pii)
  for (const n of fixtures.candidateNotes) expect(prompt).not.toContain(n.body)
  expect(prompt).not.toContain(CV)

  // A new job has no questions: the generated set is stored.
  const created = await app.request('/api/jobs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'QA Engineer', description: 'Manual and automated testing.' }),
  })
  const { id } = (await created.json()) as { id: number }
  generateObject.mockResolvedValueOnce({ object: { questions: set } })
  const applied = questionsProposalSchema.parse(await (await act('questions', id)).json())
  expect(applied.applied).toBe(true)
  const stored = interviewQuestionSchema
    .array()
    .parse(await (await app.request(`/api/jobs/${id}/questions`)).json())
  expect(stored.map((q) => q.question)).toEqual(set.map((q) => q.question))
  expect(stored.map((q) => q.sortOrder)).toEqual(set.map((_, i) => i))

  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  generateObject.mockRejectedValueOnce(new Error('boom'))
  expect((await act('questions', id)).status).toBe(502)
  warn.mockRestore()
})
