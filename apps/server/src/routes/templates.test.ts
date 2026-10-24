import { expect, test, vi } from 'vitest'
import { emailPreviewSchema, emailSchema, emailTemplateSchema, fixtures } from '@hrmit/shared'

const sendMail = vi.fn()
vi.mock('nodemailer', () => ({ createTransport: () => ({ sendMail }) }))
const { app } = await import('../app.ts')

const json = (method: string, path: string, body: unknown) =>
  app.request(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
const list = async () =>
  emailTemplateSchema.array().parse(await (await app.request('/api/templates')).json())
const custom = {
  name: 'Offer',
  description: 'Sent with the offer letter',
  subject: 'Offer: {{jobTitle}}',
  body: 'Hello {{firstName}}, here is your offer.',
}

test('built-ins are seeded with null name, editable and restorable, never deletable', async () => {
  const seeded = await list()
  expect(seeded.map((t) => t.key)).toEqual(['invite', 'reminder', 'rejection'])
  expect(seeded.every((t) => t.builtIn && t.name === null && t.description === null)).toBe(true)

  const edited = await json('PUT', '/api/templates/invite', { ...custom, name: 'Invite v2' })
  expect(edited.status).toBe(200)
  expect(await edited.json()).toMatchObject({ key: 'invite', builtIn: true, name: 'Invite v2' })
  expect((await app.request('/api/templates/invite', { method: 'DELETE' })).status).toBe(400)

  const restored = emailTemplateSchema.parse(
    await (await app.request('/api/templates/invite/restore', { method: 'POST' })).json(),
  )
  expect(restored).toEqual(fixtures.emailTemplates[0])
  expect((await app.request('/api/templates/nope/restore', { method: 'POST' })).status).toBe(404)
})

test('custom template: create, unique name, used for preview and send, history survives delete', async () => {
  expect((await json('POST', '/api/templates', { ...custom, name: '' })).status).toBe(400)
  const created = await json('POST', '/api/templates', custom)
  expect(created.status).toBe(201)
  const row = emailTemplateSchema.parse(await created.json())
  expect(row).toMatchObject({ ...custom, builtIn: false })
  expect((await json('POST', '/api/templates', { ...custom, name: 'offer' })).status).toBe(409)
  expect(
    (await json('PUT', `/api/templates/${row.key}`, { ...custom, name: 'Invite' })).status,
  ).toBe(200)
  expect((await list()).at(-1)?.key).toBe(row.key)

  const preview = emailPreviewSchema.parse(
    await (await app.request(`/api/candidates/1/emails/preview?template=${row.key}`)).json(),
  )
  expect(preview.body).toContain(`Hello ${fixtures.candidates[0]!.firstName}`)
  await json('PUT', '/api/settings/smtp', {
    host: 'smtp.example.test',
    port: 2525,
    secure: false,
    user: 'bob',
    from: 'hr@example.test',
    companyName: 'Acme',
    pass: 'x',
  })
  sendMail.mockResolvedValueOnce({})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  const sent = emailSchema.parse(
    await (await json('POST', '/api/candidates/1/emails', preview)).json(),
  )
  expect(sent.templateKey).toBe(row.key)

  expect((await app.request(`/api/templates/${row.key}`, { method: 'DELETE' })).status).toBe(204)
  expect((await app.request(`/api/templates/${row.key}`, { method: 'DELETE' })).status).toBe(404)
  const history = emailSchema
    .array()
    .parse(await (await app.request('/api/candidates/1/emails')).json())
  expect(history.some((e) => e.id === sent.id && e.templateKey === row.key)).toBe(true)
  expect((await app.request(`/api/candidates/1/emails/preview?template=${row.key}`)).status).toBe(
    404,
  )
})
