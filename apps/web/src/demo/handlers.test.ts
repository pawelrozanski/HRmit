import { candidateSchema, fixtures, jobSchema } from '@hrmit/shared'
import { setupServer } from 'msw/node'
import { afterAll, beforeAll, expect, test, vi } from 'vitest'

// Node has no window.location; MSW needs one to resolve the relative handler paths.
vi.stubGlobal('location', new URL('http://localhost/'))
const { handlers } = await import('./handlers.ts')

// Contract check (ADR 0003): the demo handlers answer like the server and pass the shared schemas.
const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

const get = (path: string) => fetch(`http://localhost${path}`).then((r) => r.json())

test('demo GET /api/jobs returns the fixtures', async () => {
  expect(jobSchema.array().parse(await get('/api/jobs'))).toEqual(fixtures.jobs)
})

test('demo GET /api/jobs/:id/candidates filters by stage', async () => {
  const all = candidateSchema.array().parse(await get('/api/jobs/2/candidates'))
  expect(all).toEqual(fixtures.candidates.filter((c) => c.jobId === 2))
  const applied = candidateSchema.array().parse(await get('/api/jobs/2/candidates?stage=applied'))
  expect(applied.length).toBeGreaterThan(0)
  expect(applied.every((c) => c.stage === 'applied')).toBe(true)
})
