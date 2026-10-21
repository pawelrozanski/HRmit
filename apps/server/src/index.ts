import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { VERSION } from '@hrmit/shared'
import { app } from './app.ts'
import { log } from './log.ts'

const PORT = Number(process.env.PORT ?? 3000)
// Loopback only: nothing on the network can reach candidate data (docs/ARCHITECTURE.md §7).
// HOST=0.0.0.0 exists for the container, where compose maps the port to the host's loopback.
const HOST = process.env.HOST ?? '127.0.0.1'

// Production: serve the built web app from the same process.
const webDist = fileURLToPath(new URL('../../web/dist/', import.meta.url))
if (existsSync(webDist)) {
  app.use('/*', serveStatic({ root: webDist }))
  app.get('/*', serveStatic({ root: webDist, path: 'index.html' }))
}

serve({ fetch: app.fetch, port: PORT, hostname: HOST }, () => {
  log.info('listening', { version: VERSION, url: `http://${HOST}:${PORT}` })
})
