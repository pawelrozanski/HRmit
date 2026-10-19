import { HttpResponse, http } from 'msw'
import { pipelineStageSchema, type Health } from '@hrmit/shared'
import { store } from './store.ts'

const base = import.meta.env.BASE_URL.replace(/\/$/, '')

/** One handler per server route. Must return shapes that pass the shared zod schemas. */
export const handlers = [
  http.get(`${base}/api/health`, () =>
    HttpResponse.json<Health>({ ok: true, mode: 'demo', version: '0.0.0' }),
  ),
  http.get(`${base}/api/jobs`, () => HttpResponse.json(store.jobs)),
  http.get(`${base}/api/jobs/:id/candidates`, ({ params, request }) => {
    const jobId = Number(params.id)
    const raw = new URL(request.url).searchParams.get('stage')
    const stage = raw === null ? undefined : pipelineStageSchema.safeParse(raw)
    if (stage && !stage.success)
      return HttpResponse.json({ error: 'invalid stage' }, { status: 400 })
    return HttpResponse.json(
      store.candidates.filter((c) => c.jobId === jobId && (!stage || c.stage === stage.data)),
    )
  }),
]
