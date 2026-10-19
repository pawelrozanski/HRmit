import { Hono } from 'hono'
import type { Health } from '@hrmit/shared'

export const VERSION = '0.0.0'

/**
 * The whole API. Sub-apps are chained with .route() so that `AppType`
 * carries every route; the web app derives its typed client from it.
 */
export const app = new Hono().get('/api/health', (c) =>
  c.json<Health>({ ok: true, mode: 'local', version: VERSION }),
)

export type AppType = typeof app
