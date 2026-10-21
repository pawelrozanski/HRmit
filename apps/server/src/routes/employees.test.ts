import { expect, test } from 'vitest'
import { employeeWithTeamsSchema, fixtures } from '@hrmit/shared'
import { app } from '../app.ts'

const json = (method: string, path: string, body: unknown) =>
  app.request(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
const list = async (query = '') =>
  employeeWithTeamsSchema.array().parse(await (await app.request(`/api/employees${query}`)).json())

test('GET /api/employees lists fixtures with teams, searches and filters by team', async () => {
  const all = await list()
  expect(all).toHaveLength(fixtures.employees.length)
  expect(all.map((e) => e.lastName)).toEqual([...all.map((e) => e.lastName)].sort())
  const hanna = all.find((e) => e.firstName === 'Hanna')!
  expect(hanna.teams.map((t) => `${t.name}:${t.role}`)).toEqual([
    'Customer Support:member',
    'IT:lead',
  ])

  expect((await list('?q=SUPPORT')).map((e) => e.position)).toEqual([
    'Support Specialist',
    'Support Team Lead',
    'Support Specialist',
  ])
  expect((await list('?q=zofia')).map((e) => e.lastName)).toEqual(['Mazur'])
  expect((await list('?q=nunes')).map((e) => e.firstName)).toEqual(['Rafael'])
  expect((await list('?teamId=4')).map((e) => e.lastName)).toEqual(['Castellanos', 'Nunes'])
  expect((await list('?teamId=4&q=head')).map((e) => e.lastName)).toEqual(['Castellanos'])
  expect(await list('?q=nobody')).toEqual([])
  expect((await app.request('/api/employees?teamId=x')).status).toBe(400)
})

test('POST, GET, PUT, DELETE /api/employees validate and hard-delete with memberships', async () => {
  const input = {
    firstName: 'Ada',
    lastName: 'Test',
    position: 'Recruiter',
    email: 'ada.test@example.com',
    hiredAt: '2026-01-15',
    duties: 'Screens CVs.\nRuns first calls.',
  }
  expect((await json('POST', '/api/employees', { ...input, email: 'nope' })).status).toBe(400)
  expect((await json('POST', '/api/employees', { ...input, hiredAt: 'soon' })).status).toBe(400)
  const created = await json('POST', '/api/employees', input)
  expect(created.status).toBe(201)
  const employee = employeeWithTeamsSchema.parse(await created.json())
  expect(employee).toMatchObject({ ...input, teams: [] })

  await json('POST', '/api/teams/1/members', { employeeIds: [employee.id] })
  const fetched = employeeWithTeamsSchema.parse(
    await (await app.request(`/api/employees/${employee.id}`)).json(),
  )
  expect(fetched.teams).toEqual([{ id: 1, name: 'Sales', role: 'member' }])

  const put = await json('PUT', `/api/employees/${employee.id}`, {
    ...input,
    position: 'Senior Recruiter',
    hiredAt: null,
  })
  expect(employeeWithTeamsSchema.parse(await put.json())).toMatchObject({
    position: 'Senior Recruiter',
    hiredAt: null,
    teams: [{ id: 1 }],
  })
  expect((await json('PUT', '/api/employees/9999', input)).status).toBe(404)
  expect((await app.request('/api/employees/9999')).status).toBe(404)

  const del = () => app.request(`/api/employees/${employee.id}`, { method: 'DELETE' })
  expect((await del()).status).toBe(204)
  expect((await del()).status).toBe(404)
  const sales = (await (await app.request('/api/teams/1')).json()) as { members: { id: number }[] }
  expect(sales.members.some((m) => m.id === employee.id)).toBe(false)
})
