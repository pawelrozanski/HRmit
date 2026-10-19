import { expect, test, vi } from 'vitest'
import { log, redact } from './log.ts'

test('redact masks secret-looking fields at any depth', () => {
  expect(
    redact({ apiKey: 'k', smtp: { pass: 'p', host: 'h' }, headers: [{ authorization: 'a' }] }),
  ).toEqual({
    apiKey: '[redacted]',
    smtp: { pass: '[redacted]', host: 'h' },
    headers: [{ authorization: '[redacted]' }],
  })
})

test('log writes one JSON line with the fields redacted', () => {
  const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  log.warn('ai test failed', { provider: 'anthropic', apiKey: 'sk-ant-123' })
  const line = JSON.parse(spy.mock.calls[0]?.[0] as string) as Record<string, unknown>
  expect(line).toMatchObject({ level: 'warn', msg: 'ai test failed', provider: 'anthropic' })
  expect(JSON.stringify(line)).not.toContain('sk-ant-123')
  spy.mockRestore()
})
