# EPIC-000: Bootstrap & Foundation

status: ready-for-qa
environment: dev
phase: 0
priority: P0
area: Infra
retries: 0
prd: ../product/PRD.md
stories: ../product/USER-STORIES.md
tasks: ../product/ENGINEERING-TASKS.md (T-001 … T-006)

## Goal

Stand up the Backstage foundation — Next.js app scaffold, self-hosted Postgres via
Docker Compose, Drizzle migrations, the Acme monochrome theme system, CI, and working
gates — so that every feature epic ships against one stack with consistent quality checks.

## User Stories (Developer / Platform)

- **US-PLAT-1** — As a developer, I want a single-app Next.js (App Router, TS) repo with shared types in `src/lib/types`, so that frontend and service layer never drift on contracts.
- **US-PLAT-2** — As a developer, I want one-command local infra (app + Postgres + nginx via Docker Compose), so that I can run the stack instantly.
- **US-PLAT-3** — As a developer, I want CI on every PR (lint + typecheck + build + test), so that broken code can't merge.
- **US-PLAT-4** — As a developer, I want validated env loading + `.env.example`, so that misconfiguration fails fast at boot.
- **US-PLAT-5** — As a designer/developer, I want the Acme design language as theme tokens (dark default), so that every screen is on-brand from its first commit.

## Tasks

### App scaffold & repo layout

- [x] **T-001** Scaffold Next.js (App Router, TypeScript) + Tailwind + shadcn/ui; layout `src/{app,lib,db,components}`; `lint` / `typecheck` / `test` / `build` scripts; pnpm.

### Local dev stack

- [x] **T-002** Docker Compose: app + Postgres + nginx reverse proxy with healthchecks + volumes; `.env.example`; `/api/health` endpoint; make `scripts/deploy-dev.sh` fully functional.

### Database & env foundation

- [x] **T-003** Drizzle ORM + migration pipeline (`drizzle-kit`) + seed script skeleton; validated env loader — boot fails fast with a clear error when a required var is missing.

### Acme theme foundation

- [x] **T-004** Design tokens from the Acme design language (monochrome, dark default + light), typography scale, ↗ motif link/action components, app shell (nav + page frame). No hardcoded colors outside tokens.

### CI pipeline

- [x] **T-005** CI on PR + `develop`: lint + typecheck + build + test with caching; required status check.

### Gates & shared components

- [x] **T-006** Point `scripts/{qa,test,security-check}.sh` at the real project commands; build the shared countdown-timer component (used by every event workspace).

## Acceptance Criteria

**Epic-level**

- A clean clone → `pnpm install` → `pnpm build` is green.
- `scripts/deploy-dev.sh` brings the stack up; `http://localhost:3000/api/health` returns 200.
- CI runs on every PR and blocks merge when red.
- Both themes render; design tokens are the only color source.
- All three gates pass on the scaffold.

**Per-task**

- **T-001** — build + lint green; layout matches target structure.
- **T-002** — compose stack healthy; health endpoint 200; deploy script exits 0.
- **T-003** — a migration applies to local PG; boot with a missing required var fails with a clear message.
- **T-004** — shell renders in dark and light; token audit finds no stray colors.
- **T-005** — an intentionally broken PR goes red; clean PR green.
- **T-006** — gates run real commands and pass; countdown component has a unit test.

> Each task also satisfies the cross-project `../DEFINITION-OF-DONE.md` checklist.

## Automation Log

