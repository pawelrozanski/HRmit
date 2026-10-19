import type { AiLang } from '@hrmit/shared'

const LANG: Record<AiLang, string> = { en: 'English', pl: 'Polish' }

/**
 * Structured interview guide for a job (ADR 0004). The prompt sees the job only: no candidate
 * data of any kind, so the questions are the same for every applicant.
 */
export const questionsPrompt = (job: { title: string; description: string }, lang: AiLang) =>
  `You are an assistant to a recruiter preparing a structured interview. Propose 6 to 10 behavioural, competency-based interview questions for the job below, grouped under 3 to 5 competencies that the job description calls for. Every question must be equally applicable to every candidate: ask about past situations and behaviour ("Tell me about a time..."), never about a specific person, CV or background. Do not rate, rank, score or judge anyone, and do not propose answers or criteria. Answer in ${LANG[lang]}.

Job title: ${job.title}
Job description: ${job.description}`
