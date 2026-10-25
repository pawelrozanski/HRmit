# Security review for 0.1.0

Final review across stages 0 to 11, done on 2026-10-19. Each stage had its own short review (see the deviation notes in [ROADMAP.md](ROADMAP.md)); this document is the summary a user or reviewer should read. Report problems as a GitHub issue; there is no bug bounty.

## Threat model

- **One user, one machine.** HRmit is a desktop-style app that happens to run in a browser. The server binds to `127.0.0.1` and has no login. Anyone who can run code or open a browser on the machine is the user. Multi-user and remote access are out of scope (see [ROADMAP.md](ROADMAP.md), out of MVP).
- **What we protect against:** other websites open in the same browser, backups and screenshots leaking secrets, candidate data leaving the machine by accident, malicious uploaded files.
- **What we do not protect against:** someone with read access to the `data/` folder (they have the database and the master key), malware on the machine, a user who deliberately exposes the port.

## Network

- The server listens on `127.0.0.1:3000` (`HOST` env, default loopback). The Docker image sets `HOST=0.0.0.0` inside the container and the compose file binds the host side to `127.0.0.1:3000`, so the result is the same: nothing on the LAN reaches it.
- No login means the browser's same-origin policy is the only guard. Since 0.1.0 every `/api/*` request with a `Host` or `Origin` header that is not `localhost`, `127.0.0.1` or `[::1]` gets `403`. That blocks cross-site form posts (which need no preflight) and DNS rebinding. Requests without these headers (curl, tests) pass; browsers always send them.
- No TLS: the traffic never leaves the loopback interface.

## Secrets at rest

- The AI API key and the SMTP password are the only secrets. They are encrypted with AES-256-GCM (`node:crypto`, fresh IV per write) before they reach SQLite, and the API only ever returns `hasApiKey` / `hasPass` booleans. The UI never echoes a stored key.
- The master key is 32 random bytes in `data/master.key`, created on first run with mode `0600`. **Caveat:** on Windows the mode is ignored and NTFS ACLs apply; and on every OS a person who can read `data/` has both the database and the key. The encryption protects against a copied database, a screenshot of the settings page or a log line, not against local disk access.
- If `master.key` is replaced, stored secrets become unreadable and are treated as unset (logged as a warning, no crash).

## Logs

- JSON lines on stdout, written through one logger with a redaction list (`apikey`, `pass`, `authorization`, `secret`, `token`). Request bodies are never logged.
- AI prompts are logged only with `HRMIT_LOG_PROMPTS=1`, and only in their anonymized form, even for local providers.
- Error messages from SMTP and AI providers are sanitized before they reach the log, the database or the UI: first line only, the password and URL credentials replaced by `[redacted]`, capped at 300 characters.

## Uploads

- One CV per candidate, PDF or DOCX only, allowlisted by extension **and** magic bytes (`%PDF-`, or a ZIP whose directory names a `word/` part), 10 MB limit.
- Stored under `data/uploads/<uuid>.<ext>`; the original file name is kept as a display column only and never used on disk. Download is by candidate id through the API, with the file name sanitized for the `Content-Disposition` header. There is no static route into `uploads/`.
- Text extraction runs in the server process (`unpdf`, `mammoth`); a parser failure yields empty text and the upload still succeeds. A hostile PDF can therefore at worst crash a request, not the file system.

## Data deletion

