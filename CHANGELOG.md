# Changelog

All notable changes to HRmit are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/pawelrozanski/HRmit/compare/v0.3.1...HEAD
[0.3.1]: https://github.com/pawelrozanski/HRmit/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/pawelrozanski/HRmit/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/pawelrozanski/HRmit/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/pawelrozanski/HRmit/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/pawelrozanski/HRmit/releases/tag/v0.1.0
