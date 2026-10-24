# HRmit

Local-first applicant tracking system (ATS) with an AI assistant. Open source, MIT, portfolio project. Tagline: _Your recruitment data stays home._ Mascot: a hermit crab (carries its home with it, like an app that runs locally).

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/adr/](docs/adr/) and [docs/ROADMAP.md](docs/ROADMAP.md) before any non-trivial change. They are the source of truth; update them when a decision changes.

## Product rules (non-negotiable)

1. **AI assists, never judges.** AI summarizes, extracts competencies, proposes interview questions. It never rejects, ranks or scores a candidate. No output schema, shipped prompt or UI element may contain a fit score, ranking or hire/no-hire verdict. The decision is always a human click. Since 0.5.2 the operator can edit the prompt texts in Settings → AI; the defaults keep this rule and whoever rewrites them owns that decision (MIT). The output schemas stay verdict-free regardless. (EU AI Act: recruitment is high-risk. GDPR art. 22.)
2. **Local by default.** The default AI provider is Ollama on localhost. Cloud providers are BYOK, opt-in, behind a dialog that says exactly what is sent where.
3. **Anonymize before cloud.** Candidate data is scrubbed locally (`anonymize()` in `packages/shared`) before any external API call: name, contact, address, photo replaced by `Candidate #N` and placeholders. The user can preview the anonymized text.
4. **Reduce bias.** Blind-screening toggle; structured interviews with the same questions and criteria for every candidate of a job.
5. **Protect personal data.** API keys and SMTP passwords encrypted at rest, never in logs, exports or API responses. Validated uploads. Candidate deletion removes everything, including files.

## Stack

- pnpm workspaces monorepo, TypeScript everywhere, Node 24.
- `apps/web`: React 19, Vite 7, Tailwind 4, shadcn/ui (added when the first component is needed), React Router 7, react-i18next, MSW (demo only).
- `apps/server`: Hono 4 on `@hono/node-server`, bound to `127.0.0.1:3000`. Drizzle + SQLite from roadmap stage 1.
- `packages/shared`: zod schemas, enums, `anonymize()`, demo fixtures.
- AI: Vercel AI SDK; Ollama through `@ai-sdk/openai-compatible`; `@ai-sdk/anthropic`. CV parsing: `unpdf`, `mammoth`. Mail: `nodemailer`.
- Quality: ESLint (flat config) + Prettier, Vitest, GitHub Actions.

## Layout

```
apps/web/src/api/        the ONE place that calls the backend (hono/client, typed from server routes)
apps/web/src/demo/       MSW handlers + localStorage store; code-split, only in VITE_DEMO builds
apps/web/src/features/   one folder per feature (jobs, candidates, pipeline, ai, settings, email)
apps/web/src/i18n/       en.json, pl.json
apps/server/src/routes/  one Hono sub-app per resource, chained with .route() in app.ts
apps/server/src/db/      Drizzle schema + migrations
apps/server/src/ai/      provider factory, prompts, output schemas
packages/shared/src/     schemas.ts, anonymize.ts, fixtures/
data/                    runtime: hrmit.db, uploads/, master.key. Gitignored. Never commit.
```

## Commands

```bash
pnpm install          # first time (pnpm via `npm i -g pnpm`; corepack needs admin on Windows)
pnpm dev              # server on :3000 + Vite on :5173 (proxies /api)
pnpm build            # typecheck server, build web for local use
pnpm build:demo       # web with VITE_DEMO=true, base /HRmit/, MSW enabled
pnpm --filter @hrmit/web preview:demo   # serve the demo build on :4173/HRmit/
pnpm lint             # eslint + prettier --check
pnpm format
pnpm typecheck
pnpm test             # vitest, projects: packages/shared, apps/server
```

## Conventions

- **Every API shape lives in `packages/shared` as a zod schema.** Server validates with it, demo handlers return it, tests parse with it.
- **Every server route gets a demo handler in the same PR.** A feature is done only when it works with `pnpm dev` and with `pnpm build:demo`.
- **Routes are chained** (`new Hono().get(...).post(...)`) so `AppType` stays complete. Never `app.get()` as a statement after creation.
- Imports use explicit `.ts`/`.tsx` extensions; `import type` for types.
- UI strings go through `t()`; add the key to both `en.json` and `pl.json`.
- Colors only through the Tailwind tokens below; never raw hex in components.
- Keep it small: no abstraction for one use, no dependency for what ten lines do. Mark deliberate shortcuts with a `// ponytail:` comment naming the ceiling.
- One runnable check per non-trivial piece of logic (a small `*.test.ts`), no fixtures-heavy suites.

## Palette

| Token        | Hex       | Use                          |
| ------------ | --------- | ---------------------------- |
| `brand`      | `#F26B1D` | primary actions, accents     |
| `brand-dark` | `#C2410C` | text on light, hover, banner |
| `cream`      | `#FFF7F0` | page background              |
| `white`      | `#FFFFFF` | cards                        |
| `ink`        | `#1F2937` | text, outlines               |

Keep WCAG AA: `brand` on white fails for body text (use `brand-dark`); white on `brand` is for large text and buttons only.

## Working rules

- Small commits, Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`), meaningful messages. Co-author line for Claude.
- One feature at a time, end to end (schema, route, handler, UI, test), before the next.
- After every larger change: a short explanation of what and why, in plain language (the owner is learning React).
- At the end of each roadmap stage: a security review (keys, logs, upload, personal data) and a line in the stage's commit message that it was done.
- When something is unclear or hard to reverse, ask instead of guessing.
- Never commit secrets or real personal data. All fixtures are fictional people and companies.
- Code, comments, commits, docs in English. UI in English and Polish.
