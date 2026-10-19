import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { dataDir } from '../db/index.ts'

/**
 * docs/ARCHITECTURE.md §7: a random 32-byte master key is created on first run in
 * <data dir>/master.key (mode 0600 where the OS honours it). Tests (':memory:') get a throwaway key.
 */
function loadMasterKey(): Buffer {
  if (dataDir === ':memory:') return randomBytes(32)
  const file = join(dataDir, 'master.key')
  if (!existsSync(file)) writeFileSync(file, randomBytes(32).toString('hex'), { mode: 0o600 })
  const key = Buffer.from(readFileSync(file, 'utf8').trim(), 'hex')
  if (key.length !== 32) throw new Error(`${file} is not a 32-byte hex key`)
  return key
}
const masterKey = loadMasterKey()

/** AES-256-GCM. Returns "iv.tag.ciphertext" in base64; a fresh IV per call. */
export function encrypt(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', masterKey, iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join('.')
}

/** Inverse of encrypt. Throws on a tampered or foreign blob (GCM auth tag check). */
export function decrypt(blob: string): string {
  const [iv, tag, data] = blob.split('.').map((s) => Buffer.from(s, 'base64'))
  if (!iv || !tag || !data) throw new Error('malformed secret blob')
  const decipher = createDecipheriv('aes-256-gcm', masterKey, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}
