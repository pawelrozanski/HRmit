# HRmit roadmap

Vertical slices: each stage ends with a feature that works end to end in **both** modes (local with SQLite, demo with MSW) and is merged to `main`. Nothing is started before the previous stage is done and reviewed.

Every stage ends with:

1. the feature usable in the browser, locally and in the demo build;
2. the shared zod schemas and fixtures updated, the contract test green;
3. a short security review (keys, logs, upload, personal data);
4. one or more Conventional Commits on `main`.

Legend: **Done when** is the acceptance test. **Demo** is what the MSW handler does. **Security** is the review focus.

---

## Stage 0: Repository skeleton

_(this session, step 3)_

- pnpm monorepo, TypeScript project references, ESLint, Prettier, Vitest.
- `apps/web`: Vite + React + Tailwind + shadcn/ui, routing, i18n with `en`/`pl` and one translated string, demo banner component, `VITE_DEMO` wiring with an empty MSW worker.
- `apps/server`: Hono app bound to `127.0.0.1:3000`, `/api/health`, static serving of the web build.
- `packages/shared`: `schemas.ts` with the pipeline-stage enum and the health schema, one test.
- `CLAUDE.md`, `README.md`, `LICENSE`, `.gitignore`, `.github/workflows/ci.yml`.
- **Done when:** `pnpm install && pnpm dev` opens the UI, which shows a health check from the server; `pnpm lint && pnpm test && pnpm build` pass; CI is green.

## Stage 1: Jobs and candidates on fixtures, deployed demo

_(done 2026-10-19; Drizzle over node:sqlite via sqlite-proxy, see ADR 0002 amendment)_

- Schema: `jobs`, `candidates` (no CV columns yet).
- Routes: list jobs, list candidates by job. Server seeds the DB from fixtures on first run when empty.
- UI: job list, candidate list per job, candidate detail drawer. Blind-screening toggle that hides name and contact fields.
- Fixtures: 3 jobs, ~15 fictional candidates in English.
- Landing page at `/` with logo placeholder, tagline, repo link and a "Try the demo" button. `pages.yml` deploys to GitHub Pages on push to `main`.
- **Done when:** the same candidate list renders locally from SQLite and at `pawelrozanski.github.io/HRmit/demo` from MSW; "Reset demo" works.
- **Demo:** handlers for the two GET routes, store seeded from fixtures, persisted in `localStorage`.
- **Security:** `.gitignore` covers `data/`; fixtures contain no real people.

## Stage 2: Pipeline kanban

_(done 2026-10-19; keyboard fallback is a native `<select>` in the candidate drawer)_

- Route: `PATCH /api/candidates/:id/stage`.
- UI: kanban with the five stages, move by drag-and-drop (`@dnd-kit/core`) with a stage select in the drawer for keyboard users.
- **Done when:** moving a card survives a reload in both modes.
- **Security:** none new.

## Stage 3: Create, edit, delete candidates and jobs; CV upload

_(done 2026-10-19; delete confirmation is a native `confirm()`, the demo download link is hidden because the demo stores no files, CV text is hidden under blind screening)_

- Routes: create/update/delete for both resources, `POST /candidates/:id/cv` (multipart), `GET /candidates/:id/cv`.
- Server: upload validation (extension + magic bytes, 10 MB), UUID filename under `data/uploads/`, text extraction with `unpdf` and `mammoth`, cascade delete including the file.
- UI: forms with zod validation, drop-zone upload, CV text preview, delete with confirmation.
- **Done when:** a real PDF and DOCX upload locally, their text shows in the UI, deleting the candidate removes the file from disk.
- **Demo:** upload accepts any file and attaches a fixture CV text.
- **Security:** full upload review; verify the file is never served by path; verify deletion.

## Stage 4: AI settings and local provider

_(done 2026-10-19; "Test connection" saves the form first, so it always tests what is stored; the master key file gets mode 0600 where the OS honours it, on Windows NTFS ACLs apply instead)_

