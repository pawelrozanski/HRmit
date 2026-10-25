import { readFile, rm, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { zValidator } from '@hono/zod-validator'
import { and, desc, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import {
  JITSI_PREFIX,
  buildIcs,
  candidateInputSchema,
  evaluationSchema,
  meetingInputSchema,
  moveStageSchema,
  noteInputSchema,
  renderTemplate,
  sendEmailInputSchema,
  type EmailPreview,
  type MeetingPreview,
  type MeetingResult,
  type Scorecard,
  type TemplateVars,
} from '@hrmit/shared'
import { db, uploadsDir } from '../db/index.ts'
import {
  candidateColumns,
  candidateNotes,
  candidates,
  emails,
  emailTemplates,
  evaluations,
  interviewQuestions,
  jobs,
  meetings,
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

/** One template rendered for one candidate (undefined when the candidate is missing). */
async function rendered(id: string, key: string, extra: TemplateVars = {}) {
  const [row] = await db
    .select({
      to: candidates.email,
      firstName: candidates.firstName,
      lastName: candidates.lastName,
      jobTitle: jobs.title,
      subject: emailTemplates.subject,
      body: emailTemplates.body,
    })
    .from(candidates)
    .innerJoin(jobs, eq(jobs.id, candidates.jobId))
    .innerJoin(emailTemplates, eq(emailTemplates.key, key))
    .where(byId(id))
  if (!row) return undefined
  const vars: TemplateVars = {
    firstName: row.firstName,
    lastName: row.lastName,
    jobTitle: row.jobTitle,
    companyName: (await getSetting('smtp.companyName')) ?? '',
    ...extra,
  }
  return {
    to: row.to,
    subject: renderTemplate(row.subject, vars),
    body: renderTemplate(row.body, vars),
  }
}

const newRoom = () => `${JITSI_PREFIX}${crypto.randomUUID()}`
/** 2026-10-20T08:00:00.000Z -> "2026-10-20 08:00 UTC" for the {{startsAt}} placeholder. */
const humanUtc = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`

export const candidatesRoute = new Hono()
  .post('/', zValidator('json', candidateInputSchema), async (c) => {
    const now = new Date().toISOString()
    const [row] = await db
      .insert(candidates)
      .values({ ...c.req.valid('json'), stageChangedAt: now, createdAt: now })
      .returning(candidateColumns)
    return c.json(row, 201)
  })
  // One candidate, for the candidate page (0.6.2).
  .get('/:id', async (c) => {
    const [row] = await db
      .select(candidateColumns)
      .from(candidates)
      .where(byId(c.req.param('id')))
    return row ? c.json(row) : c.json({ error: 'not found' }, 404)
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
  // Dated notes (0.6.0), same contract as the employee notes; cascade with the candidate.
  .get('/:id/notes', async (c) => {
    const id = Number(c.req.param('id'))
    if ((await jobOf(c.req.param('id'))) === undefined) return c.json({ error: 'not found' }, 404)
    const rows = await db
      .select()
      .from(candidateNotes)
      .where(eq(candidateNotes.candidateId, id))
      .orderBy(desc(candidateNotes.createdAt), desc(candidateNotes.id))
    return c.json(rows)
  })
  .post('/:id/notes', zValidator('json', noteInputSchema), async (c) => {
    const id = Number(c.req.param('id'))
    if ((await jobOf(c.req.param('id'))) === undefined) return c.json({ error: 'not found' }, 404)
    const { title, body, source } = c.req.valid('json')
    const [row] = await db
      .insert(candidateNotes)
      .values({
        candidateId: id,
        title: title || null,
        body,
        source,
        createdAt: new Date().toISOString(),
      })
      .returning()
    return c.json(row!, 201)
  })
  .delete('/:id/notes/:noteId', async (c) => {
    const rows = await db
      .delete(candidateNotes)
      .where(
        and(
          eq(candidateNotes.id, Number(c.req.param('noteId'))),
          eq(candidateNotes.candidateId, Number(c.req.param('id'))),
        ),
      )
      .returning({ id: candidateNotes.id })
    return rows.length ? c.body(null, 204) : c.json({ error: 'not found' }, 404)
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
  // Rendered template for the UI to edit before sending.
  .get(
    '/:id/emails/preview',
    zValidator('query', z.object({ template: z.string().min(1) }), (r, c) =>
      r.success ? undefined : c.json({ error: 'unknown template' }, 404),
    ),
    async (c) => {
      const key = c.req.valid('query').template
      const r = await rendered(c.req.param('id'), key)
      // The inner join on the template drops the row for an unknown key as well.
      if (!r) return c.json({ error: 'not found' }, 404)
      return c.json<EmailPreview>({ templateKey: key, subject: r.subject, body: r.body })
    },
  )
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
  .get('/:id/meetings', async (c) => {
    const candidateId = Number(c.req.param('id'))
    if ((await jobOf(c.req.param('id'))) === undefined) return c.json({ error: 'not found' }, 404)
    return c.json(
      await db
        .select()
        .from(meetings)
        .where(eq(meetings.candidateId, candidateId))
        .orderBy(desc(meetings.id)),
    )
  })
  // The room generated here is what the client sends back, so the text and the link agree.
  .get(
    '/:id/meetings/preview',
    zValidator('query', z.object({ startsAt: z.iso.datetime() })),
    async (c) => {
      const jitsiUrl = newRoom()
      const startsAt = humanUtc(c.req.valid('query').startsAt)
      const r = await rendered(c.req.param('id'), 'invite', { jitsiUrl, startsAt })
      if (!r) return c.json({ error: 'not found' }, 404)
      return c.json<MeetingPreview>({ subject: r.subject, body: r.body, jitsiUrl })
    },
  )
  // Sends the invite with the .ics attached and records both rows. A failed send keeps the
  // failed email row only: the recruiter fixes SMTP and schedules again, nothing dangles.
  .post('/:id/meetings', zValidator('json', meetingInputSchema), async (c) => {
    const candidateId = Number(c.req.param('id'))
    const input = c.req.valid('json')
    const jitsiUrl = input.jitsiUrl ?? newRoom()
    const r = await rendered(c.req.param('id'), 'invite', {
      jitsiUrl,
      startsAt: humanUtc(input.startsAt),
    })
    if (!r) return c.json({ error: 'not found' }, 404)
    const subject = input.subject ?? r.subject
    const body = input.body ?? r.body
    const ics = buildIcs({
      uid: `${crypto.randomUUID()}@hrmit`,
      summary: subject,
      description: body,
      startsAt: input.startsAt,
      durationMin: input.durationMin,
      url: jitsiUrl,
      organizerEmail: (await getSetting('smtp.from')) ?? '',
      attendeeEmail: r.to,
    })
    let error: string | null = null
    try {
      await sendMail(r.to, subject, body, [
        { filename: 'invite.ics', content: ics, contentType: 'text/calendar; method=REQUEST' },
      ])
    } catch (err) {
      if (err instanceof SmtpNotConfigured) return c.json({ error: 'smtp not configured' }, 409)
      error = err instanceof Error ? err.message : String(err)
    }
    const status = error ? 'failed' : 'sent'
    log[error ? 'warn' : 'info']('meeting', { candidateId, status })
    const [email] = await db
      .insert(emails)
      .values({
        candidateId,
        templateKey: 'invite',
        subject,
        body,
        status,
        sentAt: new Date().toISOString(),
        error,
      })
      .returning()
    const [meeting] = error
      ? [null]
      : await db
          .insert(meetings)
          .values({
            candidateId,
            startsAt: input.startsAt,
            durationMin: input.durationMin,
            jitsiUrl,
            emailId: email!.id,
          })
          .returning()
    return c.json<MeetingResult>({ meeting: meeting ?? null, email: email! }, 201)
  })
