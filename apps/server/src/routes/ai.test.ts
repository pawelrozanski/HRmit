import { expect, test, vi } from 'vitest'
import { aiTestResultSchema } from '@hrmit/shared'

// No Ollama in CI: the model call is mocked, the route and its sanitizer are real.
const generateText = vi.fn()
vi.mock('ai', () => ({ generateText }))
const { app } = await import('../app.ts')

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
