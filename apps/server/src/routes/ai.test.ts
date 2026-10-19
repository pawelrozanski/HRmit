import { expect, test, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import {
  AI_SETTINGS_DEFAULTS,
  aiPreviewSchema,
  aiTestResultSchema,
  candidateSchema,
  fixtures,
} from '@hrmit/shared'

// No Ollama in CI: the model call is mocked, the route and its sanitizer are real.
const generateText = vi.fn()
const generateObject = vi.fn()
vi.mock('ai', () => ({ generateText, generateObject }))
// Opt-in prompt log: must be set before the route module reads it.
process.env.HRMIT_LOG_PROMPTS = '1'
const { app } = await import('../app.ts')
const { db } = await import('../db/index.ts')
const { candidates } = await import('../db/schema.ts')

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
  for (const pii of [amelia.firstName, amelia.lastName, amelia.email, amelia.phone, amelia.notes])
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