- 2026-08-09 **Migration-tracking debt repaid (found while testing a
  from-scratch install for the open-source release).** `drizzle.__drizzle_migrations`
  recorded only 20 of 25 migrations — 0020–0024 were hand-applied via psql
  during development and never registered, so any `drizzle-kit migrate`
  failed trying to re-create existing tables. Backfilled the 5 rows
  (SHA256-of-file hash + journal `when`, format verified against already-
  recorded entries #1/#20 before writing). Pure INSERT: no DDL, no data
  touched — events/tasks/users/ai_chats counts unchanged (5/61/14/4), all
  live pages still 200, `drizzle-kit migrate` now exits 0. Backup taken
  first (`~/backup-*.sql`). Separately verified a truly
  blank database migrates to an identical 38-table schema and seeds
  cleanly — the install path works for outside users.

- 2026-08-06 **T-005 + T-006 done — EPIC COMPLETE → ready-for-qa** — CI workflow `.github/workflows/ci.yml` (pnpm cache, lint/typecheck/test/build on PR + develop/main); countdown: pure `src/lib/countdown.ts` (4 unit tests) + `Countdown` client component (SSR-safe, ticks 1s). Gates qa/test/security all PASS; suite 12 tests green. **Human QA notes:** (1) the "broken PR goes red" + required-status-check checks need a GitHub remote — repo has none yet; add origin, push, and mark the check required; (2) visual review of dark/light themes in a browser recommended.
- 2026-08-06 **T-004 done** — Monochrome tokens documented in `globals.css` (dark default `oklch(0.13 0 0)`, tight radius 0.375rem, no accent hues in chrome); next-themes with class attribute + shell toggle (icon swap is pure CSS `dark:` variant — the `setMounted`-in-effect pattern is now an eslint error under react-hooks v7); `ActionLink` ↗ motif, `Logo` lockup, `AppShell`; landing page on-brand. Token audit: zero hardcoded colors outside `globals.css`. Gotcha: pnpm 11 gates dependency build scripts via **`allowBuilds` in `pnpm-workspace.yaml`** (not package.json `pnpm.onlyBuiltDependencies`) — docker `--frozen-lockfile` install fails with ERR_PNPM_IGNORED_BUILDS until esbuild is allowed there. Deployed to DEV; smoke PASS.
- 2026-08-06 **T-003 done** — Drizzle + postgres.js wired; first migration (`app_settings` org config KV) applied to the compose DB (host port 5438) and idempotent seed verified via psql; scripts `db:generate`/`db:migrate`/`seed`. Env loader `src/lib/env.ts` (zod): **lazy singleton via Proxy** — module import never throws (test envs stay clean) but first real access fails fast listing every missing var; 5 unit tests. Gotcha: Next augments `NodeJS.ProcessEnv` (required `NODE_ENV`), so `parseEnv` takes `Record<string, string|undefined>`. Seeded proposed approval thresholds A=10jt/B=100jt IDR — placeholder until Owner confirms (PRD open question).
- 2026-08-06 **T-002 done** — Compose stack (postgres:17 + standalone Next image + nginx:1.27) up healthy; `scripts/deploy-dev.sh` smoke PASS at `http://localhost:3000/api/health` (nginx → app, SSE-ready `proxy_buffering off`). Decisions: Next `output: "standalone"` for the image; **host DB port 5438** — 5432–5437 are all occupied on this dev server, so `DATABASE_URL` for local tooling uses `localhost:5438` while in-network uses `db:5432`.
- 2026-08-06 **T-001 done** — Next.js 16.3 (App Router, TS) + Tailwind 4 + shadcn/ui (radix base) scaffolded on `develop`; layout `src/{app,components,db,lib}` with `lib/types` seed enums; vitest wired (`utils.test.ts`, 3 passing); scripts `lint`/`typecheck` (`next typegen && tsc`)/`test`/`build` all green; gates qa+test+security PASS on real commands. Decision: `typecheck` must run `next typegen` first — Next 16 route types (`LayoutProps`) are generated, plain `tsc` fails without it.
- 2026-08-06 `/agentic-init new` bootstrapped the repo — manifest, gates, `.claude/` wiring, and the full docs set (PRD → stories → AC → tasks → backlog → 11 epics across phases 0–4) synthesized from `docs/PLAN.en.md`. Git repo initialized (`main`); loop disabled by default; no hooks template in kit (skipped gracefully).

## Dependencies

- None (opening epic).
