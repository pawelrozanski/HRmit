import { readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { tarGz, type TarEntry } from '../backup/tar.ts'
import { db, uploadsDir } from '../db/index.ts'
import { log } from '../log.ts'

/** 2026-10-25T14:03:00Z -> hrmit-backup-2026-10-25-1403.tar.gz */
export const backupName = (now = new Date()) =>
  `hrmit-backup-${now.toISOString().slice(0, 16).replace('T', '-').replace(':', '')}.tar.gz`

/**
 * GET /api/backup: the database (a consistent VACUUM INTO snapshot, so the WAL is folded in)
 * and the CV files, as one .tar.gz. master.key is left out on purpose (docs/SECURITY.md):
 * the archive holds personal data and travels; the encrypted API key and SMTP password stay
 * unreadable without the key and are simply entered again after a restore.
 */
export const backupRoute = new Hono().get('/', async (c) => {
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
