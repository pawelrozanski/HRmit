import { and, eq, gt, gte, isNotNull, lt, ne, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { validator } from 'hono/validator'
import { PIPELINE_STAGES, type Dashboard, type PipelineStage } from '@hrmit/shared'
import { db } from '../db/index.ts'
import {
  candidates,
  emails,
  employeeEmails,
  evaluations,
  interviewQuestions,
  jobs,
  meetings,
  teams,
} from '../db/schema.ts'

const DAY = 86_400_000
const WEEK = 7
const FAILED_WINDOW_DAYS = 30

/** ?stuckDays= is 1..365, default 7; anything else is a 400. */
const stuckQuery = validator('query', (q, c): { stuckDays: number } | Response => {
  if (q.stuckDays === undefined) return { stuckDays: 7 }
  const stuckDays = Number(q.stuckDays)
  return Number.isInteger(stuckDays) && stuckDays >= 1 && stuckDays <= 365
    ? { stuckDays }
    : c.json({ error: 'invalid stuckDays' }, 400)
})

/** Candidate rows joined with their job; the person fields the schema allows, nothing more. */
const person = {
  candidateId: candidates.id,
  firstName: candidates.firstName,
  lastName: candidates.lastName,
  jobId: jobs.id,
  jobTitle: jobs.title,
}

/**
 * Six cheap queries over the local database, one response (docs/ARCHITECTURE.md §4.1). No AI
 * anywhere here: the numbers are always exactly what the tables say.
 * ponytail: one endpoint; split a tile out only if one ever gets slow or needs its own refresh.
 */
export const dashboardRoute = new Hono().get('/', stuckQuery, async (c) => {
  const { stuckDays } = c.req.valid('query')
  const now = Date.now()
  const iso = (ms: number) => new Date(ms).toISOString()
  const openJob = eq(jobs.status, 'open')

  const upcoming = await db
    .select({
      ...person,
      id: meetings.id,
      startsAt: meetings.startsAt,
      durationMin: meetings.durationMin,
      jitsiUrl: meetings.jitsiUrl,
    })
    .from(meetings)
    .innerJoin(candidates, eq(candidates.id, meetings.candidateId))
    .innerJoin(jobs, eq(jobs.id, candidates.jobId))
    .where(and(gte(meetings.startsAt, iso(now)), lt(meetings.startsAt, iso(now + WEEK * DAY))))
    .orderBy(meetings.startsAt)

  const stuckRows = await db
    .select({ ...person, stage: candidates.stage, stageChangedAt: candidates.stageChangedAt })
    .from(candidates)
    .innerJoin(jobs, eq(jobs.id, candidates.jobId))
    .where(
      and(
        openJob,
        ne(candidates.stage, 'rejected'),
        lt(candidates.stageChangedAt, iso(now - stuckDays * DAY)),
      ),
    )
    .orderBy(candidates.stageChangedAt)
  const stuck = stuckRows.map(({ stageChangedAt, ...r }) => ({
    ...r,
    days: Math.floor((now - Date.parse(stageChangedAt)) / DAY),
  }))

  // Questions per job and scored evaluations per candidate, joined in JS: two tiny aggregates.
  const questionCounts = new Map(
    (
      await db
        .select({ jobId: interviewQuestions.jobId, n: sql<number>`count(*)` })
        .from(interviewQuestions)
        .groupBy(interviewQuestions.jobId)
    ).map((r) => [r.jobId, r.n]),
  )
  const scoredCounts = new Map(
    (
      await db
        .select({ candidateId: evaluations.candidateId, n: sql<number>`count(*)` })
        .from(evaluations)
        .where(isNotNull(evaluations.score))
        .groupBy(evaluations.candidateId)
    ).map((r) => [r.candidateId, r.n]),
  )
  const interviewing = await db
    .select(person)
    .from(candidates)
    .innerJoin(jobs, eq(jobs.id, candidates.jobId))
    .where(and(openJob, sql`${candidates.stage} in ('interview', 'offer')`))
    .orderBy(candidates.id)
  const missingScores = interviewing
    .map((r) => ({
      ...r,
      scored: scoredCounts.get(r.candidateId) ?? 0,
      total: questionCounts.get(r.jobId) ?? 0,
    }))
    .filter((r) => r.total > 0 && r.scored < r.total)

  const funnel = await db
    .select({ jobId: candidates.jobId, stage: candidates.stage, n: sql<number>`count(*)` })
    .from(candidates)
    .groupBy(candidates.jobId, candidates.stage)
  const openJobs = (
    await db
      .select({ id: jobs.id, title: jobs.title, teamName: teams.name })
      .from(jobs)
      .leftJoin(teams, eq(teams.id, jobs.teamId))
      .where(openJob)
      .orderBy(jobs.id)
  ).map((j) => ({
    ...j,
    stages: Object.fromEntries(
      PIPELINE_STAGES.map((s) => [
        s,
        funnel.find((f) => f.jobId === j.id && f.stage === s)?.n ?? 0,
      ]),
    ) as Record<PipelineStage, number>,
  }))

  const since = iso(now - FAILED_WINDOW_DAYS * DAY)
  const failedCandidate = await db
    .select({
      id: emails.id,
      targetId: emails.candidateId,
      jobId: candidates.jobId,
      subject: emails.subject,
      sentAt: emails.sentAt,
    })
    .from(emails)
    .innerJoin(candidates, eq(candidates.id, emails.candidateId))
    .where(and(eq(emails.status, 'failed'), gt(emails.sentAt, since)))
  const failedEmployee = await db
    .select({
      id: employeeEmails.id,
      targetId: employeeEmails.employeeId,
      teamId: employeeEmails.teamId,
      subject: employeeEmails.subject,
      sentAt: employeeEmails.sentAt,
    })
    .from(employeeEmails)
    .where(and(eq(employeeEmails.status, 'failed'), gt(employeeEmails.sentAt, since)))
  const failedEmails: Dashboard['failedEmails'] = [
    ...failedCandidate.map((r) => ({ kind: 'candidate' as const, teamId: null, ...r })),
    ...failedEmployee.map((r) => ({ kind: 'employee' as const, jobId: null, ...r })),
  ].sort((a, b) => b.sentAt.localeCompare(a.sentAt))

  const [active] = await db
    .select({ activeCandidates: sql<number>`count(*)` })
    .from(candidates)
    .innerJoin(jobs, eq(jobs.id, candidates.jobId))
    .where(and(openJob, ne(candidates.stage, 'rejected')))
  const [teamRow] = await db.select({ teamCount: sql<number>`count(*)` }).from(teams)

  return c.json<Dashboard>({
    counts: {
      openJobs: openJobs.length,
      activeCandidates: active!.activeCandidates,
      meetingsThisWeek: upcoming.length,
      teams: teamRow!.teamCount,
    },
    meetings: upcoming,
    stuck,
    missingScores,
    openJobs,
    failedEmails,
  })
})
