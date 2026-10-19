import { HttpResponse, http } from 'msw'
import type { Health } from '@hrmit/shared'

const base = import.meta.env.BASE_URL.replace(/\/$/, '')

/** One handler per server route. Must return shapes that pass the shared zod schemas. */
export const handlers = [
  http.get(`${base}/api/health`, () =>
    HttpResponse.json<Health>({ ok: true, mode: 'demo', version: '0.0.0' }),
  ),
]
