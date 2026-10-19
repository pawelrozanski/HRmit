import { HttpResponse, http } from 'msw'
import { moveStageSchema, pipelineStageSchema, type Health } from '@hrmit/shared'
import { save, store } from './store.ts'

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
  http.patch(`${base}/api/candidates/:id/stage`, async ({ params, request }) => {
    const body = moveStageSchema.safeParse(await request.json())
    if (!body.success) return HttpResponse.json({ error: 'invalid stage' }, { status: 400 })
    const candidate = store.candidates.find((c) => c.id === Number(params.id))
    if (!candidate) return HttpResponse.json({ error: 'not found' }, { status: 404 })
    candidate.stage = body.data.stage
    candidate.stageChangedAt = new Date().toISOString()
    save()
    return HttpResponse.json(candidate)
  }),
]
