import { expect, test } from 'vitest'
import { jobSchema } from '@hrmit/shared'
import { app } from '../app.ts'

const json = (method: string, path: string, body: unknown) =>
  app.request(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

test('POST and PUT /api/jobs create, update and close a job', async () => {
  const created = await json('POST', '/api/jobs', { title: 'QA Engineer' })
  expect(created.status).toBe(201)
  const job = jobSchema.parse(await created.json())
  expect(job).toMatchObject({ title: 'QA Engineer', description: '', status: 'open' })

  expect((await json('POST', '/api/jobs', { title: '' })).status).toBe(400)

  const closed = await json('PUT', `/api/jobs/${job.id}`, {
    title: 'QA Engineer',
    description: 'Manual and automated testing.',
    status: 'closed',
  })
  expect(jobSchema.parse(await closed.json()).status).toBe('closed')
  expect((await json('PUT', '/api/jobs/9999', { title: 'x' })).status).toBe(404)

  const list = jobSchema.array().parse(await (await app.request('/api/jobs')).json())
  expect(list.find((j) => j.id === job.id)?.status).toBe('closed')
})
