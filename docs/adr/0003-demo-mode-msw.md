# 0003. Demo mode is the real frontend with MSW, not a separate mock-up

Date: 2026-10-19
Status: accepted

## Context

The portfolio needs a clickable demo on GitHub Pages, which can only host static files. A separate mock-up would drift from the real app within weeks and would double the UI work.

## Decision

- The same `apps/web` is built with `VITE_DEMO=true`. That flag does exactly one thing: it dynamically imports `src/demo/`, which registers a Mock Service Worker (MSW) and seeds a store from `packages/shared/fixtures`.
- MSW handlers implement the same API contract as the server, validated by the same zod schemas. A shared contract test runs every fixture through the schemas.
- Demo state lives in `localStorage` (guarded by `try/catch`), with a "Reset demo" button.
- AI responses are pre-recorded JSON fixtures, rendered with the same typing effect the real app uses for streamed text.
- Routing on Pages: landing at `/`, app at `/demo/*`. The local build renders the app at `/*`.

## Consequences

- One codebase, one set of components, no drift. Every feature shipped locally is automatically demo-able once a fixture and a handler exist.
- Every roadmap stage has a small extra cost: write the demo handler alongside the route.
- The `src/demo/` directory is code-split and absent from the local build, so MSW never runs in production.
- GitHub Pages serves from a sub-path, so Vite `base` must be `/HRmit/`; all asset and route paths go through `import.meta.env.BASE_URL`.
