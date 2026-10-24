import { and, eq, gte, lt, ne, sql } from 'drizzle-orm'
import {
  PIPELINE_STAGES,
  anonymize,
  candidateLabel,
  type ChatRefs,
  type ChatToolInput,
  type ChatToolName,
  type ChatToolOutput,
  type PipelineStage,
} from '@hrmit/shared'
import { db } from '../db/index.ts'
import {
  candidates,
  emails,
  evaluations,
  interviewQuestions,
  jobs,
  meetings,
  teams,
} from '../db/schema.ts'

const DAY = 86_400_000

/**
 * Per-request state the tools write to: whether the provider is local (full names) or cloud
 * (pseudonyms, anonymized text), and the refs the UI gets for links and name substitution.
 */
export type ToolContext = { local: boolean; refs: ChatRefs }
export const newRefs = (): ChatRefs => ({ candidates: {}, recruitments: {} })

type Fn<N extends ChatToolName> = (
  input: ChatToolInput<N>,
  ctx: ToolContext,
) => Promise<ChatToolOutput<N>>

type Row = {
  candidateId: number
  firstName: string
  lastName: string
  jobId: number
  jobTitle: string
  stage: PipelineStage
  stageChangedAt: string
}
const rowColumns = {
  candidateId: candidates.id,
  firstName: candidates.firstName,
  lastName: candidates.lastName,
  jobId: jobs.id,
  jobTitle: jobs.title,
  stage: candidates.stage,
  stageChangedAt: candidates.stageChangedAt,
}

/** The one place a name turns into a label; also records the ref the UI needs. */
function label(r: Row, ctx: ToolContext) {
  const name = `${r.firstName} ${r.lastName}`
  ctx.refs.candidates[r.candidateId] = { name, jobId: r.jobId }
  ctx.refs.recruitments[r.jobId] = { title: r.jobTitle }
  return ctx.local ? name : candidateLabel(r.candidateId)
}
const candidateRow = (r: Row, ctx: ToolContext, now: number) => ({
  candidateId: r.candidateId,
  candidate: label(r, ctx),
  jobId: r.jobId,
  jobTitle: r.jobTitle,
  stage: r.stage,
  daysInStage: Math.floor((now - Date.parse(r.stageChangedAt)) / DAY),
})

const jobColumns = {
  id: jobs.id,
  title: jobs.title,
  status: jobs.status,
  teamName: teams.name,
}

const listRecruitments: Fn<'listRecruitments'> = async ({ status, teamId }, ctx) => {
  const rows = await db
    .select({
      ...jobColumns,
      candidateCount: sql<number>`(select count(*) from candidates where candidates.job_id = jobs.id)`,
    })
    .from(jobs)
    .leftJoin(teams, eq(teams.id, jobs.teamId))
    .where(
      and(
        status === undefined ? undefined : eq(jobs.status, status),
        teamId === undefined ? undefined : eq(jobs.teamId, teamId),
      ),
    )
    .orderBy(jobs.id)
  for (const r of rows) ctx.refs.recruitments[r.id] = { title: r.title }
  return rows
}

const getRecruitment: Fn<'getRecruitment'> = async ({ jobId }, ctx) => {
  const [job] = await db
    .select(jobColumns)
    .from(jobs)
    .leftJoin(teams, eq(teams.id, jobs.teamId))
    .where(eq(jobs.id, jobId))
  if (!job) return null
  ctx.refs.recruitments[job.id] = { title: job.title }
  const counts = await db
    .select({ stage: candidates.stage, n: sql<number>`count(*)` })
    .from(candidates)
    .where(eq(candidates.jobId, jobId))
    .groupBy(candidates.stage)
  const [q] = await db
    .select({ n: sql<number>`count(*)` })
    .from(interviewQuestions)
    .where(eq(interviewQuestions.jobId, jobId))
  return {
    ...job,
    stages: Object.fromEntries(
      PIPELINE_STAGES.map((s) => [s, counts.find((c) => c.stage === s)?.n ?? 0]),
    ) as Record<PipelineStage, number>,
    questionCount: q?.n ?? 0,
  }
}

const upcomingMeetings: Fn<'upcomingMeetings'> = async ({ days }, ctx) => {
  const now = Date.now()
  const rows = await db
    .select({ ...rowColumns, startsAt: meetings.startsAt, durationMin: meetings.durationMin })
    .from(meetings)
    .innerJoin(candidates, eq(candidates.id, meetings.candidateId))
    .innerJoin(jobs, eq(jobs.id, candidates.jobId))
    .where(
      and(
        gte(meetings.startsAt, new Date(now).toISOString()),
        lt(meetings.startsAt, new Date(now + days * DAY).toISOString()),
      ),
    )
    .orderBy(meetings.startsAt)
  return rows.map(({ startsAt, durationMin, ...r }) => ({
    candidateId: r.candidateId,
    candidate: label(r, ctx),
    jobId: r.jobId,
    jobTitle: r.jobTitle,
    startsAt,
    durationMin,
  }))
}

