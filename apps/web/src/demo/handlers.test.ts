import {
  AI_SETTINGS_DEFAULTS,
  aiPreviewSchema,
  aiSettingsViewSchema,
  aiTestResultSchema,
  candidateSchema,
  emailPreviewSchema,
  emailSchema,
  emailTemplateSchema,
  fixtures,
  interviewQuestionSchema,
  jobSchema,
  meetingPreviewSchema,
  meetingResultSchema,
  meetingSchema,
  questionsProposalSchema,
  scorecardSchema,
  smtpSettingsViewSchema,
  smtpTestResultSchema,
} from '@hrmit/shared'
import { setupServer } from 'msw/node'
import { afterAll, beforeAll, expect, test, vi } from 'vitest'

// Node has no window.location; MSW needs one to resolve the relative handler paths.
vi.stubGlobal('location', new URL('http://localhost/'))
// A minimal localStorage, so the test can check that mutations are persisted for the next load.
const storage = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => storage.set(k, v),
  removeItem: (k: string) => storage.delete(k),
})
const { demoCv, handlers } = await import('./handlers.ts')
const { DEMO_STORAGE_KEY } = await import('../config.ts')
const persisted = () => JSON.parse(storage.get(DEMO_STORAGE_KEY) ?? '{}') as Store
type Store = {
  jobs: unknown[]
  questions?: { jobId: number; question: string }[]
  candidates: { id: number; aiSummaryJson?: unknown }[]
  evaluations?: { candidateId: number; questionId: number }[]
  aiSettings?: unknown
  smtpSettings?: { hasPass: boolean }
  templates?: { key: string; subject: string }[]
  emails?: { candidateId: number; status: string }[]
  meetings?: { candidateId: number }[]
}

// Contract check (ADR 0003): the demo handlers answer like the server and pass the shared schemas.
const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

const get = (path: string) => fetch(`http://localhost${path}`).then((r) => r.json())

test('demo GET /api/jobs returns the fixtures', async () => {
  expect(jobSchema.array().parse(await get('/api/jobs'))).toEqual(fixtures.jobs)
})

test('demo GET /api/jobs/:id/candidates filters by stage', async () => {
  const all = candidateSchema.array().parse(await get('/api/jobs/2/candidates'))
  expect(all).toEqual(fixtures.candidates.filter((c) => c.jobId === 2))
  const applied = candidateSchema.array().parse(await get('/api/jobs/2/candidates?stage=applied'))
  expect(applied.length).toBeGreaterThan(0)
  expect(applied.every((c) => c.stage === 'applied')).toBe(true)
})

test('demo PATCH /api/candidates/:id/stage moves the candidate', async () => {
  const res = await fetch('http://localhost/api/candidates/1/stage', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ stage: 'offer' }),
  })
  expect(res.status).toBe(200)
  expect(candidateSchema.parse(await res.json()).stage).toBe('offer')
  const inOffer = candidateSchema.array().parse(await get('/api/jobs/1/candidates?stage=offer'))
  expect(inOffer.some((c) => c.id === 1)).toBe(true)

  const bad = await fetch('http://localhost/api/candidates/1/stage', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ stage: 'hired' }),
  })
  expect(bad.status).toBe(400)
})

const send = (method: string, path: string, body: unknown) =>
  fetch(`http://localhost${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

test('demo jobs: create, edit, close', async () => {
  const created = await send('POST', '/api/jobs', { title: 'QA Engineer' })
  expect(created.status).toBe(201)
  const job = jobSchema.parse(await created.json())
  expect(job.status).toBe('open')
  expect((await send('POST', '/api/jobs', { title: '' })).status).toBe(400)

  const closed = await send('PUT', `/api/jobs/${job.id}`, { title: 'QA', status: 'closed' })
  expect(jobSchema.parse(await closed.json())).toMatchObject({ title: 'QA', status: 'closed' })
  expect((await send('PUT', '/api/jobs/9999', { title: 'x' })).status).toBe(404)
  expect(
    jobSchema
      .array()
      .parse(await get('/api/jobs'))
      .some((j) => j.id === job.id),
  ).toBe(true)
})

test('demo candidates: create, edit, upload a CV, delete', async () => {
  const input = { jobId: 1, firstName: 'Ada', lastName: 'Byron', email: 'ada@example.com' }
  const created = await send('POST', '/api/candidates', input)
  expect(created.status).toBe(201)
  const c = candidateSchema.parse(await created.json())
  expect(c).toMatchObject({ ...input, stage: 'applied', cvFilename: null, cvText: null })

  const edited = await send('PUT', `/api/candidates/${c.id}`, { ...input, notes: 'Hi' })
  expect(candidateSchema.parse(await edited.json()).notes).toBe('Hi')

  const form = new FormData()
  form.append('file', new File(['anything'], 'cv.pdf'))
  const up = await fetch(`http://localhost/api/candidates/${c.id}/cv`, {
    method: 'POST',
    body: form,
  })
  const withCv = candidateSchema.parse(await up.json())
  expect(withCv.cvFilename).toBe('cv.pdf')
  expect(withCv.cvText).toBe(demoCv(c))
  expect(withCv.cvText).toContain(fixtures.cvText)
  expect(persisted().candidates.some((x) => x.id === c.id)).toBe(true)
  expect((await fetch(`http://localhost/api/candidates/${c.id}/cv`)).status).toBe(404)

  const del = await fetch(`http://localhost/api/candidates/${c.id}`, { method: 'DELETE' })
  expect(del.status).toBe(204)
  const list = candidateSchema.array().parse(await get('/api/jobs/1/candidates'))
  expect(list.some((x) => x.id === c.id)).toBe(false)
  expect(persisted().candidates.some((x) => x.id === c.id)).toBe(false)
})

