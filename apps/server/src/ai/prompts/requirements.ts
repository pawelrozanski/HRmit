import { AI_PROMPT_DEFAULTS, renderTemplate, requirementLines, type AiLang } from '@hrmit/shared'
import { LANG, type JobText } from './summarize.ts'

/**
 * CV against the job's requirements (ADR 0010): numbered lines so the answer refers to them by
 * number and the server puts the original text back. Same order as the other CV prompts.
 */
export const requirementsPrompt = (
  job: JobText,
  cvText: string,
  lang: AiLang,
  text = AI_PROMPT_DEFAULTS.requirements,
) =>
  `${renderTemplate(text, { lang: LANG[lang] })}

Job title: ${job.title}
Requirements:
${requirementLines(job)
  .map((r, i) => `${i + 1}. ${r.requirement}${r.kind === 'niceToHave' ? ' (nice to have)' : ''}`)
  .join('\n')}

CV:
${cvText}`
