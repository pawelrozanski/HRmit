# 0010. AI compares the CV with the job's requirements, one status per requirement

Date: 2026-10-25
Status: accepted (amends the "no fit or red flags" point of [0004](0004-ai-assistant-not-judge.md); everything else in 0004 stays in force)

## Context

Since 0.6.1 a recruitment has its requirements and nice-to-haves as lists. The owner asked that the new candidate page show, at a glance, which of them the CV covers: green when it does, amber when partly, red when it is missing, worked out by the AI as soon as the candidate is opened. ADR 0004 ruled this out: no fit percentage and no "red flags" list in a schema, a prompt or the UI. The owner decided to amend that point for this one feature, knowingly: recruitment AI is high-risk under the EU AI Act and GDPR art. 22 limits decisions based solely on automated processing, so the amendment comes with the safeguards below.

## Decision

- **One status per requirement, never a total.** `POST /api/ai/requirements/:candidateId` returns, per line of the job's requirements and nice-to-haves, `met`, `partial` or `missing` with a sentence of evidence from the CV. There is no overall score, percentage, count of met lines, ranking or comparison with other candidates anywhere, and the no-verdict test still rejects `score`, `rank`, `fit`, `recommend`, `verdict`, `hire` and `flag` keys in every AI schema, this one included.
- **The CV only, the requirement only.** The prompt numbers the job's lines and gives the CV text; the model answers by number and the server puts the job's own text back, so it cannot rewrite or add a requirement. The default prompt tells the model to judge what the CV says about the requirement, never the person, and to ignore name, gender, age, origin, photo and career gaps. Blind screening hides the result like every other AI output.
- **Same consent rules as the other actions.** With a local provider the comparison runs by itself the first time a candidate's page opens; with a cloud provider nothing is sent until the recruiter clicks, and the CV and the requirements go out anonymized (ADR 0005).
- **Shown as a suggestion with its evidence.** Every line shows colour, icon and word together, the evidence under it, the "AI suggestion" badge, the model and the date, and the disclaimer that the decision is the recruiter's. The result can be regenerated or discarded and is marked stale when the requirements change.
- **No consequence in the app.** The status moves no candidate, sends nothing, sorts nothing and feeds no other screen or tool; the chat does not read it.

## Consequences

- The red list is exactly what 0004 called "red flags": a recruiter may anchor on it. The evidence line, the per-requirement layout and the absence of any total are the mitigation, not a guarantee.
- A 7B model misreads CVs: in the first check `qwen2.5:7b-instruct` marked "written English" as missing for a CV that lists English, and wrote the evidence in English for a Polish UI. The human reads the evidence; nothing acts on the colour.
- The operator can rewrite the prompt in Settings → AI like the others; the output schema stays three statuses with evidence.