- `DELETE /api/candidates/:id` removes the row and, through foreign keys with `ON DELETE CASCADE`, its evaluations, emails and meetings, then unlinks the CV file. This is the right-to-erasure path.
- Deleting a job cascades to its candidates and questions the same way.
- Employees (0.3.0) are personal data of the hiring side. `DELETE /api/employees/:id` is a hard delete and cascades to the team memberships; deleting a team removes its memberships and leaves its recruitments without a team. Employee data is never part of an AI prompt and goes through the same loopback-only API. Notes on an employee (0.3.1) are personal data too: plain text rendered as text, deleted with the employee through `ON DELETE CASCADE`, never sent to an AI provider. Messages sent to employees (0.4.0, `employee_emails`) follow the same rules: plain text only, one mail per recipient with no CC/BCC between people, the sanitized transport error is the only thing stored on failure, log lines carry ids and the status but never an address, subject or body, and the rows are deleted with the employee.
- Everything else is one folder: `data/`. Deleting it deletes the installation's data.
- **Backup download** (0.5.3, Settings → Backup): the archive holds the full database and the CV files, which is personal data of every candidate and employee, so it must be stored like the `data/` folder itself. `master.key` is deliberately left out: a backup travels, and without the key the encrypted API key and SMTP password in it stay unreadable; they are entered again after a restore. The log line records the file count and the byte size only. Same loopback-only API, no authentication beyond it (known limit).
- **Shutdown** (0.5.4): `POST /api/shutdown` stops the server; loopback-only like every other route, so it is the same trust as closing the terminal. Nothing is written or deleted, the next start migrates and seeds as usual.
- **Restore** (0.5.4): anyone who can reach the loopback API can replace the whole database with an uploaded file, the same trust level as deleting every candidate today. The archive is validated before anything is touched (format, flat upload names, SQLite integrity, core tables), the swap happens only after that, and a damaged file is refused with 422 and leaves the data as it was. Secrets inside a restored database were encrypted with the key of the machine that made the backup: on another machine they read as unset, on the same machine they keep working.

## Cloud AI and the limits of anonymization

- Default provider is Ollama on localhost; cloud providers are bring-your-own-key and opt-in behind a dialog that names the host and lists what is sent and what never is. Whether a provider counts as local comes from the catalog in `packages/shared/src/aiProviders.ts` (Ollama and LM Studio), and for the custom endpoint from its host; every other id is treated as cloud, so anonymization and the CV-import refusal apply to all of them.
- Before any cloud call the CV text and the job description go through `anonymize()`: the candidate's structured fields (name, email, phone) are replaced by `Candidate #<id>` and placeholders, then regex passes remove emails, phones, URLs, PESEL numbers, birth dates and address lines. Name matching is case- and diacritic-insensitive. The user can preview the result on every candidate.
- **This is a heuristic, not named-entity recognition.** Names that appear only in the CV body (references, former managers, co-authors), employer names and any free text that identifies a person indirectly are sent as they are. If that matters for your data, stay on the local provider. Notes, photos and the CV file itself are never sent to any provider.
- The output schemas have no field for a score, ranking or verdict, so a model cannot return one ([ADR 0004](adr/0004-ai-assistant-not-judge.md)); a test checks the schemas.

## Email

- Mail goes directly from the machine to the user's SMTP server with nodemailer; HRmit has no relay. Messages are `text/plain`, so a template placeholder can never inject HTML into a recipient's client.
- Jitsi rooms are `https://meet.jit.si/hrmit-<random>`; the server validates that prefix before sending an invite. Jitsi rooms have no password; anyone with the link can join, which is the same trade-off as any public Jitsi link.

## Demo data

- Every fixture person, company and CV is fictional and written by hand. The demo build runs entirely in the browser (MSW + `localStorage`), sends nothing anywhere and has no server.
- The demo build also ships `mockServiceWorker.js`; the local build does not register it.

## Dependencies

`pnpm audit --audit-level high` on 2026-10-19:

| Advisory                                 | Severity | Path                                                 | Status                                                                                                               |
| ---------------------------------------- | -------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| tinypool prototype pollution (2 reports) | critical | `vitest > tinypool` (dev)                            | **Fixed:** upgraded to vitest 5, which no longer depends on tinypool.                                                |
| braces stack exhaustion                  | high     | `shadcn > fast-glob > micromatch > braces` (dev CLI) | No patched version. Dev-only code generator, moved to `devDependencies`; it never runs in the app or the build.      |
| esbuild dev-server request forgery       | moderate | `drizzle-kit > @esbuild-kit > esbuild` (dev)         | Affects only an esbuild dev server, which HRmit does not run; Vite uses a patched esbuild.                           |
| sprintf-js unbounded precision           | moderate | `mammoth > argparse > sprintf-js` (prod)             | No patched version. Used by argparse for CLI help text; HRmit never passes user input through it. Accepted, tracked. |

`pnpm audit --prod --audit-level high` reports nothing above moderate. CI keeps running the audit as a non-blocking step.

License check (`pnpm -r licenses list --prod`): 140 production packages. MIT 117, Apache-2.0 10, BSD-2-Clause 4, ISC 2, BSD-3-Clause 1, 0BSD 1, plus five with other but compatible terms: `nodemailer` (MIT-0), `pako` (MIT AND Zlib), `jszip` (MIT OR GPL-3.0-or-later, used under MIT), `json-schema` (AFL-2.1 OR BSD-3-Clause, used under BSD), `duck` ("BSD"). Nothing copyleft-only. All compatible with the project's MIT license ([ADR 0006](adr/0006-license-mit.md)).

