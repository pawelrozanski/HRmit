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
- Employees (0.3.0) are personal data of the hiring side. `DELETE /api/employees/:id` is a hard delete and cascades to the team memberships; deleting a team removes its memberships and leaves its recruitments without a team. Employee data is never part of an AI prompt and goes through the same loopback-only API. Notes on an employee (0.3.1) are personal data too: plain text rendered as text, deleted with the employee through `ON DELETE CASCADE`, never sent to an AI provider.
- Everything else is one folder: `data/`. Deleting it deletes the installation's data.

## Cloud AI and the limits of anonymization

- Default provider is Ollama on localhost; cloud providers are bring-your-own-key and opt-in behind a dialog that names the host and lists what is sent and what never is.
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

## Known limits, in one list

1. Anyone who can read `data/` has everything, including the master key.
2. Anonymization is pattern-based and will miss names that are only in free text.
3. No audit log and no stage history: a change cannot be traced to a time or a person (single user).
4. No rate limit and no CSRF token: the loopback binding and the Origin/Host check are the whole defence.
5. Docker files were written and partly replayed locally but not run with Docker, which is not installed on the development machine.
