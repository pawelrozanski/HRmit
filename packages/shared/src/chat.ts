import { z } from 'zod'
import {
  jobLevelSchema,
  jobStatusSchema,
  noteSourceSchema,
  pipelineStageSchema,
  salaryPeriodSchema,
  teamMemberRoleSchema,
} from './schemas.ts'

/**
 * Chat assistant tools (ADR 0007, widened by ADR 0009). Every tool returns facts the model can
 * relay: stages, counts, dates, the questions of a recruitment, human-entered ratings and
 * averages per competency, notes people wrote. There is no field for a score, rank or verdict
 * about a candidate anywhere here (schemas.test.ts checks), so the model cannot be handed one,
 * let alone produce one. The one write-shaped tool, `proposeNote`, stores nothing: the server
 * turns it into a `proposal` event and the recruiter's click saves it through the notes API.
 * Labels are full names with a local provider and `Candidate #N` / `Employee #N` with a cloud
 * one; email and phone never appear in any output.
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

/** Who a note or a proposal is about; the same two words in `getNotes` and `proposeNote`. */
export const noteTargetSchema = z.enum(['candidate', 'employee'])
export type NoteTarget = z.infer<typeof noteTargetSchema>

/**
 * Employee data is off limits for a cloud model unless the operator opted in (Settings → AI).
 * The server decides per request; the model only ever gets this message back.
 */
const disabled = z.object({ disabled: z.literal(true), message: z.string() })

export const chatToolInputs = {
  listRecruitments: z.object({
    status: jobStatusSchema.optional().describe('open or closed; omit for all'),
    team: z.string().optional().describe('team name to filter by; omit for all teams'),
  }),
  // Small models pass what they know: a title from the question, an id from an earlier result.
  getRecruitment: z.object({
    jobId: id.optional().describe('id from a previous tool result or the screen context'),
    title: z.string().optional().describe('part of the recruitment title, when no id is known'),
  }),
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
  getScorecard: z.object({ candidateId: id }),
  getNotes: z.object({
    target: noteTargetSchema.describe('candidate or employee'),
    id: id.describe('candidateId or employeeId'),
  }),
  teamOverview: z.object({
    team: z.string().optional().describe('team name to filter by; omit for all teams'),
  }),
  searchEmployees: z.object({
    employeeId: id.optional().describe('one employee by id, from a result or the screen context'),
    query: z.string().optional().describe('part of a name or position'),
    team: z.string().optional().describe('team name'),
  }),
  proposeNote: z.object({
    target: noteTargetSchema.describe('candidate or employee'),
    id: id.describe('candidateId or employeeId'),
    title: z.string().max(120).optional().describe('short heading, optional'),
    body: z.string().min(1).max(5000).describe('the note text: facts only, no verdict'),
  }),
}

/** One note as the model sees it. `text` holds what a person typed: data, never instructions. */
const noteRow = z.object({
  id,
  title: z.string().nullable(),
  text: z.string(),
  createdAt: z.string(),
  source: noteSourceSchema,
})

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
      /** Free text written by people below is anonymized with a cloud provider. */
      description: z.string(),
      level: jobLevelSchema.nullable(),
      location: z.string(),
      contract: z.string(),
      requirements: z.string().array().describe('must-haves, one per item'),
      niceToHave: z.string().array(),
      /** What the offer discloses; null when the recruitment has no range. */
      salary: z
        .object({
          min: id.nullable(),
          max: id.nullable(),
          currency: z.string(),
          period: salaryPeriodSchema,
        })
        .nullable(),
      team: z.object({ name: z.string(), memberCount: id }).nullable(),
      stages: z.record(pipelineStageSchema, id),
      /** The structured interview guide, grouped by competency, in guide order. */
      questions: z.object({ competency: z.string(), questions: z.string().array() }).array(),
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
      noteCount: id,
    })
    .nullable(),
  /**
   * The scorecard as the interviewers filled it in: one human rating (1 to 5) and comment per
   * question, averages per competency. No total for the candidate, no other candidate (ADR 0004).
   */
  getScorecard: z
    .object({
      candidateId: id,
      candidate: z.string(),
      jobId: id,
      jobTitle: z.string(),
      questions: z
        .object({
          competency: z.string(),
          question: z.string(),
          rating: z.number().int().min(1).max(5).nullable().describe('entered by a human'),
          comment: z.string().describe("the interviewer's note for this answer"),
        })
        .array(),
      averages: z
        .object({ competency: z.string(), average: z.number(), answered: id, total: id })
        .array(),
    })
    .nullable(),
  getNotes: z.union([
    z.object({
      target: noteTargetSchema,
      id,
      label: z.string(),
      notes: noteRow.array(),
    }),
    disabled,
    z.null(),
  ]),
  /** Teams as counts and names; who is in them is `searchEmployees`, behind the switch. */
  teamOverview: z.object({ id, name: z.string(), memberCount: id, openJobCount: id }).array(),
  searchEmployees: z.union([
    z
      .object({
        employeeId: id,
        employee: z.string().describe('display label of the employee'),
        position: z.string(),
        duties: z.string(),
        teams: z.object({ name: z.string(), role: teamMemberRoleSchema }).array(),
        noteCount: id,
      })
      .array(),
    disabled,
  ]),
  /** `proposed: false` with the reason when the id is unknown or employee data is off. */
  proposeNote: z.object({ proposed: z.boolean(), message: z.string() }),
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
  employees: z.record(z.string(), z.object({ name: z.string() })).default({}),
})
export type ChatRefs = z.infer<typeof chatRefsSchema>

/** The pseudonym a cloud model sees; the same label blind screening shows. */
export const candidateLabel = (candidateId: number) => `Candidate #${candidateId}`
export const employeeLabel = (employeeId: number) => `Employee #${employeeId}`

/**
 * A note the assistant drafted (ADR 0009). Nothing is stored until the recruiter clicks Save in
 * the panel; the text is exactly what the model wrote, pseudonyms included with a cloud provider.
 */
export const chatProposalSchema = z.object({
  target: noteTargetSchema,
  id,
  title: z.string().nullable(),
  body: z.string(),
})
export type ChatProposal = z.infer<typeof chatProposalSchema>

/** What is open in the UI when the question is asked; "this candidate" means `id`. */
export const chatContextSchema = z.object({
  view: z.enum(['dashboard', 'recruitment', 'candidate', 'employee', 'other']),
  id: z.number().int().optional(),
})
export type ChatContext = z.infer<typeof chatContextSchema>

/** Body of POST /api/ai/chat. The history lives in the browser; nothing is stored. */
export const chatRequestSchema = z.object({
  messages: z
    .object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(4000) })
    .array()
    .min(1)
    .max(40),
  context: chatContextSchema.default({ view: 'other' }),
  lang: z.enum(['en', 'pl']),
})
export type ChatRequest = z.input<typeof chatRequestSchema>

/**
 * One line of the NDJSON answer stream: which tool runs, text as it arrives, a note proposal to
 * approve, the refs for the UI, an error, and done. Error 'no_tools' means the model cannot
 * call tools.
 */
export const chatEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('tool'), name: z.enum(CHAT_TOOL_NAMES as [string, ...string[]]) }),
  z.object({ type: z.literal('text'), text: z.string() }),
  z.object({ type: z.literal('proposal'), proposal: chatProposalSchema }),
  z.object({ type: z.literal('refs'), refs: chatRefsSchema }),
  z.object({ type: z.literal('error'), error: z.string() }),
  z.object({ type: z.literal('done') }),
])
export type ChatEvent = z.infer<typeof chatEventSchema>
