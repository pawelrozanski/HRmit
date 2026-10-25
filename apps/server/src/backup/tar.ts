import { gzipSync } from 'node:zlib'

export type TarEntry = { name: string; data: Buffer; mtime?: Date }

const BLOCK = 512
const pad = (n: number) => (BLOCK - (n % BLOCK)) % BLOCK
const octal = (n: number, len: number) => n.toString(8).padStart(len - 1, '0') + '\0'

/** One POSIX ustar header. Names stay under 100 bytes here (uploads are UUID file names). */
function header(e: TarEntry): Buffer {
  const h = Buffer.alloc(BLOCK)
  h.write(e.name, 0, 100, 'utf8')
  h.write(octal(0o644, 8), 100)
  h.write(octal(0, 8), 108)
  h.write(octal(0, 8), 116)
  h.write(octal(e.data.length, 12), 124)
  h.write(octal(Math.floor((e.mtime ?? new Date()).getTime() / 1000), 12), 136)
  h.write('        ', 148) // checksum is computed over spaces
  h.write('0', 156) // regular file
  h.write('ustar\0', 257)
  h.write('00', 263)
  let sum = 0
  for (const b of h) sum += b
  h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148)
  return h
}

/**
 * A .tar.gz built in memory: 40 lines instead of a dependency. Only regular files, no
 * directories (extractors create them), so hrmit.db and uploads/<uuid> are all it ever holds.
 * ponytail: whole archive in memory; stream it if a data folder ever passes a few hundred MB.
 */
export function tarGz(entries: TarEntry[]): Buffer {
  const parts: Buffer[] = []
  for (const e of entries) {
    parts.push(header(e), e.data, Buffer.alloc(pad(e.data.length)))
  }
  parts.push(Buffer.alloc(BLOCK * 2))
  return gzipSync(Buffer.concat(parts))
}

/** Reads what tarGz wrote (tests and a future restore): name and bytes per entry. */
export function untar(tar: Buffer): TarEntry[] {
  const out: TarEntry[] = []
  let at = 0
  while (at + BLOCK <= tar.length) {
    const name = tar.toString('utf8', at, at + 100).replace(/\0.*$/s, '')
    if (!name) break
    const size = parseInt(tar.toString('utf8', at + 124, at + 136), 8)
    out.push({ name, data: tar.subarray(at + BLOCK, at + BLOCK + size) })
    at += BLOCK + size + pad(size)
  }
  return out
}
