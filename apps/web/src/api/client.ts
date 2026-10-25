import { hc } from 'hono/client'
import type { AppType } from '@hrmit/server/app'

/**
 * The only place the UI talks to the backend. Fully typed from the server's routes.
 * In demo builds the same calls are answered by MSW (src/demo), the client does not know.
 */
const base = import.meta.env.BASE_URL.replace(/\/$/, '')
export const api = hc<AppType>(base)

/** Download link for a candidate's CV. Built by hand: hc's $url() needs an absolute base. */
export const cvUrl = (candidateId: number) => `${base}/api/candidates/${candidateId}/cv`
/** The backup archive (binary, not a typed route). */
export const backupUrl = `${base}/api/backup`
