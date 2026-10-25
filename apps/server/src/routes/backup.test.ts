import { mkdtempSync } from 'node:fs'
import { readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { gunzipSync } from 'node:zlib'
import { expect, test, vi } from 'vitest'
import { fixtures, restoreResultSchema } from '@hrmit/shared'
import { tarGz, untar } from '../backup/tar.ts'

// A real folder, not ':memory:': the restore swaps the database file on disk.
process.env.HRMIT_DATA_DIR = mkdtempSync(join(tmpdir(), 'hrmit-backup-'))
const { app } = await import('../app.ts')
const { uploadsDir } = await import('../db/index.ts')
const { backupName } = await import('./backup.ts')
vi.spyOn(console, 'log').mockImplementation(() => {})

const upload = (name: string, bytes: Uint8Array) => {
  const form = new FormData()
  form.append('file', new File([new Uint8Array(bytes)], name))
  return app.request('/api/backup/restore', { method: 'POST', body: form })
}
const candidateCount = async () =>
  ((await (await app.request('/api/jobs/1/candidates')).json()) as unknown[]).length

test('GET /api/backup: a tar.gz with a readable database snapshot and the uploads, no key', async () => {
  await writeFile(join(uploadsDir, 'cv-one.pdf'), 'not really a pdf')
  const res = await app.request('/api/backup')
  expect(res.status).toBe(200)
  expect(res.headers.get('content-disposition')).toMatch(
    /^attachment; filename="hrmit-backup-\d{4}-\d\d-\d\d-\d{4}\.tar\.gz"$/,
  )
  const entries = untar(gunzipSync(Buffer.from(await res.arrayBuffer())))
  expect(entries.map((e) => e.name)).toEqual(['hrmit.db', 'uploads/cv-one.pdf'])
  expect(entries[1]!.data.toString()).toBe('not really a pdf')

  const file = join(tmpdir(), `hrmit-restored-${Date.now()}.db`)
  await writeFile(file, entries[0]!.data)
  const restored = new DatabaseSync(file)
  const n = restored.prepare('select count(*) as n from candidates').get() as { n: number }
  expect(n.n).toBe(fixtures.candidates.length)
  restored.close()
})

test('POST /api/backup/restore puts the archive back: database rows and the uploads folder', async () => {
  const before = await candidateCount()
  const archive = Buffer.from(await (await app.request('/api/backup')).arrayBuffer())
  // Change things after the backup: a candidate is deleted, another file lands in uploads.
  expect((await app.request('/api/candidates/1', { method: 'DELETE' })).status).toBe(204)
  await writeFile(join(uploadsDir, 'later.pdf'), 'after the backup')
  expect(await candidateCount()).toBe(before - 1)

  const res = await upload('hrmit-backup.tar.gz', archive)
  expect(res.status).toBe(200)
  expect(restoreResultSchema.parse(await res.json())).toEqual({
    candidates: fixtures.candidates.length,
    files: 1,
  })
  expect(await candidateCount()).toBe(before)
  expect(await readdir(uploadsDir)).toEqual(['cv-one.pdf'])
  // The app keeps working on the swapped handle.
  expect((await app.request('/api/templates')).status).toBe(200)
})

test('restore refuses what is not a backup', async () => {
  expect((await upload('x.tar.gz', Buffer.from('hello'))).status).toBe(415)
  const noDb = tarGz([{ name: 'uploads/a.pdf', data: Buffer.from('x') }])
  expect((await upload('x.tar.gz', noDb)).status).toBe(415)
  const traversal = tarGz([
    { name: 'hrmit.db', data: Buffer.from('x') },
    { name: 'uploads/../evil', data: Buffer.from('x') },
  ])
  expect((await upload('x.tar.gz', traversal)).status).toBe(415)
  const damaged = tarGz([{ name: 'hrmit.db', data: Buffer.from('this is not sqlite') }])
  expect((await upload('x.tar.gz', damaged)).status).toBe(422)
})

test('backupName is sortable and filename-safe', () => {
  expect(backupName(new Date('2026-10-25T14:03:00Z'))).toBe('hrmit-backup-2026-10-25-1403.tar.gz')
})
