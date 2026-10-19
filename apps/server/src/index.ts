import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { app, VERSION } from './app.ts'
import { log } from './log.ts'

const PORT = Number(process.env.PORT ?? 3000)
// Loopback only: nothing on the network can reach candidate data. See docs/ARCHITECTURE.md §7.
const HOST = '127.0.0.1'

// Production: serve the built web app from the same process.
const webDist = fileURLToPath(new URL('../../web/dist/', import.meta.url))
if (existsSync(webDist)) {
  app.use('/*', serveStatic({ root: webDist }))
  app.get('/*', serveStatic({ root: webDist, path: 'index.html' }))
}

serve({ fetch: app.fetch, port: PORT, hostname: HOST }, () => {
  log.info('listening', { version: VERSION, url: `http://${HOST}:${PORT}` })
})
