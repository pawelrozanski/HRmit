import { expect, test } from 'vitest'
import { fixtures, interviewQuestionSchema, jobSchema } from '@hrmit/shared'
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

test('GET and PUT /api/jobs/:id/questions: seeded, replaced in order, validated', async () => {
  const seeded = interviewQuestionSchema
    .array()
    .parse(await (await app.request('/api/jobs/1/questions')).json())
  expect(seeded.map((q) => q.question)).toEqual(fixtures.questions[1]!.map((q) => q.question))
  expect(seeded.map((q) => q.sortOrder)).toEqual(seeded.map((_, i) => i))
  expect(seeded.every((q) => q.jobId === 1)).toBe(true)

  // Reorder (last first), edit the second one and drop the rest: one PUT.
  const inputs = [
    { competency: seeded.at(-1)!.competency, question: seeded.at(-1)!.question },
    { competency: 'Edited', question: 'Edited question?' },
  ]
  const put = await json('PUT', '/api/jobs/1/questions', inputs)
  expect(put.status).toBe(200)
  const replaced = interviewQuestionSchema.array().parse(await put.json())
  expect(replaced.map(({ competency, question }) => ({ competency, question }))).toEqual(inputs)
  expect(replaced.map((q) => q.sortOrder)).toEqual([0, 1])
  const again = interviewQuestionSchema
    .array()
    .parse(await (await app.request('/api/jobs/1/questions')).json())
  expect(again).toEqual(replaced)

  expect(
    (await json('PUT', '/api/jobs/1/questions', [{ competency: '', question: 'x' }])).status,
  ).toBe(400)
  expect(
    (await json('PUT', '/api/jobs/1/questions', { competency: 'a', question: 'b' })).status,
  ).toBe(400)
  expect((await json('PUT', '/api/jobs/9999/questions', [])).status).toBe(404)
  expect((await app.request('/api/jobs/9999/questions')).status).toBe(404)
})
