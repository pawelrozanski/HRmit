import { AI_PROMPT_DEFAULTS, renderTemplate, type AiLang } from '@hrmit/shared'
import { LANG } from './summarize.ts'

/** Same shape as summarizePrompt: instruction text, then the job and the CV. */
export const competenciesPrompt = (
  job: { title: string; description: string },
  cvText: string,
  lang: AiLang,
  text = AI_PROMPT_DEFAULTS.competencies,
) =>
  `${renderTemplate(text, { lang: LANG[lang] })}

Job title: ${job.title}
Job description: ${job.description}

CV:
${cvText}`