- Schema: `settings`. Server: AES-256-GCM encryption helper, master key on first run, log redaction.
- Routes: get/update settings (secrets masked), `POST /ai/test`.
- UI: settings page with provider choice (Ollama / Anthropic / OpenAI-compatible), base URL, model, key field that never echoes the key, "Test connection".
- **Done when:** with Ollama running, "Test connection" succeeds; the key is stored encrypted in SQLite; the API never returns it.
- **Demo:** settings are editable, "Test connection" always succeeds after a delay.
- **Security:** encryption review, log review, `GET /settings` response review.

## Stage 5: CV summary and competencies with AI

_(done 2026-10-19; the OpenAI-compatible provider needs `supportsStructuredOutputs: true` or the zod schema never reaches Ollama; "edit" is deferred, a result can be regenerated or discarded; the 7b model sometimes writes fewer than three sentences, the schema describes the length but does not enforce it)_

- Server: provider factory, prompts, zod output schemas (summary, competencies). `generateObject` through Vercel AI SDK.
- Routes: `POST /ai/summarize/:id`, `POST /ai/competencies/:id`; result saved to `ai_summary_json`.
- UI: "Summarize with AI" and "Extract competencies" buttons, typing effect, "AI suggestion" label and disclaimer, edit or discard.
- **Done when:** a real CV gets a summary from `qwen2.5:7b-instruct` locally; the output schema has no score or verdict field (checked by a test).
- **Demo:** pre-recorded JSON per fixture candidate.
- **Security:** prompts never include email, phone or notes beyond what the action needs.

## Stage 6: Anonymization and BYOK cloud providers

_(done 2026-10-19; `isLocalProvider()` and `isLocalBaseUrl()` live in `packages/shared` so the web badge and the server agree; the cloud dialog opens on Save or Test whenever the provider or base URL changes to a non-local one, and the change is saved only on confirm; prompt debugging is `HRMIT_LOG_PROMPTS=1` and logs the anonymized prompt only; the "done when" was proven with a mocked model capturing the prompt, no real cloud key was used; the demo build was verified by the msw/node handler test, the embedded browser pane cannot register service workers)_

- `packages/shared/anonymize.ts` implemented with unit tests (names with diacritics, emails, phones, PESEL, URLs).
- Route: `GET /ai/preview/:id`. Cloud calls go through `anonymize()`.
- UI: opt-in dialog when switching to a cloud provider, "Preview anonymized data" on the candidate page, provider badge showing local vs cloud on every AI result.
- **Done when:** switching to Anthropic with a test key produces a summary whose request body (debug log) contains `Candidate #N` and no name or email.
- **Demo:** the preview shows the fixture's anonymized text; cloud switch shows the dialog but keeps returning fixtures.
- **Security:** full review of what leaves the machine; debug logging of prompts is off by default.

## Stage 7: Structured interview questions

_(done 2026-10-19; one `PUT /api/jobs/:id/questions` replaces the whole list and covers create, edit, delete and reorder, so there is no separate reorder route; `POST /api/ai/questions/:jobId` stores the generated set only when the job has no questions yet and otherwise returns it as a proposal with `applied: false` for the UI's Use / Discard; the prompt sees the job title and description only, the description goes through `anonymize()` for cloud providers, which now accepts no candidate and runs the pattern passes alone; one fixture question set per job seeds the local database on first run and doubles as the demo's "generated" set, there is no second pre-recorded set; the guide is a Pipeline | Interview guide switch on the candidates page, reordering is move up / move down buttons, not drag-and-drop; verified locally with Ollama qwen2.5:7b-instruct and in the demo build in the embedded browser)_

- Schema: `interview_questions`. Routes: generate (AI), list, update, reorder.
- UI: per-job "Interview guide" tab, generate from job description, edit inline, reorder.
- **Done when:** a job has an editable question list grouped by competency, generated locally.
- **Demo:** pre-recorded question sets per fixture job.
- **Security:** none new.

