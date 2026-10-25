import { expect, test, vi } from 'vitest'
import { VERSION, updateCheckSchema, updateStatusSchema } from '@hrmit/shared'
import { app } from '../app.ts'
import { isNewer } from './update.ts'

vi.spyOn(console, 'log').mockImplementation(() => {})
const tags = (...names: string[]) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(names.map((name) => ({ name }))))

test('isNewer compares x.y.z numerically', () => {
  expect(isNewer('0.10.0', '0.9.1')).toBe(true)
  expect(isNewer('1.0.0', '0.99.99')).toBe(true)
  expect(isNewer('0.5.4', '0.5.4')).toBe(false)
  expect(isNewer('0.5.3', '0.5.4')).toBe(false)
})

test('GET /api/update picks the highest release tag and ignores others', async () => {
  tags('v99.0.0', 'v100.0.0', 'v200.0.0-rc.1', 'nightly')
  const check = updateCheckSchema.parse(await (await app.request('/api/update')).json())
  expect(check).toMatchObject({
    current: VERSION,
    latest: '100.0.0',
    available: true,
    install: 'git',
  })
})

test('POST /api/update refuses when already on the newest tag', async () => {
  tags(`v${VERSION}`)
  const res = await app.request('/api/update', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ backup: true }),
  })
  expect(res.status).toBe(409)
  expect(updateStatusSchema.parse(await (await app.request('/api/update/status')).json()).run).toBe(
    null,
  )
})
