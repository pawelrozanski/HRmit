# Changelog

All notable changes to HRmit are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.6.1] - 2026-10-25

### Added

- Position details on a recruitment: level (intern to director, "Mid / Specialist" for the Polish "specjalista"), location and work mode, contract, requirements and nice-to-haves (one per line), and the salary range with currency and period (month, year or hour). The new and edit recruitment form has the fields; all are optional, and "To" lower than "From" is refused.
- A Details tab next to Pipeline and Interview guide in a recruitment shows all of it, with an Edit button.
- The assistant's `getRecruitment` tool returns the details too, so "what are the requirements?" or "what is the salary range?" is answered from them. Free text is anonymized for a cloud provider like the description.

### Changed

- Generating the interview guide now also gives the model the level, requirements and nice-to-haves (never the salary).

## [0.6.0] - 2026-10-25

### Added

- The AI assistant reads more of your data (ADR 0009): the full description and interview guide of a recruitment with its team, a candidate's scorecard (the interviewers' ratings and comments per question, averages per competency, never a total), the notes on a candidate or an employee, and the position, duties and teams of employees. Suggested questions follow: "Show the interview ratings" and "Note down a summary of the interview" in the candidate drawer, "What are the requirements?" in a recruitment, "What do the notes say?" and "What is this person's role?" in the employee drawer.
- The assistant can draft a note. It never saves one: the draft appears as a card under the answer with Save, Edit and Discard, you read the whole text, and Save stores it through the ordinary notes endpoint. Such a note is marked "Drafted by the AI assistant, approved by you" in the drawer.
- Notes on candidates: a dated list with optional titles in the candidate drawer, like the one employees had. The old free-text "Notes" field became the candidate's first note.
- Settings → AI: "Employee data in the assistant (cloud)", off by default. With a cloud provider the assistant cannot read employees at all until you turn it on; then names become "Employee #N" and notes are anonymized like candidate data. A local provider may always.

### Changed

- With a cloud provider the chat now sends notes and interviewer comments after anonymization; the panel's hint and the consent dialog say so. Every candidate's and employee's name, email and phone is replaced in that text, declensions included.
- The chat's step limit is 8 model turns instead of 5, so a question that needs the recruitment, the candidate, the scorecard and a note fits in one answer.
- The "Who is the best candidate?" demo answer still refuses to rank and now shows rated/total questions per competency.

### Fixed

- Anonymization in inflected mode treated the word "the" as the name "Theo" and replaced it with "Candidate #2". Four-letter names now keep their last letter.

## [0.5.5] - 2026-10-25

### Added

- Windows installer (ADR 0008): `HRmit-Setup-<version>.exe` on GitHub Releases, about 25 MB, built by a workflow on every version tag. It needs no administrator rights, Node or terminal, and adds an HRmit shortcut on the desktop and in the Start menu. The shortcut starts HRmit in the background and opens it in the browser at `http://127.0.0.1:7300`; "Shut down HRmit" stops it. Data lives in `%APPDATA%\HRmit\data` and stays on update and uninstall. Not signed yet; the README explains the SmartScreen warning. "Check for updates" links to the new installer there.
- Check for updates: a button in Settings → General opens a dialog that asks GitHub for the newest release. When one is newer it offers to update, with "Back up my data first" checked by default (saved to `data/backups/`). The update fetches the release tag, fast-forwards the git checkout, installs dependencies when the lockfile changed, and the page reloads when the restarted server reports the new version. Refused with a message for a checkout with local changes; the Docker image gets the rebuild steps instead. Hidden in the demo.

## [0.5.4] - 2026-10-25

### Added

- Shut down HRmit: a button in Settings → General stops the server on this computer after a confirm (`POST /api/shutdown`, answers then exits). Hidden in the demo.
- Recovery: Settings → Backup & Recovery takes the downloaded `.tar.gz` back (`POST /api/backup/restore`). The archive is checked first (format, file names, SQLite integrity, core tables); then the database is swapped on the open handle, migrated and seeded again, the uploads folder replaced, and the page reloads. A damaged file is refused and nothing changes. The demo takes its JSON file back the same way.

### Changed

- The prompt editor moved from AI settings to its own tab, Settings → AI prompts.
- The Backup tab is called Backup & Recovery.
- The settings tab list is grouped: General, then AI (AI settings, AI prompts), Mail (Email (SMTP), Email templates) and Files (Backup & Recovery), each group a labelled tab list with a line above it.
- About HRmit links to the license next to the changelog and GitHub.

## [0.5.3] - 2026-10-25

### Added

