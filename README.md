<p align="center">
  <!-- logo: hermit crab, coming in roadmap stage 11 -->
</p>

<h1 align="center">HRmit</h1>

<p align="center"><strong>Your recruitment data stays home.</strong></p>

<p align="center">
  Local-first applicant tracking system with an AI assistant.<br/>
  Download it, run it, open <code>localhost</code>. Candidates never leave your machine.
</p>

> **Status:** early development. The repository skeleton is in place; features land one by one following [docs/ROADMAP.md](docs/ROADMAP.md).

## What it does (MVP)

- Jobs and candidates with a kanban pipeline: applied → screening → interview → offer / rejected.
- CV upload (PDF, DOCX) with text extraction and an AI summary.
- AI-generated structured interview questions per job, the same for every candidate.
- Scorecards with identical criteria, blind-screening mode.
- Email templates over your own SMTP, meeting invites with a Jitsi link and an `.ics` file.
- AI provider settings: local Ollama by default, bring-your-own-key cloud as an option, with an anonymization preview.

## Why local?

Recruitment data is some of the most sensitive data a small company holds, and most ATS products are SaaS. HRmit runs on your computer: SQLite file, uploads folder, done. Backup is "copy the folder", deletion is "delete the candidate" and the file goes with it.

AI works the same way. The default model runs on your machine through [Ollama](https://ollama.com). If you choose a cloud model, you paste your own key, and every CV is anonymized locally before it is sent; you can see exactly what leaves.

## Design decisions

- **AI assists, never judges.** It summarizes, extracts competencies and proposes questions. It cannot rank, score or reject anyone: the output schemas have no field for it. Recruitment AI is high-risk under the EU AI Act, and GDPR art. 22 limits automated decisions. The decision is always yours. ([ADR 0004](docs/adr/0004-ai-assistant-not-judge.md))
- **Local by default, cloud by choice, anonymized always.** ([ADR 0005](docs/adr/0005-byok-anonymization.md))
- **The demo is the real app.** The same frontend is built with a flag that swaps the backend for a browser-side mock. No separate mock-up to drift. ([ADR 0003](docs/adr/0003-demo-mode-msw.md))
- **One language, one repo.** TypeScript end to end, with types flowing from the server's routes into the UI. ([ADR 0001](docs/adr/0001-stack.md))
- **SQLite, no database server.** ([ADR 0002](docs/adr/0002-sqlite.md))

Full picture in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Demo

A clickable demo with fictional candidates will live at **https://pawelrozanski.github.io/HRmit/** once roadmap stage 1 ships. It runs entirely in your browser; nothing is sent anywhere.

## Getting started

Requirements: Node 24+, pnpm (`npm install -g pnpm`), optionally [Ollama](https://ollama.com) for AI features.

```bash
git clone https://github.com/pawelrozanski/HRmit.git
cd HRmit
pnpm install
pnpm dev
```

Open http://localhost:5173. The API runs on `127.0.0.1:3000` and is not reachable from other machines.

Other commands: `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm build:demo`.

## Roadmap and contributing

See [docs/ROADMAP.md](docs/ROADMAP.md). Issues and pull requests are welcome; please keep commits small and follow Conventional Commits.

## License

[MIT](LICENSE) © 2026 Paweł Różański
