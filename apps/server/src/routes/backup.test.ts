import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { tmpdir } from 'node:os'
import { gunzipSync } from 'node:zlib'
import { expect, test, vi } from 'vitest'
import { fixtures } from '@hrmit/shared'
import { app } from '../app.ts'
import { untar } from '../backup/tar.ts'
import { uploadsDir } from '../db/index.ts'
import { backupName } from './backup.ts'

test('GET /api/backup: a tar.gz with a readable database snapshot and the uploads, no key', async () => {
  await writeFile(join(uploadsDir, 'cv-one.pdf'), 'not really a pdf')
  vi.spyOn(console, 'log').mockImplementation(() => {})
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

test('backupName is sortable and filename-safe', () => {
  expect(backupName(new Date('2026-10-25T14:03:00Z'))).toBe('hrmit-backup-2026-10-25-1403.tar.gz')
})
