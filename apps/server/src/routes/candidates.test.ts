import { expect, test } from 'vitest'
import { candidateSchema } from '@hrmit/shared'
import { app } from '../app.ts'

const patch = (id: string, body: unknown) =>
  app.request(`/api/candidates/${id}/stage`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

test('PATCH /api/candidates/:id/stage moves the candidate and stamps the change', async () => {
  const before = Date.now()
  const res = await patch('1', { stage: 'interview' })
  expect(res.status).toBe(200)
  const moved = candidateSchema.parse(await res.json())
  expect(moved.stage).toBe('interview')
  expect(Date.parse(moved.stageChangedAt)).toBeGreaterThanOrEqual(before)

  // persisted: the list endpoint sees it too
  const list = candidateSchema
    .array()
    .parse(await (await app.request('/api/jobs/1/candidates?stage=interview')).json())
  expect(list.some((c) => c.id === 1)).toBe(true)
})

test('PATCH rejects unknown stages and unknown candidates', async () => {
  expect((await patch('1', { stage: 'hired' })).status).toBe(400)
  expect((await patch('9999', { stage: 'offer' })).status).toBe(404)
})
