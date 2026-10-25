import { execFileSync } from 'node:child_process'
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

/**
 * dist/ is what the installer copies: Node itself (the node.exe running this script, renamed
 * HRmit.exe so Task Manager and the installer can tell it apart), the server as one ESM file,
 * its migrations, the web build, the launcher and the icon. Then makensis packs it.
 * Needs the web app built first (`pnpm dist` does both).
 */
const path = (p) => fileURLToPath(new URL(p, import.meta.url))
const { version } = JSON.parse(readFileSync(path('package.json'), 'utf8'))

rmSync(path('dist'), { recursive: true, force: true })
await build({
  entryPoints: [path('../server/src/index.ts')],
  outfile: path('dist/server.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  // CommonJS dependencies (nodemailer, mammoth) call require(); ESM output has none by default.
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  logLevel: 'warning',
})
cpSync(path('../server/drizzle'), path('dist/drizzle'), { recursive: true })
cpSync(path('../web/dist'), path('dist/web'), { recursive: true })
copyFileSync(path('launcher.mjs'), path('dist/launcher.mjs'))
copyFileSync(path('hrmit.ico'), path('dist/hrmit.ico'))
copyFileSync(process.execPath, path('dist/HRmit.exe'))

mkdirSync(path('release'), { recursive: true }) // makensis does not create the OutFile folder
const nsis = 'C:/Program Files (x86)/NSIS/makensis.exe'
const makensis = process.env.MAKENSIS ?? (existsSync(nsis) ? nsis : 'makensis')
execFileSync(makensis, ['/V2', `/DVERSION=${version}`, 'installer.nsi'], {
  cwd: path('.'),
  stdio: 'inherit',
})
console.log(`release/HRmit-Setup-${version}.exe (Node ${process.versions.node})`)