- Settings → Backup: one button downloads `hrmit-backup-<date>-<time>.tar.gz` with the database (a consistent snapshot) and the uploaded CV files. The encryption key is not included, so the stored AI key and SMTP password have to be entered again after a restore; the page says how to restore by hand. `GET /api/backup`, archive written by a small ustar writer and `node:zlib`, no new dependency. The demo downloads its data as a JSON file.

### Fixed

- Playwright: the keyboard-order test still expected the assistant button after Settings; it follows Dashboard since 0.5.2. The 0.5.2 CI run was red for that reason.

## [0.5.2] - 2026-10-25

### Added

- Editable prompts in Settings → AI: the instruction text of the four prompts (summarize CV, extract competencies, interview questions, assistant chat) with `{{lang}}` and `{{today}}` placeholders and a "Restore default" per prompt. `GET/PUT /api/settings/prompts`; a text equal to the shipped default is not stored, so later default improvements still reach it. The defaults keep the "describe, never judge" rule; rewriting them is the operator's own decision. The structured outputs still have no score or verdict field (docs/SECURITY.md).

### Changed

- The AI assistant button in the header sits between Dashboard and Recruitments.

## [0.5.1] - 2026-10-25

### Added

- Custom email templates: Settings → Email templates is a grid of tiles (name and description), the "New template" tile opens the editor, and the same dialog edits a tile's name, description, subject and body with the available placeholders listed. Custom templates can be deleted after a confirm; the built-in three can be edited and put back with "Restore default". Every template, custom ones included, can be picked in the candidate's send dialog. `GET/POST /api/templates`, `PUT/DELETE /api/templates/:key`, `POST /api/templates/:key/restore`; names are unique (409). Migration 0012 (additive): `name`, `description` and `built_in` on `email_templates`; `emails.template_key` keeps the key as text, so deleting a template never touches the history. Demo stores saved earlier get the new fields on load.

### Changed

- Built-in templates have a short default description in English and Polish; the description and the name follow the language until you rename them.

## [0.5.0] - 2026-10-25

### Added

- Dashboard (`/dashboard`), the first screen after opening the panel: headline counts (open recruitments, active candidates, interviews this week, teams), interviews in the next 7 days with a Jitsi link, candidates waiting N days or more in a stage (N editable on the tile, default 7), candidates in interview or offer with an incomplete scorecard, open recruitments with a labelled funnel bar, and failed emails of the last 30 days. Every row opens the candidate or employee drawer. `GET /api/dashboard?stuckDays=N`, plain queries, no AI, no contact fields in the response. The demo computes it from its store; fixture dates are now relative to today.
- AI assistant chat: a side panel opened from the header on every page. Questions go to `POST /api/ai/chat`, which lets the model call seven read-only tools (recruitments, one recruitment with its funnel, upcoming interviews, candidates waiting in a stage, candidate search by title, stage or competency, one candidate with the stored AI text and the human interview averages per competency, teams as counts) and streams the answer. Suggested questions per screen, a status line while a tool runs, names and recruitment titles in the answer as links, "New conversation", Enter sends and Shift+Enter breaks a line. The assistant never ranks or recommends; asked who is best it lists facts and says the decision is the recruiter's. With a cloud provider the model sees `Candidate #N` and anonymized text, including in the recruiter's own messages; names are filled in by the browser from a separate `refs` event. Conversations are not stored. Ollama models without tool support get a clear error with a link to AI settings. In the demo the suggested questions are answered from the demo store through the same stream. ADR 0007.
- `anonymize()` has an `inflected` option that also matches Polish declensions of the candidate's name; the chat uses it for the recruiter's own words.

### Fixed

- A kanban card can no longer be dragged off the board: the drag is kept inside the pipeline area.
- Long subjects in the dashboard's failed-emails tile are cut with an ellipsis instead of pushing the date onto the next line.
- The "at least days" field on the dashboard can be cleared and typed into, not only stepped with the arrows.

## [0.4.0] - 2026-10-22

### Added

- Messages to employees: a "Send message" button in the employee drawer opens a dialog with the recipient shown read-only, a subject (1-200 characters) and a plain-text body (1-10000); Ctrl+Enter sends. A "Messages" section below the notes lists the history newest first with a sent / failed / outbox badge and the date. `GET/POST /api/employees/:id/emails`.
- Messages to teams: "Send message" on the team page with a recipient picker (checkbox list of the members with the Lead badge, "Select all", "Leads only", "Clear", the selected count next to the button, Send disabled with nobody picked). One mail per recipient, each sent on its own, no CC/BCC; the result reads "Sent to 4 of 5" and names who failed. A "Messages" section lists each send with the date, recipient count and status counts. `GET/POST /api/teams/:id/emails` (400 for a non-member, 409 without SMTP).
- `{{firstName}}`, `{{lastName}}` and `{{companyName}}` are filled in per recipient in both dialogs. Without SMTP settings the dialog says so and links to Settings → Email (SMTP).
- Migration 0011 (additive): `employee_emails`, cascading with the employee, `team_id` set null with the team. Demo mode records sends with status `demo` under the `employeeEmails` store key.

