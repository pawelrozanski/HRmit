import { getTableColumns } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { PIPELINE_STAGES, type AiSummary } from '@hrmit/shared'

// docs/ARCHITECTURE.md §3.
export const jobs = sqliteTable('jobs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  status: text('status', { enum: ['open', 'closed'] })
    .notNull()
    .default('open'),
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

/** Key-value settings (ai.provider, ai.apiKey, ...). Keys on the secret list are stored encrypted. */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})
