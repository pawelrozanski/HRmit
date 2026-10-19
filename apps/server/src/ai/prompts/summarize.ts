import type { AiLang } from '@hrmit/shared'

const LANG: Record<AiLang, string> = { en: 'English', pl: 'Polish' }

/**
 * docs/ARCHITECTURE.md §5.1: plain template, restates the product rule. The prompt only ever
 * carries the CV text and the job title and description, never contact details or notes.
 */
export const summarizePrompt = (
  job: { title: string; description: string },
  cvText: string,
  lang: AiLang,
) =>
  `You are an assistant to a recruiter. Describe, do not decide: summarize what this CV says in relation to the job below. Do not rate, rank, score, recommend or judge the candidate, and do not mention the candidate's name.
Write the summary as 3 to 6 sentences and add short factual highlights taken from the CV. Answer in ${LANG[lang]}.

Job title: ${job.title}
Job description: ${job.description}

CV:
${cvText}`
