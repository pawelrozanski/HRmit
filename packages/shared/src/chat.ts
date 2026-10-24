import { z } from 'zod'
import { jobStatusSchema, pipelineStageSchema } from './schemas.ts'

/**
 * Chat assistant tools (ADR 0007). Every tool is read-only and returns facts the model can
 * relay: stages, counts, dates, human-entered averages per competency. There is no field for a
 * score, rank or verdict about a candidate anywhere here (schemas.test.ts checks), so the model
 * cannot be handed one, let alone produce one. The `candidate` label is the full name with a
 * local provider and `Candidate #N` with a cloud one; email, phone, notes and CV text never
 * appear in any output.
 */
const id = z.number().int()

const candidateRow = z.object({
  candidateId: id,
  candidate: z.string().describe('display label of the candidate'),
  jobId: id,
  jobTitle: z.string(),
  stage: pipelineStageSchema,
  daysInStage: id,
})

export const chatToolInputs = {
  listRecruitments: z.object({
    status: jobStatusSchema.optional().describe('open or closed; omit for all'),
    teamId: id.optional(),
  }),
  getRecruitment: z.object({ jobId: id }),
  upcomingMeetings: z.object({
    days: id.min(1).max(30).default(7).describe('how many days ahead, default 7'),
  }),
  stuckCandidates: z.object({
    days: id.min(1).max(365).default(7).describe('minimum days without a stage change'),
    jobId: id.optional(),
  }),
  searchCandidates: z.object({
    query: z.string().min(1).describe('job title, stage name or competency keyword'),
    jobId: id.optional(),
  }),
  getCandidate: z.object({ candidateId: id }),
  teamOverview: z.object({ teamId: id.optional() }),
}

export const chatToolOutputs = {
  listRecruitments: z
    .object({
      id,
      title: z.string(),
      status: jobStatusSchema,
      teamName: z.string().nullable(),
      candidateCount: id,
    })
    .array(),
  getRecruitment: z
    .object({
      id,
      title: z.string(),
      status: jobStatusSchema,
      teamName: z.string().nullable(),
      stages: z.record(pipelineStageSchema, id),
      questionCount: id,
    })
    .nullable(),
  upcomingMeetings: candidateRow
    .omit({ stage: true, daysInStage: true })
    .extend({ startsAt: z.string(), durationMin: id })
    .array(),
  stuckCandidates: candidateRow.array(),
  searchCandidates: candidateRow.array(),
  getCandidate: candidateRow
    .extend({
      jobStatus: jobStatusSchema,
      /** The stored AI summary, if any; anonymized with a cloud provider. */
      summary: z.string().nullable(),
      competencies: z.string().array(),
      /** Human interview averages per competency; never summed into one number (ADR 0004). */
      interviewAverages: z
        .object({ competency: z.string(), average: z.number(), answered: id, total: id })
        .array(),
      meetingCount: id,
      emailCount: id,
    })
    .nullable(),
  /** Employees never reach the model: teams are counts and names only (docs/SECURITY.md). */
  teamOverview: z.object({ id, name: z.string(), memberCount: id, openJobCount: id }).array(),
}

export type ChatToolName = keyof typeof chatToolInputs
export const CHAT_TOOL_NAMES = Object.keys(chatToolInputs) as ChatToolName[]
export type ChatToolInput<N extends ChatToolName> = z.infer<(typeof chatToolInputs)[N]>
export type ChatToolOutput<N extends ChatToolName> = z.infer<(typeof chatToolOutputs)[N]>

/**
 * What the UI needs to turn labels into links and pseudonyms back into names. Collected on the
 * server while tools run and sent to the browser only, never to the model.
 */
export const chatRefsSchema = z.object({
  candidates: z.record(z.string(), z.object({ name: z.string(), jobId: id })),
  recruitments: z.record(z.string(), z.object({ title: z.string() })),
})
export type ChatRefs = z.infer<typeof chatRefsSchema>

/** The pseudonym a cloud model sees; the same label blind screening shows. */
export const candidateLabel = (candidateId: number) => `Candidate #${candidateId}`
