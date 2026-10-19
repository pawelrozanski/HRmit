import type { AiLang } from '@hrmit/shared'

const LANG: Record<AiLang, string> = { en: 'English', pl: 'Polish' }

/** Same rules as summarizePrompt: describe, do not decide; CV and job text only. */
export const competenciesPrompt = (
  job: { title: string; description: string },
  cvText: string,
  lang: AiLang,
) =>
  `You are an assistant to a recruiter. Describe, do not decide: list the competencies this CV shows that relate to the job below, each with the evidence from the CV that shows it. Do not rate, rank, score, recommend or judge the candidate, do not list missing competencies, and do not mention the candidate's name. Answer in ${LANG[lang]}.

Job title: ${job.title}
Job description: ${job.description}

CV:
${cvText}`
