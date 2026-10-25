import { execFile, spawn } from 'node:child_process'
import { closeSync, existsSync, openSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import {
  VERSION,
  updateRunSchema,
  updateStartSchema,
  type UpdateCheck,
  type UpdateRun,
  type UpdateStatus,
} from '@hrmit/shared'
import { dataDir } from '../db/index.ts'
import { log } from '../log.ts'
import { backupArchive, backupName } from './backup.ts'

const TAGS_URL = 'https://api.github.com/repos/pawelrozanski/HRmit/tags?per_page=100'
const root = fileURLToPath(new URL('../../../../', import.meta.url))
const updater = fileURLToPath(new URL('../update/updater.ts', import.meta.url))
const statusFile = join(dataDir, 'update.json')
const tagsSchema = z.array(z.object({ name: z.string() }))

/** '0.10.0' is newer than '0.9.1'. Plain x.y.z only, which is all this repository tags. */
export function isNewer(a: string, b: string) {
  const [pa, pb] = [a, b].map((v) => v.split('.').map(Number)) as [number[], number[]]
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return (pa[i] ?? 0) > (pb[i] ?? 0)
  return false
}

/** The highest vX.Y.Z tag on GitHub, or the running version if none is higher. */
async function latestRelease() {
  const res = await fetch(TAGS_URL, {
    headers: { accept: 'application/vnd.github+json', 'user-agent': 'HRmit' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`)
  return tagsSchema
    .parse(await res.json())
    .flatMap((t) => /^v(\d+\.\d+\.\d+)$/.exec(t.name)?.[1] ?? [])
    .reduce((a, b) => (isNewer(b, a) ? b : a), VERSION)
}

/** HRMIT_INSTALLER is set by the Windows launcher; the Docker image has no .git. */
const install = () =>
  process.env.HRMIT_INSTALLER ? 'installer' : existsSync(join(root, '.git')) ? 'git' : 'manual'

const readRun = (): UpdateRun | null => {
  try {
    return updateRunSchema.parse(JSON.parse(readFileSync(statusFile, 'utf8')))
  } catch {
    return null
  }
}

/**
 * GET /api/update: asks GitHub for the newest release tag. The only call HRmit makes to
 * GitHub, and only when the user clicks "Check for updates"; nothing about the data is sent.
 *
 * POST /api/update: optional backup into data/backups/, then a detached updater fetches the
 * tag, fast-forwards the checkout, installs when the lockfile changed and lets `tsx watch`
 * restart the server. Refused (409) outside a git checkout, when already up to date, or when
 * tracked files have local changes, so nobody's edits are overwritten. The target is the tag
 * the server finds itself, never a value from the request.
 *
 * GET /api/update/status: the running version and the last run, polled by the dialog.
 */
export const updateRoute = new Hono()
  .get('/', async (c) => {
    try {
      const latest = await latestRelease()
      return c.json<UpdateCheck>({
        current: VERSION,
        latest,
        available: isNewer(latest, VERSION),
        install: install(),
      })
    } catch (e) {
      log.warn('update check failed', { error: (e as Error).message })
      return c.json({ error: 'update check failed' }, 502)
    }
  })
  .post('/', zValidator('json', updateStartSchema), async (c) => {
    if (install() !== 'git') return c.json({ error: 'not a git checkout' }, 409)
    let latest: string
    try {
      latest = await latestRelease()
    } catch {
      return c.json({ error: 'update check failed' }, 502)
    }
    if (!isNewer(latest, VERSION)) return c.json({ error: 'up to date' }, 409)
    const { stdout } = await promisify(execFile)(
      'git',
      ['status', '--porcelain', '--untracked-files=no'],
      { cwd: root },
    )
    if (stdout.trim()) return c.json({ error: 'local changes' }, 409)

    let backup: string | null = null
    if (c.req.valid('json').backup) {
      backup = backupName()
      await mkdir(join(dataDir, 'backups'), { recursive: true })
      await writeFile(join(dataDir, 'backups', backup), await backupArchive())
    }
    const run: UpdateRun = { state: 'running', target: latest, step: 'fetch', backup, error: null }
    await writeFile(statusFile, JSON.stringify(run))
    // ponytail: no lock against a second start; the dialog disables its button while running.
    const out = openSync(join(dataDir, 'update.log'), 'w')
    spawn(process.execPath, [updater, root, statusFile], {
      cwd: root,
      detached: true,
      stdio: ['ignore', out, out],
      windowsHide: true,
    }).unref()
    closeSync(out)
    log.info('update started', { from: VERSION, to: latest, backup })
    return c.json<UpdateStatus>({ version: VERSION, run }, 202)
  })
  .get('/status', (c) => c.json<UpdateStatus>({ version: VERSION, run: readRun() }))
