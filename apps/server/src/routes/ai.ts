import { generateText } from 'ai'
import { Hono } from 'hono'
import type { AiTestResult } from '@hrmit/shared'
import { createModel } from '../ai/provider.ts'
import { log } from '../log.ts'
import { getAiSettings } from '../settings.ts'

/** Error text safe for the UI and the log: no key, no stack, no credentials inside URLs. */
function sanitize(err: unknown, apiKey: string | null): string {
  let msg = (err instanceof Error ? err.message : String(err)).split('\n')[0] ?? ''
  if (apiKey) msg = msg.replaceAll(apiKey, '[redacted]')
  msg = msg.replace(/(https?:\/\/)[^/\s@]+@/g, '$1[redacted]@')
  return msg.slice(0, 300) || 'Unknown error'
}

export const aiRoute = new Hono()
  // Connection check: a trivial prompt through the configured provider.
  .post('/test', async (c) => {
    const settings = await getAiSettings()
    const started = performance.now()
    try {
      await generateText({
        model: createModel(settings),
        prompt: 'Reply with OK',
        maxOutputTokens: 8,
      })
      const latencyMs = Math.round(performance.now() - started)
      return c.json<AiTestResult>({ ok: true, model: settings.model, latencyMs })
    } catch (err) {
      const error = sanitize(err, settings.apiKey)
      log.warn('ai test failed', { provider: settings.provider, model: settings.model, error })
      return c.json<AiTestResult>({ ok: false, error })
    }
  })
