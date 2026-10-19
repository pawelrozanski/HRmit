# Architecture Decision Records

Short records of decisions that are hard to reverse. One file per decision, numbered, never edited after acceptance; a change gets a new ADR that supersedes the old one.

| #                                      | Decision                                                 | Status   |
| -------------------------------------- | -------------------------------------------------------- | -------- |
| [0001](0001-stack.md)                  | React + Vite, Hono, pnpm monorepo                        | accepted |
| [0002](0002-sqlite.md)                 | SQLite + Drizzle as the only database                    | accepted |
| [0003](0003-demo-mode-msw.md)          | Demo mode is the real frontend with MSW                  | accepted |
| [0004](0004-ai-assistant-not-judge.md) | AI assists, never decides                                | accepted |
| [0005](0005-byok-anonymization.md)     | Local AI by default, BYOK cloud only after anonymization | accepted |
| [0006](0006-license-mit.md)            | MIT license                                              | accepted |

Template:

```
# NNNN. Title
Date: YYYY-MM-DD
Status: proposed | accepted | superseded by NNNN

## Context
## Decision
## Consequences
```
