import { zValidator } from '@hono/zod-validator'
import { and, eq, ne, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { emailTemplateInputSchema, fixtures, type EmailTemplateInput } from '@hrmit/shared'
import { db } from '../db/index.ts'
import { emailTemplates } from '../db/schema.ts'

/** Built-in templates first in their seeded order, custom ones after, by name. */
const list = () =>
  db
    .select()
    .from(emailTemplates)
    .orderBy(sql`${emailTemplates.builtIn} desc, ${emailTemplates.name} collate nocase`)
const byKey = (key: string) => db.select().from(emailTemplates).where(eq(emailTemplates.key, key))
/** Another row with the same name, case-insensitive (the unique index alone is case-sensitive). */
const nameTaken = async (name: string, key = '') =>
  (
    await db
      .select({ key: emailTemplates.key })
      .from(emailTemplates)
      .where(and(sql`lower(${emailTemplates.name}) = lower(${name})`, ne(emailTemplates.key, key)))
  ).length > 0

const parse = zValidator('json', emailTemplateInputSchema)

/** Built-in rows can be edited and restored, never deleted; custom rows (random key) can be anything. */
export const templatesRoute = new Hono()
  .get('/', async (c) => c.json(await list()))
  .post('/', parse, async (c) => {
    const input: EmailTemplateInput = c.req.valid('json')
    if (await nameTaken(input.name)) return c.json({ error: 'name taken' }, 409)
    const [row] = await db
      .insert(emailTemplates)
      .values({ key: crypto.randomUUID(), builtIn: false, ...input })
      .returning()
    return c.json(row!, 201)
  })
  .put('/:key', parse, async (c) => {
    const key = c.req.param('key')
    const input: EmailTemplateInput = c.req.valid('json')
    if (!(await byKey(key)).length) return c.json({ error: 'not found' }, 404)
    if (await nameTaken(input.name, key)) return c.json({ error: 'name taken' }, 409)
    const [row] = await db
      .update(emailTemplates)
      .set(input)
      .where(eq(emailTemplates.key, key))
      .returning()
    return c.json(row!)
  })
  .delete('/:key', async (c) => {
    const [row] = await byKey(c.req.param('key'))
    if (!row) return c.json({ error: 'not found' }, 404)
    if (row.builtIn) return c.json({ error: 'built-in template' }, 400)
    await db.delete(emailTemplates).where(eq(emailTemplates.key, row.key))
    return c.body(null, 204)
  })
  // Back to the shipped text; name and description go null so the translated default shows again.
  .post('/:key/restore', async (c) => {
    const key = c.req.param('key')
    const fixture = fixtures.emailTemplates.find((t) => t.key === key)
    if (!fixture) return c.json({ error: 'not found' }, 404)
    const [row] = await db
      .update(emailTemplates)
      .set({ name: null, description: null, subject: fixture.subject, body: fixture.body })
      .where(eq(emailTemplates.key, key))
      .returning()
    if (!row) return c.json({ error: 'not found' }, 404)
    return c.json(row)
  })
