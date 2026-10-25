import { execFileSync, execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { UpdateRun } from '@hrmit/shared'

/**
 * The detached half of POST /api/update, started as `node updater.ts <repo root> <status file>`
 * (Node 24 strips the types). It runs outside the server because the merge makes `tsx watch`
 * restart the server, which would kill anything running inside it. Progress goes to the status
 * file the server serves at GET /api/update/status; command output goes to data/update.log.
 * Plain node, no workspace imports at runtime: only the type import above, which is erased.
 */
const [root, statusFile] = process.argv.slice(2) as [string, string]
const run = JSON.parse(readFileSync(statusFile, 'utf8')) as UpdateRun
const save = (patch: Partial<UpdateRun>) =>
  writeFileSync(statusFile, JSON.stringify(Object.assign(run, patch)))
const git = (...args: string[]) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const tag = `v${run.target}`

try {
  save({ step: 'fetch' })
  git('fetch', '--no-tags', 'origin', `refs/tags/${tag}:refs/tags/${tag}`)
  save({ step: 'merge' })
  const before = git('rev-parse', 'HEAD').trim()
  // Fast-forward only: a checkout with its own commits is refused, never merged into.
  git('merge', '--ff-only', tag)
  if (git('diff', '--name-only', before, 'HEAD', '--', 'pnpm-lock.yaml').trim()) {
    save({ step: 'install' })
    execSync('pnpm install --frozen-lockfile', { cwd: root, stdio: 'inherit' })
  }
  save({ step: 'restart' })
  // The merge already restarted the server under `tsx watch`, possibly before the install
  // finished; touching the entry file restarts it once more with the new dependencies.
  const entry = join(root, 'apps/server/src/index.ts')
  writeFileSync(entry, readFileSync(entry))
  save({ state: 'done' })
} catch (e) {
  const err = e as { stderr?: string | Buffer; message: string }
  save({ state: 'failed', error: (err.stderr?.toString().trim() || err.message).slice(-500) })
}
