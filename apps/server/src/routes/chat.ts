import { stepCountIs, streamText, tool, type ModelMessage, type ToolSet } from 'ai'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { stream } from 'hono/streaming'
import {
  chatRequestSchema,
  chatToolInputs,
  getProvider,
  isLocalProvider,
  type ChatEvent,
  type ChatToolName,
} from '@hrmit/shared'
import { chatPrompt } from '../ai/prompts/chat.ts'
import { createModel } from '../ai/provider.ts'
import { chatToolFns, newContext, scrub, type ToolContext } from '../ai/tools.ts'
import { log } from '../log.ts'
import { getAiPrompts, getAiSettings } from '../settings.ts'
import { sanitize } from './ai.ts'

/**
 * At most eight model turns (tool rounds plus the final answer) per question: "compare the
 * requirements with this candidate's scorecard and note it" is four tools and an answer, and a
 * small model adds a detour or two.
 */
const MAX_STEPS = 8

const DESCRIPTIONS: Record<ChatToolName, string> = {
  listRecruitments: 'List recruitments (jobs), optionally by status or team name.',
  getRecruitment:
    'One recruitment, by id or by part of its title: description, level, location, contract, requirements, nice-to-haves, salary range, hiring team, candidate count per pipeline stage and the interview guide.',
  upcomingMeetings: 'Scheduled interviews from now to N days ahead.',
  stuckCandidates: 'Candidates of open recruitments with no stage change for N days or more.',
  searchCandidates:
    'Find candidates by recruitment title, stage name or competency keyword. Not by name.',
  getCandidate:
    'One candidate: stage, recruitment, stored AI summary and competencies, interview averages per competency, counts of meetings, emails and notes.',
  getScorecard:
    "One candidate's structured interview scorecard: every question with the interviewer's rating (1 to 5) and comment, and the averages per competency.",
  getNotes: 'Notes written about a candidate or an employee, with date and author.',
  teamOverview: 'Teams with member and open recruitment counts, optionally one team by name.',
  searchEmployees:
    'Employees (interviewers, hiring managers): position, duties, teams and role. By id, by part of a name or position, or by team name.',
  proposeNote:
    'Call this whenever the recruiter asks you to note, write down, record or save something about a candidate or an employee. It drafts the note for the recruiter to approve and saves nothing itself. Never call it unasked.',
}

/**
 * Ollama tells us up front whether a model can call tools (`capabilities` from /api/show);
 * for other providers the first call tells. Undefined means "cannot tell, try".
 */
async function ollamaSupportsTools(baseUrl: string, model: string): Promise<boolean | undefined> {
  const base = baseUrl.replace(/\/v1\/?$/, '')
  const res = await fetch(`${base}/api/show`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model }),
  })
  if (res.status === 404) throw new Error(`model ${model} is not installed in Ollama`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const { capabilities } = (await res.json()) as { capabilities?: string[] }
  return capabilities ? capabilities.includes('tools') : undefined
}

/**
 * The plain functions behind the tools, wrapped for the AI SDK with their shared schemas. One
 * entry per tool, spelled out: a generic loop over the names does not type-check in TS.
 */
function makeTools(ctx: ToolContext): ToolSet {
  const s = chatToolInputs
  const f = chatToolFns
  const d = DESCRIPTIONS
  return {
    listRecruitments: tool({
      description: d.listRecruitments,
      inputSchema: s.listRecruitments,
      execute: (i) => f.listRecruitments(i, ctx),
    }),
    getRecruitment: tool({
      description: d.getRecruitment,
      inputSchema: s.getRecruitment,
      execute: (i) => f.getRecruitment(i, ctx),
    }),
    upcomingMeetings: tool({
      description: d.upcomingMeetings,
      inputSchema: s.upcomingMeetings,
      execute: (i) => f.upcomingMeetings(i, ctx),
    }),
    stuckCandidates: tool({
      description: d.stuckCandidates,
      inputSchema: s.stuckCandidates,
      execute: (i) => f.stuckCandidates(i, ctx),
    }),
    searchCandidates: tool({
      description: d.searchCandidates,
      inputSchema: s.searchCandidates,
      execute: (i) => f.searchCandidates(i, ctx),
    }),
    getCandidate: tool({
      description: d.getCandidate,
      inputSchema: s.getCandidate,
      execute: (i) => f.getCandidate(i, ctx),
    }),
    getScorecard: tool({
      description: d.getScorecard,
      inputSchema: s.getScorecard,
      execute: (i) => f.getScorecard(i, ctx),
    }),
    getNotes: tool({
      description: d.getNotes,
      inputSchema: s.getNotes,
      execute: (i) => f.getNotes(i, ctx),
    }),
    teamOverview: tool({
      description: d.teamOverview,
      inputSchema: s.teamOverview,
      execute: (i) => f.teamOverview(i, ctx),
    }),
    searchEmployees: tool({
      description: d.searchEmployees,
      inputSchema: s.searchEmployees,
      execute: (i) => f.searchEmployees(i, ctx),
    }),
    proposeNote: tool({
      description: d.proposeNote,
      inputSchema: s.proposeNote,
      execute: (i) => f.proposeNote(i, ctx),
    }),
  }
}

