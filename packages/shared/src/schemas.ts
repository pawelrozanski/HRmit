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
  createdAt: z.string(),
})
export type Candidate = z.infer<typeof candidateSchema>

/** Body of POST /api/candidates and PUT /api/candidates/:id. CV fields change only via upload. */
export const candidateInputSchema = candidateSchema
  .omit({ id: true, createdAt: true, stageChangedAt: true, cvFilename: true, cvText: true })
  .extend({
    phone: z.string().default(''),
    stage: pipelineStageSchema.default('applied'),
    notes: z.string().default(''),
  })
export type CandidateInput = z.input<typeof candidateInputSchema>

/** Body of PATCH /api/candidates/:id/stage. */
export const moveStageSchema = z.object({ stage: pipelineStageSchema })
