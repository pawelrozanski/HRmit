import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import {
  aiSettingsSchema,
  smtpSettingsSchema,
  type AiSettingsView,
  type SmtpSettingsView,
  type SmtpTestResult,
} from '@hrmit/shared'
import { sendMail, SmtpNotConfigured } from '../mail/send.ts'
import { getAiSettings, getSmtpSettings, setSetting } from '../settings.ts'

/** The only shapes that leave the server: each secret is reduced to a boolean. */
async function view(): Promise<AiSettingsView> {
  const { apiKey, ...rest } = await getAiSettings()
  return { ...rest, hasApiKey: apiKey !== null }
}
async function smtpView(): Promise<SmtpSettingsView> {
  const { pass, ...rest } = await getSmtpSettings()
  return { ...rest, hasPass: pass !== null }
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
  .get('/smtp', async (c) => c.json(await smtpView()))
  // Same rules for pass as for the AI key. Non-string fields are stored as their string form.
  .put('/smtp', zValidator('json', smtpSettingsSchema), async (c) => {
    const { pass, ...fields } = c.req.valid('json')
    for (const [k, v] of Object.entries(fields)) await setSetting(`smtp.${k}`, String(v))
    if (pass === null || pass) await setSetting('smtp.pass', pass)
    return c.json(await smtpView())
  })
  // A message to the sender's own address proves host, port, TLS and credentials together.
  .post('/smtp/test', async (c) => {
    const { from } = await getSmtpSettings()
    try {
      await sendMail(from, 'HRmit test email', 'Your HRmit SMTP settings work.')
      return c.json<SmtpTestResult>({ ok: true })
    } catch (err) {
      const error =
        err instanceof SmtpNotConfigured
          ? 'SMTP is not configured'
          : String(err instanceof Error ? err.message : err)
      return c.json<SmtpTestResult>({ ok: false, error })
    }
  })
