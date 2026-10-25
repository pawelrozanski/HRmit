import { eq } from 'drizzle-orm'
import { expect, test, vi } from 'vitest'
import { AI_SETTINGS_DEFAULTS, aiSettingsViewSchema } from '@hrmit/shared'
import { app } from '../app.ts'
import { db } from '../db/index.ts'
import { settings } from '../db/schema.ts'

const KEY = 'sk-ant-api03-very-secret'
const put = (body: unknown) =>
  app.request('/api/settings/ai', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
const get = async () =>
  aiSettingsViewSchema.parse(await (await app.request('/api/settings/ai')).json())

test('GET /api/settings/ai returns the defaults on a fresh install', async () => {
  expect(await get()).toEqual(AI_SETTINGS_DEFAULTS)
})

test('PUT stores the key encrypted and GET never returns it', async () => {
  const body = {
    provider: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-x',
    chatEmployees: false,
  }
  const res = await put({ ...body, apiKey: KEY })
  expect(res.status).toBe(200)
  expect(await res.text()).not.toContain(KEY)
  expect(await get()).toEqual({ ...body, hasApiKey: true })

  const [row] = await db.select().from(settings).where(eq(settings.key, 'ai.apiKey'))
  expect(row?.value).toBeDefined()
  expect(row?.value).not.toContain(KEY)

  // Omitted and empty keep the stored key.
  expect((await (await put(body)).json()).hasApiKey).toBe(true)
  expect((await (await put({ ...body, apiKey: '' })).json()).hasApiKey).toBe(true)
  // Explicit null clears it.
  expect((await (await put({ ...body, apiKey: null })).json()).hasApiKey).toBe(false)

  expect((await put({ ...body, baseUrl: 'not a url' })).status).toBe(400)
  expect((await put({ ...body, provider: 'nope' })).status).toBe(400)
})

test('a provider id from before 0.3.3 reads as custom', async () => {
  await db
    .insert(settings)
    .values({ key: 'ai.provider', value: 'openai-compatible' })
    .onConflictDoUpdate({ target: settings.key, set: { value: 'openai-compatible' } })
  expect((await get()).provider).toBe('custom')
})

test('a blob encrypted under another master.key reads as no key, not a 500', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  await db
    .insert(settings)
    .values({ key: 'ai.apiKey', value: 'AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAA.AAAA' })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: 'AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAA.AAAA' },
    })
  expect((await get()).hasApiKey).toBe(false)
  expect(warn).toHaveBeenCalled()
  warn.mockRestore()
})

test('prompts: defaults, an edit is stored, the default text is not', async () => {
  const { AI_PROMPT_DEFAULTS, aiPromptsSchema } = await import('@hrmit/shared')
  const { summarizePrompt } = await import('../ai/prompts/summarize.ts')
  const get = async () =>
    aiPromptsSchema.parse(await (await app.request('/api/settings/prompts')).json())
  expect(await get()).toEqual(AI_PROMPT_DEFAULTS)
  const custom = { ...AI_PROMPT_DEFAULTS, summarize: 'Summarize in {{lang}}, two lines.' }
  const res = await app.request('/api/settings/prompts', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(custom),
  })
  expect(res.status).toBe(200)
  expect(await get()).toEqual(custom)
  const rows = await db.select().from(settings)
  expect(rows.map((r) => r.key).filter((k) => k.startsWith('ai.prompt.'))).toEqual([
    'ai.prompt.summarize',
  ])
  expect(summarizePrompt({ title: 'T', description: 'D' }, 'CV', 'pl', custom.summarize)).toBe(
    'Summarize in Polish, two lines.\n\nJob title: T\nJob description: D\n\nCV:\nCV',
  )
  const empty = await app.request('/api/settings/prompts', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...custom, chat: '' }),
  })
  expect(empty.status).toBe(400)
})
