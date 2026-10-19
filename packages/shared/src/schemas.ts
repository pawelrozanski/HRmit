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
