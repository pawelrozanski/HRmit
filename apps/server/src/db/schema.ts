import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { PIPELINE_STAGES } from '@hrmit/shared'

// docs/ARCHITECTURE.md §3. CV columns arrive in roadmap stage 3.
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
  createdAt: text('created_at').notNull(),
})
