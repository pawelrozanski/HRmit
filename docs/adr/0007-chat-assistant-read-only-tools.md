# 0007. Chat assistant over read-only tools

Date: 2026-10-25
Status: accepted (amends the "no open chat" point of [0004](0004-ai-assistant-not-judge.md); everything else in 0004 stays in force). The read-only, no-notes and no-employees points are amended by [0009](0009-chat-notes-scorecards-employees.md)

## Context

ADR 0004 ruled out a chat to keep the AI surface small: three structured actions, no free-form input, no conversation memory. Since then the data grew (teams, employees, meetings, scorecards, messages) and the recruiter's everyday questions are cross-cutting: "what do I have tomorrow", "how is this recruitment going", "who has been waiting the longest". A dashboard answers the fixed ones; the long tail needs natural language.

A chat that is handed the database in its prompt would break ADR 0005 (everything would leave the machine with a cloud provider) and invite the model to improvise. A chat that can only call a few read-only functions and must answer from their results keeps the data flow explicit.

## Decision

- **Tool calling, not context stuffing.** `POST /api/ai/chat` runs the Vercel AI SDK tool loop (`streamText` with `stopWhen: stepCountIs(5)`) over seven read-only tools: `listRecruitments`, `getRecruitment`, `upcomingMeetings`, `stuckCandidates`, `searchCandidates`, `getCandidate`, `teamOverview`. The model sees tool names, one-line descriptions and zod input schemas; it never sees the database. The server executes a tool only when the model asks, and only that tool's result enters the conversation.
- **Still no verdict field.** Tool outputs carry facts: stages, days in stage, counts, dates, stored AI text and the human interviewers' averages per competency. The no-verdict test from 0004 now covers the tool schemas too (no `score`, `rank`, `fit`, `recommend`, `verdict`, `hire`, `flag` key anywhere). The system prompt restates the rule for prose: facts, then "the decision is yours".
- **Read only, by construction.** The tools are `SELECT`s; a test runs all of them and asserts no table changed. Actions (move, send, schedule) stay human clicks; the answer can only link to the place where the click happens.
- **Anonymization applies to the chat exactly as to the actions.** With a cloud provider every tool returns `Candidate #N` instead of a name, stored AI text goes through `anonymize()`, and the recruiter's own messages are scrubbed too (names, including Polish declensions, emails, phones) before they join the prompt. Real names travel in a separate `refs` event to the browser only, never to the model; the UI swaps pseudonyms for names at render time, and not under blind screening.
- **Employees are not in the conversation.** The only employee-related tool returns team names and counts. No employee name, position, duties, note or message can reach a model.
- **No persistence.** The conversation lives in the browser's memory for the session; nothing is stored on the server, and the log carries the provider, model, step count, tool names and timing only.
- **Screen context is an id.** The UI sends `{ view, id }`; the prompt says "this candidate means candidateId N". The data behind the id always comes from a tool.

## Consequences

- The chat is a thin layer: seven plain functions with tests, one route, one panel. Adding a question type means adding a tool and its schema, which the no-verdict test will inspect.
- Small local models are the weak point, not the design. `qwen2.5:7b-instruct` calls tools reliably for single questions in English, less so in Polish and over several turns (see the model notes in `docs/ARCHITECTURE.md` §5.3). The prompt and the tool schemas were tuned for it (names accepted instead of ids, no permission questions, deterministic sampling); a bigger model simply works better with the same code.
- Prompt injection is bounded: a hostile string in a CV or a note can only make the model call read-only tools or write an odd answer. There is no write path to abuse.
- The demo cannot run a model, so it answers the suggested questions from the demo store through the same stream format. The panel does not know the difference.
