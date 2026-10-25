import { AI_PROMPT_DEFAULTS, renderTemplate, type AiLang, type Job } from '@hrmit/shared'
import { LANG } from './summarize.ts'

type JobText = Pick<Job, 'title' | 'description' | 'level' | 'requirements' | 'niceToHave'>

/**
 * Structured interview guide for a job (ADR 0004). The prompt sees the job only: no candidate
 * data of any kind, so the questions are the same for every applicant. The salary is left out:
 * it says nothing about what to ask.
 */
export const questionsPrompt = (job: JobText, lang: AiLang, text = AI_PROMPT_DEFAULTS.questions) =>
  `${renderTemplate(text, { lang: LANG[lang] })}

${[
  `Job title: ${job.title}`,
  job.level && `Level: ${job.level}`,
  `Job description: ${job.description}`,
  job.requirements.trim() && `Requirements:\n${job.requirements.trim()}`,
  job.niceToHave.trim() && `Nice to have:\n${job.niceToHave.trim()}`,
]
  .filter(Boolean)
  .join('\n')}`