test('demo AI settings: persisted without the key, test always succeeds', async () => {
  expect(aiSettingsViewSchema.parse(await get('/api/settings/ai'))).toEqual(AI_SETTINGS_DEFAULTS)

  const body = { provider: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-x' }
  const saved = await send('PUT', '/api/settings/ai', { ...body, apiKey: 'sk-ant-demo' })
  expect(aiSettingsViewSchema.parse(await saved.json())).toEqual({ ...body, hasApiKey: true })
  expect(storage.get(DEMO_STORAGE_KEY)).not.toContain('sk-ant-demo')
  expect(persisted().aiSettings).toEqual({ ...body, hasApiKey: true })

  const kept = await send('PUT', '/api/settings/ai', { ...body, apiKey: '' })
  expect(aiSettingsViewSchema.parse(await kept.json()).hasApiKey).toBe(true)
  const cleared = await send('PUT', '/api/settings/ai', { ...body, apiKey: null })
  expect(aiSettingsViewSchema.parse(await cleared.json()).hasApiKey).toBe(false)
  expect((await send('PUT', '/api/settings/ai', { ...body, baseUrl: 'nope' })).status).toBe(400)

  const test = await fetch('http://localhost/api/ai/test', { method: 'POST' })
  expect(aiTestResultSchema.parse(await test.json())).toMatchObject({ ok: true, model: 'claude-x' })
})

test('demo AI actions: 422 without CV, fixture answer after upload, persisted, discarded', async () => {
  const ai = (kind: string, id: number) => send('POST', `/api/ai/${kind}/${id}`, { lang: 'en' })
  expect((await ai('summarize', 9999)).status).toBe(404)
  expect((await ai('summarize', 2)).status).toBe(422)

  const form = new FormData()
  form.append('file', new File(['x'], 'cv.pdf'))
  await fetch('http://localhost/api/candidates/2/cv', { method: 'POST', body: form })

  const summarized = candidateSchema.parse(await (await ai('summarize', 2)).json())
  expect(summarized.aiSummaryJson?.summary).toMatchObject(fixtures.ai[2]!.summary)
  const both = candidateSchema.parse(await (await ai('competencies', 2)).json())
  expect(both.aiSummaryJson?.summary).toEqual(summarized.aiSummaryJson?.summary)
  expect(both.aiSummaryJson?.competencies).toMatchObject(fixtures.ai[2]!.competencies)
  expect(persisted().candidates.find((c) => c.id === 2)).toMatchObject({
    aiSummaryJson: both.aiSummaryJson,
  })

  const gone = await fetch('http://localhost/api/ai/summary/2', { method: 'DELETE' })
  expect(candidateSchema.parse(await gone.json()).aiSummaryJson).toBeNull()
}, 10_000)

test('demo GET /api/ai/preview/:id anonymizes the uploaded text with the shared function', async () => {
  expect((await fetch('http://localhost/api/ai/preview/9999')).status).toBe(404)
  expect((await fetch('http://localhost/api/ai/preview/3')).status).toBe(422)
  const theo = fixtures.candidates[1]!
  const preview = aiPreviewSchema.parse(await get('/api/ai/preview/2'))
  expect(preview.original).toBe(demoCv(theo))
  expect(preview.anonymized).toContain('Candidate #2')
  expect(preview.anonymized).toContain(fixtures.cvText)
  for (const pii of [theo.firstName, theo.lastName, theo.email, theo.phone])
    expect(preview.anonymized).not.toContain(pii)
  expect(preview.replacements.map((r) => r.kind).sort()).toEqual(['email', 'name', 'phone'])
  // Settings were switched to Anthropic by the settings test above.
  expect(preview.provider).toBe('cloud')
})

test('demo questions: seeded per job, replaced in order, generated only onto an empty list', async () => {
  const seeded = interviewQuestionSchema.array().parse(await get('/api/jobs/1/questions'))
  expect(seeded.map((q) => q.question)).toEqual(fixtures.questions[1]!.map((q) => q.question))
  expect(seeded.map((q) => q.sortOrder)).toEqual(seeded.map((_, i) => i))
  expect((await fetch('http://localhost/api/jobs/9999/questions')).status).toBe(404)

  const inputs = [
    { competency: 'B', question: seeded[1]!.question },
    { competency: 'A', question: seeded[0]!.question },
  ]
  const put = await send('PUT', '/api/jobs/1/questions', inputs)
  const replaced = interviewQuestionSchema.array().parse(await put.json())
  expect(replaced.map(({ competency, question }) => ({ competency, question }))).toEqual(inputs)
  expect(replaced.map((q) => q.sortOrder)).toEqual([0, 1])
  expect(persisted().questions?.filter((q) => q.jobId === 1)).toHaveLength(2)
  expect(
    (await send('PUT', '/api/jobs/1/questions', [{ competency: '', question: 'x' }])).status,
  ).toBe(400)

  // Non-empty list: a proposal, nothing stored. Empty list: stored.
  const proposal = questionsProposalSchema.parse(
    await (await send('POST', '/api/ai/questions/1', { lang: 'en' })).json(),
  )
  expect(proposal).toEqual({ questions: fixtures.questions[1], applied: false })
  expect(interviewQuestionSchema.array().parse(await get('/api/jobs/1/questions'))).toEqual(
    replaced,
  )
  await send('PUT', '/api/jobs/1/questions', [])
  const applied = questionsProposalSchema.parse(
    await (await send('POST', '/api/ai/questions/1', { lang: 'en' })).json(),
  )
  expect(applied.applied).toBe(true)
  const stored = interviewQuestionSchema.array().parse(await get('/api/jobs/1/questions'))
  expect(stored.map((q) => q.question)).toEqual(fixtures.questions[1]!.map((q) => q.question))
  expect((await send('POST', '/api/ai/questions/9999', { lang: 'en' })).status).toBe(404)
}, 10_000)

test('demo scorecard: full list per candidate, upsert, foreign question rejected, cascades', async () => {
  const card = (id: number) => get(`/api/candidates/${id}/scorecard`).then(scorecardSchema.parse)
  // Beatrice (7) is seeded with four scores on job 2's fixture questions (job 1 was re-seeded).
  const seeded = await card(7)
  expect(
    seeded.evaluations.map(({ questionId, score, note }) => ({ questionId, score, note })),
  ).toEqual(fixtures.evaluations[7])
  expect((await fetch('http://localhost/api/candidates/9999/scorecard')).status).toBe(404)

  // Job 1's questions were re-seeded by the questions test above; candidate 6 is unscored.
  const blank = await card(6)
  expect(blank.evaluations.every((e) => e.score === null && e.note === '')).toBe(true)
  const [q1, q2] = blank.evaluations
  const put = await send('PUT', '/api/candidates/6/scorecard', [
    { questionId: q1!.questionId, score: 3, note: 'ok' },
  ])
  expect(scorecardSchema.parse(await put.json()).evaluations[0]).toMatchObject({
    score: 3,
    note: 'ok',
  })
  const again = await send('PUT', '/api/candidates/6/scorecard', [
    { questionId: q1!.questionId, score: 5, note: 'better' },
    { questionId: q2!.questionId, score: null, note: 'skipped' },
  ])
  const updated = scorecardSchema.parse(await again.json())
  expect(updated.evaluations.slice(0, 2).map((e) => e.score)).toEqual([5, null])
  expect(await card(6)).toEqual(updated)
  expect(persisted().evaluations?.filter((e) => e.candidateId === 6)).toHaveLength(2)

  const foreign = seeded.evaluations[0]!.questionId
  const bad = (body: unknown) => send('PUT', '/api/candidates/6/scorecard', body)
  expect((await bad([{ questionId: foreign, score: 1, note: '' }])).status).toBe(400)
  expect((await bad([{ questionId: q1!.questionId, score: 9, note: '' }])).status).toBe(400)

  // Reorder keeps evaluations, a shorter list drops the orphans, deletion drops them all.
  const inputs = blank.evaluations.map(({ competency, question }) => ({ competency, question }))
  await send('PUT', '/api/jobs/1/questions', [...inputs].reverse())
  expect((await card(6)).evaluations.filter((e) => e.note !== '')).toHaveLength(2)
  await send('PUT', '/api/jobs/1/questions', inputs.slice(1))
  expect((await card(6)).evaluations).toHaveLength(inputs.length - 1)
  expect(persisted().evaluations?.filter((e) => e.candidateId === 6)).toHaveLength(1)
  await fetch('http://localhost/api/candidates/6', { method: 'DELETE' })
  expect(persisted().evaluations?.some((e) => e.candidateId === 6)).toBe(false)
})

test('demo email: SMTP view without the password, templates editable, preview, outbox', async () => {
  const smtp = {
    host: 'smtp.example.test',
    port: 465,
    secure: true,
    user: 'u',
    from: 'hr@example.test',
    companyName: 'Acme',
  }
  const saved = smtpSettingsViewSchema.parse(
    await (await send('PUT', '/api/settings/smtp', { ...smtp, pass: 'secret' })).json(),
  )
  expect(saved).toEqual({ ...smtp, hasPass: true })
  expect(JSON.stringify(persisted())).not.toContain('secret')
  expect(persisted().smtpSettings?.hasPass).toBe(true)
  const test = await (await send('POST', '/api/settings/smtp/test', {})).json()
  expect(smtpTestResultSchema.parse(test).ok).toBe(true)

  expect(emailTemplateSchema.array().parse(await get('/api/templates'))).toEqual(
    fixtures.emailTemplates,
  )
  const edited = emailTemplateSchema.array().parse(
    await (
      await send('PUT', '/api/templates', [
        {
          key: 'rejection',
          subject: 'Re: {{jobTitle}}',
          body: 'Bye {{firstName}} from {{companyName}}',
        },
      ])
    ).json(),
  )
  expect(edited).toHaveLength(3)
  expect(persisted().templates?.find((t) => t.key === 'rejection')?.subject).toBe(
    'Re: {{jobTitle}}',
  )

  const preview = emailPreviewSchema.parse(
    await get('/api/candidates/5/emails/preview?template=rejection'),
  )
  expect(preview).toEqual({
    templateKey: 'rejection',
    subject: 'Re: Frontend Developer (React)',
    body: 'Bye Ingrid from Acme',
  })
  const bad = await fetch('http://localhost/api/candidates/5/emails/preview?template=offer')
  expect(bad.status).toBe(404)

  const before = emailSchema.array().parse(await get('/api/candidates/5/emails'))
  expect(before.map((e) => e.status)).toEqual(['sent'])
  const res = await send('POST', '/api/candidates/5/emails', preview)
  expect(res.status).toBe(201)
  expect(emailSchema.parse(await res.json())).toMatchObject({
    candidateId: 5,
    status: 'demo',
    ...preview,
  })
  const after = emailSchema.array().parse(await get('/api/candidates/5/emails'))
  expect(after.map((e) => e.status)).toEqual(['sent', 'demo'])
  expect(persisted().emails?.filter((e) => e.candidateId === 5)).toHaveLength(2)
  expect((await send('POST', '/api/candidates/999/emails', preview)).status).toBe(404)
})

test('demo meetings: fixtures listed newest first, preview, schedule records outbox and meeting', async () => {
  const before = meetingSchema.array().parse(await get('/api/candidates/7/meetings'))
  expect(before).toEqual(fixtures.meetings.filter((m) => m.candidateId === 7))
  const startsAt = '2026-10-21T09:00:00.000Z'
  const preview = meetingPreviewSchema.parse(
    await get(`/api/candidates/7/meetings/preview?startsAt=${startsAt}`),
  )
  expect(preview.body).toContain('When: 2026-10-21 09:00 UTC')
  expect(preview.body).toContain(`Where: ${preview.jitsiUrl}`)
  const res = await send('POST', '/api/candidates/7/meetings', {
    ...preview,
    startsAt,
    durationMin: 30,
  })
  expect(res.status).toBe(201)
  const { meeting, email } = meetingResultSchema.parse(await res.json())
  expect(meeting).toMatchObject({
    candidateId: 7,
    startsAt,
    durationMin: 30,
    jitsiUrl: preview.jitsiUrl,
    emailId: email.id,
  })
  expect(email).toMatchObject({
    candidateId: 7,
    templateKey: 'invite',
    status: 'demo',
    subject: preview.subject,
  })
  const after = meetingSchema.array().parse(await get('/api/candidates/7/meetings'))
  expect(after.map((m) => m.id)).toEqual([meeting!.id, 2])
  expect(persisted().meetings?.filter((m) => m.candidateId === 7)).toHaveLength(2)
  expect(
    (await send('POST', '/api/candidates/7/meetings', { startsAt, durationMin: 5 })).status,
  ).toBe(400)
  expect(
    (await send('POST', '/api/candidates/999/meetings', { startsAt, durationMin: 30 })).status,
  ).toBe(404)
  await fetch('http://localhost/api/candidates/7', { method: 'DELETE' })
  expect(persisted().meetings?.some((m) => m.candidateId === 7)).toBe(false)
})
