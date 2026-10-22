import { eq } from 'drizzle-orm'
import { expect, test, vi } from 'vitest'
import { employeeEmailSchema, teamEmailSchema, teamSendResultSchema } from '@hrmit/shared'

// No SMTP in CI: the transport is mocked, the routes and the sanitizer are real.
const sendMail = vi.fn()
vi.mock('nodemailer', () => ({ createTransport: () => ({ sendMail }) }))
const { app } = await import('../app.ts')
const { db } = await import('../db/index.ts')
const { employeeEmails, settings } = await import('../db/schema.ts')

const PASS = 'hunter2-very-secret'
const json = (method: string, path: string, body: unknown) =>
  app.request(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
const text = {
  subject: 'Panel on {{firstName}}',
  body: 'Hi {{firstName}} {{lastName}}, from {{companyName}}.',
}

test('employee message: 409 without SMTP, sent and failed rows, placeholders, log hygiene', async () => {
  expect((await json('POST', '/api/employees/4/emails', text)).status).toBe(409)
  expect((await app.request('/api/employees/4/emails')).status).toBe(200)
  expect(await (await app.request('/api/employees/4/emails')).json()).toEqual([])
  await json('PUT', '/api/settings/smtp', {
    host: 'smtp.example.test',
    port: 2525,
    secure: false,
    user: 'bob',
    pass: PASS,
    from: 'hr@example.test',
    companyName: 'Acme',
  })

  sendMail.mockResolvedValueOnce({})
  const info = vi.spyOn(console, 'log').mockImplementation(() => {})
  const res = await json('POST', '/api/employees/4/emails', text)
  expect(res.status).toBe(201)
  const sent = employeeEmailSchema.parse(await res.json())
  expect(sent).toMatchObject({
    employeeId: 4,
    teamId: null,
    status: 'sent',
    error: null,
    subject: 'Panel on Hanna',
    body: 'Hi Hanna Sorlie, from Acme.',
  })
  expect(sendMail.mock.lastCall?.[0]).toMatchObject({
    to: 'hanna.sorlie@example.com',
    text: sent.body,
  })
  expect(sendMail.mock.lastCall?.[0]).not.toHaveProperty('html')
  const line = String(info.mock.calls.find((c) => String(c[0]).includes('employee-email'))?.[0])
  expect(line).toContain('"employeeId":4')
  expect(line).not.toContain('example.com')
  expect(line).not.toContain('Hanna')
  expect(line).not.toContain('Panel')
  info.mockRestore()

  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  sendMail.mockRejectedValueOnce(new Error(`connect ECONNREFUSED ${PASS}\n at smtp.js:1`))
  const failed = employeeEmailSchema.parse(
    await (await json('POST', '/api/employees/4/emails', text)).json(),
  )
  expect(failed.status).toBe('failed')
  expect(failed.error).toContain('ECONNREFUSED')
  expect(failed.error).not.toContain(PASS)
  expect(failed.error).not.toContain('at smtp')
  expect(String(warn.mock.lastCall?.[0])).not.toContain(PASS)
  warn.mockRestore()

  const history = employeeEmailSchema
    .array()
    .parse(await (await app.request('/api/employees/4/emails')).json())
  expect(history.map((e) => e.status)).toEqual(['failed', 'sent'])
  expect((await json('POST', '/api/employees/4/emails', { subject: '', body: 'x' })).status).toBe(
    400,
  )
  expect((await json('POST', '/api/employees/9999/emails', text)).status).toBe(404)
  expect((await app.request('/api/employees/9999/emails')).status).toBe(404)
})

test('team message: one mail per member, non-member 400, failures named, history with names', async () => {
  // IT (team 2): Hanna (4, lead), Kacper (5), Leila (6), 7. Margaret (1) is in Sales only.
  expect((await json('POST', '/api/teams/2/emails', { ...text, employeeIds: [4, 1] })).status).toBe(
    400,
  )
  expect((await json('POST', '/api/teams/2/emails', { ...text, employeeIds: [] })).status).toBe(400)
  expect((await json('POST', '/api/teams/999/emails', { ...text, employeeIds: [4] })).status).toBe(
    404,
  )
  sendMail.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('450 mailbox busy'))
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const info = vi.spyOn(console, 'log').mockImplementation(() => {})
  const res = await json('POST', '/api/teams/2/emails', { ...text, employeeIds: [4, 5] })
  expect(res.status).toBe(201)
  const result = teamSendResultSchema.parse(await res.json())
  expect(result.sent.map((r) => [r.employeeId, r.teamId, r.subject])).toEqual([
    [4, 2, 'Panel on Hanna'],
  ])
  expect(result.failed).toEqual([
    { employeeId: 5, name: 'Kacper Zielinski', error: '450 mailbox busy' },
  ])
  // Two separate transport calls, one address each: no CC or BCC between people.
  const calls = sendMail.mock.calls.slice(-2).map((c) => c[0] as Record<string, unknown>)
  expect(calls.map((c) => c.to)).toEqual([
    'hanna.sorlie@example.com',
    'kacper.zielinski@example.com',
  ])
  for (const c of calls) {
    expect(c).not.toHaveProperty('cc')
    expect(c).not.toHaveProperty('bcc')
  }
  const summary = String(info.mock.calls.find((c) => String(c[0]).includes('team-email'))?.[0])
  expect(summary).toContain('"sent":1')
  expect(summary).not.toContain('Hanna')
  warn.mockRestore()
  info.mockRestore()

  const history = teamEmailSchema
    .array()
    .parse(await (await app.request('/api/teams/2/emails')).json())
  expect(history.map((e) => [e.name, e.status])).toEqual([
    ['Kacper Zielinski', 'failed'],
    ['Hanna Sorlie', 'sent'],
  ])
  expect(new Set(history.map((e) => e.sentAt)).size).toBe(1)
  expect((await app.request('/api/teams/999/emails')).status).toBe(404)

  // Cascade: the employee's rows go with the employee (GDPR), the team's survive the team.
  await app.request('/api/employees/5', { method: 'DELETE' })
  expect(await db.select().from(employeeEmails).where(eq(employeeEmails.employeeId, 5))).toEqual([])
  await app.request('/api/teams/2', { method: 'DELETE' })
  const [orphan] = await db.select().from(employeeEmails).where(eq(employeeEmails.employeeId, 4))
  expect(orphan?.teamId).toBeNull()

  await db.delete(settings).where(eq(settings.key, 'smtp.host'))
  expect((await json('POST', '/api/teams/1/emails', { ...text, employeeIds: [1] })).status).toBe(
    409,
  )
})
