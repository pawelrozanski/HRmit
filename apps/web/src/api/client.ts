import { hc } from 'hono/client'
import type { AppType } from '@hrmit/server/app'

/**
 * The only place the UI talks to the backend. Fully typed from the server's routes.
 * In demo builds the same calls are answered by MSW (src/demo), the client does not know.
 */
export const api = hc<AppType>(import.meta.env.BASE_URL.replace(/\/$/, ''))
