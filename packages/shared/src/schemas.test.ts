import { expect, test } from 'vitest'
import { healthSchema, pipelineStageSchema } from './schemas.ts'

test('health schema accepts both modes', () => {
  expect(healthSchema.parse({ ok: true, mode: 'local', version: '0.0.0' }).mode).toBe('local')
  expect(() => healthSchema.parse({ ok: false, mode: 'local', version: '0' })).toThrow()
})

test('pipeline stage rejects unknown stages', () => {
  expect(pipelineStageSchema.parse('offer')).toBe('offer')
  expect(() => pipelineStageSchema.parse('hired')).toThrow()
})
