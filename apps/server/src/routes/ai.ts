import { generateObject, generateText } from 'ai'
import { eq } from 'drizzle-orm'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import type { z } from 'zod'
import {
  aiActionBodySchema,
  competenciesSchema,
  cvSummarySchema,
  type AiSummary,
  type AiTestResult,
} from '@hrmit/shared'
import { competenciesPrompt } from '../ai/prompts/competencies.ts'
import { summarizePrompt } from '../ai/prompts/summarize.ts'
import { createModel } from '../ai/provider.ts'
import { db } from '../db/index.ts'
import { candidateColumns, candidates, jobs } from '../db/schema.ts'
import { log } from '../log.ts'
import { getAiSettings } from '../settings.ts'

/** Error text safe for the UI and the log: no key, no stack, no credentials inside URLs. */
function sanitize(err: unknown, apiKey: string | null): string {
  let msg = (err instanceof Error ? err.message : String(err)).split('\n')[0] ?? ''
  if (apiKey) msg = msg.replaceAll(apiKey, '[redacted]')
  msg = msg.replace(/(https?:\/\/)[^/\s@]+@/g, '$1[redacted]@')
  return msg.slice(0, 300) || 'Unknown error'
}

const byId = (id: string) => eq(candidates.id, Number(id))

/**
 * One AI action: load the CV and the job, ask the model for the shared schema, merge the
 * result into aiSummaryJson. Only cvText and the job text reach the prompt (ADR 0004, stage 5
 * security note): no name, email, phone or notes.
 */
const action = <K extends keyof AiSummary, S extends z.ZodType<object>>(
  key: K,
  schema: S,
  prompt: typeof summarizePrompt,
) =>
  new Hono().post('/:candidateId', zValidator('json', aiActionBodySchema), async (c) => {
    const where = byId(c.req.param('candidateId'))
    const [row] = await db
      .select({
        cvText: candidates.cvText,
        aiSummaryJson: candidates.aiSummaryJson,
        title: jobs.title,
        description: jobs.description,
      })
      .from(candidates)
      .innerJoin(jobs, eq(jobs.id, candidates.jobId))
      .where(where)
    if (!row) return c.json({ error: 'not found' }, 404)
    if (!row.cvText) return c.json({ error: 'no cv text' }, 422)

    const settings = await getAiSettings()
    let object: z.infer<S>
    try {
      ;({ object } = await generateObject({
        model: createModel(settings),
        schema,
        prompt: prompt(row, row.cvText, c.req.valid('json').lang),
      }))
    } catch (err) {
      const error = sanitize(err, settings.apiKey)
      log.warn('ai action failed', {
        action: key,
        provider: settings.provider,
        model: settings.model,
        error,
      })
      return c.json({ error }, 502)
    }
    const aiSummaryJson: AiSummary = {
      ...row.aiSummaryJson,
      [key]: { ...object, generatedAt: new Date().toISOString(), model: settings.model },
    }
    const [candidate] = await db
      .update(candidates)
      .set({ aiSummaryJson })
      .where(where)
      .returning(candidateColumns)
    return c.json(candidate!)
  })

export const aiRoute = new Hono()
  // Connection check: a trivial prompt through the configured provider.
  .post('/test', async (c) => {
    const settings = await getAiSettings()
    const started = performance.now()
    try {
      await generateText({
        model: createModel(settings),
        prompt: 'Reply with OK',
        maxOutputTokens: 8,
      })
      const latencyMs = Math.round(performance.now() - started)
      return c.json<AiTestResult>({ ok: true, model: settings.model, latencyMs })
    } catch (err) {
      const error = sanitize(err, settings.apiKey)
      log.warn('ai test failed', { provider: settings.provider, model: settings.model, error })
      return c.json<AiTestResult>({ ok: false, error })
    }
  })
  .route('/summarize', action('summary', cvSummarySchema, summarizePrompt))
  .route('/competencies', action('competencies', competenciesSchema, competenciesPrompt))
  // Discard: the human decides what stays. Clears both actions' output at once.
  .delete('/summary/:candidateId', async (c) => {
    const [candidate] = await db
      .update(candidates)
      .set({ aiSummaryJson: null })
      .where(byId(c.req.param('candidateId')))
      .returning(candidateColumns)
    return candidate ? c.json(candidate) : c.json({ error: 'not found' }, 404)
  })
