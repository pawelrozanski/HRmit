import { expect, test, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { aiTestResultSchema, candidateSchema, fixtures } from '@hrmit/shared'

// No Ollama in CI: the model call is mocked, the route and its sanitizer are real.
const generateText = vi.fn()
const generateObject = vi.fn()
vi.mock('ai', () => ({ generateText, generateObject }))
const { app } = await import('../app.ts')
const { db } = await import('../db/index.ts')
const { candidates } = await import('../db/schema.ts')

const KEY = 'sk-live-secret-123'
const testAi = async () =>
  aiTestResultSchema.parse(await (await app.request('/api/ai/test', { method: 'POST' })).json())

test('POST /api/ai/test reports ok with the model and latency', async () => {
  generateText.mockResolvedValueOnce({ text: 'OK' })
  const result = await testAi()
  expect(result).toMatchObject({ ok: true, model: 'qwen2.5:7b-instruct' })
  if (result.ok) expect(result.latencyMs).toBeGreaterThanOrEqual(0)
  expect(generateText.mock.calls[0]?.[0]).toMatchObject({ prompt: 'Reply with OK' })
})

test('POST /api/ai/test sanitizes failures: no key, no stack, no URL credentials', async () => {
  await app.request('/api/settings/ai', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      provider: 'openai-compatible',
      baseUrl: 'https://api.example.com/v1',
      model: 'm',
      apiKey: KEY,
    }),
  })
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
  await db.update(candidates).set({ cvText: fixtures.cvText }).where(eq(candidates.id, 1))

  const summary = fixtures.ai[1]!.summary
  generateObject.mockResolvedValueOnce({ object: summary })
  const res = await act('summarize', 1)
  expect(res.status).toBe(200)
  const c1 = candidateSchema.parse(await res.json())
  expect(c1.aiSummaryJson?.summary).toMatchObject({ ...summary, model: 'm' })
  expect(c1.aiSummaryJson?.competencies).toBeUndefined()
  // Prompt hygiene: CV, job text and the language, nothing personal.
  const prompt = generateObject.mock.calls[0]?.[0].prompt as string
  expect(prompt).toContain(fixtures.cvText)
  expect(prompt).toContain(fixtures.jobs[0]!.title)
  expect(prompt).toContain('Polish')
  expect(prompt).not.toContain(fixtures.candidates[0]!.email)
  expect(prompt).not.toContain(fixtures.candidates[0]!.lastName)
  expect(prompt).not.toContain(fixtures.candidates[0]!.notes)

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

  const gone = await app.request('/api/ai/summary/1', { method: 'DELETE' })
  expect(candidateSchema.parse(await gone.json()).aiSummaryJson).toBeNull()
  expect((await app.request('/api/ai/summary/9999', { method: 'DELETE' })).status).toBe(404)
})
