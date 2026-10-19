import { eq } from 'drizzle-orm'
import { expect, test, vi } from 'vitest'
import {
  emailPreviewSchema,
  emailSchema,
  emailTemplateSchema,
  fixtures,
  smtpSettingsViewSchema,
  smtpTestResultSchema,
} from '@hrmit/shared'

// No SMTP in CI: the transport is mocked, the routes, the settings and the sanitizer are real.
const sendMail = vi.fn()
vi.mock('nodemailer', () => ({ createTransport: () => ({ sendMail }) }))
const { app } = await import('../app.ts')
const { db } = await import('../db/index.ts')
const { settings } = await import('../db/schema.ts')

const PASS = 'hunter2-very-secret'
const SMTP = {
  host: 'smtp.example.test',
  port: 2525,
  secure: false,
  user: 'bob',
  from: 'hr@example.test',
  companyName: 'Acme',
}
const json = (method: string, path: string, body: unknown) =>
  app.request(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
const getSmtp = async () =>
  smtpSettingsViewSchema.parse(await (await app.request('/api/settings/smtp')).json())
const amelia = fixtures.candidates[0]!

test('SMTP settings: password encrypted at rest, never returned, same keep/replace/clear rules', async () => {
  expect((await getSmtp()).hasPass).toBe(false)
  const res = await json('PUT', '/api/settings/smtp', { ...SMTP, pass: PASS })
  expect(res.status).toBe(200)
  expect(await res.text()).not.toContain(PASS)
  expect(await getSmtp()).toEqual({ ...SMTP, hasPass: true })
  const [row] = await db.select().from(settings).where(eq(settings.key, 'smtp.pass'))
  expect(row?.value).toBeDefined()
  expect(row?.value).not.toContain(PASS)
  expect((await (await json('PUT', '/api/settings/smtp', SMTP)).json()).hasPass).toBe(true)
  expect(
    (await (await json('PUT', '/api/settings/smtp', { ...SMTP, pass: '' })).json()).hasPass,
  ).toBe(true)
  expect(await (await json('PUT', '/api/settings/smtp', { ...SMTP, from: 'nope' })).status).toBe(
    400,
  )
})

test('POST /api/settings/smtp/test sends to the from address and sanitizes failures', async () => {
  sendMail.mockResolvedValueOnce({})
  const ok = smtpTestResultSchema.parse(
    await (await app.request('/api/settings/smtp/test', { method: 'POST' })).json(),
  )
  expect(ok).toEqual({ ok: true })
  expect(sendMail.mock.calls[0]?.[0]).toMatchObject({
    to: SMTP.from,
    from: { name: 'Acme', address: SMTP.from },
  })
  expect(sendMail.mock.calls[0]?.[0]).not.toHaveProperty('html')

  sendMail.mockRejectedValueOnce(new Error(`535 auth failed for ${PASS}\n  at smtp.js:1`))
  const failed = smtpTestResultSchema.parse(
    await (await app.request('/api/settings/smtp/test', { method: 'POST' })).json(),
  )
  expect(failed.ok).toBe(false)
  if (!failed.ok) {
    expect(failed.error).not.toContain(PASS)
    expect(failed.error).not.toContain('at smtp')
  }
})

test('templates: seeded, listed, replaced per key', async () => {
  const list = emailTemplateSchema.array().parse(await (await app.request('/api/templates')).json())
  expect(list.map((t) => t.key)).toEqual(['invite', 'rejection', 'reminder'])
  const res = await json('PUT', '/api/templates', [
    { key: 'rejection', subject: 'Re: {{jobTitle}}', body: 'Dear {{firstName}} {{lastName}}, no.' },
  ])
  expect(res.status).toBe(200)
  const after = emailTemplateSchema.array().parse(await res.json())
  expect(after.find((t) => t.key === 'rejection')?.subject).toBe('Re: {{jobTitle}}')
  expect(after).toHaveLength(3)
  expect(
    (await json('PUT', '/api/templates', [{ key: 'offer', subject: 'x', body: 'y' }])).status,
  ).toBe(400)
})

test('preview renders the placeholders; unknown template is 404', async () => {
  const res = await app.request('/api/candidates/1/emails/preview?template=rejection')
  expect(res.status).toBe(200)
  const preview = emailPreviewSchema.parse(await res.json())
  expect(preview.subject).toBe('Re: Frontend Developer (React)')
  expect(preview.body).toBe(`Dear ${amelia.firstName} ${amelia.lastName}, no.`)
  expect((await app.request('/api/candidates/1/emails/preview?template=offer')).status).toBe(404)
  expect((await app.request('/api/candidates/999/emails/preview?template=invite')).status).toBe(404)
})

test('send records sent and failed rows, 404 unknown candidate, 409 without SMTP', async () => {
  const input = { templateKey: 'rejection', subject: 'Subject', body: 'Body with <b>no html</b>' }
  sendMail.mockResolvedValueOnce({})
  const info = vi.spyOn(console, 'log').mockImplementation(() => {})
  const res = await json('POST', '/api/candidates/1/emails', input)
  expect(res.status).toBe(201)
  const sent = emailSchema.parse(await res.json())
  expect(sent).toMatchObject({ candidateId: 1, status: 'sent', error: null, ...input })
  expect(sendMail.mock.lastCall?.[0]).toMatchObject({ to: amelia.email, text: input.body })
  // The log line carries ids and the status, never the candidate's address or the text.
  const line = String(info.mock.calls.find((c) => String(c[0]).includes('"email"'))?.[0])
  expect(line).not.toContain(amelia.email)
  expect(line).not.toContain('Subject')
  info.mockRestore()

  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  sendMail.mockRejectedValueOnce(new Error(`connect ECONNREFUSED ${PASS}`))
  const failed = emailSchema.parse(
    await (await json('POST', '/api/candidates/1/emails', input)).json(),
  )
  expect(failed.status).toBe('failed')
  expect(failed.error).toContain('ECONNREFUSED')
  expect(failed.error).not.toContain(PASS)
  warn.mockRestore()

  const history = emailSchema
    .array()
    .parse(await (await app.request('/api/candidates/1/emails')).json())
  expect(history.map((e) => e.status)).toEqual(['sent', 'failed'])
  expect((await app.request('/api/candidates/999/emails')).status).toBe(404)
  expect((await json('POST', '/api/candidates/999/emails', input)).status).toBe(404)

  await db.delete(settings).where(eq(settings.key, 'smtp.host'))
  expect((await json('POST', '/api/candidates/1/emails', input)).status).toBe(409)
})
