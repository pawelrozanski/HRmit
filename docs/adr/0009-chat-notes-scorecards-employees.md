# 0009. Chat assistant reads notes, scorecards and employees; writes only through a human click

Date: 2026-10-25
Status: accepted (amends [0007](0007-chat-assistant-read-only-tools.md): the tools may read notes and employee data, and one tool proposes a write; everything else in 0007 and [0004](0004-ai-assistant-not-judge.md) stays in force)

## Context

ADR 0007 kept the chat on a narrow slice of the data on purpose: no notes, no employees, no write path. In use, the questions a recruiter asks after an interview need exactly what was left out: what the interviewers wrote on the scorecard, what the notes say, what the recruitment requires, who is on the hiring team. And the natural follow-up is "write that down". Each of these crosses a line 0007 drew, so each gets its own safeguard rather than a general loosening.

Three rules change:

| Rule in 0007                          | Now                                   | Safeguard                                                                                                                                                         |
| ------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tools are read-only                   | The chat can propose a note           | The model proposes, a person approves. No edit or delete of existing notes from the chat.                                                                         |
| Notes never reach a model             | The chat reads notes                  | With a cloud provider every note goes through `anonymize()` for every candidate and employee.                                                                     |
| Employees are not in the conversation | The chat sees employee data and notes | Local provider: always. Cloud provider: only after an explicit switch in Settings → AI, off by default, that says what leaves the machine; pseudonymized as well. |

## Decision

- **Notes.** `getNotes({ target: 'candidate' \| 'employee', id })` returns the dated notes with their author (`human`, or `assistant` for a note drafted by the chat and approved). Candidates get a `candidate_notes` table shaped like `employee_notes` (migration 0013); the old free-text `candidates.notes` field became the candidate's first note and stays empty from now on.
- **Scorecards.** `getScorecard({ candidateId })` returns every question with the interviewer's rating (1 to 5, keyed `rating` so the no-verdict test stays intact) and comment, plus the averages per competency. No total, no other candidate. The prompt forbids adding ratings up or building a league table; the "who is best" answer stays a refusal with facts.
- **Recruitment details.** `getRecruitment` returns the description (requirements are part of it; no separate field), the interview guide grouped by competency and the team name with its member count. No employee names: those are behind the switch.
- **Employees.** `searchEmployees({ employeeId?, query?, team? })` and `getNotes({ target: 'employee' })` return position, duties, teams with role, and notes. The server decides per request: a local provider may always, a cloud provider only when `ai.chatEmployees` is on. Otherwise the tool returns a refusal message that the model relays, and the prompt tells it where the switch is. The model has no way around the check. With a cloud provider an employee is `Employee #N`, and names travel to the browser in `refs.employees`, like candidates.
- **Writing.** The one write-shaped tool, `proposeNote({ target, id, title?, body })`, stores nothing. It validates the id, leaves the draft in the request context and tells the model that the recruiter will decide. The server turns the draft into a `proposal` event in the NDJSON stream. The browser shows the whole text as a card with Save, Edit and Discard; Save posts to the ordinary notes endpoint with `source: 'assistant'`, after swapping a cloud model's pseudonyms for the names from the refs. The saved note is marked as drafted by the assistant and approved by a person. There is no path from the model to an insert, update or delete.
- **Anonymization of free text.** With a cloud provider every free text in a tool result (notes, interviewer comments, descriptions, duties, stored AI text) and the recruiter's own words are scrubbed with `anonymize()` for every candidate and every employee, declensions included. A review of this payload found that a four-letter name ("Theo") in inflected mode swallowed "the"; four-letter names now keep their last letter.
- **Prompt injection.** Text people typed sits in tool results under `text`, `comment`, `description`, `duties` and `summary`; the system prompt declares those fields data, never instructions, and tells the model to mention when a note contains instructions. The human click is the last line of defence: nothing a note says can save a note.
- **Limits.** `stepCountIs` goes from 5 to 8 model turns: "compare the requirements with this candidate's scorecard and note it" is four tools and an answer, and a small model takes a detour or two.

## Consequences

- The data flow to a cloud model widens, knowingly: notes and interviewer comments after anonymization, and, only after the opt-in, employee positions, duties, teams and notes under pseudonyms. `docs/SECURITY.md` lists it with a captured payload, and the cloud consent dialog names notes and employees.
- Anonymization of free text is weaker than of a CV: a note names third parties ("her husband works at X", "referred by Marek") and those names stay. Known limit, stated in the panel and in SECURITY.md.
- Eleven tools instead of seven. Small local models were checked again with the new set; the notes are in `docs/ARCHITECTURE.md` §5.3.
- Notes drafted by the assistant are visibly marked, so a reviewer can tell them apart from a recruiter's own words, and ADR 0004 still holds for them: the prompt asks for facts, the card reminds the recruiter, and the recruiter reads the whole text before it exists.
