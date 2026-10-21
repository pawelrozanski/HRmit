import { getTableColumns, sql } from 'drizzle-orm'
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
  unique,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'
import {
  EMAIL_TEMPLATE_KEYS,
  PIPELINE_STAGES,
  TEAM_MEMBER_ROLES,
  type AiSummary,
} from '@hrmit/shared'

// docs/ARCHITECTURE.md §3.

/** Hiring teams. The name is unique case-insensitively (an index on lower(name)). */
export const teams = sqliteTable(
  'teams',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    createdAt: text('created_at').notNull(),
  },
  (t) => [uniqueIndex('teams_name_unique').on(sql`lower(${t.name})`)],
)

/**
 * The hiring side: interviewers and hiring managers. Personal data, hard-deleted with their
 * memberships (docs/SECURITY.md); never part of an AI prompt.
 */
export const employees = sqliteTable('employees', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  position: text('position').notNull(),
  email: text('email').notNull(),
  /** ISO date, null when unknown. */
  hiredAt: text('hired_at'),
  duties: text('duties').notNull().default(''),
  createdAt: text('created_at').notNull(),
})

/** Free-text notes on an employee (plain text). Personal data: gone with the employee. */
export const employeeNotes = sqliteTable('employee_notes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  employeeId: integer('employee_id')
    .notNull()
    .references(() => employees.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  createdAt: text('created_at').notNull(),
})

/** Memberships: an employee can be in several teams, with one role per team. */
export const teamMembers = sqliteTable(
  'team_members',
  {
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    employeeId: integer('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    role: text('role', { enum: TEAM_MEMBER_ROLES }).notNull().default('member'),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.employeeId] })],
)

/** A job is what the UI calls a recruitment (glossary in docs/ARCHITECTURE.md). */
export const jobs = sqliteTable('jobs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  status: text('status', { enum: ['open', 'closed'] })
    .notNull()
    .default('open'),
  /** The hiring team; a deleted team leaves the job without one. */
  teamId: integer('team_id').references(() => teams.id, { onDelete: 'set null' }),
  createdAt: text('created_at').notNull(),
})

export const candidates = sqliteTable('candidates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  jobId: integer('job_id')
    .notNull()
    .references(() => jobs.id, { onDelete: 'cascade' }),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull().default(''),
  stage: text('stage', { enum: PIPELINE_STAGES }).notNull().default('applied'),
  stageChangedAt: text('stage_changed_at').notNull(),
  notes: text('notes').notNull().default(''),
  cvFilename: text('cv_filename'),
  /** Random UUID name under <data dir>/uploads/. Never leaves the server (see candidateColumns). */
  cvPath: text('cv_path'),
  cvText: text('cv_text'),
  /** Last output of each AI action (docs/ARCHITECTURE.md §3), parsed by drizzle's json mode. */
  aiSummaryJson: text('ai_summary_json', { mode: 'json' }).$type<AiSummary>(),
  createdAt: text('created_at').notNull(),
})

// What the API returns for a candidate: every column except the file path on disk.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { cvPath: _cvPath, ...candidateColumns } = getTableColumns(candidates)
export { candidateColumns }

/** Structured interview: the job's question list, shared by all its candidates (ADR 0004). */
export const interviewQuestions = sqliteTable('interview_questions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  jobId: integer('job_id')
    .notNull()
    .references(() => jobs.id, { onDelete: 'cascade' }),
  competency: text('competency').notNull(),
  question: text('question').notNull(),
  sortOrder: integer('sort_order').notNull(),
})

/**
 * Scorecard (ADR 0004): one human score and note per candidate and question. Goes away with
 * the candidate (GDPR erasure) and with the question (guide edited).
 */
export const evaluations = sqliteTable(
  'evaluations',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    candidateId: integer('candidate_id')
      .notNull()
      .references(() => candidates.id, { onDelete: 'cascade' }),
    questionId: integer('question_id')
      .notNull()
      .references(() => interviewQuestions.id, { onDelete: 'cascade' }),
    /** 1 to 5, null until scored. The range is enforced by the shared zod schema. */
    score: integer('score'),
    note: text('note').notNull().default(''),
  },
  (t) => [unique().on(t.candidateId, t.questionId)],
)

/** Key-value settings (ai.provider, ai.apiKey, ...). Keys on the secret list are stored encrypted. */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})

/** Editable email templates (docs/ARCHITECTURE.md §6), seeded from the shared fixtures. */
export const emailTemplates = sqliteTable('email_templates', {
  key: text('key', { enum: EMAIL_TEMPLATE_KEYS }).primaryKey(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
})

/** Every email ever sent (or attempted) to a candidate: the communication history. */
export const emails = sqliteTable('emails', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  candidateId: integer('candidate_id')
    .notNull()
    .references(() => candidates.id, { onDelete: 'cascade' }),
  templateKey: text('template_key', { enum: EMAIL_TEMPLATE_KEYS }).notNull(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  status: text('status', { enum: ['sent', 'failed', 'demo'] }).notNull(),
  sentAt: text('sent_at').notNull(),
  /** Sanitized transport error for failed rows; never contains the SMTP password. */
  error: text('error'),
})

/**
 * Scheduled interviews (docs/ARCHITECTURE.md §6). The invite email is linked for the history;
 * the link goes null if that row ever disappears, the meeting goes with the candidate.
 */
export const meetings = sqliteTable('meetings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  candidateId: integer('candidate_id')
    .notNull()
    .references(() => candidates.id, { onDelete: 'cascade' }),
  startsAt: text('starts_at').notNull(),
  durationMin: integer('duration_min').notNull(),
  jitsiUrl: text('jitsi_url').notNull(),
  emailId: integer('email_id').references(() => emails.id, { onDelete: 'set null' }),
})
