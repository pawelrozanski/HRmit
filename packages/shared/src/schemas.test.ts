import { expect, test } from 'vitest'
import { z } from 'zod'
import {
  aiSummarySchema,
  candidateInputSchema,
  emailSchema,
  emailTemplateSchema,
  employeeInputSchema,
  employeeSchema,
  competenciesSchema,
  cvSummarySchema,
  evaluationSchema,
  candidateSchema,
  healthSchema,
  interviewQuestionInputSchema,
  jobInputSchema,
  jobSchema,
  pipelineStageSchema,
  questionsGenerationSchema,
  questionsProposalSchema,
  requirementLines,
  requirementsMatchGenerationSchema,
  requirementsMatchSchema,
  teamMemberLinkSchema,
  teamRowSchema,
} from './schemas.ts'
import { chatToolInputs, chatToolOutputs } from './chat.ts'
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
  expect(fixtures.jobs).toHaveLength(4)
  expect(fixtures.candidates.length).toBeGreaterThanOrEqual(15)
})

test('input schemas fill defaults and reject ids and CV fields', () => {
  expect(jobInputSchema.parse({ title: 'QA' })).toEqual({
    title: 'QA',
    description: '',
    status: 'open',
    teamId: null,
    level: null,
    location: '',
    contract: '',
    requirements: '',
    niceToHave: '',
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: 'PLN',
    salaryPeriod: 'month',
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
    // ADR 0010: a status per requirement, still no total, rank or verdict key.
    requirementsMatchGenerationSchema,
    requirementsMatchSchema,
    // Chat tools (ADR 0007): what the model is handed has no verdict field either.
    ...Object.values(chatToolInputs),
    ...Object.values(chatToolOutputs),
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

test('fixture evaluations point at questions of the candidate job and pass the schema', () => {
  for (const [candidateId, list] of Object.entries(fixtures.evaluations)) {
    const candidate = fixtures.candidates.find((c) => c.id === Number(candidateId))!
    const ids = fixtures.questionRows.filter((q) => q.jobId === candidate.jobId).map((q) => q.id)
    expect(list.map((e) => evaluationSchema.parse(e).questionId)).toEqual(ids)
    expect(list.some((e) => e.score !== null)).toBe(true)
  }
  expect(() => evaluationSchema.parse({ questionId: 1, score: 6, note: '' })).toThrow()
  expect(() => evaluationSchema.parse({ questionId: 1, score: 0, note: '' })).toThrow()
})

test('fixture email templates cover every key and fixture emails point at candidates', () => {
  expect(fixtures.emailTemplates.map((t) => emailTemplateSchema.parse(t).key)).toEqual([
    'invite',
    'reminder',
    'rejection',
  ])
  for (const e of fixtures.emails) {
    emailSchema.parse(e)
    expect(fixtures.candidates.some((c) => c.id === e.candidateId)).toBe(true)
  }
})

test('fixture teams and employees pass the schemas; one lead per team, valid links', () => {
  for (const e of fixtures.employees) employeeSchema.parse(e)
  for (const t of fixtures.teams) teamRowSchema.parse(t)
  const employeeIds = new Set(fixtures.employees.map((e) => e.id))
  const teamIds = new Set(fixtures.teams.map((t) => t.id))
  for (const m of fixtures.teamMembers) {
    teamMemberLinkSchema.parse(m)
    expect(employeeIds.has(m.employeeId)).toBe(true)
    expect(teamIds.has(m.teamId)).toBe(true)
  }
  for (const t of fixtures.teams)
    expect(fixtures.teamMembers.filter((m) => m.teamId === t.id && m.role === 'lead')).toHaveLength(
      1,
    )
  for (const j of fixtures.jobs) if (j.teamId !== null) expect(teamIds.has(j.teamId)).toBe(true)

  const input = { firstName: 'A', lastName: 'B', position: 'C', email: 'a@example.com' }
  expect(employeeInputSchema.parse(input)).toMatchObject({ hiredAt: null, duties: '' })
  expect(() => employeeInputSchema.parse({ ...input, hiredAt: '2026-13-01' })).toThrow()
  expect(jobInputSchema.parse({ title: 'x' }).teamId).toBeNull()
})

test('requirementLines: requirements then nice-to-haves, blank lines dropped', () => {
  expect(requirementLines({ requirements: ' React \n\nTypeScript', niceToHave: 'Figma' })).toEqual([
    { requirement: 'React', kind: 'required' },
    { requirement: 'TypeScript', kind: 'required' },
    { requirement: 'Figma', kind: 'niceToHave' },
  ])
})
