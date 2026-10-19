# 0002. SQLite + Drizzle as the only database

Date: 2026-10-19
Status: accepted

## Context

The product promise is "your recruitment data stays home". A single recruiter runs the app on one machine. There is no server to host Postgres on, and asking users to install a database service contradicts "download and run".

## Decision

- SQLite through Node's built-in `node:sqlite` (Node 22.5+; we target Node 24). No native addon to compile, nothing to install.
- Drizzle ORM for the schema and migrations. Migrations run automatically on server start.
- The database file lives in `./data/hrmit.db` (override with `HRMIT_DATA_DIR`). Backup is "copy the folder".
- CV files are stored on disk next to the database, not as blobs, so the DB stays small and a file manager can inspect uploads.

## Consequences

- Zero-config install; the whole user state is one folder.
- Single-writer database. Fine for one user; a team edition would need Postgres, which Drizzle also supports, so the query code would mostly survive.
- WAL mode is enabled for the few concurrent reads the UI makes.
- Deleting a candidate must delete both the row and the file; this is one transaction plus one `unlink`, and the roadmap's security review checks it.
