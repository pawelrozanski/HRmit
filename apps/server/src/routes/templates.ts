import { zValidator } from '@hono/zod-validator'
import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { emailTemplateSchema } from '@hrmit/shared'
import { db } from '../db/index.ts'
import { emailTemplates } from '../db/schema.ts'

const list = () => db.select().from(emailTemplates).orderBy(emailTemplates.key)

/** The three templates. PUT replaces subject and body per key; keys are fixed by the schema. */
export const templatesRoute = new Hono()
  .get('/', async (c) => c.json(await list()))
  .put('/', zValidator('json', emailTemplateSchema.array().min(1)), async (c) => {
    await db
      .insert(emailTemplates)
      .values(c.req.valid('json'))
      .onConflictDoUpdate({
        target: emailTemplates.key,
        set: { subject: sql`excluded.subject`, body: sql`excluded.body` },
      })
    return c.json(await list())
  })
