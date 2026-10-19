import { expect, test } from 'vitest'
import {
  candidateInputSchema,
  candidateSchema,
  healthSchema,
  jobInputSchema,
  jobSchema,
  pipelineStageSchema,
} from './schemas.ts'
import * as fixtures from './fixtures/index.ts'

test('health schema accepts both modes', () => {
  expect(healthSchema.parse({ ok: true, mode: 'local', version: '0.0.0' }).mode).toBe('local')
  expect(() => healthSchema.parse({ ok: false, mode: 'local', version: '0' })).toThrow()
})

test('pipeline stage rejects unknown stages', () => {
  expect(pipelineStageSchema.parse('offer')).toBe('offer')
  expect(() => pipelineStageSchema.parse('hired')).toThrow()
})

test('fixtures pass the schemas and every candidate points at a job', () => {
  const jobIds = new Set(fixtures.jobs.map((j) => jobSchema.parse(j).id))
  for (const c of fixtures.candidates) expect(jobIds.has(candidateSchema.parse(c).jobId)).toBe(true)
  expect(fixtures.jobs).toHaveLength(3)
  expect(fixtures.candidates.length).toBeGreaterThanOrEqual(15)
})

test('input schemas fill defaults and reject ids and CV fields', () => {
  expect(jobInputSchema.parse({ title: 'QA' })).toEqual({
    title: 'QA',
    description: '',
    status: 'open',
  })
  expect(() => jobInputSchema.parse({ title: '' })).toThrow()
  const c = candidateInputSchema.parse({
    jobId: 1,
    firstName: 'Ada',
    lastName: 'Byron',
    email: 'ada@example.com',
  })
  expect(c).toMatchObject({ phone: '', stage: 'applied', notes: '' })
  expect('cvText' in c).toBe(false)
  expect(() => candidateInputSchema.parse({ ...c, email: 'nope' })).toThrow()
})
