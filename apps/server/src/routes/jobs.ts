import { zValidator } from '@hono/zod-validator'
import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { validator } from 'hono/validator'
import { jobInputSchema, pipelineStageSchema, type PipelineStage } from '@hrmit/shared'
import { db } from '../db/index.ts'
import { candidateColumns, candidates, jobs } from '../db/schema.ts'

const stageQuery = validator('query', (q, c): { stage?: PipelineStage } | Response => {
  const stage = q.stage === undefined ? undefined : pipelineStageSchema.safeParse(q.stage)
  if (stage && !stage.success) return c.json({ error: 'invalid stage' }, 400)
  return stage ? { stage: stage.data } : {}
})

export const jobsRoute = new Hono()
  .get('/', async (c) => c.json(await db.select().from(jobs).orderBy(jobs.id)))
  .post('/', zValidator('json', jobInputSchema), async (c) => {
    const [row] = await db
      .insert(jobs)
      .values({ ...c.req.valid('json'), createdAt: new Date().toISOString() })
      .returning()
    return c.json(row, 201)
  })
  // Full replace. Closing a job is a PUT with status 'closed'.
  .put('/:id', zValidator('json', jobInputSchema), async (c) => {
    const [row] = await db
      .update(jobs)
      .set(c.req.valid('json'))
      .where(eq(jobs.id, Number(c.req.param('id'))))
      .returning()
    return row ? c.json(row) : c.json({ error: 'not found' }, 404)
  })
  .get('/:id/candidates', stageQuery, async (c) => {
    const jobId = Number(c.req.param('id'))
    const { stage } = c.req.valid('query')
    const rows = await db
      .select(candidateColumns)
      .from(candidates)
      .where(and(eq(candidates.jobId, jobId), stage ? eq(candidates.stage, stage) : undefined))
      .orderBy(candidates.id)
    return c.json(rows)
  })
