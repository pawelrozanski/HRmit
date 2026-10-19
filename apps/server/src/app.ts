import { Hono } from 'hono'
import type { Health } from '@hrmit/shared'
import { candidatesRoute } from './routes/candidates.ts'
import { jobsRoute } from './routes/jobs.ts'

export const VERSION = '0.0.0'

/**
 * The whole API. Sub-apps are chained with .route() so that `AppType`
 * carries every route; the web app derives its typed client from it.
 */
export const app = new Hono()
  .get('/api/health', (c) => c.json<Health>({ ok: true, mode: 'local', version: VERSION }))
  .route('/api/jobs', jobsRoute)
  .route('/api/candidates', candidatesRoute)

export type AppType = typeof app