## [0.3.3] - 2026-10-22

### Added

- Provider catalog (`packages/shared/src/aiProviders.ts`): Ollama, LM Studio, Anthropic, OpenAI, Google Gemini, Mistral, DeepSeek, xAI, Perplexity, OpenRouter, Groq, Together AI, Fireworks AI and a custom OpenAI-compatible endpoint, each with a default base URL, a local flag, a one-line description, suggested model ids and key/docs links. Logos from `simple-icons` (CC0) where available, a monogram tile otherwise.
- `GET /api/ai/models`: the models installed in Ollama (from `/api/tags`), used to fill the model suggestions; empty for every other provider. The demo answers with a fixed list.

### Changed

- AI settings: the provider select is a tile with the logo and name of the current provider; clicking it opens "Choose a provider" (Ollama on top, cloud providers in a grid, Escape closes). Picking a cloud provider shows the existing consent dialog before anything changes; cancelling keeps the previous provider. The model field is free text with a datalist of suggestions, the base URL is read-only for cloud providers (with an "Edit" button) and editable for local and custom ones, the API key field and the "Get an API key" link appear for cloud providers only.
- `ai.provider` must be a catalog id; `openai-compatible` from older databases and demo stores reads as `custom`. The anonymization rule and the CV-import refusal apply to every non-local id.

## [0.3.2] - 2026-10-22

### Changed

- Employee notes have an optional title (max 120 characters) and a body of up to 5000 characters. A note is added in a dialog ("Add note": title, body, Ctrl+Enter saves) and read in a dialog opened from its row; the list shows only the title (or "Untitled note") and the date. Delete moved into the read dialog, still confirmed. Migration 0010 (additive): `employee_notes.title`, null on existing notes.

## [0.3.1] - 2026-10-22

### Added

- Notes on employees: a "Notes" section in the employee drawer with a textarea (Ctrl+Enter adds), the list newest first with date and time, and a confirmed delete per note. The employees list shows a note count next to the name. Six fictional notes in the fixtures, seeded once on existing databases.
- `GET/POST /api/employees/:id/notes`, `DELETE /api/employees/:id/notes/:noteId`; `noteCount` on the employees list and detail. Migration 0009 (additive): `employee_notes`, cascading with the employee.

### Added

- Employees (`/employees`): the hiring side of the company with position, email, hire date and duties. Search by name or position, filter by team, details drawer, edit and a confirmed hard delete that also removes team memberships. Twelve fictional employees in the fixtures.
- Teams (`/teams`, `/teams/:id`): cards with member and open-recruitment counts, a team view with the members list, a Lead/Member role toggle, "Remove from team" and an "Add members" dialog that adds several employees at once from a searchable checkbox list (keyboard: Tab, Space, Enter). Deleting a team keeps its recruitments and says how many are affected. Four fixture teams: Sales, IT, Customer Support, Marketing.
- A recruitment can belong to a team: team select in the form, team badge in the list and a team filter above it. `GET /api/jobs?teamId=`.
- Migration 0008 (additive): `employees`, `teams`, `team_members`, `jobs.team_id`; existing databases get the fixture teams and employees once, their jobs stay unassigned.
- Icons from lucide in the header navigation, page headings, buttons and empty states.

### Changed

- "Jobs" are labelled "Recruitments" (PL "Rekrutacje") in the UI; the entity stays a `job` in the API and the database (glossary in `docs/ARCHITECTURE.md`). Routes move to `/recruitments` and `/recruitments/:id`; `/jobs/:id` redirects. Navigation order: Recruitments, Employees, Teams, Settings. The placeholder Teams page is gone.

## [0.2.1] - 2026-10-21

### Added

- Brand assets from the logo sheet under apps/web/public/brand: the hermit-crab mark in a light and a dark variant, the app icon, favicons (16/32/64) and an Apple touch icon; the header and the landing page use the mark with the two-tone wordmark, the README shows the lockup in light and dark.
- Empty "Teams" page in the header navigation as a placeholder for the multi-user edition.

### Changed

- The hand-drawn SVG logo is replaced by the official artwork.

## [0.2.0] - 2026-10-21

### Added

