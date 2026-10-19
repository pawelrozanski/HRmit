import { expect, test } from 'vitest'
import { z } from 'zod'
import {
  aiSummarySchema,
  candidateInputSchema,
  competenciesSchema,
  cvSummarySchema,
  candidateSchema,
  healthSchema,
  interviewQuestionInputSchema,
  jobInputSchema,
  jobSchema,
  pipelineStageSchema,
  questionsGenerationSchema,
  questionsProposalSchema,
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

// ADR 0004: the model cannot return a verdict because there is no field for one.
test('AI output schemas have no score, rank or verdict field anywhere', () => {
  const forbidden = /score|rank|fit|recommend|verdict|hire|flag/i
  const keys = (node: unknown): string[] =>
    node && typeof node === 'object'
      ? Object.entries(node).flatMap(([k, v]) => [
          ...(k === 'properties' ? Object.keys(v as object) : []),
          ...keys(v),
        ])
      : []
  for (const schema of [
    cvSummarySchema,
    competenciesSchema,
    aiSummarySchema,
    questionsGenerationSchema,
    questionsProposalSchema,
  ]) {
    const found = keys(z.toJSONSchema(schema))
    expect(found.length).toBeGreaterThan(0)
    expect(found.filter((k) => forbidden.test(k))).toEqual([])
  }
  // Every fixture answer must pass the same schemas.
  for (const entry of Object.values(fixtures.ai)) {
    cvSummarySchema.parse(entry.summary)
    competenciesSchema.parse(entry.competencies)
  }
  expect(Object.keys(fixtures.ai)).toHaveLength(fixtures.candidates.length)
})

test('fixture question sets cover every job and pass the generation schema', () => {
  for (const job of fixtures.jobs) {
    const set = fixtures.questions[job.id]!
    questionsGenerationSchema.parse({ questions: set })
    for (const q of set) interviewQuestionInputSchema.parse(q)
    expect(new Set(set.map((q) => q.competency)).size).toBeGreaterThanOrEqual(3)
  }
})
