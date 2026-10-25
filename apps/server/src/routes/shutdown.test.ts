import { expect, test, vi } from 'vitest'
import { shutdownResultSchema } from '@hrmit/shared'
import { app } from '../app.ts'

test('POST /api/shutdown answers first and exits on the next tick', async () => {
  vi.useFakeTimers()
  const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never)
  vi.spyOn(console, 'log').mockImplementation(() => {})
  const res = await app.request('/api/shutdown', { method: 'POST' })
  expect(shutdownResultSchema.parse(await res.json())).toEqual({ ok: true })
  expect(exit).not.toHaveBeenCalled()
  vi.runAllTimers()
  expect(exit).toHaveBeenCalledWith(0)
  vi.useRealTimers()
})