## Chat assistant (0.5.0, ADR 0007)

Reviewed on 2026-10-25 against the four questions below.

**What reaches the model.** The system prompt, the conversation as the recruiter typed it (after scrubbing with a cloud provider), the seven tool descriptions with their JSON schemas, and the results of the tools the model called. Never the database, never a CV file, never notes, never an employee. With a local provider the tool results carry full candidate names and the stored AI text as is, like the summarize action does. With a cloud provider the same request looks like this (captured from the fixtures, Polish question, candidate 1 open):

```json
{
  "system": "You are the assistant inside HRmit … The recruiter has candidate #1 open …",
  "messages": [{ "role": "user", "content": "Streść mi Candidate #1 ([email]), czy ma ocenę?" }]
}
```

and the `getCandidate` result the model gets back:

```json
{
  "candidateId": 1,
  "candidate": "Candidate #1",
  "jobId": 1,
  "jobTitle": "Frontend Developer (React)",
  "stage": "interview",
  "daysInStage": 3,
  "jobStatus": "open",
  "summary": "Candidate #1 has four years of React experience; contact [email].",
  "competencies": ["Accessibility"],
  "interviewAverages": [
    { "competency": "Accessibility", "average": 4.5, "answered": 2, "total": 2 }
  ],
  "meetingCount": 0,
  "emailCount": 0
}
```

The names behind the pseudonyms go to the browser in a separate `refs` event (`{"1": {"name": "Amelia Hartwell", "jobId": 1}}`) that is never part of a model message. The recruiter's own words are scrubbed with `anonymize()` for every candidate in the database, in the mode that also catches Polish declensions ("Amelię", "Hartwella"; found during this review, the exact mode used for CVs missed them), plus the regex passes for emails and phones. The scrub runs on every request over the whole history, so a name typed three questions ago does not come back. Limits are the same as for CVs: a name that is not a candidate's (a referee, a colleague) is not recognised; the panel states that a cloud provider is active.

**Logs.** One line per answer: provider, model, step count, tool names and milliseconds. A failure logs the sanitized error. No question, no answer, no tool result (`chat.test.ts` asserts the log line contains neither the question nor a name).

**Employees.** The only tool that touches them is `teamOverview`, which returns team names with member and open-recruitment counts. No employee name, position, duties, note or message can be selected by any tool (`tools.test.ts` asserts none of the fixture employees' names or positions appear in the output). The rule from 0.3.0 stands: employees never reach an AI prompt.

**No write path.** The tools are `SELECT` statements; a test runs all seven in both modes and compares every table's row count before and after. The chat route imports nothing that writes. The model can only propose a link; moving a candidate, sending a mail or scheduling an interview remains a click in the existing UI.

**Prompt injection.** Free text from a CV or a note can reach the model only inside a tool result, and only the stored AI summary and competency names at that (never the CV body, never notes). A hostile string can at worst make the model call another read-only tool or write a strange answer. The step limit (5) bounds the loop.

**Demo.** No model runs; the MSW handler builds the answers from the demo store in the browser. With a cloud provider picked in the demo settings the text uses pseudonyms, like the server would.

## Editable prompts (0.5.2)

The instruction texts of the four prompts can be changed in Settings → AI and are stored as plain settings rows (no secrets, nothing encrypted). The shipped defaults carry the "describe, never judge" rule; an operator who removes it from a text has made that choice themselves. The structured outputs (summary, competencies, questions) are still bound by their zod schemas, which have no score, ranking or verdict field. The chat answer is free text and has no such schema. The prompt texts never contain candidate data: the data is appended by the server at request time and goes through the same anonymization as before.

## Known limits, in one list

1. Anyone who can read `data/` has everything, including the master key.
2. Anonymization is pattern-based and will miss names that are only in free text. In the chat the recruiter's own words are scrubbed of candidate names (declensions included), but not of other people's names.
3. No audit log and no stage history: a change cannot be traced to a time or a person (single user).
4. No rate limit and no CSRF token: the loopback binding and the Origin/Host check are the whole defence.
5. Docker files were written and partly replayed locally but not run with Docker, which is not installed on the development machine.
