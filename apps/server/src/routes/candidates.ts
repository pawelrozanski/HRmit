import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { moveStageSchema } from '@hrmit/shared'
import { db } from '../db/index.ts'
import { candidates } from '../db/schema.ts'

export const candidatesRoute = new Hono().patch(
  '/:id/stage',
  zValidator('json', moveStageSchema),
  async (c) => {
    const id = Number(c.req.param('id'))
    const { stage } = c.req.valid('json')
    const [row] = await db
      .update(candidates)
      .set({ stage, stageChangedAt: new Date().toISOString() })
      .where(eq(candidates.id, id))
      .returning()
    return row ? c.json(row) : c.json({ error: 'not found' }, 404)
  },
)
