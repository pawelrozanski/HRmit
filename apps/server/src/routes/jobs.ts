import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { validator } from 'hono/validator'
import { pipelineStageSchema } from '@hrmit/shared'
import { db } from '../db/index.ts'
import { candidates, jobs } from '../db/schema.ts'

const stageQuery = validator('query', (q, c) => {
  const stage = q.stage === undefined ? undefined : pipelineStageSchema.safeParse(q.stage)
  if (stage && !stage.success) return c.json({ error: 'invalid stage' }, 400)
  return { stage: stage?.data }
})

export const jobsRoute = new Hono()
  .get('/', async (c) => c.json(await db.select().from(jobs).orderBy(jobs.id)))
  .get('/:id/candidates', stageQuery, async (c) => {
    const jobId = Number(c.req.param('id'))
    const { stage } = c.req.valid('query')
    const rows = await db
      .select()
      .from(candidates)
      .where(and(eq(candidates.jobId, jobId), stage ? eq(candidates.stage, stage) : undefined))
      .orderBy(candidates.id)
    return c.json(rows)
  })
