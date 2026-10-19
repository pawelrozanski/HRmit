import { readFile, rm, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { zValidator } from '@hono/zod-validator'
import { and, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import {
  candidateInputSchema,
  emailTemplateKeySchema,
  evaluationSchema,
  moveStageSchema,
  renderTemplate,
  sendEmailInputSchema,
  type EmailPreview,
  type Scorecard,
} from '@hrmit/shared'
import { db, uploadsDir } from '../db/index.ts'
import {
  candidateColumns,
  candidates,
  emails,
  emailTemplates,
  evaluations,
  interviewQuestions,
  jobs,
} from '../db/schema.ts'
import { log } from '../log.ts'
import { sendMail, SmtpNotConfigured } from '../mail/send.ts'
import { getSetting } from '../settings.ts'
import { CV_MIME, extractCvText, validateCv, type CvExt } from '../security/upload.ts'

const byId = (id: string) => eq(candidates.id, Number(id))

/** Remove a stored CV file if there is one. A missing file is not an error. */
const unlinkCv = (cvPath: string | null) =>
  cvPath ? rm(join(uploadsDir, cvPath), { force: true }) : Promise.resolve()

const jobOf = (id: string) =>
  db
    .select({ jobId: candidates.jobId })
    .from(candidates)
    .where(byId(id))
    .then((rows) => rows[0]?.jobId)

/** The job's questions in guide order, each with this candidate's evaluation or an empty one. */
async function scorecard(candidateId: number, jobId: number): Promise<Scorecard> {
  const rows = await db
    .select({
      questionId: interviewQuestions.id,
      competency: interviewQuestions.competency,
      question: interviewQuestions.question,
      score: evaluations.score,
      note: evaluations.note,
    })
    .from(interviewQuestions)
    .leftJoin(
      evaluations,
      and(
        eq(evaluations.questionId, interviewQuestions.id),
        eq(evaluations.candidateId, candidateId),
      ),
    )
    .where(eq(interviewQuestions.jobId, jobId))
    .orderBy(interviewQuestions.sortOrder, interviewQuestions.id)
  return { candidateId, evaluations: rows.map((r) => ({ ...r, note: r.note ?? '' })) }
}

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
  // GDPR erasure path: the row and the file go together; evaluations cascade in the schema.
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
  .get('/:id/scorecard', async (c) => {
    const jobId = await jobOf(c.req.param('id'))
    if (jobId === undefined) return c.json({ error: 'not found' }, 404)
    return c.json(await scorecard(Number(c.req.param('id')), jobId))
  })
  // Upsert per question. Scores can only be given on the candidate's own job's questions.
  .put('/:id/scorecard', zValidator('json', evaluationSchema.array()), async (c) => {
    const candidateId = Number(c.req.param('id'))
    const jobId = await jobOf(c.req.param('id'))
    if (jobId === undefined) return c.json({ error: 'not found' }, 404)
    const inputs = c.req.valid('json')
    const valid = new Set(
      (
        await db
          .select({ id: interviewQuestions.id })
          .from(interviewQuestions)
          .where(eq(interviewQuestions.jobId, jobId))
      ).map((q) => q.id),
    )
    if (inputs.some((e) => !valid.has(e.questionId)))
      return c.json({ error: 'question not in this job' }, 400)
    if (inputs.length)
      await db
        .insert(evaluations)
        .values(inputs.map((e) => ({ candidateId, ...e })))
        .onConflictDoUpdate({
          target: [evaluations.candidateId, evaluations.questionId],
          set: { score: sql`excluded.score`, note: sql`excluded.note` },
        })
    return c.json(await scorecard(candidateId, jobId))
  })
  .get('/:id/emails', async (c) => {
    const candidateId = Number(c.req.param('id'))
    if ((await jobOf(c.req.param('id'))) === undefined) return c.json({ error: 'not found' }, 404)
    return c.json(
      await db.select().from(emails).where(eq(emails.candidateId, candidateId)).orderBy(emails.id),
    )
  })
  // Rendered template for the UI to edit before sending. Meeting placeholders stay until stage 10.
  .get('/:id/emails/preview', async (c) => {
    const key = emailTemplateKeySchema.safeParse(c.req.query('template'))
    if (!key.success) return c.json({ error: 'unknown template' }, 404)
    const [row] = await db
      .select({
        firstName: candidates.firstName,
        lastName: candidates.lastName,
        jobTitle: jobs.title,
        subject: emailTemplates.subject,
        body: emailTemplates.body,
      })
      .from(candidates)
      .innerJoin(jobs, eq(jobs.id, candidates.jobId))
      .innerJoin(emailTemplates, eq(emailTemplates.key, key.data))
      .where(byId(c.req.param('id')))
    if (!row) return c.json({ error: 'not found' }, 404)
    const vars = {
      firstName: row.firstName,
      lastName: row.lastName,
      jobTitle: row.jobTitle,
      companyName: (await getSetting('smtp.companyName')) ?? '',
    }
    return c.json<EmailPreview>({
      templateKey: key.data,
      subject: renderTemplate(row.subject, vars),
      body: renderTemplate(row.body, vars),
    })
  })
  // Sends the text as given (the recruiter edited it) and records the outcome either way.
  // Only ids and the status reach the log: no address, no subject, no body.
  .post('/:id/emails', zValidator('json', sendEmailInputSchema), async (c) => {
    const candidateId = Number(c.req.param('id'))
    const [row] = await db
      .select({ email: candidates.email })
      .from(candidates)
      .where(byId(c.req.param('id')))
    if (!row) return c.json({ error: 'not found' }, 404)
    const input = c.req.valid('json')
    let error: string | null = null
    try {
      await sendMail(row.email, input.subject, input.body)
    } catch (err) {
      if (err instanceof SmtpNotConfigured) return c.json({ error: 'smtp not configured' }, 409)
      error = err instanceof Error ? err.message : String(err)
    }
    const status = error ? 'failed' : 'sent'
    log[error ? 'warn' : 'info']('email', { candidateId, template: input.templateKey, status })
    const [saved] = await db
      .insert(emails)
      .values({ candidateId, ...input, status, sentAt: new Date().toISOString(), error })
      .returning()
    return c.json(saved, 201)
  })
