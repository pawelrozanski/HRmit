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

/** No CV columns yet (roadmap stage 3). */
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
  createdAt: z.string(),
})
export type Candidate = z.infer<typeof candidateSchema>

/** Body of PATCH /api/candidates/:id/stage. */
export const moveStageSchema = z.object({ stage: pipelineStageSchema })
