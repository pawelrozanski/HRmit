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
