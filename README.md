# Backstage — event & task management for production teams

Self-hosted task management built for organisations that run **events**: concerts,
festivals, conferences. Where a generic task tracker gives you a board, this gives
you the things event teams actually fight with — a countdown to show day, approval
chains for money, cross-division handoffs, dependency bottlenecks, and a settlement
report that closes the books.

Built with Next.js (App Router), PostgreSQL, and Drizzle ORM. Ships as a Docker
Compose stack: one command to a running install.

> **Status: early.** This runs a real production office day-to-day, but it is a
> young open-source project. Expect rough edges, no upgrade path between versions
> yet, and breaking changes. Self-hosters welcome; read the security notes below
> before exposing it to the internet.

---

## What it does

**Events as first-class objects.** Every event carries a live countdown, an editable
workflow (Planning → Pre-production → Promotion → Show week → Show day → Settlement),
a health status that recomputes itself, and its own board, list, schedule, budget,
documents, run-of-show, and wiki pages.

**Tasks with the awkward parts handled.** Per-division boards, a Lead/PIC distinct
from the assignee list, checklists with their own dates, labels, recurring tasks,
@mentions with attachments, and **dependencies that cross divisions and events** —
including waits on outside parties (permits, vendors) that nobody can mark done for
you.

**Bottlenecks that escalate themselves.** A task many others wait on is scored by
fan-in. Cross a threshold and it turns red, auto-bumps to urgent (reversibly, and a
human's manual change always wins), and lands on a ranked panel for leadership.

**Money with a paper trail.** Budget lines per division, expense requests that flow
a configurable approval chain by amount, and a settlement report reconciling planned
vs committed vs paid.

**Outside collaborators without accounts.** Magic-link guest portal scoped to one
division, with forms and a review queue.

**An AI assistant that reasons over your data.** Ask whether an event will run
smoothly and get a verdict with grounded reasons — time pressure, dependency load,
one person carrying too much, unresolved external waits, budget burn, ticket pace.
Optional; the app runs fine without it.

Also: permission-scoped global search (⌘K), daily/weekly email digests, PDF progress
and settlement reports, an audit log, and an installable PWA for backstage phones.

---

## Quick start

Requires Docker and Docker Compose.

```bash
git clone https://github.com/aapextechnology/taskmanagement.git
cd taskmanagement
cp .env.example .env
docker compose up -d
```

The stack migrates the database on first boot and comes up at
**http://localhost:3000**.

Load demo data (optional, but the fastest way to see what the app does):

```bash
pnpm install && pnpm seed
```

Demo accounts all use the password `backstage123`:

| Account | Role |
| --- | --- |
| `owner@example.com` | Owner — sees everything |
| `admin@example.com` | Admin |
| `head.production@example.com` | Division head |
| `staff.production@example.com` | Division staff |

**Delete the demo users before real use.** They have a published password.

---

## Configuration

All configuration is environment variables — see `.env.example`.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string (required) |
| `AUTH_SECRET` | Session signing secret (required) — `openssl rand -base64 32` |
| `APP_URL` / `AUTH_URL` | Public URL. Set both when serving behind a domain or reverse proxy |
| `ORG_NAME` / `ORG_SHORT_NAME` / `PRODUCT_NAME` | First-boot branding; editable later in Admin |
| `SMTP_*` | Outgoing email. The dev stack includes Mailpit at `localhost:8025` |
| `UPLOADS_DIR` | Where uploaded files land |
| `OPENAI_API_KEY` | Optional — enables the AI assistant. Empty disables it cleanly |
| `OPENAI_MODEL` | Model id for the assistant |

### Branding

The app carries **your** organisation's name, not ours. Set `ORG_NAME`,
`ORG_SHORT_NAME`, and `PRODUCT_NAME` for a fresh install, then change them any time
in **Admin → Organisation branding**. The name flows to the sidebar, page titles,
the installable app name, notification and digest emails, guest invitations, PDF
report headers, and the AI assistant's own description of who it works for.

---

## Security notes

Read this before putting the app on the public internet.

- **Change `AUTH_SECRET`.** The compose file ships a placeholder so a local
  `docker compose up` works out of the box. It is not a secret.
- **Delete the demo users** (`pnpm seed` data) — the password is in this README.
- **Change the Postgres password** in `docker-compose.yml`; it is a development
  default and the database port is exposed for local tooling.
- **Terminate TLS in front of the app.** Nothing here does HTTPS on its own.
- Secrets belong in `.env`, which is gitignored. Never commit one.
- Uploaded files are served through an authenticated route, not the public
  filesystem — keep it that way if you modify file handling.

---

## Architecture

```
src/
  app/            Next.js App Router — (app) internal, guest/ portal, api/ routes
  components/     Shared UI (shadcn/ui on Base UI + Tailwind)
  db/             Drizzle schema, migrations, idempotent demo seed
  lib/            Domain services — the real logic lives here
    permissions/  THE authorisation module: every read/write goes through it
```

Two rules worth knowing before you contribute:

1. **All data access goes through `src/lib/permissions`.** Capabilities are checked
   against role × division × context, with an exhaustive test matrix. Pages and API
   routes never query around it.
2. **Day bucketing is timezone-explicit.** Dates bucket by a configured timezone
   (Asia/Jakarta by default), not the server's local time, so "today" means the same
   thing everywhere.

### Development

```bash
pnpm install
docker compose up -d db mailpit   # Postgres + a mail catcher
pnpm db:migrate && pnpm seed
pnpm dev
```

Quality gates — all of these must pass:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

---

## Contributing

Issues and pull requests are welcome. Please run the gates above before opening a
PR, and add tests for new behaviour — the permission matrix and the pure-logic
modules (scoring, date bucketing, progress, settlement math) are all unit-tested and
should stay that way.

When adding a migration, use `pnpm db:generate` rather than hand-writing SQL, so
Drizzle's snapshot chain stays consistent.

## License

MIT — see [LICENSE](LICENSE).
