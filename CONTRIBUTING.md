# Contributing

Thanks for looking. This project is young — issues, questions, and pull requests
are all welcome, including "this didn't install and here's the error".

## Getting set up

```bash
git clone https://github.com/aapextechnology/taskmanagement.git
cd taskmanagement
cp .env.example .env          # set AUTH_SECRET: openssl rand -base64 32
pnpm install
docker compose up -d db mailpit
pnpm db:migrate && pnpm seed
pnpm dev
```

You now have the app at http://localhost:3000, a mail catcher at
http://localhost:8025, and demo data. Sign in as `owner@example.com` /
`backstage123`.

If a port is taken, override `APP_PORT`, `DB_PORT`, `MAILPIT_UI_PORT`, or
`MAILPIT_SMTP_PORT` in `.env`.

## Before you open a pull request

All four gates must pass — CI runs exactly these:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Add tests for new behaviour. The pure-logic modules are all unit-tested and should
stay that way: the permission matrix, bottleneck scoring, WIB date bucketing, task
progress, and settlement math.

## Two rules that matter more than style

**1. All data access goes through `src/lib/permissions`.**

Capabilities are checked against role × division × context. Pages, server actions,
and API routes never query around the permission module — they resolve the target,
derive its context, and ask. If you add a capability, add its rows to the matrix
test in `src/lib/permissions/permissions.test.ts`, including the negative cases.

A permission gate only decides *whether* someone may act. Where a feature also
exposes data (search, the AI assistant, reports), the data itself is separately
re-scoped for that actor. Keep both halves.

**2. Day bucketing is timezone-explicit.**

"Today" means the same thing for everyone. Dates bucket by a configured timezone
(Asia/Jakarta by default), never the server's local time. Use the helpers in
`src/lib/tasks/dates.ts` rather than `toDateString()` or local getters. When you
write a test for anything date-bucketed, include a case that straddles the UTC
boundary (17:00Z) — that is where naive implementations break.

## Database migrations

Generate them; don't hand-write SQL:

```bash
pnpm db:generate    # writes the .sql file, the journal entry, and a snapshot
pnpm db:migrate
```

Hand-written migrations break Drizzle's snapshot chain, which makes future
`db:generate` runs emit changes that were already applied. If you must hand-write
one (for a data migration, say), say so in the PR so it can be reviewed carefully.

Migrations run automatically on `docker compose up` via a one-shot `migrate`
service, so a fresh clone always lands on the current schema.

## Project layout

```
src/
  app/            Next.js App Router — (app) internal, guest/ portal, api/ routes
  components/     Shared UI (shadcn/ui on Base UI + Tailwind)
  db/             Drizzle schema, migrations, idempotent demo seed
  lib/            Domain services — the real logic lives here
    permissions/  The authorisation module
docs/             PRD, user stories, acceptance criteria, engineering tasks, epics
```

The `docs/` tree describes an example organisation. It is there so the domain
model makes sense to read, not because you must follow that process.

## UI conventions

- Sentence case for headings; reserve uppercase for small labels and table heads.
- No native `<select>` or bare checkboxes for actions — use the styled control set
  (`segmented.tsx`, `choice-chips.tsx`, `ui/switch.tsx`, the pickers).
- Every mutation should confirm itself (toast) and every list should have a real
  empty state.
- Colours come from tokens in `globals.css`. Don't hardcode hex values in
  components.

## Reporting security issues

Please don't open a public issue for a vulnerability. Email the maintainers
instead so it can be fixed before it is described publicly.
