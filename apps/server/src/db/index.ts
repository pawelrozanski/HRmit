import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import { count } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/sqlite-proxy'
import { migrate } from 'drizzle-orm/sqlite-proxy/migrator'
import { fixtures } from '@hrmit/shared'
import * as schema from './schema.ts'

// ./data/hrmit.db and master.key by default; HRMIT_DATA_DIR overrides. ':memory:' is for tests. See ADR 0002.
export const dataDir =
  process.env.HRMIT_DATA_DIR ?? fileURLToPath(new URL('../../../../data', import.meta.url))
const file = dataDir === ':memory:' ? dataDir : join(dataDir, 'hrmit.db')
if (dataDir !== ':memory:') mkdirSync(dataDir, { recursive: true })

/** CV files live here under random UUID names. Tests get a throwaway temp folder. */
export const uploadsDir =
  dataDir === ':memory:' ? mkdtempSync(join(tmpdir(), 'hrmit-')) : join(dataDir, 'uploads')
mkdirSync(uploadsDir, { recursive: true })

const sqlite = new DatabaseSync(file)
sqlite.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')

// Drizzle has no node:sqlite driver yet, so we hand it the built-in one through sqlite-proxy.
export const db = drizzle(
  async (sql, params, method) => {
    const stmt = sqlite.prepare(sql)
    if (method === 'run') return { rows: [stmt.run(...params) as never] }
    stmt.setReturnArrays(true)
    if (method === 'get')
      return { rows: (stmt.get(...params) as unknown as unknown[] | undefined) ?? [] }
    return { rows: stmt.all(...params) as unknown[] }
  },
  { schema },
)

await migrate(db, async (queries) => sqlite.exec(queries.join(';\n')), {
  migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)),
})

// First run: seed from the shared fixtures so the UI is not empty.
const countOf = async (
  table:
    | typeof schema.jobs
    | typeof schema.teams
    | typeof schema.employees
    | typeof schema.employeeNotes,
) => (await db.select({ n: count() }).from(table))[0]?.n ?? 0
// Teams first: fixture jobs point at them. 0.3.0 added these tables, so an existing database
// gets them seeded once as well, with the user's jobs left unassigned.
if ((await countOf(schema.teams)) === 0 && (await countOf(schema.employees)) === 0) {
  await db.insert(schema.teams).values(fixtures.teams)
  await db.insert(schema.employees).values(fixtures.employees)
  await db.insert(schema.teamMembers).values(fixtures.teamMembers)
}
// 0.3.1 added notes: seeded once, only for employees that still exist (a fixture employee may be gone).
if ((await countOf(schema.employeeNotes)) === 0) {
  const ids = new Set(
    (await db.select({ id: schema.employees.id }).from(schema.employees)).map((r) => r.id),
  )
  const notes = fixtures.employeeNotes.filter((n) => ids.has(n.employeeId))
  if (notes.length) await db.insert(schema.employeeNotes).values(notes)
}

if ((await countOf(schema.jobs)) === 0) {
  await db.insert(schema.jobs).values(fixtures.jobs)
  await db.insert(schema.candidates).values(fixtures.candidates)
  await db.insert(schema.interviewQuestions).values(fixtures.questionRows)
  await db
    .insert(schema.evaluations)
    .values(
      Object.entries(fixtures.evaluations).flatMap(([candidateId, list]) =>
        list.map((e) => ({ candidateId: Number(candidateId), ...e })),
      ),
    )
}

// Every start: insert template keys that are missing, so existing databases get new templates
// without touching ones the user edited (fixtures.emails are demo-only history, not seeded).
await db.insert(schema.emailTemplates).values(fixtures.emailTemplates).onConflictDoNothing()
