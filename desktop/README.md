# Goshenignite Inventory — Windows desktop app

A standalone Windows build of the same application: one installer, no Docker, no separate database server, no internet connection required after install. It bundles a real PostgreSQL (via [embedded-postgres](https://github.com/leinelissen/embedded-postgres)) that starts automatically in the background, and runs the same backend and frontend code as every other deployment of this project — nothing about the application itself was rewritten.

## How it works

On first launch, the app:

1. Initializes a private PostgreSQL 17 cluster under the Windows user's app-data folder (`%APPDATA%\Goshenignite Inventory\pgdata`) — invisible to, and unrelated to, any PostgreSQL already installed on the machine.
2. Runs the project's normal SQL migrations against it.
3. Shows a one-time setup screen to create the first administrator account (optionally seeded with sample inventory data to explore).
4. Starts the same Express API used everywhere else, configured to also serve the built frontend directly (a small opt-in addition in `backend/src/app.ts`, gated behind `SERVE_FRONTEND_DIR`, which does nothing unless that variable is set — every other deployment is unaffected).
5. Opens a normal application window pointed at that local server.

On every later launch, it skips straight to step 4 — the existing database and account are reused.

## Building the installer

Requires Windows, Node.js 22+, and the repository's root dependencies already installed (`npm ci` at the repo root).

```powershell
cd desktop
npm install
npm run dist:win
```

`dist:win` rebuilds the backend and frontend, assembles a self-contained copy of the backend's production dependencies (isolated from the monorepo's hoisted `node_modules`, matching exactly what ships in the Docker image), and produces an NSIS installer at `desktop/release/GoshenigniteInventorySetup.exe`.

Run `npm run prepare:resources` on its own to refresh the staged build (`desktop/vendor/resources/`) without repackaging — useful while iterating with `npm start`, which runs the app directly from those resources.

## Notable implementation choices

- **`asar: false`.** Electron normally bundles app code into a single-file `app.asar` archive. This app spawns and `chmod`s native PostgreSQL binaries at runtime, which fails from inside an asar archive even with `asarUnpack` configured — disabling asar entirely (app code is a handful of small files) is simpler and more reliable than fighting that interaction.
- **Postgres version pinned to 17.10** (`embedded-postgres@17.10.0-beta.17`) to match the `postgres:17-alpine` used everywhere else in this project.
- **Windows shutdown is a hard kill.** `embedded-postgres` uses `taskkill /f` to stop Postgres on Windows (there's no POSIX SIGINT to send). Postgres's own crash recovery handles this safely on the next launch — a fraction of a second of WAL replay, no data loss — so it isn't worked around here.
- **First-run detection checks the database, not just whether Postgres was initialized.** If the app were ever interrupted between creating the database and finishing setup, checking only "does a Postgres cluster exist" would permanently skip the setup screen. The app instead queries `SELECT 1 FROM users LIMIT 1` after migrating, every launch.
