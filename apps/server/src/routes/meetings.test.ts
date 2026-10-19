import { eq } from 'drizzle-orm'
import { expect, test, vi } from 'vitest'
import {
  JITSI_PREFIX,
  fixtures,
  meetingPreviewSchema,
  meetingResultSchema,
  meetingSchema,
} from '@hrmit/shared'

// No SMTP in CI: the transport is mocked, the routes and the .ics builder are real.
const sendMail = vi.fn()
vi.mock('nodemailer', () => ({ createTransport: () => ({ sendMail }) }))
const { app } = await import('../app.ts')
const { db } = await import('../db/index.ts')
const { emails, settings } = await import('../db/schema.ts')

const json = (method: string, path: string, body: unknown) =>
  app.request(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
const amelia = fixtures.candidates[0]!
const input = { startsAt: '2026-10-20T08:00:00.000Z', durationMin: 45 }

test('preview renders the invite with a fresh room and the UTC time', async () => {
  await json('PUT', '/api/settings/smtp', {
    host: 'smtp.example.test',
    port: 2525,
    secure: false,
    user: '',
    from: 'hr@example.test',
    companyName: 'Acme',
  })
  const res = await app.request(`/api/candidates/1/meetings/preview?startsAt=${input.startsAt}`)
  expect(res.status).toBe(200)
  const p = meetingPreviewSchema.parse(await res.json())
  expect(p.subject).toBe('Interview invitation: Frontend Developer (React) at Acme')
  expect(p.body).toContain(`Hello ${amelia.firstName}`)
  expect(p.body).toContain('When: 2026-10-20 08:00 UTC')
  expect(p.body).toContain(`Where: ${p.jitsiUrl}`)
  expect(p.jitsiUrl.startsWith(JITSI_PREFIX)).toBe(true)
  expect((await app.request('/api/candidates/1/meetings/preview?startsAt=tomorrow')).status).toBe(
    400,
  )
  expect(
    (await app.request(`/api/candidates/999/meetings/preview?startsAt=${input.startsAt}`)).status,
  ).toBe(404)
})

test('schedule: .ics attached, meeting linked to the email row, listed newest first', async () => {
  sendMail.mockResolvedValueOnce({})
  const info = vi.spyOn(console, 'log').mockImplementation(() => {})
  const jitsiUrl = `${JITSI_PREFIX}test-room`
  const res = await json('POST', '/api/candidates/1/meetings', {
    ...input,
    jitsiUrl,
    subject: 'Edited subject',
  })
  expect(res.status).toBe(201)
  const { meeting, email } = meetingResultSchema.parse(await res.json())
  expect(meeting).toMatchObject({ candidateId: 1, ...input, jitsiUrl, emailId: email.id })
  expect(email).toMatchObject({
    candidateId: 1,
    templateKey: 'invite',
    status: 'sent',
    subject: 'Edited subject',
  })
  expect(email.body).toContain(`Where: ${jitsiUrl}`)

  const mail = sendMail.mock.lastCall?.[0] as {
    to: string
    text: string
    attachments: { filename: string; content: string; contentType: string }[]
  }
  expect(mail.to).toBe(amelia.email)
  expect(mail).not.toHaveProperty('html')
  const [ics] = mail.attachments
  expect(ics).toMatchObject({
    filename: 'invite.ics',
    contentType: 'text/calendar; method=REQUEST',
  })
  const unfolded = ics!.content.replace(/\r\n /g, '')
  expect(unfolded).toContain('BEGIN:VEVENT')
  expect(unfolded).toContain('DTSTART:20261020T080000Z')
  expect(unfolded).toContain('DTEND:20261020T084500Z')
  expect(unfolded).toContain(`URL:${jitsiUrl}`)
  expect(unfolded).toContain(`ATTENDEE;ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:${amelia.email}`)
  expect(unfolded).toContain('ORGANIZER:mailto:hr@example.test')
  // Only ids and the status reach the log.
  const line = String(info.mock.calls.find((c) => String(c[0]).includes('"meeting"'))?.[0])
  expect(line).not.toContain(amelia.email)
  expect(line).not.toContain(jitsiUrl)
  info.mockRestore()

  const list = meetingSchema
    .array()
    .parse(await (await app.request('/api/candidates/1/meetings')).json())
  expect(list.map((m) => m.id)).toEqual([meeting!.id])
  expect((await app.request('/api/candidates/999/meetings')).status).toBe(404)

  // Deleting the email row leaves the meeting with emailId null (ON DELETE SET NULL).
  await db.delete(emails).where(eq(emails.id, email.id))
  const [after] = meetingSchema
    .array()
    .parse(await (await app.request('/api/candidates/1/meetings')).json())
  expect(after?.emailId).toBeNull()
})

test('failed send records a failed email and no meeting; 400, 404, 409', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  sendMail.mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
  const { meeting, email } = meetingResultSchema.parse(
    await (await json('POST', '/api/candidates/1/meetings', input)).json(),
  )
  expect(meeting).toBeNull()
  expect(email).toMatchObject({ status: 'failed', error: 'connect ECONNREFUSED' })
  warn.mockRestore()
  const list = meetingSchema
    .array()
    .parse(await (await app.request('/api/candidates/1/meetings')).json())
  expect(list).toHaveLength(1)

  expect(
    (await json('POST', '/api/candidates/1/meetings', { ...input, durationMin: 5 })).status,
  ).toBe(400)
  expect(
    (
      await json('POST', '/api/candidates/1/meetings', {
        ...input,
        jitsiUrl: 'https://evil.example/x',
      })
    ).status,
  ).toBe(400)
  expect((await json('POST', '/api/candidates/999/meetings', input)).status).toBe(404)
  await db.delete(settings).where(eq(settings.key, 'smtp.host'))
  expect((await json('POST', '/api/candidates/1/meetings', input)).status).toBe(409)
})
