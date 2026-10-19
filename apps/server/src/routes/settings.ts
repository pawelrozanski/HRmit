import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { aiSettingsSchema, type AiSettingsView } from '@hrmit/shared'
import { getAiSettings, setSetting } from '../settings.ts'

/** The only shape that leaves the server: the key is reduced to a boolean. */
async function view(): Promise<AiSettingsView> {
  const { apiKey, ...rest } = await getAiSettings()
  return { ...rest, hasApiKey: apiKey !== null }
}

export const settingsRoute = new Hono()
  .get('/ai', async (c) => c.json(await view()))
  // apiKey omitted or '' keeps the stored key, a string replaces it, null removes it.
  .put('/ai', zValidator('json', aiSettingsSchema), async (c) => {
    const { apiKey, ...fields } = c.req.valid('json')
    for (const [k, v] of Object.entries(fields)) await setSetting(`ai.${k}`, v)
    if (apiKey === null || apiKey) await setSetting('ai.apiKey', apiKey)
    return c.json(await view())
  })
