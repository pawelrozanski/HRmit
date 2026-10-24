import { AI_PROMPT_DEFAULTS, renderTemplate, type AiLang } from '@hrmit/shared'
import { LANG } from './summarize.ts'

/**
 * Structured interview guide for a job (ADR 0004). The prompt sees the job only: no candidate
 * data of any kind, so the questions are the same for every applicant.
 */
export const questionsPrompt = (
  job: { title: string; description: string },
  lang: AiLang,
  text = AI_PROMPT_DEFAULTS.questions,
) =>
  `${renderTemplate(text, { lang: LANG[lang] })}

Job title: ${job.title}
Job description: ${job.description}`
