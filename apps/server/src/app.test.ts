import { expect, test } from 'vitest'
import { candidateSchema, fixtures, healthSchema, jobSchema } from '@hrmit/shared'
import { app } from './app.ts'

test('GET /api/health matches the shared schema', async () => {
  const res = await app.request('/api/health')
  expect(res.status).toBe(200)
  expect(healthSchema.parse(await res.json()).mode).toBe('local')
})

test('GET /api/jobs returns the seeded fixtures', async () => {
  const res = await app.request('/api/jobs')
  expect(jobSchema.array().parse(await res.json())).toEqual(fixtures.jobs)
})

test('GET /api/jobs/:id/candidates filters by stage', async () => {
  const all = candidateSchema
    .array()
    .parse(await (await app.request('/api/jobs/1/candidates')).json())
  expect(all).toEqual(fixtures.candidates.filter((c) => c.jobId === 1))

  const applied = candidateSchema
    .array()
    .parse(await (await app.request('/api/jobs/1/candidates?stage=applied')).json())
  expect(applied.every((c) => c.stage === 'applied')).toBe(true)
  expect(applied.length).toBeGreaterThan(0)

  expect((await app.request('/api/jobs/1/candidates?stage=hired')).status).toBe(400)
})
