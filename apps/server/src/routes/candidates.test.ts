import { readdirSync } from 'node:fs'
import { expect, test } from 'vitest'
import { eq } from 'drizzle-orm'
import { candidateSchema, fixtures, scorecardSchema } from '@hrmit/shared'
import { app } from '../app.ts'
import { db, uploadsDir } from '../db/index.ts'
import { evaluations } from '../db/schema.ts'
import { tinyDocx, tinyPdf, zip } from '../test/cv-files.ts'

const json = (method: string, path: string, body: unknown) =>
  app.request(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

const upload = (id: number, name: string, bytes: Uint8Array<ArrayBuffer>) => {
  const form = new FormData()
  form.append('file', new File([bytes], name))
  return app.request(`/api/candidates/${id}/cv`, { method: 'POST', body: form })
}

const files = () => readdirSync(uploadsDir)

// --- routes ---------------------------------------------------------------------------------

test('PATCH /api/candidates/:id/stage moves the candidate and stamps the change', async () => {
  const before = Date.now()
  const res = await json('PATCH', '/api/candidates/1/stage', { stage: 'interview' })
  expect(res.status).toBe(200)
  const moved = candidateSchema.parse(await res.json())
  expect(moved.stage).toBe('interview')
  expect(Date.parse(moved.stageChangedAt)).toBeGreaterThanOrEqual(before)

  const list = candidateSchema
    .array()
    .parse(await (await app.request('/api/jobs/1/candidates?stage=interview')).json())
  expect(list.some((c) => c.id === 1)).toBe(true)
})

test('PATCH rejects unknown stages and unknown candidates', async () => {
  expect((await json('PATCH', '/api/candidates/1/stage', { stage: 'hired' })).status).toBe(400)
  expect((await json('PATCH', '/api/candidates/9999/stage', { stage: 'offer' })).status).toBe(404)
})

test('POST and PUT /api/candidates validate and persist', async () => {
  const input = { jobId: 1, firstName: 'Ada', lastName: 'Byron', email: 'ada@example.com' }
  const created = await json('POST', '/api/candidates', input)
  expect(created.status).toBe(201)
  const c = candidateSchema.parse(await created.json())
  expect(c).toMatchObject({ ...input, stage: 'applied', phone: '', cvFilename: null })
  expect('cvPath' in c).toBe(false)

  expect((await json('POST', '/api/candidates', { ...input, email: 'nope' })).status).toBe(400)

  const updated = await json('PUT', `/api/candidates/${c.id}`, {
    ...input,
    notes: 'Called back',
    stage: 'screening',
  })
  const u = candidateSchema.parse(await updated.json())
  expect(u.notes).toBe('Called back')
  expect(Date.parse(u.stageChangedAt)).toBeGreaterThan(Date.parse(c.stageChangedAt) - 1)
  expect((await json('PUT', '/api/candidates/9999', input)).status).toBe(404)
})

test('CV upload: real PDF and DOCX are stored under a UUID and their text extracted', async () => {
  const before = files().length
  const pdf = await upload(2, 'Résumé.pdf', tinyPdf('Hello from PDF'))
  expect(pdf.status).toBe(200)
  const c = candidateSchema.parse(await pdf.json())
  expect(c.cvFilename).toBe('Résumé.pdf')
  expect(c.cvText).toContain('Hello from PDF')
  expect(files().length).toBe(before + 1)
  expect(files().some((f) => f.includes('Résumé'))).toBe(false)

  // download: by id, original name in the header, path never exposed
  const dl = await app.request('/api/candidates/2/cv')
  expect(dl.status).toBe(200)
  expect(dl.headers.get('content-type')).toBe('application/pdf')
  expect(dl.headers.get('content-disposition')).toContain("filename*=UTF-8''R%C3%A9sum%C3%A9.pdf")
  expect(new TextDecoder().decode(await dl.arrayBuffer()).startsWith('%PDF-')).toBe(true)

  // second upload replaces the first file on disk
  const docx = await upload(2, 'cv.docx', tinyDocx('Hello from DOCX'))
  expect(docx.status).toBe(200)
  expect(candidateSchema.parse(await docx.json()).cvText).toContain('Hello from DOCX')
  expect(files().length).toBe(before + 1)
})

test('CV upload rejects disguised and oversized files, and unknown candidates', async () => {
  const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]) // "MZ" header
  expect((await upload(3, 'malware.pdf', exe)).status).toBe(415)
  expect((await upload(3, 'cv.docx', zip({ 'a.txt': 'not a docx' }))).status).toBe(415)
  expect((await upload(3, 'cv.txt', new TextEncoder().encode('plain'))).status).toBe(415)
  expect((await upload(3, 'big.pdf', new Uint8Array(10 * 1024 * 1024 + 1))).status).toBe(413)
  expect((await upload(9999, 'cv.pdf', tinyPdf('x'))).status).toBe(404)
  expect((await app.request('/api/candidates/3/cv')).status).toBe(404)
})

