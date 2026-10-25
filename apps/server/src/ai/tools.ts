import { and, eq, getTableColumns, gte, inArray, like, lt, ne, or, sql } from 'drizzle-orm'
import {
  PIPELINE_STAGES,
  anonymize,
  candidateLabel,
  employeeLabel,
  type AnonymizeCandidate,
  type ChatProposal,
  type ChatRefs,
  type ChatToolInput,
  type ChatToolName,
  type ChatToolOutput,
  type PipelineStage,
} from '@hrmit/shared'
import { db } from '../db/index.ts'
import {
  candidateNotes,
  candidates,
  emails,
  employeeNotes,
  employees,
  evaluations,
  interviewQuestions,
  jobs,
  meetings,
  teamMembers,
  teams,
} from '../db/schema.ts'

const DAY = 86_400_000

/**
 * Per-request state the tools write to: whether the provider is local (full names) or cloud
 * (pseudonyms, anonymized text), whether employee data may be read at all (ADR 0009: always
 * with a local provider, with a cloud one only after the operator's opt-in), the refs the UI
 * gets for links and name substitution, and the note drafts the model proposed (never saved here).
 */
export type ToolContext = {
  local: boolean
  employees: boolean
  refs: ChatRefs
  proposals: ChatProposal[]
  /** Everyone whose name must not reach a cloud model; loaded once per request, on first use. */
  people?: Promise<Person[]>
}
export const newContext = (local: boolean, employees = local): ToolContext => ({
  local,
  employees,
  refs: { candidates: {}, recruitments: {}, employees: {} },
  proposals: [],
})

type Person = AnonymizeCandidate & { label: string }

const loadPeople = async (): Promise<Person[]> => {
  const cs = await db
    .select({
      id: candidates.id,
      firstName: candidates.firstName,
      lastName: candidates.lastName,
      email: candidates.email,
      phone: candidates.phone,
    })
    .from(candidates)
  const es = await db
    .select({
      id: employees.id,
      firstName: employees.firstName,
      lastName: employees.lastName,
      email: employees.email,
    })
    .from(employees)
  return [
    ...cs.map((c) => ({ ...c, label: candidateLabel(c.id) })),
    ...es.map((e) => ({ ...e, phone: '', label: employeeLabel(e.id) })),
  ]
}

/**
 * Free text written by people (notes, interviewer comments, a job description, duties) goes to
 * a cloud model only after every candidate's and employee's name, email and phone is replaced,
 * declensions included: a note about one person often names another. Local: as is.
 * ponytail: anonymize() once per person per text; fine for hundreds of people.
 */
export async function scrub(text: string, ctx: ToolContext): Promise<string> {
  if (ctx.local || !text) return text
  const people = await (ctx.people ??= loadPeople())
  return people.reduce((t, p) => anonymize(t, p, { inflected: true, label: p.label }).text, text)
}

/** A one-item-per-line field (requirements, nice-to-haves) as a list, scrubbed for cloud. */
const lines = (text: string, ctx: ToolContext) =>
  scrub(text, ctx).then((t) =>
    t
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean),
  )

const DISABLED = {
  disabled: true as const,
  message:
    'Employee data is not available to the assistant with a cloud provider. The recruiter can turn it on in Settings → AI ("Employee data in the assistant").',
}

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

/** The one place a candidate's name turns into a label; also records the ref the UI needs. */
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

const candidateById = (candidateId: number) =>
  db
    .select(rowColumns)
    .from(candidates)
    .innerJoin(jobs, eq(jobs.id, candidates.jobId))
    .where(eq(candidates.id, candidateId))
    .then((rows) => rows[0])

/** Case-insensitive "contains" on a name column (SQLite LIKE is case-insensitive for ASCII). */
const nameLike = (column: typeof teams.name | typeof jobs.title, text: string) =>
  like(column, `%${text.trim()}%`)

const countWhere = (table: typeof meetings | typeof emails | typeof candidateNotes, id: number) =>
  db
    .select({ n: sql<number>`count(*)` })
    .from(table)
    .where(eq(table.candidateId, id))
    .then((rows) => rows[0]?.n ?? 0)

/** Human averages per competency for one candidate; never summed into one number (ADR 0004). */
const averagesFor = async (candidateId: number, jobId: number) =>
  (
    await db
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
      .where(eq(interviewQuestions.jobId, jobId))
      .groupBy(interviewQuestions.competency)
  )
    .filter((a) => a.answered > 0)
    .map((a) => ({ ...a, average: Math.round(a.average * 10) / 10 }))

const listRecruitments: Fn<'listRecruitments'> = async ({ status, team }, ctx) => {
  const rows = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      status: jobs.status,
      teamName: teams.name,
      candidateCount: sql<number>`(select count(*) from candidates where candidates.job_id = jobs.id)`,
    })
    .from(jobs)
    .leftJoin(teams, eq(teams.id, jobs.teamId))
    .where(
      and(
        status === undefined ? undefined : eq(jobs.status, status),
        team ? nameLike(teams.name, team) : undefined,
      ),
    )
    .orderBy(jobs.id)
  for (const r of rows) ctx.refs.recruitments[r.id] = { title: r.title }
  return rows
}

