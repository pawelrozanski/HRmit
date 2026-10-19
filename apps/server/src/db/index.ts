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
const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(schema.jobs)
if (n === 0) {
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
