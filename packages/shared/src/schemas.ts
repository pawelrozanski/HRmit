import { z } from 'zod'

/** Pipeline stages, in kanban order. The only place this list exists. */
export const PIPELINE_STAGES = ['applied', 'screening', 'interview', 'offer', 'rejected'] as const
export const pipelineStageSchema = z.enum(PIPELINE_STAGES)
export type PipelineStage = z.infer<typeof pipelineStageSchema>

export const healthSchema = z.object({
  ok: z.literal(true),
  mode: z.enum(['local', 'demo']),
  version: z.string(),
})
export type Health = z.infer<typeof healthSchema>

export const jobStatusSchema = z.enum(['open', 'closed'])

export const jobSchema = z.object({
  id: z.number().int(),
  title: z.string().min(1),
  description: z.string(),
  status: jobStatusSchema,
  createdAt: z.string(),
})
export type Job = z.infer<typeof jobSchema>

/** Body of POST /api/jobs and PUT /api/jobs/:id. Closing a job is a PUT with status 'closed'. */
export const jobInputSchema = jobSchema.omit({ id: true, createdAt: true }).extend({
  description: z.string().default(''),
  status: jobStatusSchema.default('open'),
})
export type JobInput = z.input<typeof jobInputSchema>

/**
 * AI output schemas (ADR 0004): descriptive fields only. No score, rank, fit, recommendation,
 * verdict or flag field exists anywhere here; schemas.test.ts asserts it.
 */
export const cvSummarySchema = z.object({
  summary: z.string().describe('3 to 6 sentences describing the CV'),
  highlights: z.array(z.string()).describe('short factual points taken from the CV'),
})
export type CvSummary = z.infer<typeof cvSummarySchema>

export const competenciesSchema = z.object({
  competencies: z.array(
    z.object({
      name: z.string(),
      evidence: z.string().describe('where in the CV this competency shows'),
    }),
  ),
})
export type Competencies = z.infer<typeof competenciesSchema>

const aiMeta = z.object({ generatedAt: z.string(), model: z.string() })

/** Stored as candidate.aiSummaryJson: each action's last output plus when and by which model. */
export const aiSummarySchema = z.object({
  summary: cvSummarySchema.extend(aiMeta.shape).optional(),
  competencies: competenciesSchema.extend(aiMeta.shape).optional(),
})
export type AiSummary = z.infer<typeof aiSummarySchema>

/**
 * Structured interview (ADR 0004): questions belong to the job, never to a candidate, so every
 * applicant gets the same list. Descriptive fields only, like the other AI outputs.
 */
export const interviewQuestionSchema = z.object({
  id: z.number().int(),
  jobId: z.number().int(),
  competency: z.string().min(1),
  question: z.string().min(1),
  sortOrder: z.number().int(),
})
export type InterviewQuestion = z.infer<typeof interviewQuestionSchema>

/** One item of the PUT /api/jobs/:id/questions body: the server assigns id and sortOrder. */
export const interviewQuestionInputSchema = interviewQuestionSchema.pick({
  competency: true,
  question: true,
})
export type InterviewQuestionInput = z.infer<typeof interviewQuestionInputSchema>

/** Model output for POST /api/ai/questions/:jobId: 6 to 10 questions over 3 to 5 competencies. */
export const questionsGenerationSchema = z.object({
  questions: z
    .array(
      z.object({
        competency: z.string().describe('the competency this question explores'),
        question: z.string().describe('a behavioural question every candidate can be asked'),
      }),
    )
    .min(6)
    .max(10),
})
export type QuestionsGeneration = z.infer<typeof questionsGenerationSchema>

/** Response of POST /api/ai/questions/:jobId: applied when the job had no questions yet. */
export const questionsProposalSchema = z.object({
  questions: interviewQuestionInputSchema.array(),
  applied: z.boolean(),
})
export type QuestionsProposal = z.infer<typeof questionsProposalSchema>

/**
 * Scorecard (ADR 0004): a human interviewer's 1 to 5 score and note per question of the job.
 * score null means not scored yet. Shown per question and averaged per competency, never summed
 * into one number for the candidate.
 */
