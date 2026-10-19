import { expect, test } from 'vitest'
import { healthSchema } from '@hrmit/shared'
import { app } from './app.ts'

test('GET /api/health matches the shared schema', async () => {
  const res = await app.request('/api/health')
  expect(res.status).toBe(200)
  expect(healthSchema.parse(await res.json()).mode).toBe('local')
})
