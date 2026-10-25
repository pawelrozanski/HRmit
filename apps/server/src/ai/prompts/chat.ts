import { AI_PROMPT_DEFAULTS, renderTemplate, type AiLang, type ChatContext } from '@hrmit/shared'
import { LANG } from './summarize.ts'

const CONTEXT: Record<ChatContext['view'], (id?: number) => string> = {
  dashboard: () => 'The recruiter is looking at the dashboard.',
  recruitment: (id) =>
    `The recruiter has recruitment #${id} open. "This recruitment" means jobId ${id}.`,
  candidate: (id) =>
    `The recruiter has candidate #${id} open. "This candidate", "him", "her" or "them" means candidateId ${id}.`,
  employee: (id) =>
    `The recruiter has employee #${id} open. "This employee", "him", "her" or "them" means employeeId ${id}.`,
  other: () => '',
}

/**
 * ADR 0007: the assistant answers from tools, in the recruiter's language, and never judges.
 * English instruction text with a language placeholder, like the other prompts: small local
 * models follow it better than a translated one and there is one text to test. The context is
 * an id only; the data behind it always comes from a tool.
 */
export const chatPrompt = (
  lang: AiLang,
  context: ChatContext,
  text = AI_PROMPT_DEFAULTS.chat,
  today = new Date(),
) =>
  `${renderTemplate(text, { lang: LANG[lang], today: today.toISOString().slice(0, 10) })}
${CONTEXT[context.view](context.id)}`.trim()
