import {
  AI_SETTINGS_DEFAULTS,
  aiModelsSchema,
  aiPreviewSchema,
  aiSettingsViewSchema,
  aiTestResultSchema,
  candidateNoteSchema,
  candidateSchema,
  cvImportSchema,
  chatEventSchema,
  dashboardSchema,
  type ChatContext,
  emailPreviewSchema,
  emailSchema,
  emailTemplateSchema,
  employeeEmailSchema,
  employeeNoteSchema,
  employeeWithTeamsSchema,
  fixtures,
  requirementLines,
  interviewQuestionSchema,
  jobSchema,
  meetingPreviewSchema,
  meetingResultSchema,
  meetingSchema,
  questionsProposalSchema,
  scorecardSchema,
  smtpSettingsViewSchema,
  smtpTestResultSchema,
  teamDetailSchema,
  teamEmailSchema,
  teamSendResultSchema,
  teamSchema,
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
  employeeEmails?: { employeeId: number }[]
  jobs: unknown[]
  questions?: { jobId: number; question: string }[]
  candidates: { id: number; aiSummaryJson?: unknown }[]
  evaluations?: { candidateId: number; questionId: number }[]
  aiSettings?: unknown
  smtpSettings?: { hasPass: boolean; companyName: string }
  templates?: { key: string; subject: string }[]
  emails?: { candidateId: number; status: string }[]
  meetings?: { candidateId: number }[]
  employeeNotes?: { id: number; employeeId: number }[]
  candidateNotes?: { id: number; candidateId: number }[]
  teams?: { id: number }[]
  teamMembers?: { teamId: number }[]
}

// Contract check (ADR 0003): the demo handlers answer like the server and pass the shared schemas.
const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

const get = (path: string) => fetch(`http://localhost${path}`).then((r) => r.json())

test('demo POST /api/ai/chat: scenarios stream like the server, unknown questions get the demo note', async () => {
  const chat = async (
    content: string,
    context: ChatContext = { view: 'dashboard' },
    lang = 'en',
  ) => {
    const res = await fetch('http://localhost/api/ai/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content }], context, lang }),
    })
    expect(res.headers.get('content-type')).toContain('x-ndjson')
    const events = (await res.text())
      .trim()
      .split('\n')
      .map((l) => chatEventSchema.parse(JSON.parse(l)))
    const text = events.flatMap((e) => (e.type === 'text' ? [e.text] : [])).join('')
    const refs = events.find((e) => e.type === 'refs')
    const proposal = events.find((e) => e.type === 'proposal')
    return {
      types: [...new Set(events.map((e) => e.type))],
      text,
      refs: refs?.type === 'refs' ? refs.refs : undefined,
      proposal: proposal?.type === 'proposal' ? proposal.proposal : undefined,
    }
  }
  const longest = await chat('Who has been waiting the longest?')
  expect(longest.types).toEqual(['tool', 'text', 'refs', 'done'])
  expect(longest.text).toContain('Samuel Okonkwo')
  expect(longest.refs?.candidates['8']).toEqual({ name: 'Samuel Okonkwo', jobId: 2 })
  // The portfolio scenario: no ranking, facts and the decision named as the recruiter's.
  const best = await chat('Kto jest najlepszym kandydatem?', { view: 'recruitment', id: 1 }, 'pl')
  expect(best.text).toMatch(/Nie rankinguję/)
  expect(best.text).toContain('Amelia Hartwell')
  expect(best.text).toMatch(/decyzja należy do Ciebie/)
  // 0.6.0 scenarios: scorecard facts, a note proposal that stores nothing, requirements, notes.
  const card = await chat('Show the interview ratings', { view: 'candidate', id: 1 })
  expect(card.types).toEqual(['tool', 'text', 'refs', 'done'])
  expect(card.text).toMatch(/Accessibility: .*\/5/)
  expect(card.text).toMatch(/not mine/)
  const notesBefore = persisted().candidateNotes?.length
  const draft = await chat('Note down a summary of the interview', { view: 'candidate', id: 1 })
  expect(draft.types).toEqual(['tool', 'text', 'proposal', 'refs', 'done'])
  expect(draft.proposal).toMatchObject({ target: 'candidate', id: 1, title: 'Interview summary' })
  expect(draft.proposal?.body).toMatch(/Interview summary/)
  expect(persisted().candidateNotes?.length).toBe(notesBefore)
  const req = await chat('Jakie są wymagania?', { view: 'recruitment', id: 1 }, 'pl')
  expect(req.text).toContain('React')
  expect(req.text).toMatch(/Zespół rekrutujący: IT/)
  expect(req.text).toMatch(/Poziom: specjalista \(mid\)/)
  expect(req.text).toMatch(/Widełki: 14\s000–19\s000 PLN miesięcznie/)
  expect(req.text).toMatch(/Mile widziane:\n- Testing Library/)
  const notes = await chat('What do the notes say?', { view: 'employee', id: 4 })
  expect(notes.text).toContain('Out of office 20-24 October.')
  expect(notes.refs?.employees['4']?.name).toBeTruthy()
  const role = await chat('What is this person’s role?', { view: 'employee', id: 4 })
  expect(role.text).toMatch(/Teams: /)
  const other = await chat('What is the meaning of life?')
  expect(other.types).toEqual(['text', 'refs', 'done'])
  expect(other.text).toContain('suggested questions')
  expect(
    (
      await fetch('http://localhost/api/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      })
    ).status,
  ).toBe(400)
}, 20_000)

