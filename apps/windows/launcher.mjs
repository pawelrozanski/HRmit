import { spawn } from 'node:child_process'
import { mkdirSync, openSync } from 'node:fs'
import { join } from 'node:path'

/**
 * What the desktop shortcut runs (ADR 0008): `HRmit.exe launcher.mjs`, where HRmit.exe is the
 * bundled Node. If HRmit is not running yet, start the server in the background with no
 * window, wait until it answers, then open it in the default browser. A second click only
 * opens the browser. Stopping is the "Shut down HRmit" button in Settings > General.
 */
const PORT = 7300 // fixed, so the address and the browser's saved language and theme stay the same
const origin = `http://127.0.0.1:${PORT}`
const here = import.meta.dirname
const home = join(process.env.APPDATA, 'HRmit')
const logFile = join(home, 'hrmit.log')

const running = () =>
  fetch(`${origin}/api/health`)
    .then((r) => r.ok)
    .catch(() => false)

if (!(await running())) {
  mkdirSync(home, { recursive: true })
  // ponytail: the log only grows; rotate it when someone's gets big.
  const log = openSync(logFile, 'a')
  spawn(process.execPath, [join(here, 'server.mjs')], {
    detached: true,
    windowsHide: true,
    stdio: ['ignore', log, log],
    env: {
      ...process.env,
      PORT: String(PORT),
      HRMIT_DATA_DIR: join(home, 'data'),
      HRMIT_WEB_DIST: join(here, 'web'),
      HRMIT_MIGRATIONS_DIR: join(here, 'drizzle'),
      HRMIT_INSTALLER: '1',
    },
  }).unref()
  let up = false
  for (let i = 0; i < 150 && !up; i++) {
    await new Promise((r) => setTimeout(r, 100))
    up = await running()
  }
  // Port taken or a crash: the log says why, and Notepad is something everyone can read.
  if (!up) {
    spawn('notepad.exe', [logFile], { detached: true, stdio: 'ignore' }).unref()
    process.exit(1)
  }
}
spawn('explorer.exe', [origin], { detached: true, stdio: 'ignore' }).unref()
