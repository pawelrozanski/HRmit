import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { gunzipSync } from 'node:zlib'
import { zValidator } from '@hono/zod-validator'
import { count, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { type RestoreResult } from '@hrmit/shared'
import { tarGz, untar, type TarEntry } from '../backup/tar.ts'
import { db, replaceDatabase, uploadsDir } from '../db/index.ts'
import { candidates } from '../db/schema.ts'
import { log } from '../log.ts'

/** 2026-10-25T14:03:00Z -> hrmit-backup-2026-10-25-1403.tar.gz */
export const backupName = (now = new Date()) =>
  `hrmit-backup-${now.toISOString().slice(0, 16).replace('T', '-').replace(':', '')}.tar.gz`

/** Names the archive may carry: the database, or a flat file name under uploads/. */
const isUploadName = (name: string) =>
  name.startsWith('uploads/') && basename(name.slice(8)) === name.slice(8) && name.length > 8

/** The uploaded database must open, pass integrity_check and have the core tables. */
function validDatabase(bytes: Buffer): Promise<boolean> {
  const tmp = join(tmpdir(), `hrmit-restore-${crypto.randomUUID()}.db`)
  return writeFile(tmp, bytes)
    .then(() => {
      const d = new DatabaseSync(tmp, { readOnly: true })
      try {
        const ok = d.prepare('PRAGMA integrity_check').get() as { integrity_check: string }
        const tables = d
          .prepare("select name from sqlite_master where type = 'table'")
          .all()
          .map((r) => (r as { name: string }).name)
        return (
          ok.integrity_check === 'ok' && ['jobs', 'candidates'].every((t) => tables.includes(t))
        )
      } finally {
        d.close()
      }
    })
    .catch(() => false)
    .finally(() => rm(tmp, { force: true }))
}

/**
 * GET /api/backup: the database (a consistent VACUUM INTO snapshot, so the WAL is folded in)
 * and the CV files, as one .tar.gz. master.key is left out on purpose (docs/SECURITY.md):
 * the archive holds personal data and travels; the encrypted API key and SMTP password stay
 * unreadable without the key and are simply entered again after a restore.
 *
 * POST /api/backup/restore: the same archive back. Everything in the archive replaces what is
 * on disk: the database (migrated afterwards, so an older backup comes up to date) and the
 * whole uploads folder. Settings rows, the API key and the SMTP password included, are the
 * ones from the backup; the secrets are unreadable (different key) and show as unset.
 */
export const backupRoute = new Hono()
  .get('/', async (c) => {
    const snapshot = join(tmpdir(), `hrmit-${crypto.randomUUID()}.db`)
    await db.run(sql`VACUUM INTO ${snapshot}`)
    try {
      const entries: TarEntry[] = [{ name: 'hrmit.db', data: await readFile(snapshot) }]
      for (const f of await readdir(uploadsDir))
        entries.push({ name: `uploads/${f}`, data: await readFile(join(uploadsDir, f)) })
      const body = tarGz(entries)
      log.info('backup', { files: entries.length, bytes: body.length })
      return c.body(new Uint8Array(body), 200, {
        'content-type': 'application/gzip',
        'content-disposition': `attachment; filename="${backupName()}"`,
      })
    } finally {
      await rm(snapshot, { force: true })
    }
  })
  .post('/restore', zValidator('form', z.object({ file: z.instanceof(File) })), async (c) => {
    let entries: TarEntry[]
    try {
      entries = untar(gunzipSync(Buffer.from(await c.req.valid('form').file.arrayBuffer())))
    } catch {
      return c.json({ error: 'not a backup archive' }, 415)
    }
    const database = entries.find((e) => e.name === 'hrmit.db')
    const uploads = entries.filter((e) => e.name !== 'hrmit.db')
    if (!database || !uploads.every((e) => isUploadName(e.name)))
      return c.json({ error: 'not a backup archive' }, 415)
    if (!(await validDatabase(database.data))) return c.json({ error: 'database damaged' }, 422)

    await replaceDatabase(database.data)
    await rm(uploadsDir, { recursive: true, force: true })
    await mkdir(uploadsDir, { recursive: true })
    for (const e of uploads) await writeFile(join(uploadsDir, basename(e.name)), e.data)
    const [row] = await db.select({ n: count() }).from(candidates)
    log.info('restore', { files: uploads.length, candidates: row?.n ?? 0 })
    return c.json<RestoreResult>({ candidates: row?.n ?? 0, files: uploads.length })
  })