test('demo GET /api/dashboard: relative fixtures give meetings, stuck rows and a failed email', async () => {
  const d = dashboardSchema.parse(await get('/api/dashboard'))
  expect(d.counts).toMatchObject({ openJobs: 3, teams: 4, meetingsThisWeek: 2 })
  expect(d.meetings.map((m) => m.candidateId)).toEqual([1, 7])
  // Theo (9 days) and Samuel (12 days); job 3 is closed, so its long waits do not count.
  expect(d.stuck.map((s) => s.candidateId)).toEqual([8, 2])
  expect(
    (await get('/api/dashboard?stuckDays=10')).stuck.map(
      (s: { candidateId: number }) => s.candidateId,
    ),
  ).toEqual([8])
  expect(d.missingScores.map((m) => m.candidateId)).toEqual([4, 7])
  expect(d.openJobs.find((j) => j.id === 1)?.stages).toMatchObject({ applied: 2, interview: 1 })
  expect(d.failedEmails).toMatchObject([{ kind: 'candidate', targetId: 2, jobId: 1 }])
  expect(JSON.stringify(d)).not.toMatch(/@example.com/)
  expect((await fetch('http://localhost/api/dashboard?stuckDays=0')).status).toBe(400)
})

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

  const body = {
    provider: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-x',
    chatEmployees: false,
  }
  const saved = await send('PUT', '/api/settings/ai', { ...body, apiKey: 'sk-ant-demo' })
  expect(aiSettingsViewSchema.parse(await saved.json())).toEqual({ ...body, hasApiKey: true })
  expect(storage.get(DEMO_STORAGE_KEY)).not.toContain('sk-ant-demo')
  expect(persisted().aiSettings).toEqual({ ...body, hasApiKey: true })
  // The backup is the whole store as a JSON download.
  const backup = await fetch('http://localhost/api/backup')
  expect(backup.headers.get('content-disposition')).toMatch(/hrmit-demo-backup-.*\.json"$/)
  const dump = (await backup.json()) as { candidates: unknown[] }
  expect(Object.keys(dump)).toContain('candidates')
  // Restore: the same JSON back replaces the store; junk is refused.
  const form = new FormData()
  form.append('file', new File([JSON.stringify({ ...dump, candidates: [] })], 'b.json'))
  const restored = await fetch('http://localhost/api/backup/restore', {
    method: 'POST',
    body: form,
  })
  expect(await restored.json()).toEqual({ candidates: 0, files: 0 })
  expect(persisted().candidates).toEqual([])
  const junk = new FormData()
  junk.append('file', new File(['nope'], 'b.json'))
  expect(
    (await fetch('http://localhost/api/backup/restore', { method: 'POST', body: junk })).status,
  ).toBe(415)
  const back = new FormData()
  back.append('file', new File([JSON.stringify(dump)], 'b.json'))
  await fetch('http://localhost/api/backup/restore', { method: 'POST', body: back })
  expect(persisted().candidates).toHaveLength(dump.candidates.length)
  // Prompt texts round-trip through the store.
  const { AI_PROMPT_DEFAULTS, aiPromptsSchema } = await import('@hrmit/shared')
  expect(aiPromptsSchema.parse(await get('/api/settings/prompts'))).toEqual(AI_PROMPT_DEFAULTS)
  const prompts = { ...AI_PROMPT_DEFAULTS, chat: 'Answer in {{lang}}. Today is {{today}}.' }
  expect((await send('PUT', '/api/settings/prompts', prompts)).status).toBe(200)
  expect(aiPromptsSchema.parse(await get('/api/settings/prompts'))).toEqual(prompts)
  expect((await send('PUT', '/api/settings/prompts', { ...prompts, chat: '' })).status).toBe(400)

  const kept = await send('PUT', '/api/settings/ai', { ...body, apiKey: '' })
  expect(aiSettingsViewSchema.parse(await kept.json()).hasApiKey).toBe(true)
  const cleared = await send('PUT', '/api/settings/ai', { ...body, apiKey: null })
  expect(aiSettingsViewSchema.parse(await cleared.json()).hasApiKey).toBe(false)
  expect((await send('PUT', '/api/settings/ai', { ...body, baseUrl: 'nope' })).status).toBe(400)

  const test = await fetch('http://localhost/api/ai/test', { method: 'POST' })
  expect(aiTestResultSchema.parse(await test.json())).toMatchObject({ ok: true, model: 'claude-x' })

  // Installed models only for Ollama; a pre-0.3.3 id still validates as the custom provider.
  expect(aiModelsSchema.parse(await get('/api/ai/models'))).toEqual({ models: [] })
  await send('PUT', '/api/settings/ai', AI_SETTINGS_DEFAULTS)
  expect(aiModelsSchema.parse(await get('/api/ai/models')).models).toContain('qwen2.5:7b-instruct')
  expect((await send('PUT', '/api/settings/ai', { ...body, provider: 'groq' })).status).toBe(200)
  expect((await send('PUT', '/api/settings/ai', { ...body, provider: 'nope' })).status).toBe(400)
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

  // CV against the requirements: one item per job line, every status shows up on the demo CV.
  const matched = candidateSchema.parse(await (await ai('requirements', 2)).json())
  const items = matched.aiSummaryJson?.requirements?.items ?? []
  expect(items.map((i) => i.requirement)).toEqual(
    requirementLines(fixtures.jobs[0]!).map((l) => l.requirement),
  )
  expect(new Set(items.map((i) => i.status))).toEqual(new Set(['met', 'partial', 'missing']))
  expect(candidateSchema.parse(await get('/api/candidates/2')).aiSummaryJson).toEqual(
    matched.aiSummaryJson,
  )
  expect((await fetch('http://localhost/api/candidates/9999')).status).toBe(404)

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
  const edited = emailTemplateSchema.parse(
    await (
      await send('PUT', '/api/templates/rejection', {
        name: 'Rejection',
        subject: 'Re: {{jobTitle}}',
        body: 'Bye {{firstName}} from {{companyName}}',
      })
    ).json(),
  )
  expect(edited).toMatchObject({ key: 'rejection', builtIn: true, name: 'Rejection' })
  expect(persisted().templates?.find((t) => t.key === 'rejection')?.subject).toBe(
    'Re: {{jobTitle}}',
  )
  // Custom template: created, unique name (case-insensitive), listed after the built-ins, deletable.
  const custom = { name: 'Offer', subject: 'Offer: {{jobTitle}}', body: 'Hi {{firstName}}' }
  const created = await send('POST', '/api/templates', custom)
  expect(created.status).toBe(201)
  const row = emailTemplateSchema.parse(await created.json())
  expect(row).toMatchObject({ ...custom, builtIn: false, description: null })
  expect((await send('POST', '/api/templates', { ...custom, name: 'offer' })).status).toBe(409)
  expect(
    emailTemplateSchema
      .array()
      .parse(await get('/api/templates'))
      .at(-1)?.key,
  ).toBe(row.key)
  expect(
    emailPreviewSchema.parse(await get(`/api/candidates/5/emails/preview?template=${row.key}`))
      .body,
  ).toBe('Hi Ingrid')
  expect((await fetch(`http://localhost/api/templates/invite`, { method: 'DELETE' })).status).toBe(
    400,
  )
  expect(
    (await fetch(`http://localhost/api/templates/${row.key}`, { method: 'DELETE' })).status,
  ).toBe(204)
  expect(persisted().templates?.some((t) => t.key === row.key)).toBe(false)
  // Restore puts the shipped text and the null name back.
  const restored = emailTemplateSchema.parse(
    await (await send('POST', '/api/templates/rejection/restore', {})).json(),
  )
  expect(restored).toEqual(fixtures.emailTemplates[2])
  await send('PUT', '/api/templates/rejection', {
    name: 'Rejection',
    subject: 'Re: {{jobTitle}}',
    body: 'Bye {{firstName}} from {{companyName}}',
  })

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

test('demo POST /api/ai/parse-cv returns the fictional import for any file', async () => {
  const form = new FormData()
  form.append('file', new File(['anything'], 'cv.pdf'))
  const res = await fetch('http://localhost/api/ai/parse-cv', { method: 'POST', body: form })
  expect(res.status).toBe(200)
  const result = cvImportSchema.parse(await res.json())
  expect(result.fields).toEqual(fixtures.cvImport)
  expect(result.cvText).toContain(fixtures.cvImport.email)
})

test('demo employees and teams: counts from the store, add members, lead role, cascades', async () => {
  const teams = teamSchema.array().parse(await get('/api/teams'))
  expect(teams.map((t) => [t.name, t.memberCount, t.openJobCount])).toEqual([
    ['Customer Support', 4, 0],
    ['IT', 4, 1],
    ['Marketing', 2, 1],
    ['Sales', 4, 0],
  ])
  const employees = employeeWithTeamsSchema.array().parse(await get('/api/employees?q=hanna'))
  expect(employees.map((e) => e.teams.map((t) => t.name))).toEqual([['Customer Support', 'IT']])
  expect(employees[0]!.noteCount).toBe(3)
  expect(employeeWithTeamsSchema.array().parse(await get('/api/employees?teamId=4'))).toHaveLength(
    2,
  )
  expect(
    jobSchema
      .array()
      .parse(await get('/api/jobs?teamId=2'))
      .map((j) => j.id),
  ).toEqual([1])
  expect((await fetch('http://localhost/api/jobs?teamId=x')).status).toBe(400)

  expect((await send('POST', '/api/teams', { name: 'it' })).status).toBe(409)
  const created = await send('POST', '/api/teams', { name: 'Legal', description: 'Contracts' })
  expect(created.status).toBe(201)
  const team = teamDetailSchema.parse(await created.json())
  expect(team).toMatchObject({ name: 'Legal', memberCount: 0, members: [], jobs: [] })

  const emp = await send('POST', '/api/employees', {
    firstName: 'Ada',
    lastName: 'Test',
    position: 'Counsel',
    email: 'ada.test@example.com',
  })
  expect(emp.status).toBe(201)
  const employee = employeeWithTeamsSchema.parse(await emp.json())
  expect(employee).toMatchObject({ hiredAt: null, duties: '', teams: [] })

  const added = await send('POST', `/api/teams/${team.id}/members`, {
    employeeIds: [employee.id, 1, 1],
  })
  expect(teamDetailSchema.parse(await added.json()).members.map((m) => m.id)).toEqual([
    1,
    employee.id,
  ])
  const lead = await send('PATCH', `/api/teams/${team.id}/members/${employee.id}`, {
    role: 'lead',
  })
  expect(teamDetailSchema.parse(await lead.json()).members[0]).toMatchObject({
    id: employee.id,
    role: 'lead',
  })
  expect((await send('POST', '/api/jobs', { title: 'Counsel', teamId: team.id })).status).toBe(201)
  expect((await send('POST', '/api/jobs', { title: 'x', teamId: 999 })).status).toBe(400)
  expect(
    teamSchema
      .array()
      .parse(await get('/api/teams'))
      .find((t) => t.id === team.id),
  ).toMatchObject({ memberCount: 2, openJobCount: 1 })
  expect(persisted().teamMembers?.filter((m) => m.teamId === team.id)).toHaveLength(2)

  // Deleting the employee drops the membership; deleting the team keeps the job without a team.
  await fetch(`http://localhost/api/employees/${employee.id}`, { method: 'DELETE' })
  expect((await fetch(`http://localhost/api/employees/${employee.id}`)).status).toBe(404)
  expect(teamDetailSchema.parse(await get(`/api/teams/${team.id}`)).members).toHaveLength(1)
  expect(
    (await fetch(`http://localhost/api/teams/${team.id}/members/1`, { method: 'DELETE' })).status,
  ).toBe(204)
  expect((await fetch('http://localhost/api/employees/1')).status).toBe(200)
  expect((await fetch(`http://localhost/api/teams/${team.id}`, { method: 'DELETE' })).status).toBe(
    204,
  )
  const jobs = jobSchema.array().parse(await get('/api/jobs'))
  expect(jobs.find((j) => j.title === 'Counsel')?.teamId).toBeNull()
  expect(persisted().teams?.some((t) => t.id === team.id)).toBe(false)
})

test('demo employee notes: newest first, add, delete, 404s, gone with the employee', async () => {
  const notes = async (id: number) =>
    employeeNoteSchema.array().parse(await get(`/api/employees/${id}/notes`))
  expect((await notes(4)).map((n) => n.body)[0]).toBe('Out of office 20-24 October.')
  expect((await fetch('http://localhost/api/employees/9999/notes')).status).toBe(404)
  expect((await send('POST', '/api/employees/1/notes', { body: ' ' })).status).toBe(400)
  const posted = await send('POST', '/api/employees/1/notes', {
    title: ' ',
    body: ' Likes Tuesdays ',
  })
  expect(posted.status).toBe(201)
  const note = employeeNoteSchema.parse(await posted.json())
  expect(note).toMatchObject({ employeeId: 1, title: null, body: 'Likes Tuesdays' })
  expect((await notes(1)).map((n) => n.id)).toEqual([note.id])
  expect(employeeWithTeamsSchema.parse(await get('/api/employees/1')).noteCount).toBe(1)
  expect(persisted().employeeNotes?.some((n) => n.id === note.id)).toBe(true)
  const del = (eid: number, nid: number) =>
    fetch(`http://localhost/api/employees/${eid}/notes/${nid}`, { method: 'DELETE' })
  expect((await del(2, note.id)).status).toBe(404)
  expect((await del(1, note.id)).status).toBe(204)
  expect((await del(1, note.id)).status).toBe(404)
  await send('POST', '/api/employees/1/notes', { body: 'gone' })
  await fetch('http://localhost/api/employees/1', { method: 'DELETE' })
  expect(persisted().employeeNotes?.some((n) => n.employeeId === 1)).toBe(false)
})

test('demo candidate notes: seeded from the old field, add with source, delete, gone with the candidate', async () => {
  const notes = async (id: number) =>
    candidateNoteSchema.array().parse(await get(`/api/candidates/${id}/notes`))
  expect((await notes(1)).map((n) => n.body)).toEqual([
    'Portfolio shows a strong eye for accessible forms.',
  ])
  expect(await notes(3)).toEqual([])
  expect((await fetch('http://localhost/api/candidates/9999/notes')).status).toBe(404)
  expect((await send('POST', '/api/candidates/3/notes', { body: ' ' })).status).toBe(400)
  const posted = await send('POST', '/api/candidates/3/notes', {
    title: 'Interview',
    body: 'Asked about remote work.',
    source: 'assistant',
  })
  expect(posted.status).toBe(201)
  const note = candidateNoteSchema.parse(await posted.json())
  expect(note).toMatchObject({ candidateId: 3, title: 'Interview', source: 'assistant' })
  expect((await notes(3)).map((n) => n.id)).toEqual([note.id])
  expect(persisted().candidateNotes?.some((n) => n.id === note.id)).toBe(true)
  expect(
    (await fetch(`http://localhost/api/candidates/1/notes/${note.id}`, { method: 'DELETE' }))
      .status,
  ).toBe(404)
  expect(
    (await fetch(`http://localhost/api/candidates/3/notes/${note.id}`, { method: 'DELETE' }))
      .status,
  ).toBe(204)
  await send('POST', '/api/candidates/3/notes', { body: 'gone' })
  await fetch('http://localhost/api/candidates/3', { method: 'DELETE' })
  expect(persisted().candidateNotes?.some((n) => n.candidateId === 3)).toBe(false)
})

test('demo employee and team messages: outbox rows, placeholders, non-member 400, gone with the employee', async () => {
  const text = { subject: 'Hi {{firstName}}', body: 'From {{companyName}}.' }
  expect(await get('/api/employees/4/emails')).toEqual([])
  expect((await fetch('http://localhost/api/employees/9999/emails')).status).toBe(404)
  expect((await send('POST', '/api/employees/4/emails', { subject: '', body: 'x' })).status).toBe(
    400,
  )
  const one = await send('POST', '/api/employees/4/emails', text)
  expect(one.status).toBe(201)
  expect(employeeEmailSchema.parse(await one.json())).toMatchObject({
    employeeId: 4,
    teamId: null,
    status: 'demo',
    subject: 'Hi Hanna',
    body: `From ${persisted().smtpSettings?.companyName}.`,
  })
  expect((await send('POST', '/api/teams/2/emails', { ...text, employeeIds: [4, 1] })).status).toBe(
    400,
  )
  const many = await send('POST', '/api/teams/2/emails', { ...text, employeeIds: [4, 5] })
  expect(many.status).toBe(201)
  const result = teamSendResultSchema.parse(await many.json())
  expect(result.sent.map((r) => [r.employeeId, r.teamId, r.subject])).toEqual([
    [4, 2, 'Hi Hanna'],
    [5, 2, 'Hi Kacper'],
  ])
  expect(result.failed).toEqual([])
  const history = teamEmailSchema.array().parse(await get('/api/teams/2/emails'))
  expect(history.map((r) => r.name)).toEqual(['Kacper Zielinski', 'Hanna Sorlie'])
  expect(employeeEmailSchema.array().parse(await get('/api/employees/4/emails'))).toHaveLength(2)
  expect(persisted().employeeEmails?.length).toBe(3)
  await fetch('http://localhost/api/employees/5', { method: 'DELETE' })
  expect(persisted().employeeEmails?.some((m) => m.employeeId === 5)).toBe(false)
})
