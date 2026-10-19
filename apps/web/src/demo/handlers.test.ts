import {
  AI_SETTINGS_DEFAULTS,
  aiSettingsViewSchema,
  aiTestResultSchema,
  candidateSchema,
  fixtures,
  jobSchema,
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
const { handlers } = await import('./handlers.ts')
const { DEMO_STORAGE_KEY } = await import('../config.ts')
const persisted = () => JSON.parse(storage.get(DEMO_STORAGE_KEY) ?? '{}') as Store
type Store = { jobs: unknown[]; candidates: { id: number }[]; aiSettings?: unknown }

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
  expect(withCv.cvText).toBe(fixtures.cvText)
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