const getRecruitment: Fn<'getRecruitment'> = async ({ jobId, title }, ctx) => {
  if (jobId === undefined && !title?.trim()) return null
  const [job] = await db
    .select({
      ...getTableColumns(jobs),
      teamName: teams.name,
      memberCount: sql<number>`(select count(*) from team_members where team_members.team_id = jobs.team_id)`,
    })
    .from(jobs)
    .leftJoin(teams, eq(teams.id, jobs.teamId))
    .where(jobId !== undefined ? eq(jobs.id, jobId) : nameLike(jobs.title, title!))
    .orderBy(jobs.id)
    .limit(1)
  if (!job) return null
  ctx.refs.recruitments[job.id] = { title: job.title }
  const counts = await db
    .select({ stage: candidates.stage, n: sql<number>`count(*)` })
    .from(candidates)
    .where(eq(candidates.jobId, job.id))
    .groupBy(candidates.stage)
  const qs = await db
    .select({ competency: interviewQuestions.competency, question: interviewQuestions.question })
    .from(interviewQuestions)
    .where(eq(interviewQuestions.jobId, job.id))
    .orderBy(interviewQuestions.sortOrder)
  const grouped: { competency: string; questions: string[] }[] = []
  for (const q of qs) {
    const g = grouped.find((x) => x.competency === q.competency)
    if (g) g.questions.push(q.question)
    else grouped.push({ competency: q.competency, questions: [q.question] })
  }
  return {
    id: job.id,
    title: job.title,
    status: job.status,
    description: await scrub(job.description, ctx),
    level: job.level,
    location: await scrub(job.location, ctx),
    contract: await scrub(job.contract, ctx),
    requirements: await lines(job.requirements, ctx),
    niceToHave: await lines(job.niceToHave, ctx),
    salary:
      job.salaryMin === null && job.salaryMax === null
        ? null
        : {
            min: job.salaryMin,
            max: job.salaryMax,
            currency: job.salaryCurrency,
            period: job.salaryPeriod,
          },
    team: job.teamName === null ? null : { name: job.teamName, memberCount: job.memberCount },
    stages: Object.fromEntries(
      PIPELINE_STAGES.map((s) => [s, counts.find((c) => c.stage === s)?.n ?? 0]),
    ) as Record<PipelineStage, number>,
    questions: grouped,
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
    .select({ ...rowColumns, jobStatus: jobs.status, ai: candidates.aiSummaryJson })
    .from(candidates)
    .innerJoin(jobs, eq(jobs.id, candidates.jobId))
    .where(eq(candidates.id, candidateId))
  if (!r) return null
  return {
    ...candidateRow(r, ctx, Date.now()),
    jobStatus: r.jobStatus,
    // Stored AI text may mention names; with a cloud provider it goes through anonymize().
    summary: r.ai?.summary ? await scrub(r.ai.summary.summary, ctx) : null,
    competencies: await Promise.all(
      (r.ai?.competencies?.competencies ?? []).map((c) => scrub(c.name, ctx)),
    ),
    interviewAverages: await averagesFor(candidateId, r.jobId),
    meetingCount: await countWhere(meetings, candidateId),
    emailCount: await countWhere(emails, candidateId),
    noteCount: await countWhere(candidateNotes, candidateId),
  }
}

/** The scorecard as the interviewers filled it in; comments are people's text (scrubbed for cloud). */
const getScorecard: Fn<'getScorecard'> = async ({ candidateId }, ctx) => {
  const r = await candidateById(candidateId)
  if (!r) return null
  const rows = await db
    .select({
      competency: interviewQuestions.competency,
      question: interviewQuestions.question,
      rating: evaluations.score,
      comment: evaluations.note,
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
    .orderBy(interviewQuestions.sortOrder)
  return {
    candidateId,
    candidate: label(r, ctx),
    jobId: r.jobId,
    jobTitle: r.jobTitle,
    questions: await Promise.all(
      rows.map(async (q) => ({ ...q, comment: await scrub(q.comment ?? '', ctx) })),
    ),
    averages: await averagesFor(candidateId, r.jobId),
  }
}

/** An employee's name turns into a label here; the ref lets the UI show the name. */
function employeeLabelOf(e: { id: number; firstName: string; lastName: string }, ctx: ToolContext) {
  const name = `${e.firstName} ${e.lastName}`
  ctx.refs.employees[e.id] = { name }
  return ctx.local ? name : employeeLabel(e.id)
}

const getNotes: Fn<'getNotes'> = async ({ target, id }, ctx) => {
  let display: string
  let rows: {
    id: number
    title: string | null
    body: string
    createdAt: string
    source: 'human' | 'assistant'
  }[]
  if (target === 'candidate') {
    const r = await candidateById(id)
    if (!r) return null
    display = label(r, ctx)
    rows = await db
      .select()
      .from(candidateNotes)
      .where(eq(candidateNotes.candidateId, id))
      .orderBy(candidateNotes.createdAt, candidateNotes.id)
  } else {
    if (!ctx.employees) return DISABLED
    const [e] = await db.select().from(employees).where(eq(employees.id, id))
    if (!e) return null
    display = employeeLabelOf(e, ctx)
    rows = await db
      .select()
      .from(employeeNotes)
      .where(eq(employeeNotes.employeeId, id))
      .orderBy(employeeNotes.createdAt, employeeNotes.id)
  }
  return {
    target,
    id,
    label: display,
    notes: await Promise.all(
      rows.map(async (n) => ({
        id: n.id,
        title: n.title,
        text: await scrub(n.body, ctx),
        createdAt: n.createdAt,
        source: n.source,
      })),
    ),
  }
}

/** Counts only: no employee name, position or duties leaves here, whatever the switch says. */
const teamOverview: Fn<'teamOverview'> = ({ team }) =>
  db
    .select({
      id: teams.id,
      name: teams.name,
      memberCount: sql<number>`(select count(*) from team_members where team_members.team_id = teams.id)`,
      openJobCount: sql<number>`(select count(*) from jobs where jobs.team_id = teams.id and jobs.status = 'open')`,
    })
    .from(teams)
    .where(team ? nameLike(teams.name, team) : undefined)
    .orderBy(teams.name)

/** Behind the employee switch (ADR 0009). By id, by part of a name or position, or by team. */
const searchEmployees: Fn<'searchEmployees'> = async ({ employeeId, query, team }, ctx) => {
  if (!ctx.employees) return DISABLED
  const pattern = `%${query?.trim().toLowerCase() ?? ''}%`
  const rows = await db
    .select({
      id: employees.id,
      firstName: employees.firstName,
      lastName: employees.lastName,
      position: employees.position,
      duties: employees.duties,
      noteCount: sql<number>`(select count(*) from employee_notes where employee_notes.employee_id = employees.id)`,
    })
    .from(employees)
    .where(
      and(
        employeeId === undefined ? undefined : eq(employees.id, employeeId),
        query?.trim()
          ? or(
              sql`lower(${employees.firstName}) like ${pattern}`,
              sql`lower(${employees.lastName}) like ${pattern}`,
              sql`lower(${employees.position}) like ${pattern}`,
            )
          : undefined,
        team?.trim()
          ? inArray(
              employees.id,
              db
                .select({ id: teamMembers.employeeId })
                .from(teamMembers)
                .innerJoin(teams, eq(teams.id, teamMembers.teamId))
                .where(nameLike(teams.name, team)),
            )
          : undefined,
      ),
    )
    .orderBy(employees.lastName, employees.firstName, employees.id)
    .limit(20)
  if (rows.length === 0) return []
  const memberships = await db
    .select({ employeeId: teamMembers.employeeId, name: teams.name, role: teamMembers.role })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(
      inArray(
        teamMembers.employeeId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(teams.name)
  return Promise.all(
    rows.map(async (e) => ({
      employeeId: e.id,
      employee: employeeLabelOf(e, ctx),
      position: e.position,
      duties: await scrub(e.duties, ctx),
      teams: memberships
        .filter((m) => m.employeeId === e.id)
        .map(({ name, role }) => ({ name, role })),
      noteCount: e.noteCount,
    })),
  )
}

/**
 * The only write-shaped tool, and it writes nothing: the draft goes to the UI as a `proposal`
 * event and is saved by the recruiter's click through the notes API (ADR 0009). An unknown
 * id is refused here so a made-up one never becomes a card.
 */
const proposeNote: Fn<'proposeNote'> = async ({ target, id, title, body }, ctx) => {
  if (target === 'employee' && !ctx.employees) return { proposed: false, message: DISABLED.message }
  // The ref lets the card show the name and link to the drawer, even if no other tool ran.
  if (target === 'candidate') {
    const r = await candidateById(id)
    if (!r) return { proposed: false, message: `No candidate with id ${id}.` }
    label(r, ctx)
  } else {
    const [e] = await db.select().from(employees).where(eq(employees.id, id))
    if (!e) return { proposed: false, message: `No employee with id ${id}.` }
    employeeLabelOf(e, ctx)
  }
  ctx.proposals.push({ target, id, title: title?.trim() || null, body })
  return {
    proposed: true,
    message:
      'The draft is shown to the recruiter, who decides whether to save it. Nothing is saved yet; tell the recruiter to review it.',
  }
}

/** One plain async function per tool; the chat route wraps them for the AI SDK. */
export const chatToolFns: { [N in ChatToolName]: Fn<N> } = {
  listRecruitments,
  getRecruitment,
  upcomingMeetings,
  stuckCandidates,
  searchCandidates,
  getCandidate,
  getScorecard,
  getNotes,
  teamOverview,
  searchEmployees,
  proposeNote,
}