export const evaluationSchema = z.object({
  questionId: z.number().int(),
  score: z.number().int().min(1).max(5).nullable(),
  note: z.string(),
})
export type Evaluation = z.infer<typeof evaluationSchema>

/**
 * GET /api/candidates/:id/scorecard: every question of the candidate's job in guide order, joined
 * with its evaluation, so the UI always has the full list. PUT takes evaluationSchema.array().
 */
export const scorecardSchema = z.object({
  candidateId: z.number().int(),
  evaluations: evaluationSchema
    .extend(interviewQuestionSchema.pick({ competency: true, question: true }).shape)
    .array(),
})
export type Scorecard = z.infer<typeof scorecardSchema>

/** Body of POST /api/ai/summarize/:candidateId and /competencies/:candidateId. */
export const aiActionBodySchema = z.object({ lang: z.enum(['en', 'pl']) })
export type AiLang = z.infer<typeof aiActionBodySchema>['lang']

export const candidateSchema = z.object({
  id: z.number().int(),
  jobId: z.number().int(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string(),
  stage: pipelineStageSchema,
  stageChangedAt: z.string(),
  notes: z.string(),
  /** Original upload name, display only. The file itself is served by id, never by path. */
  cvFilename: z.string().nullable(),
  /** Plain text extracted from the CV; empty when extraction failed, null without a CV. */
  cvText: z.string().nullable(),
  aiSummaryJson: aiSummarySchema.nullable(),
  createdAt: z.string(),
})
export type Candidate = z.infer<typeof candidateSchema>

/** Body of POST /api/candidates and PUT /api/candidates/:id. CV fields change only via upload. */
export const candidateInputSchema = candidateSchema
  .omit({
    id: true,
    createdAt: true,
    stageChangedAt: true,
    cvFilename: true,
    cvText: true,
    aiSummaryJson: true,
  })
  .extend({
    phone: z.string().default(''),
    stage: pipelineStageSchema.default('applied'),
    notes: z.string().default(''),
  })
export type CandidateInput = z.input<typeof candidateInputSchema>

/** Body of PATCH /api/candidates/:id/stage. */
export const moveStageSchema = z.object({ stage: pipelineStageSchema })

/** AI provider settings. ADR 0005: Ollama on localhost by default, cloud providers are BYOK. */
export const aiProviderSchema = z.enum(['ollama', 'anthropic', 'openai-compatible'])
export type AiProvider = z.infer<typeof aiProviderSchema>

/** Body of PUT /api/settings/ai. apiKey omitted or '' keeps the stored key, null clears it. */
export const aiSettingsSchema = z.object({
  provider: aiProviderSchema,
  baseUrl: z.string().url(),
  model: z.string().min(1),
  apiKey: z.string().nullable().optional(),
})
export type AiSettings = z.infer<typeof aiSettingsSchema>

/** What GET /api/settings/ai returns: the key itself never leaves the server. */
export const aiSettingsViewSchema = aiSettingsSchema
  .omit({ apiKey: true })
  .extend({ hasApiKey: z.boolean() })
export type AiSettingsView = z.infer<typeof aiSettingsViewSchema>

export const AI_SETTINGS_DEFAULTS: AiSettingsView = {
  provider: 'ollama',
  baseUrl: 'http://localhost:11434/v1',
  model: 'qwen2.5:7b-instruct',
  hasApiKey: false,
}

/** Result of POST /api/ai/test. The error text is sanitized on the server: no key, no stack. */
export const aiTestResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), model: z.string(), latencyMs: z.number() }),
  z.object({ ok: z.literal(false), error: z.string() }),
])
export type AiTestResult = z.infer<typeof aiTestResultSchema>

/** GET /api/ai/preview/:candidateId: what a cloud provider would receive, next to the original. */
export const aiPreviewSchema = z.object({
  original: z.string(),
  anonymized: z.string(),
  replacements: z.array(z.object({ kind: z.string(), count: z.number().int() })),
  provider: z.enum(['local', 'cloud']),
})
export type AiPreview = z.infer<typeof aiPreviewSchema>
