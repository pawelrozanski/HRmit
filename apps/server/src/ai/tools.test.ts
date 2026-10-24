import { expect, test } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import {
  CHAT_TOOL_NAMES,
  chatRefsSchema,
  chatToolInputs,
  chatToolOutputs,
  fixtures,
  type ChatToolName,
} from '@hrmit/shared'
import { db } from '../db/index.ts'
import * as schema from '../db/schema.ts'
import { chatToolFns, newRefs, type ToolContext } from './tools.ts'

const amelia = fixtures.candidates[0]!
const CV = `${amelia.firstName} ${amelia.lastName}\n${amelia.email} | ${amelia.phone}\n\n${fixtures.cvText}`
const SUMMARY = `${amelia.firstName} ${amelia.lastName} has four years of React. Reach her at ${amelia.email}.`
await db
  .update(schema.candidates)
  .set({
    cvText: CV,
    aiSummaryJson: {
      summary: { summary: SUMMARY, highlights: [], generatedAt: 't', model: 'm' },
      competencies: {
        competencies: [{ name: 'Accessibility', evidence: 'audits' }],
        generatedAt: 't',
        model: 'm',
      },
    },
  })
  .where(eq(schema.candidates.id, 1))
await db.insert(schema.meetings).values({
  candidateId: 1,
  startsAt: new Date(Date.now() + 86_400_000).toISOString(),
  durationMin: 60,
  jitsiUrl: 'https://meet.jit.si/hrmit-test',
})

/** Every tool with a typical input, in a mode; outputs validated against the shared schemas. */
async function runAll(local: boolean) {
  const ctx: ToolContext = { local, refs: newRefs() }
  const inputs: { [N in ChatToolName]: unknown } = {
    listRecruitments: { status: 'open' },
    getRecruitment: { jobId: 1 },
    upcomingMeetings: {},
    stuckCandidates: { days: 7 },
    searchCandidates: { query: 'accessibility' },
    getCandidate: { candidateId: 1 },
    teamOverview: {},
  }
  const out = {} as { [N in ChatToolName]: unknown }
  for (const name of CHAT_TOOL_NAMES) {
    const input = chatToolInputs[name].parse(inputs[name])
    const fn = chatToolFns[name] as (i: unknown, c: ToolContext) => Promise<unknown>
    out[name] = chatToolOutputs[name].parse(await fn(input, ctx))
  }
  return { out, ctx }
}

test('local provider: full names, stored AI text as is, refs for every candidate and job', async () => {
  const { out, ctx } = await runAll(true)
  const candidate = chatToolOutputs.getCandidate.parse(out.getCandidate)!
  expect(candidate).toMatchObject({
    candidate: 'Amelia Hartwell',
    jobTitle: fixtures.jobs[0]!.title,
    stage: 'interview',
    summary: SUMMARY,
    competencies: ['Accessibility'],
    meetingCount: 1,
    emailCount: 0,
  })
  // Human averages per competency only, never one number for the candidate.
  expect(candidate.interviewAverages.length).toBeGreaterThan(1)
  expect(candidate.interviewAverages.every((a) => a.average >= 1 && a.average <= 5)).toBe(true)
  expect(Object.keys(candidate)).not.toContain('total')
  expect(chatToolOutputs.upcomingMeetings.parse(out.upcomingMeetings)).toMatchObject([
    { candidateId: 1, candidate: 'Amelia Hartwell' },
  ])
  expect(
    chatToolOutputs.searchCandidates.parse(out.searchCandidates).map((c) => c.candidateId),
  ).toEqual([1])
  expect(chatToolOutputs.getRecruitment.parse(out.getRecruitment)).toMatchObject({
    teamName: 'IT',
    stages: { interview: 1, rejected: 1 },
    questionCount: fixtures.questions[1]!.length,
  })
  expect(chatToolOutputs.teamOverview.parse(out.teamOverview)[0]).toMatchObject({
    name: 'Customer Support',
    memberCount: 4,
  })
  chatRefsSchema.parse(ctx.refs)
  expect(ctx.refs.candidates[1]).toEqual({ name: 'Amelia Hartwell', jobId: 1 })
  expect(ctx.refs.recruitments[1]?.title).toBe(fixtures.jobs[0]!.title)
})

test('cloud provider: pseudonyms, anonymized AI text, never an email or phone', async () => {
  const { out, ctx } = await runAll(false)
  const json = JSON.stringify(out)
  for (const c of fixtures.candidates) {
    expect(json).not.toContain(c.firstName)
    expect(json).not.toContain(c.lastName)
    expect(json).not.toContain(c.email)
  }
  expect(json).not.toMatch(/@example\.com|\+48|\[phone\]/)
  const candidate = chatToolOutputs.getCandidate.parse(out.getCandidate)!
  expect(candidate.candidate).toBe('Candidate #1')
  expect(candidate.summary).toBe('Candidate #1 has four years of React. Reach her at [email].')
  // The UI still gets the real name, from the refs, never from the tool output.
  expect(ctx.refs.candidates[1]?.name).toBe('Amelia Hartwell')
})

test('employees never appear: team tool is counts and names only', async () => {
  const json = JSON.stringify(await chatToolFns.teamOverview({}, { local: true, refs: newRefs() }))
  for (const e of fixtures.employees) {
    expect(json).not.toContain(e.lastName)
    expect(json).not.toContain(e.position)
  }
})

test('missing ids give null, filters apply, search ignores names', async () => {
  const ctx: ToolContext = { local: true, refs: newRefs() }
  expect(await chatToolFns.getCandidate({ candidateId: 9999 }, ctx)).toBeNull()
  expect(await chatToolFns.getRecruitment({ jobId: 9999 }, ctx)).toBeNull()
  expect((await chatToolFns.listRecruitments({ teamId: 2 }, ctx)).map((j) => j.id)).toEqual([1])
  expect(
    (await chatToolFns.stuckCandidates({ days: 10, jobId: 2 }, ctx)).map((c) => c.candidateId),
  ).toEqual([8])
  expect(await chatToolFns.searchCandidates({ query: 'Hartwell' }, ctx)).toEqual([])
  expect(
    (await chatToolFns.searchCandidates({ query: 'offer', jobId: 1 }, ctx)).map(
      (c) => c.candidateId,
    ),
  ).toEqual([4])
})

test('tools are read-only: no row count changes after running all of them', async () => {
  const tables = Object.values(schema).filter((t) => typeof t === 'object' && 'getSQL' in t)
  const counts = () =>
    Promise.all(
      tables.map((t) => db.select({ n: sql<number>`count(*)` }).from(t as typeof schema.jobs)),
    )
  const before = await counts()
  await runAll(true)
  await runAll(false)
  expect(await counts()).toEqual(before)
  expect(tables.length).toBeGreaterThan(5)
})
