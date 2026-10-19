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

- Routes: create/update/delete for both resources, `POST /candidates/:id/cv` (multipart), `GET /candidates/:id/cv`.
- Server: upload validation (extension + magic bytes, 10 MB), UUID filename under `data/uploads/`, text extraction with `unpdf` and `mammoth`, cascade delete including the file.
- UI: forms with zod validation, drop-zone upload, CV text preview, delete with confirmation.
- **Done when:** a real PDF and DOCX upload locally, their text shows in the UI, deleting the candidate removes the file from disk.
- **Demo:** upload accepts any file and attaches a fixture CV text.
- **Security:** full upload review; verify the file is never served by path; verify deletion.

## Stage 4: AI settings and local provider

- Schema: `settings`. Server: AES-256-GCM encryption helper, master key on first run, log redaction.
- Routes: get/update settings (secrets masked), `POST /ai/test`.
- UI: settings page with provider choice (Ollama / Anthropic / OpenAI-compatible), base URL, model, key field that never echoes the key, "Test connection".
- **Done when:** with Ollama running, "Test connection" succeeds; the key is stored encrypted in SQLite; the API never returns it.
- **Demo:** settings are editable, "Test connection" always succeeds after a delay.
- **Security:** encryption review, log review, `GET /settings` response review.

## Stage 5: CV summary and competencies with AI

- Server: provider factory, prompts, zod output schemas (summary, competencies). `generateObject` through Vercel AI SDK.
- Routes: `POST /ai/summarize/:id`, `POST /ai/competencies/:id`; result saved to `ai_summary_json`.
- UI: "Summarize with AI" and "Extract competencies" buttons, typing effect, "AI suggestion" label and disclaimer, edit or discard.
- **Done when:** a real CV gets a summary from `qwen2.5:7b-instruct` locally; the output schema has no score or verdict field (checked by a test).
- **Demo:** pre-recorded JSON per fixture candidate.
- **Security:** prompts never include email, phone or notes beyond what the action needs.

## Stage 6: Anonymization and BYOK cloud providers

- `packages/shared/anonymize.ts` implemented with unit tests (names with diacritics, emails, phones, PESEL, URLs).
- Route: `GET /ai/preview/:id`. Cloud calls go through `anonymize()`.
- UI: opt-in dialog when switching to a cloud provider, "Preview anonymized data" on the candidate page, provider badge showing local vs cloud on every AI result.
- **Done when:** switching to Anthropic with a test key produces a summary whose request body (debug log) contains `Candidate #N` and no name or email.
- **Demo:** the preview shows the fixture's anonymized text; cloud switch shows the dialog but keeps returning fixtures.
- **Security:** full review of what leaves the machine; debug logging of prompts is off by default.

## Stage 7: Structured interview questions

- Schema: `interview_questions`. Routes: generate (AI), list, update, reorder.
- UI: per-job "Interview guide" tab, generate from job description, edit inline, reorder.
- **Done when:** a job has an editable question list grouped by competency, generated locally.
- **Demo:** pre-recorded question sets per fixture job.
- **Security:** none new.

## Stage 8: Scorecard

- Schema: `evaluations`. Routes: get/put per candidate.
- UI: scorecard on the candidate page with the job's questions, 1 to 5 score and note per question, totals shown per competency, never as a single ranking number. Works in blind mode.
- **Done when:** two candidates for the same job are scored on identical criteria and the result persists.
- **Security:** none new.

## Stage 9: Email templates and SMTP

- Schema: `email_templates`, `emails`. Server: nodemailer, placeholder substitution, "Send test email".
- Routes: templates get/update, send to candidate, list by candidate.
- UI: SMTP settings, template editor, "Send email" dialog with preview, communication history on the candidate page.
- **Done when:** a rejection email reaches a real inbox through the user's SMTP; the password is stored encrypted.
- **Demo:** emails are saved with `status: 'demo'` and appear in an Outbox view.
- **Security:** SMTP password handling, no candidate data in logs, template placeholders cannot inject HTML.

## Stage 10: Meeting invites (Jitsi + .ics)

- Schema: `meetings`. Server: Jitsi URL generation, hand-built `.ics`, sent as attachment through the invite template.
- UI: "Schedule interview" dialog with `<input type="datetime-local">` and duration.
- **Done when:** the recipient's calendar imports the `.ics` and the Jitsi link opens a room.
- **Demo:** meeting appears on the candidate page; invite goes to the Outbox.
- **Security:** none new.

## Stage 11: Polish and release 0.1

- Landing page final copy and logo, README screenshots, demo walkthrough.
- `docker-compose.yml` as an alternative run path.
- Playwright smoke test of the demo build in CI.
- Accessibility pass: contrast of the orange palette on cream and white, keyboard navigation of the kanban, focus states.
- Final security review across all stages, dependency license check, `pnpm audit`.
- Tag `v0.1.0`.

---

## Out of MVP (tracked, not planned)

- Inbound applications via IMAP (`imapflow`).
- Google Meet integration (OAuth).
- Desktop installer (Tauri).
- Multi-user with authentication.
- Local NER model for anonymization.
- Stage history and audit log.