- "Import from CV" in the new-candidate form: the CV is parsed, a local model (or a regex heuristic when no local model is configured) prefills name, email and phone for review, and the file is uploaded with the candidate. The raw CV is never sent to a cloud provider, because a person who is not in the database yet cannot be anonymized.
- Settings with a left sidebar of categories (`/settings/general`, `/settings/ai`, `/settings/email`, `/settings/templates`); on narrow screens the sidebar becomes a scrollable row above the content.
- General tab: language, theme (Light, Dark (high contrast), System) and an About block with the version and mode from `/api/health`, the changelog and the repository.
- High-contrast dark theme. The choice is stored in `localStorage` (`hrmit-theme`), applied before first paint, and "System" follows `prefers-color-scheme` live. Native controls follow through `color-scheme`.
- Keyboard navigation: a "Skip to content" link as the first focusable element, header links with `aria-current="page"`, settings sidebar as a vertical tab list with arrow keys, Home and End.

### Changed

- Email templates live under Settings; `/templates` redirects to `/settings/templates` and the header keeps Jobs and Settings. Language is chosen in Settings → General instead of the header.
- One `VERSION` constant in `packages/shared`, used by the server, the demo handler and the About block.

## [0.1.0] - 2026-10-19

First release: the MVP of a local-first ATS with an AI assistant, delivered as roadmap stages 0 to 11.

### Added

- Stage 0: pnpm monorepo (`apps/web`, `apps/server`, `packages/shared`), Hono API on `127.0.0.1:3000`, React 19 + Vite 7 + Tailwind 4 + shadcn/ui, `en`/`pl` i18n, CI.
- Stage 1: jobs and candidates on SQLite (Drizzle over `node:sqlite`), seeded from fictional fixtures; candidate drawer; blind-screening toggle; landing page; demo build with MSW and `localStorage`, deployed to GitHub Pages.
- Stage 2: kanban pipeline with drag-and-drop and a keyboard-friendly stage select.
- Stage 3: create, edit and delete jobs and candidates; CV upload (PDF, DOCX) validated by extension and magic bytes, text extraction, cascade delete including the file.
- Stage 4: AI settings with provider choice, AES-256-GCM encrypted keys, master key on first run, log redaction, "Test connection".
- Stage 5: CV summary and competency extraction through the Vercel AI SDK with zod output schemas that contain no score or verdict; typing effect; "AI suggestion" label and disclaimer.
- Stage 6: local `anonymize()` with tests, anonymization preview, opt-in dialog for cloud providers, local/cloud badge on every AI result.
- Stage 7: structured interview questions per job, generated by AI or written by hand, editable and reorderable.
- Stage 8: scorecard per candidate with the job's questions, 1 to 5 scores and notes, averages per competency.
- Stage 9: email templates (invitation, reminder, rejection), SMTP settings with an encrypted password, send dialog with preview, per-candidate history.
- Stage 10: interview scheduling with a Jitsi room link and a hand-built `.ics` attachment.
- Stage 11: hermit-crab logo and final landing copy; README with screenshots; `Dockerfile` and `docker-compose.yml` (not run on the development machine); Playwright smoke test of the demo build with axe checks in CI; accessibility pass (AA contrast, one `h1` per page); final security review (`docs/SECURITY.md`), dependency audit and license check; `HOST` and `OLLAMA_BASE_URL` environment variables.

### Changed

- Primary buttons and badges use `brand-dark` (`#C2410C`) for WCAG AA contrast; the bright `brand` orange is the hover, border and focus-ring colour.
- vitest 5 (removes the tinypool advisory); the shadcn CLI is a devDependency.

### Security

- `/api/*` rejects requests whose `Origin` or `Host` is not loopback, closing cross-site form posts and DNS rebinding against the login-less local server.

[Unreleased]: https://github.com/pawelrozanski/HRmit/compare/v0.5.5...HEAD
[0.5.5]: https://github.com/pawelrozanski/HRmit/compare/v0.5.4...v0.5.5
[0.5.4]: https://github.com/pawelrozanski/HRmit/compare/v0.5.3...v0.5.4
[0.5.3]: https://github.com/pawelrozanski/HRmit/compare/v0.5.2...v0.5.3
[0.5.2]: https://github.com/pawelrozanski/HRmit/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/pawelrozanski/HRmit/compare/v0.5.0...v0.5.1
[0.3.1]: https://github.com/pawelrozanski/HRmit/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/pawelrozanski/HRmit/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/pawelrozanski/HRmit/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/pawelrozanski/HRmit/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/pawelrozanski/HRmit/releases/tag/v0.1.0
