import { expect, test } from 'vitest'
import {
  employeeWithTeamsSchema,
  fixtures,
  jobSchema,
  teamDetailSchema,
  teamSchema,
} from '@hrmit/shared'
import { app } from '../app.ts'

const json = (method: string, path: string, body: unknown) =>
  app.request(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
const get = async <T>(path: string, parse: (v: unknown) => T) =>
  parse(await (await app.request(path)).json())
const del = (path: string) => app.request(path, { method: 'DELETE' })

test('GET /api/teams lists fixtures with counts; GET /:id has members and jobs', async () => {
  const list = await get('/api/teams', (v) => teamSchema.array().parse(v))
  expect(list.map((t) => t.name)).toEqual(['Customer Support', 'IT', 'Marketing', 'Sales'])
  const it = list.find((t) => t.name === 'IT')!
  expect(it.memberCount).toBe(4)
  expect(it.openJobCount).toBe(1)
  expect(list.find((t) => t.name === 'Customer Support')!.openJobCount).toBe(0) // job 3 closed

  const detail = await get(`/api/teams/${it.id}`, (v) => teamDetailSchema.parse(v))
  expect(detail.members[0]).toMatchObject({ lastName: 'Sorlie', role: 'lead' })
  expect(detail.members).toHaveLength(4)
  expect(detail.jobs.map((j) => j.id)).toEqual([1])
  expect((await app.request('/api/teams/9999')).status).toBe(404)
})

test('POST/PUT /api/teams validate and reject duplicate names ignoring case', async () => {
  expect((await json('POST', '/api/teams', { name: '' })).status).toBe(400)
  expect((await json('POST', '/api/teams', { name: 'sales' })).status).toBe(409)
  const created = await json('POST', '/api/teams', { name: 'Legal' })
  expect(created.status).toBe(201)
  const team = teamDetailSchema.parse(await created.json())
  expect(team).toMatchObject({ name: 'Legal', description: '', memberCount: 0, members: [] })
  expect((await json('PUT', `/api/teams/${team.id}`, { name: 'it' })).status).toBe(409)
  const updated = await json('PUT', `/api/teams/${team.id}`, { name: 'Legal', description: 'd' })
  expect(teamDetailSchema.parse(await updated.json()).description).toBe('d')
  expect((await json('PUT', '/api/teams/9999', { name: 'x' })).status).toBe(404)
})

test('members: add many (duplicates ignored), set role, remove; unknown employee is 400', async () => {
  const created = await json('POST', '/api/teams', { name: 'Panel' })
  const { id } = teamDetailSchema.parse(await created.json())
  expect((await json('POST', `/api/teams/${id}/members`, { employeeIds: [] })).status).toBe(400)
  expect((await json('POST', `/api/teams/${id}/members`, { employeeIds: [9999] })).status).toBe(400)
  expect((await json('POST', '/api/teams/9999/members', { employeeIds: [1] })).status).toBe(404)

  const added = await json('POST', `/api/teams/${id}/members`, { employeeIds: [1, 2, 1] })
  expect(added.status).toBe(200)
  expect(teamDetailSchema.parse(await added.json()).members.map((m) => m.id)).toEqual([1, 2])
  const again = await json('POST', `/api/teams/${id}/members`, { employeeIds: [2, 3] })
  const detail = teamDetailSchema.parse(await again.json())
  expect(detail.memberCount).toBe(3)
  expect(detail.members.every((m) => m.role === 'member')).toBe(true)

  const lead = await json('PATCH', `/api/teams/${id}/members/2`, { role: 'lead' })
  expect(teamDetailSchema.parse(await lead.json()).members[0]).toMatchObject({
    id: 2,
    role: 'lead',
  })
  expect((await json('PATCH', `/api/teams/${id}/members/2`, { role: 'boss' })).status).toBe(400)
  expect((await json('PATCH', `/api/teams/${id}/members/9999`, { role: 'lead' })).status).toBe(404)

  expect((await del(`/api/teams/${id}/members/3`)).status).toBe(204)
  expect((await del(`/api/teams/${id}/members/3`)).status).toBe(404)
  // The employee itself is untouched.
  expect((await app.request('/api/employees/3')).status).toBe(200)
  const employee = await get('/api/employees/2', (v) => employeeWithTeamsSchema.parse(v))
  expect(employee.teams).toContainEqual({ id, name: 'Panel', role: 'lead' })
})

test('DELETE /api/teams/:id keeps its jobs with teamId null and drops memberships', async () => {
  const created = await json('POST', '/api/teams', { name: 'Temporary' })
  const { id } = teamDetailSchema.parse(await created.json())
  await json('POST', `/api/teams/${id}/members`, { employeeIds: [5] })
  const job = jobSchema.parse(
    await (await json('POST', '/api/jobs', { title: 'Temp role', teamId: id })).json(),
  )
  expect(job.teamId).toBe(id)
  expect(await get(`/api/jobs?teamId=${id}`, (v) => jobSchema.array().parse(v))).toEqual([job])

  expect((await del(`/api/teams/${id}`)).status).toBe(204)
  expect((await del(`/api/teams/${id}`)).status).toBe(404)
  const after = await get('/api/jobs', (v) => jobSchema.array().parse(v))
  expect(after.find((j) => j.id === job.id)?.teamId).toBeNull()
  const employee = await get('/api/employees/5', (v) => employeeWithTeamsSchema.parse(v))
  expect(employee.teams.some((t) => t.id === id)).toBe(false)
})

test('jobs: teamId must exist, ?teamId filters, fixtures carry their teams', async () => {
  expect((await json('POST', '/api/jobs', { title: 'x', teamId: 9999 })).status).toBe(400)
  expect((await json('PUT', '/api/jobs/1', { title: 'x', teamId: 9999 })).status).toBe(400)
  expect((await app.request('/api/jobs?teamId=abc')).status).toBe(400)
  const it = await get('/api/jobs?teamId=2', (v) => jobSchema.array().parse(v))
  expect(it.map((j) => j.id)).toEqual([1])
  const all = await get('/api/jobs', (v) => jobSchema.array().parse(v))
  expect(all.filter((j) => j.id <= 4).map((j) => j.teamId)).toEqual(
    fixtures.jobs.map((j) => j.teamId),
  )
})