const stuckCandidates: Fn<'stuckCandidates'> = async ({ days, jobId }, ctx) => {
  const now = Date.now()
  const rows = await db
    .select(rowColumns)
    .from(candidates)
    .innerJoin(jobs, eq(jobs.id, candidates.jobId))
    .where(
      and(
        eq(jobs.status, 'open'),
        ne(candidates.stage, 'rejected'),
        lt(candidates.stageChangedAt, new Date(now - days * DAY).toISOString()),
        jobId === undefined ? undefined : eq(jobs.id, jobId),
      ),
    )
    .orderBy(candidates.stageChangedAt)
  return rows.map((r) => candidateRow(r, ctx, now))
}

/**
 * Keyword match over the job title, the stage name and the competency names of the stored AI
 * output. Never over the name, email or notes: the model is not a people-search engine.
 * ponytail: in-memory filter over every candidate; a LIKE query if the table ever grows.
 */
const searchCandidates: Fn<'searchCandidates'> = async ({ query, jobId }, ctx) => {
  const now = Date.now()
  const q = query.toLowerCase()
  const rows = await db
    .select({ ...rowColumns, ai: candidates.aiSummaryJson })
    .from(candidates)
    .innerJoin(jobs, eq(jobs.id, candidates.jobId))
    .where(jobId === undefined ? undefined : eq(jobs.id, jobId))
    .orderBy(candidates.id)
  return rows
    .filter(({ jobTitle, stage, ai }) =>
      [jobTitle, stage, ...(ai?.competencies?.competencies.map((c) => c.name) ?? [])].some((s) =>
        s.toLowerCase().includes(q),
      ),
    )
    .map((r) => candidateRow(r, ctx, now))
}

const getCandidate: Fn<'getCandidate'> = async ({ candidateId }, ctx) => {
  const [r] = await db
    .select({
      ...rowColumns,
      jobStatus: jobs.status,
      email: candidates.email,
      phone: candidates.phone,
      ai: candidates.aiSummaryJson,
    })
    .from(candidates)
    .innerJoin(jobs, eq(jobs.id, candidates.jobId))
    .where(eq(candidates.id, candidateId))
  if (!r) return null
  // Stored AI text may mention the name; with a cloud provider it goes through anonymize().
  const person = { id: r.candidateId, ...r }
  const text = (s: string) => (ctx.local ? s : anonymize(s, person).text)
  const averages = await db
    .select({
      competency: interviewQuestions.competency,
      average: sql<number>`avg(${evaluations.score})`,
      answered: sql<number>`count(${evaluations.score})`,
      total: sql<number>`count(*)`,
    })
    .from(interviewQuestions)
    .leftJoin(
      evaluations,
      and(
        eq(evaluations.questionId, interviewQuestions.id),
        eq(evaluations.candidateId, candidateId),
      ),
    )
    .where(eq(interviewQuestions.jobId, r.jobId))
    .groupBy(interviewQuestions.competency)
  const count = (table: typeof meetings | typeof emails) =>
    db
      .select({ n: sql<number>`count(*)` })
      .from(table)
      .where(eq(table.candidateId, candidateId))
      .then((rows) => rows[0]?.n ?? 0)
  return {
    ...candidateRow(r, ctx, Date.now()),
    jobStatus: r.jobStatus,
    summary: r.ai?.summary ? text(r.ai.summary.summary) : null,
    competencies: r.ai?.competencies?.competencies.map((c) => text(c.name)) ?? [],
    interviewAverages: averages
      .filter((a) => a.answered > 0)
      .map((a) => ({ ...a, average: Math.round(a.average * 10) / 10 })),
    meetingCount: await count(meetings),
    emailCount: await count(emails),
  }
}

/** Counts only: no employee name, position or duties ever leaves for the model. */
const teamOverview: Fn<'teamOverview'> = ({ teamId }) =>
  db
    .select({
      id: teams.id,
      name: teams.name,
      memberCount: sql<number>`(select count(*) from team_members where team_members.team_id = teams.id)`,
      openJobCount: sql<number>`(select count(*) from jobs where jobs.team_id = teams.id and jobs.status = 'open')`,
    })
    .from(teams)
    .where(teamId === undefined ? undefined : eq(teams.id, teamId))
    .orderBy(teams.name)

/** One plain async function per tool; the chat route wraps them for the AI SDK. */
export const chatToolFns: { [N in ChatToolName]: Fn<N> } = {
  listRecruitments,
  getRecruitment,
  upcomingMeetings,
  stuckCandidates,
  searchCandidates,
  getCandidate,
  teamOverview,
}
