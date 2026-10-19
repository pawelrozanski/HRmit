import { generateObject, generateText } from 'ai'
import { eq } from 'drizzle-orm'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import type { z } from 'zod'
import {
  aiActionBodySchema,
  anonymize,
  competenciesSchema,
  cvSummarySchema,
  isLocalProvider,
  questionsGenerationSchema,
  type AiPreview,
  type AiSummary,
  type AiTestResult,
  type QuestionsProposal,
} from '@hrmit/shared'
import { competenciesPrompt } from '../ai/prompts/competencies.ts'
import { questionsPrompt } from '../ai/prompts/questions.ts'
import { summarizePrompt } from '../ai/prompts/summarize.ts'
import { listQuestions, replaceQuestions } from './jobs.ts'
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

/** Everything an action or the preview needs: the structured fields feed anonymize() only. */
const loadCandidate = (id: string) =>
  db
    .select({
      id: candidates.id,
      firstName: candidates.firstName,
      lastName: candidates.lastName,
      email: candidates.email,
      phone: candidates.phone,
      cvText: candidates.cvText,
      aiSummaryJson: candidates.aiSummaryJson,
      title: jobs.title,
      description: jobs.description,
    })
    .from(candidates)
    .innerJoin(jobs, eq(jobs.id, candidates.jobId))
    .where(byId(id))
    .then((rows) => rows[0])

/** Prompt debugging is opt-in and only ever sees the anonymized text (ADR 0005). */
const LOG_PROMPTS = process.env.HRMIT_LOG_PROMPTS === '1'

/**
 * One AI action: load the CV and the job, ask the model for the shared schema, merge the
 * result into aiSummaryJson. Only cvText and the job text reach the prompt (ADR 0004, stage 5
 * security note): no name, email, phone or notes. A cloud provider gets both anonymized
 * (docs/ARCHITECTURE.md §5.2); a local one gets the full text.
 */
const action = <K extends keyof AiSummary, S extends z.ZodType<object>>(
  key: K,
  schema: S,
  prompt: typeof summarizePrompt,
) =>
  new Hono().post('/:candidateId', zValidator('json', aiActionBodySchema), async (c) => {
    const where = byId(c.req.param('candidateId'))
    const row = await loadCandidate(c.req.param('candidateId'))
    if (!row) return c.json({ error: 'not found' }, 404)
    if (!row.cvText) return c.json({ error: 'no cv text' }, 422)

    const settings = await getAiSettings()
    const local = isLocalProvider(settings)
    const lang = c.req.valid('json').lang
    const safe = prompt(
      { title: row.title, description: anonymize(row.description, row).text },
      anonymize(row.cvText, row).text,
      lang,
    )
    if (LOG_PROMPTS)
      log.info('ai prompt', { action: key, provider: settings.provider, prompt: safe })
    let object: z.infer<S>
    try {
      ;({ object } = await generateObject({
        model: createModel(settings),
        schema,
        prompt: local ? prompt(row, row.cvText, lang) : safe,
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
  // Interview guide for a job. The prompt sees the job title and description only, never a
  // candidate (ADR 0004). Applied straight away when the job has no questions yet, otherwise
  // returned as a proposal the UI can accept or discard.
  .post('/questions/:jobId', zValidator('json', aiActionBodySchema), async (c) => {
    const jobId = Number(c.req.param('jobId'))
    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId))
    if (!job) return c.json({ error: 'not found' }, 404)
    const settings = await getAiSettings()
    const lang = c.req.valid('json').lang
    const safe = questionsPrompt({ ...job, description: anonymize(job.description).text }, lang)
    if (LOG_PROMPTS)
      log.info('ai prompt', { action: 'questions', provider: settings.provider, prompt: safe })
    let object: z.infer<typeof questionsGenerationSchema>
    try {
      ;({ object } = await generateObject({
        model: createModel(settings),
        schema: questionsGenerationSchema,
        prompt: isLocalProvider(settings) ? questionsPrompt(job, lang) : safe,
      }))
    } catch (err) {
      const error = sanitize(err, settings.apiKey)
      log.warn('ai action failed', {
        action: 'questions',
        provider: settings.provider,
        model: settings.model,
        error,
      })
      return c.json({ error }, 502)
    }
    const applied = (await listQuestions(jobId)).length === 0
    if (applied) await replaceQuestions(jobId, object.questions)
    return c.json<QuestionsProposal>({ questions: object.questions, applied })
  })
  // What a cloud provider would see, next to the original. Never logged.
  .get('/preview/:candidateId', async (c) => {
    const row = await loadCandidate(c.req.param('candidateId'))
    if (!row) return c.json({ error: 'not found' }, 404)
    if (!row.cvText) return c.json({ error: 'no cv text' }, 422)
    const { text, replacements } = anonymize(row.cvText, row)
    const provider = isLocalProvider(await getAiSettings()) ? 'local' : 'cloud'
    return c.json<AiPreview>({ original: row.cvText, anonymized: text, replacements, provider })
  })
  // Discard: the human decides what stays. Clears both actions' output at once.
  .delete('/summary/:candidateId', async (c) => {
    const [candidate] = await db
      .update(candidates)
      .set({ aiSummaryJson: null })
      .where(byId(c.req.param('candidateId')))
      .returning(candidateColumns)
    return candidate ? c.json(candidate) : c.json({ error: 'not found' }, 404)
  })