const looksLikeNoTools = (msg: string) => /tool/i.test(msg) && /support|unsupported/i.test(msg)

export const chatRoute = new Hono().post('/', zValidator('json', chatRequestSchema), async (c) => {
  const { messages, context, lang } = c.req.valid('json')
  const settings = await getAiSettings()
  const local = isLocalProvider(settings)

  if (getProvider(settings.provider).id === 'ollama') {
    try {
      if ((await ollamaSupportsTools(settings.baseUrl, settings.model)) === false)
        return c.json({ error: 'no_tools' }, 422)
    } catch (err) {
      const error = sanitize(err, null)
      log.warn('ai chat unavailable', { provider: settings.provider, model: settings.model, error })
      return c.json({ error }, 502)
    }
  }

  // ADR 0009: employees are readable with a local provider, and with a cloud one only after
  // the operator's opt-in in Settings → AI.
  const ctx: ToolContext = newContext(local, local || settings.chatEmployees)
  const tools = makeTools(ctx)
  // With a cloud provider the recruiter's own words are scrubbed too: a typed name becomes the
  // same "Candidate #N" / "Employee #N" the tools use, so the model can still look the person
  // up by id. Inflected forms ("Amelię", "Hartwella") are matched too: this is prose, not a CV.
  const history: ModelMessage[] = []
  for (const m of messages)
    history.push({
      role: m.role,
      content: m.role === 'user' ? await scrub(m.content, ctx) : m.content,
    })

  const started = performance.now()
  const called: string[] = []
  let steps = 0
  const result = streamText({
    model: createModel(settings),
    system: chatPrompt(lang, context, (await getAiPrompts()).chat),
    messages: history,
    tools,
    stopWhen: stepCountIs(MAX_STEPS),
    // Deterministic sampling makes a 7B model far more reliable at emitting well-formed tool calls.
    temperature: 0,
    onStepFinish: () => void steps++,
  })

  // NDJSON: one event per line (packages/shared chatEventSchema). The log gets tool names
  // and timings only, never a message or a tool result (docs/SECURITY.md).
  c.header('content-type', 'application/x-ndjson; charset=utf-8')
  return stream(c, async (s) => {
    const send = (e: ChatEvent) => s.writeln(JSON.stringify(e))
    // A proposeNote call leaves its draft in the context; it goes to the browser as an event
    // the moment the tool has run, and nowhere else.
    const flushProposals = async () => {
      for (const proposal of ctx.proposals.splice(0)) await send({ type: 'proposal', proposal })
    }
    try {
      for await (const part of result.fullStream) {
        if (part.type === 'tool-call') {
          called.push(part.toolName)
          await send({ type: 'tool', name: part.toolName })
          await flushProposals()
        } else if (part.type === 'tool-result') await flushProposals()
        else if (part.type === 'text-delta') await send({ type: 'text', text: part.text })
        else if (part.type === 'error') throw part.error
      }
      await send({ type: 'refs', refs: ctx.refs })
      log.info('ai chat', {
        provider: settings.provider,
        model: settings.model,
        steps,
        tools: called,
        ms: Math.round(performance.now() - started),
      })
    } catch (err) {
      const error = sanitize(err, settings.apiKey)
      log.warn('ai chat failed', { provider: settings.provider, model: settings.model, error })
      await send({ type: 'error', error: looksLikeNoTools(error) ? 'no_tools' : error })
    }
    await send({ type: 'done' })
  })
})
