# 0004. AI assists, never decides

Date: 2026-10-19
Status: accepted

## Context

Recruitment systems are listed as high-risk under the EU AI Act, and GDPR Article 22 restricts decisions based solely on automated processing. Beyond compliance, an LLM ranking candidates reproduces whatever bias its training data carries, and a recruiter who sees a score will anchor on it.

## Decision

- AI is exposed as three explicit actions with structured outputs: **summarize CV**, **extract competencies**, **generate structured interview questions** for a job. No open chat.
- Output schemas contain only descriptive fields. There is no score, rank, fit percentage, hire/no-hire flag or "red flags" list anywhere in the schema, the prompts or the UI. The model cannot return a verdict because there is no field for one.
- Every pipeline move, every evaluation score and every rejection is a human click. AI output is shown as "AI suggestion" with a visible disclaimer and can be edited or discarded.
- Structured interview: questions belong to the job, not the candidate, so every applicant gets the same questions and the same scoring criteria. Blind screening mode hides name, photo, contact fields and derived cues on the candidate list and the scorecard.

## Consequences

- Smaller scope: no chat UI, no conversation memory, no prompt-injection surface from free-form input.
- A reviewer can verify the rule by reading the zod schemas, which is a stronger guarantee than a sentence in a prompt.
- Some users may want a ranking. That is a product boundary, not a missing feature, and the README says so.
