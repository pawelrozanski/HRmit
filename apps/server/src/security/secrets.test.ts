import { expect, test } from 'vitest'
import { decrypt, encrypt } from './secrets.ts'

test('encrypt/decrypt round trip, fresh IV each time', () => {
  const a = encrypt('sk-ant-secret')
  const b = encrypt('sk-ant-secret')
  expect(a).not.toBe(b)
  expect(a).not.toContain('sk-ant')
  expect(decrypt(a)).toBe('sk-ant-secret')
  expect(decrypt(b)).toBe('sk-ant-secret')
})

test('tampered ciphertext fails to decrypt', () => {
  const [iv, tag, data] = encrypt('sk-ant-secret').split('.') as [string, string, string]
  const flipped = Buffer.from(data, 'base64')
  flipped[0] = (flipped[0] ?? 0) ^ 0xff
  expect(() => decrypt(`${iv}.${tag}.${flipped.toString('base64')}`)).toThrow()
  expect(() => decrypt(`${iv}.${Buffer.alloc(16).toString('base64')}.${data}`)).toThrow()
})