## Stage 8: Scorecard

_(done 2026-10-19; `GET /api/candidates/:id/scorecard` returns the job's questions in guide order joined with the candidate's evaluation, so the UI never needs a second call, and `PUT` takes the `evaluations` array and upserts per question, rejecting a question of another job with 400; `score` is nullable, a note can be written before a score; evaluations cascade with the candidate and with the question, and `PUT /api/jobs/:id/questions` now keeps rows whose text is unchanged so a reorder of the guide does not wipe the job's scorecards, while an edited question starts without scores; the scorecard is a section of the candidate drawer, not a separate page, with a native radio group of five per question and averages per competency with the scored count; three fixture candidates are seeded with scores; verified locally on two candidates of job 1 after a reload, in blind mode, and in the demo build in the embedded browser)_

- Schema: `evaluations`. Routes: get/put per candidate.
- UI: scorecard on the candidate page with the job's questions, 1 to 5 score and note per question, totals shown per competency, never as a single ranking number. Works in blind mode.
- **Done when:** two candidates for the same job are scored on identical criteria and the result persists.
- **Security:** none new.

## Stage 9: Email templates and SMTP

_(done 2026-10-19; the send dialog fetches `GET /api/candidates/:id/emails/preview?template=…` and `POST /api/candidates/:id/emails` takes the final subject and body, so the recruiter edits the rendered text and the server renders nothing itself; `renderTemplate()` is a `replaceAll` loop in `packages/shared`, unknown placeholders stay visible, `{{startsAt}}` and `{{jitsiUrl}}` are filled from stage 10; mail is `text/plain` only, so a placeholder value is never HTML; SMTP settings add a `companyName` field (sender display name and the `{{companyName}}` placeholder), a deviation from the three keys listed in §3; missing template keys are inserted on every start, edited ones are kept; the "real inbox" was a local SMTP sink on 127.0.0.1:2525 started for the check, no real mail account was available, the captured message had the rendered rejection text and the row showed as Sent in the drawer; the password in `data/hrmit.db` was verified to be ciphertext; the demo records `status: 'demo'` rows shown as "Outbox (demo)" in the same history list, there is no separate Outbox page; header links now resolve from the app root, a relative `settings` from `/jobs/1` rendered an empty page before)_

- Schema: `email_templates`, `emails`. Server: nodemailer, placeholder substitution, "Send test email".
- Routes: templates get/update, send to candidate, list by candidate.
- UI: SMTP settings, template editor, "Send email" dialog with preview, communication history on the candidate page.
- **Done when:** a rejection email reaches a real inbox through the user's SMTP; the password is stored encrypted.
- **Demo:** emails are saved with `status: 'demo'` and appear in an Outbox view.
- **Security:** SMTP password handling, no candidate data in logs, template placeholders cannot inject HTML.

## Stage 10: Meeting invites (Jitsi + .ics)

_(done 2026-10-19; `GET /api/candidates/:id/meetings/preview?startsAt=…` generates the room URL and renders the `invite` template, `POST /api/candidates/:id/meetings` takes `{ startsAt, durationMin, jitsiUrl?, subject?, body? }` so the recruiter edits the rendered text like in stage 9 and the server validates the room against the `https://meet.jit.si/hrmit-` prefix; the preview takes only `startsAt`, the duration does not appear in the template text; `{{startsAt}}` renders as `YYYY-MM-DD HH:MM UTC`, the recruiter can rewrite it in the dialog; the `meetings` table has an extra nullable `email_id` (set null on delete) linking the invite row, a deviation from §3; a failed send records the failed email row and no meeting, the UI shows the transport error; `buildIcs()` in `packages/shared` folds at 75 octets and escapes TEXT per RFC 5545, the file goes as a `text/calendar; method=REQUEST` attachment named `invite.ics`; the calendar import was checked by decoding the attachment captured by a local SMTP sink on 127.0.0.1:2525 and inspecting the VEVENT, no real calendar client was available; the Jitsi link opened the pre-join page in the browser; the demo was verified by the msw/node handlers test, the in-app browser refuses the service worker)_

- Schema: `meetings`. Server: Jitsi URL generation, hand-built `.ics`, sent as attachment through the invite template.
- UI: "Schedule interview" dialog with `<input type="datetime-local">` and duration.
- **Done when:** the recipient's calendar imports the `.ics` and the Jitsi link opens a room.
- **Demo:** meeting appears on the candidate page; invite goes to the Outbox.
- **Security:** none new.

## Stage 11: Polish and release 0.1

_(done 2026-10-19; the logo is a hand-written SVG under 1 KB; screenshots were taken with Playwright against the local build on a throwaway data dir, with one fictional CV summarized by Ollama; the Docker image runs the TypeScript source with tsx and a production-only install, with `HOST` (default `127.0.0.1`, `0.0.0.0` inside the container) and `OLLAMA_BASE_URL` as new env vars, and it was replayed locally in a temp dir but not run with Docker, which is not installed; the Playwright smoke test builds and serves the demo itself and doubles as the axe run, so there is no separate accessibility script; the accessibility pass moved the shadcn `primary` token from `brand` to `brand-dark`, since white on `#F26B1D` is 3.1:1, and made the app header the `h1`; the security review added a loopback check on `Origin` and `Host` for `/api/*`, upgraded vitest to 5 for the tinypool advisory and moved the shadcn CLI to devDependencies, the remaining advisories are documented in `docs/SECURITY.md`; the GitHub release was not created because no authenticated GitHub client was available, only the annotated tag was pushed)_

- Landing page final copy and logo, README screenshots, demo walkthrough.
- `docker-compose.yml` as an alternative run path.
- Playwright smoke test of the demo build in CI.
- Accessibility pass: contrast of the orange palette on cream and white, keyboard navigation of the kanban, focus states.
- Final security review across all stages, dependency license check, `pnpm audit`.
- Tag `v0.1.0`.

---

## After the MVP

### 0.3.1: Notes on employees

_(done 2026-10-22; additive migration 0009 adds `employee_notes` with `ON DELETE CASCADE`, verified against a rolled-back copy of `data/hrmit.db` where the twelve employees and their memberships survived and the six fixture notes were seeded exactly once; the note count rides on the employees list as a correlated subquery, so the list stays one request)_

### 0.3.0: Employees, teams and the recruitments label

_(done 2026-10-21; additive migration 0008 adds `employees`, `teams`, `team_members` and `jobs.team_id`, verified against a copy of an existing `data/hrmit.db` where the jobs survived with `team_id` null and the fixture teams and employees were seeded once; the entity stays a `job` in the API and the database and is labelled a recruitment in the UI, see the glossary in ARCHITECTURE.md §3; a team lead is a `role` column on the membership, not a column on the team, so a team can temporarily have none or several; deleting a team keeps its recruitments and the confirm dialog states how many are affected; employees are hard-deleted; the demo store backfills the three new keys into stores saved before 0.3.0; the add-members dialog is a native checkbox list, verified by keyboard in the in-app browser and in the Playwright run)_

- Schema: `employees`, `teams`, `team_members` (composite key, `role`), `jobs.team_id`.
- Routes: `/api/employees`, `/api/teams` with members and role, `/api/jobs?teamId=`.
- UI: Employees page with search, team filter and a details drawer; Teams grid and team view with the lead toggle and an add-members dialog; team select and filter on recruitments; lucide icons in the header.
- **Done when:** a team can be created, staffed from the employee list and assigned recruitments, in local and demo mode, with the counts on the Teams page matching.
- **Security:** employees are personal data: hard delete with cascade, never sent to AI, same loopback-only API.

## Out of MVP (tracked, not planned)

- Inbound applications via IMAP (`imapflow`).
- Google Meet integration (OAuth).
- Desktop installer (Tauri).
- Multi-user with authentication.
- Local NER model for anonymization.
- Stage history and audit log.
