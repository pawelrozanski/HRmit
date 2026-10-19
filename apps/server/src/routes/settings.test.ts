import { eq } from 'drizzle-orm'
import { expect, test } from 'vitest'
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
  const body = { provider: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-x' }
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
  expect((await put({ ...body, provider: 'openai' })).status).toBe(400)
})
