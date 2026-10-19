import { zValidator } from '@hono/zod-validator'
import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { validator } from 'hono/validator'
import {
  interviewQuestionInputSchema,
  jobInputSchema,
  pipelineStageSchema,
  type InterviewQuestionInput,
  type PipelineStage,
} from '@hrmit/shared'
import { db } from '../db/index.ts'
import { candidateColumns, candidates, interviewQuestions, jobs } from '../db/schema.ts'

export const listQuestions = (jobId: number) =>
  db
    .select()
    .from(interviewQuestions)
    .where(eq(interviewQuestions.jobId, jobId))
    .orderBy(interviewQuestions.sortOrder, interviewQuestions.id)

/**
 * Replace the job's whole list; sortOrder is the array index. One call covers create, edit,
 * delete and reorder. ponytail: delete + insert without a transaction (sqlite-proxy has none);
 * a single local user never races itself.
 */
export async function replaceQuestions(jobId: number, inputs: InterviewQuestionInput[]) {
  await db.delete(interviewQuestions).where(eq(interviewQuestions.jobId, jobId))
  if (inputs.length)
    await db
      .insert(interviewQuestions)
      .values(inputs.map((q, sortOrder) => ({ ...q, jobId, sortOrder })))
  return listQuestions(jobId)
}

const jobExists = (id: number) =>
  db
    .select({ id: jobs.id })
    .from(jobs)
    .where(eq(jobs.id, id))
    .then((rows) => rows.length > 0)

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
  .get('/:id/questions', async (c) => {
    const jobId = Number(c.req.param('id'))
    if (!(await jobExists(jobId))) return c.json({ error: 'not found' }, 404)
    return c.json(await listQuestions(jobId))
  })
  .put('/:id/questions', zValidator('json', interviewQuestionInputSchema.array()), async (c) => {
    const jobId = Number(c.req.param('id'))
    if (!(await jobExists(jobId))) return c.json({ error: 'not found' }, 404)
    return c.json(await replaceQuestions(jobId, c.req.valid('json')))
  })