test('a broken PDF still uploads, with empty text', async () => {
  const res = await upload(4, 'broken.pdf', new TextEncoder().encode('%PDF-1.4 garbage'))
  expect(res.status).toBe(200)
  expect(candidateSchema.parse(await res.json()).cvText).toBe('')
})

test('DELETE /api/candidates/:id removes the row and the file', async () => {
  await upload(5, 'cv.pdf', tinyPdf('bye'))
  const stored = files()
  expect((await app.request('/api/candidates/5', { method: 'DELETE' })).status).toBe(204)
  expect((await app.request('/api/candidates/5/cv')).status).toBe(404)
  expect(files().length).toBe(stored.length - 1)
  const list = candidateSchema
    .array()
    .parse(await (await app.request('/api/jobs/1/candidates')).json())
  expect(list.some((c) => c.id === 5)).toBe(false)
  expect((await app.request('/api/candidates/5', { method: 'DELETE' })).status).toBe(404)
})

// --- scorecard ------------------------------------------------------------------------------

const scorecardOf = async (id: number) =>
  scorecardSchema.parse(await (await app.request(`/api/candidates/${id}/scorecard`)).json())
const storedFor = (candidateId: number) =>
  db.select().from(evaluations).where(eq(evaluations.candidateId, candidateId))

test('GET /api/candidates/:id/scorecard lists every question of the job, scored or not', async () => {
  const seeded = await scorecardOf(1)
  expect(seeded.candidateId).toBe(1)
  expect(
    seeded.evaluations.map(({ questionId, score, note }) => ({ questionId, score, note })),
  ).toEqual(fixtures.evaluations[1])
  expect(seeded.evaluations.map((e) => e.question)).toEqual(
    fixtures.questions[1]!.map((q) => q.question),
  )

  const unscored = await scorecardOf(3)
  expect(unscored.evaluations).toHaveLength(fixtures.questions[1]!.length)
  expect(unscored.evaluations.every((e) => e.score === null && e.note === '')).toBe(true)
  expect((await app.request('/api/candidates/9999/scorecard')).status).toBe(404)
})

test('PUT /api/candidates/:id/scorecard upserts, re-PUT updates, foreign questions are rejected', async () => {
  const [q1, q2] = (await scorecardOf(3)).evaluations
  const first = await json('PUT', '/api/candidates/3/scorecard', [
    { questionId: q1!.questionId, score: 4, note: 'Clear example.' },
  ])
  expect(first.status).toBe(200)
  const after = scorecardSchema.parse(await first.json())
  expect(after.evaluations[0]).toMatchObject({ score: 4, note: 'Clear example.' })
  expect(after.evaluations[1]).toMatchObject({ score: null, note: '' })

  const second = await json('PUT', '/api/candidates/3/scorecard', [
    { questionId: q1!.questionId, score: 2, note: 'On reflection, vague.' },
    { questionId: q2!.questionId, score: null, note: 'Not asked yet.' },
  ])
  const updated = scorecardSchema.parse(await second.json())
  expect(updated.evaluations[0]).toMatchObject({ score: 2, note: 'On reflection, vague.' })
  expect(updated.evaluations[1]).toMatchObject({ score: null, note: 'Not asked yet.' })
  expect(await scorecardOf(3)).toEqual(updated)
  expect(await storedFor(3)).toHaveLength(2)

  // A question of another job (job 2's first), an out-of-range score, an unknown candidate.
  const foreign = (await scorecardOf(7)).evaluations[0]!.questionId
  expect(
    (
      await json('PUT', '/api/candidates/3/scorecard', [
        { questionId: foreign, score: 3, note: '' },
      ])
    ).status,
  ).toBe(400)
  expect(
    (
      await json('PUT', '/api/candidates/3/scorecard', [
        { questionId: q1!.questionId, score: 6, note: '' },
      ])
    ).status,
  ).toBe(400)
  expect((await json('PUT', '/api/candidates/9999/scorecard', [])).status).toBe(404)
})

test('evaluations cascade: candidate deletion and question removal, reorder keeps them', async () => {
  expect((await storedFor(1)).length).toBeGreaterThan(0)
  expect((await app.request('/api/candidates/1', { method: 'DELETE' })).status).toBe(204)
  expect(await storedFor(1)).toEqual([])

  // Job 1 still has Marcus (4) scored on six questions. Reorder: all six survive.
  const before = await scorecardOf(4)
  const inputs = before.evaluations.map(({ competency, question }) => ({ competency, question }))
  await json('PUT', '/api/jobs/1/questions', [...inputs].reverse())
  expect((await scorecardOf(4)).evaluations.filter((e) => e.score !== null)).toHaveLength(6)
  // Keep only the first two questions: evaluations of the others are gone.
  await json('PUT', '/api/jobs/1/questions', inputs.slice(0, 2))
  const shorter = await scorecardOf(4)
  expect(shorter.evaluations).toHaveLength(2)
  expect(await storedFor(4)).toHaveLength(2)
})
