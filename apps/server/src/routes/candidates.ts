import { readFile, rm, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { candidateInputSchema, moveStageSchema } from '@hrmit/shared'
import { db, uploadsDir } from '../db/index.ts'
import { candidateColumns, candidates } from '../db/schema.ts'
import { CV_MIME, extractCvText, validateCv, type CvExt } from '../security/upload.ts'

const byId = (id: string) => eq(candidates.id, Number(id))

/** Remove a stored CV file if there is one. A missing file is not an error. */
const unlinkCv = (cvPath: string | null) =>
  cvPath ? rm(join(uploadsDir, cvPath), { force: true }) : Promise.resolve()

export const candidatesRoute = new Hono()
  .post('/', zValidator('json', candidateInputSchema), async (c) => {
    const now = new Date().toISOString()
    const [row] = await db
      .insert(candidates)
      .values({ ...c.req.valid('json'), stageChangedAt: now, createdAt: now })
      .returning(candidateColumns)
    return c.json(row, 201)
  })
  // Full replace of the editable fields; a stage change here is stamped like PATCH /stage.
  .put('/:id', zValidator('json', candidateInputSchema), async (c) => {
    const where = byId(c.req.param('id'))
    const input = c.req.valid('json')
    const [current] = await db.select({ stage: candidates.stage }).from(candidates).where(where)
    if (!current) return c.json({ error: 'not found' }, 404)
    const stamp = input.stage === current.stage ? {} : { stageChangedAt: new Date().toISOString() }
    const [row] = await db
      .update(candidates)
      .set({ ...input, ...stamp })
      .where(where)
      .returning(candidateColumns)
    return c.json(row)
  })
  // GDPR erasure path: the row and the file go together. Related tables cascade (none yet).
  .delete('/:id', async (c) => {
    const [row] = await db
      .delete(candidates)
      .where(byId(c.req.param('id')))
      .returning({ cvPath: candidates.cvPath })
    if (!row) return c.json({ error: 'not found' }, 404)
    await unlinkCv(row.cvPath)
    return c.body(null, 204)
  })
  .patch('/:id/stage', zValidator('json', moveStageSchema), async (c) => {
    const { stage } = c.req.valid('json')
    const [row] = await db
      .update(candidates)
      .set({ stage, stageChangedAt: new Date().toISOString() })
      .where(byId(c.req.param('id')))
      .returning(candidateColumns)
    return row ? c.json(row) : c.json({ error: 'not found' }, 404)
  })
  // One CV per candidate: a new upload replaces the previous file.
  .post('/:id/cv', zValidator('form', z.object({ file: z.instanceof(File) })), async (c) => {
    const where = byId(c.req.param('id'))
    const { file } = c.req.valid('form')
    const bytes = new Uint8Array(await file.arrayBuffer())
    const ext = validateCv(file.name, bytes)
    if (ext === 'too_large') return c.json({ error: ext }, 413)
    if (ext === 'bad_type') return c.json({ error: ext }, 415)

    const [current] = await db.select({ cvPath: candidates.cvPath }).from(candidates).where(where)
    if (!current) return c.json({ error: 'not found' }, 404)

    const cvPath = `${crypto.randomUUID()}.${ext}`
    await writeFile(join(uploadsDir, cvPath), bytes)
    const cvText = await extractCvText(ext, bytes)
    const [row] = await db
      .update(candidates)
      .set({ cvFilename: file.name, cvPath, cvText })
      .where(where)
      .returning(candidateColumns)
    await unlinkCv(current.cvPath)
    return c.json(row)
  })
  // The file is looked up by candidate id; the path on disk never appears in a URL.
  .get('/:id/cv', async (c) => {
    const [row] = await db
      .select({ cvPath: candidates.cvPath, cvFilename: candidates.cvFilename })
      .from(candidates)
      .where(byId(c.req.param('id')))
    if (!row?.cvPath) return c.json({ error: 'not found' }, 404)
    const ext = extname(row.cvPath).slice(1) as CvExt
    const name = row.cvFilename ?? 'cv'
    // ASCII fallback plus the RFC 5987 form, so names with diacritics survive.
    const ascii = name.replace(/[^\x20-\x7e]|["\\]/g, '_')
    return c.body(await readFile(join(uploadsDir, row.cvPath)), 200, {
      'content-type': CV_MIME[ext],
      'content-disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    })
  })
