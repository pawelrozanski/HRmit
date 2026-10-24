import { AI_PROMPT_DEFAULTS, renderTemplate, type AiLang } from '@hrmit/shared'

export const LANG: Record<AiLang, string> = { en: 'English', pl: 'Polish' }

/**
 * docs/ARCHITECTURE.md §5.1: the instruction text (default or the operator's edit from
 * Settings → AI) followed by the job and the CV text, never contact details or notes.
 */
export const summarizePrompt = (
  job: { title: string; description: string },
  cvText: string,
  lang: AiLang,
  text = AI_PROMPT_DEFAULTS.summarize,
) =>
  `${renderTemplate(text, { lang: LANG[lang] })}

Job title: ${job.title}
Job description: ${job.description}

CV:
${cvText}`
