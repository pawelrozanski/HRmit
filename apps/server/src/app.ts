import { Hono } from 'hono'
import { VERSION, type Health, type ShutdownResult } from '@hrmit/shared'
import { log } from './log.ts'
import { aiRoute } from './routes/ai.ts'
import { backupRoute } from './routes/backup.ts'
import { candidatesRoute } from './routes/candidates.ts'
import { dashboardRoute } from './routes/dashboard.ts'
import { employeesRoute } from './routes/employees.ts'
import { jobsRoute } from './routes/jobs.ts'
import { settingsRoute } from './routes/settings.ts'
import { teamsRoute } from './routes/teams.ts'
import { templatesRoute } from './routes/templates.ts'

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]'])
const isLoopback = (url: string) => {
  try {
    return LOOPBACK.has(new URL(url).hostname)
  } catch {
    return false
  }
}

/**
 * The whole API. Sub-apps are chained with .route() so that `AppType`
 * carries every route; the web app derives its typed client from it.
 */
export const app = new Hono()
  // No login, so the browser's same-origin rules are the only guard (docs/SECURITY.md). A foreign
  // Origin (cross-site form post) or a foreign Host (DNS rebinding) gets 403; both headers are
  // always sent by browsers. Non-browser clients without them, such as curl and tests, pass.
  .use('/api/*', async (c, next) => {
    const host = c.req.header('host')
    const origin = c.req.header('origin')
    if ((host && !isLoopback(`http://${host}`)) || (origin && !isLoopback(origin)))
      return c.text('forbidden', 403)
    await next()
  })
  .get('/api/health', (c) => c.json<Health>({ ok: true, mode: 'local', version: VERSION }))
  // The off switch in Settings > General (0.5.4): answer first, exit on the next tick so the
  // response leaves the socket. Loopback-only like everything else; see docs/SECURITY.md.
  .post('/api/shutdown', (c) => {
    log.info('shutdown requested')
    setTimeout(() => process.exit(0), 100)
    return c.json<ShutdownResult>({ ok: true })
  })
  .route('/api/dashboard', dashboardRoute)
  .route('/api/jobs', jobsRoute)
  .route('/api/candidates', candidatesRoute)
  .route('/api/employees', employeesRoute)
  .route('/api/teams', teamsRoute)
  .route('/api/settings', settingsRoute)
  .route('/api/templates', templatesRoute)
  .route('/api/ai', aiRoute)
  .route('/api/backup', backupRoute)

export type AppType = typeof app
