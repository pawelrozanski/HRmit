# 0001. Stack: React + Vite, Hono on Node, pnpm monorepo

Date: 2026-10-19
Status: accepted

## Context

Portfolio project by a single developer who knows Java but not frontend. Must run locally with one command, build to a static demo for GitHub Pages, and share types between UI and API. Docker is not installed on the dev machine.

## Decision

- **Frontend:** React 19 + TypeScript + Vite, Tailwind CSS, shadcn/ui components, React Router, react-i18next.
- **Backend:** Hono on Node 24. Chosen over Fastify for `hono/client`, which derives a typed API client from the route definitions, and because Hono is a thin layer over standard `fetch` Request/Response, which MSW intercepts without adapters.
- **Monorepo:** pnpm workspaces (`apps/web`, `apps/server`, `packages/shared`). pnpm via `corepack`, so nothing is installed globally.
- **Validation:** zod schemas in `packages/shared`, used by server validation, demo handlers and TypeScript types.
- **Quality:** ESLint + Prettier, Vitest. Playwright later for a demo smoke test.
- **Run:** `pnpm dev` is the primary path. `docker-compose.yml` is an optional extra, added late in the roadmap.

## Consequences

- One language (TypeScript) end to end; the Java developer learns one new ecosystem, not two.
- Field renames break the web build instead of failing at runtime.
- Hono is younger than Fastify; fewer plugins, but the MVP needs none beyond zod validation and static file serving, both built in.
- No Docker means no "it works in the container" isolation; the trade is a one-line install for anyone with Node.
