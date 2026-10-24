import { expect, test } from 'vitest'
import { eq } from 'drizzle-orm'
import { dashboardSchema, fixtures } from '@hrmit/shared'
import { app } from '../app.ts'
import { db } from '../db/index.ts'
import { candidates, emails, employeeEmails, jobs, meetings } from '../db/schema.ts'

const DAY = 86_400_000
const at = (days: number) => new Date(Date.now() + days * DAY).toISOString()
const load = async (query = '') => {
  const res = await app.request(`/api/dashboard${query}`)
  expect(res.status).toBe(200)
  return dashboardSchema.parse(await res.json())
}

test('GET /api/dashboard: fixtures give counts, a funnel and no contact fields', async () => {
  const d = await load()
  expect(d.counts.openJobs).toBe(fixtures.jobs.filter((j) => j.status === 'open').length)
  expect(d.counts.teams).toBe(fixtures.teams.length)
  // Fixture meetings are demo-only, never seeded into the database: nothing this week.
  expect(d.meetings).toEqual([])
  expect(d.counts.meetingsThisWeek).toBe(0)
  // Relative fixture dates: Samuel (12 days) and Theo (9 days) wait 7 days or more; job 3 is closed.
  expect(d.stuck.map((s) => s.candidateId)).toEqual([8, 2])
  expect(d.stuck[0]).toMatchObject({ stage: 'screening', days: 12 })
  // Closed job 3 is out of the funnel and of the stuck list.
  expect(d.openJobs.map((j) => j.id)).toEqual([1, 2, 4])
  expect(d.stuck.some((s) => s.jobId === 3)).toBe(false)
  expect(d.openJobs[0]).toMatchObject({ teamName: 'IT', stages: { interview: 1, rejected: 1 } })
  // Amelia (1) is fully scored; Marcus (4, offer) has 6 of 8.
  expect(d.missingScores.map((m) => m.candidateId)).toContain(4)
  expect(d.missingScores.map((m) => m.candidateId)).not.toContain(1)
  expect(d.missingScores.find((m) => m.candidateId === 4)).toMatchObject({ scored: 6, total: 8 })
  expect(JSON.stringify(d)).not.toMatch(/email"|phone|@example\.com|cvText|notes"/)
})

test('stuckDays filters and validates', async () => {
  expect((await load('?stuckDays=365')).stuck.length).toBe(0)
  expect((await app.request('/api/dashboard?stuckDays=0')).status).toBe(400)
  expect((await app.request('/api/dashboard?stuckDays=x')).status).toBe(400)
  await db
    .update(candidates)
    .set({ stageChangedAt: at(-2) })
    .where(eq(candidates.id, 3))
  const d = await load('?stuckDays=3')
  expect(d.stuck.some((s) => s.candidateId === 3)).toBe(false)
  expect((await load('?stuckDays=1')).stuck.find((s) => s.candidateId === 3)?.days).toBe(2)
})

test('meetings in the next seven days, failed emails of the last 30 days', async () => {
  await db.insert(meetings).values([
    { candidateId: 1, startsAt: at(1), durationMin: 60, jitsiUrl: 'https://meet.jit.si/hrmit-a' },
    { candidateId: 2, startsAt: at(8), durationMin: 60, jitsiUrl: 'https://meet.jit.si/hrmit-b' },
    { candidateId: 2, startsAt: at(-1), durationMin: 60, jitsiUrl: 'https://meet.jit.si/hrmit-c' },
  ])
  const row = { templateKey: 'invite' as const, subject: 's', body: 'b' }
  await db.insert(emails).values([
    { candidateId: 1, ...row, status: 'failed', sentAt: at(-2), error: 'x' },
    { candidateId: 1, ...row, status: 'failed', sentAt: at(-40), error: 'x' },
    { candidateId: 1, ...row, status: 'sent', sentAt: at(-1), error: null },
  ])
  await db
    .insert(employeeEmails)
    .values({ employeeId: 4, teamId: 2, subject: 't', body: 'b', status: 'failed', sentAt: at(-3) })
  const d = await load()
  expect(d.meetings.map((m) => m.candidateId)).toEqual([1])
  expect(d.meetings[0]).toMatchObject({ jobId: 1, jobTitle: fixtures.jobs[0]!.title })
  expect(d.counts.meetingsThisWeek).toBe(1)
  expect(d.failedEmails.map((f) => f.kind)).toEqual(['candidate', 'employee'])
  expect(d.failedEmails[1]).toMatchObject({ targetId: 4, teamId: 2, jobId: null })
})

test('a job without questions never reports missing scores; a closed job drops out', async () => {
  // A new job has no questions: a candidate in interview there has nothing to score.
  const [job] = await db
    .insert(jobs)
    .values({ title: 'No guide', createdAt: at(0) })
    .returning({ id: jobs.id })
  await db.insert(candidates).values({
    jobId: job!.id,
    firstName: 'Test',
    lastName: 'Person',
    email: 't@example.com',
    stage: 'interview',
    stageChangedAt: at(0),
    createdAt: at(0),
  })
  let d = await load()
  expect(d.missingScores.some((m) => m.jobId === job!.id)).toBe(false)
  expect(d.openJobs.some((j) => j.id === job!.id)).toBe(true)
  await db.update(jobs).set({ status: 'closed' }).where(eq(jobs.id, 1))
  d = await load()
  expect(d.openJobs.some((j) => j.id === 1)).toBe(false)
  expect(d.missingScores.some((m) => m.jobId === 1)).toBe(false)
  expect(d.stuck.some((s) => s.jobId === 1)).toBe(false)
})
