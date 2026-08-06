# EPIC-000: Bootstrap & Foundation

status: on-progress
environment: dev
phase: 0
priority: P0
area: Infra
retries: 0
prd: ../product/PRD.md
stories: ../product/USER-STORIES.md
tasks: ../product/ENGINEERING-TASKS.md (T-001 … T-006)

## Goal

Stand up the RVC Backstage foundation — Next.js app scaffold, self-hosted Postgres via
Docker Compose, Drizzle migrations, the RVC monochrome theme system, CI, and working
gates — so that every feature epic ships against one stack with consistent quality checks.

## User Stories (Developer / Platform)

- **US-PLAT-1** — As a developer, I want a single-app Next.js (App Router, TS) repo with shared types in `src/lib/types`, so that frontend and service layer never drift on contracts.
- **US-PLAT-2** — As a developer, I want one-command local infra (app + Postgres + nginx via Docker Compose), so that I can run the stack instantly.
- **US-PLAT-3** — As a developer, I want CI on every PR (lint + typecheck + build + test), so that broken code can't merge.
- **US-PLAT-4** — As a developer, I want validated env loading + `.env.example`, so that misconfiguration fails fast at boot.
- **US-PLAT-5** — As a designer/developer, I want the RVC design language as theme tokens (dark default), so that every screen is on-brand from its first commit.

## Tasks

### App scaffold & repo layout

- [x] **T-001** Scaffold Next.js (App Router, TypeScript) + Tailwind + shadcn/ui; layout `src/{app,lib,db,components}`; `lint` / `typecheck` / `test` / `build` scripts; pnpm.

### Local dev stack

- [ ] **T-002** Docker Compose: app + Postgres + nginx reverse proxy with healthchecks + volumes; `.env.example`; `/api/health` endpoint; make `scripts/deploy-dev.sh` fully functional.

### Database & env foundation

- [ ] **T-003** Drizzle ORM + migration pipeline (`drizzle-kit`) + seed script skeleton; validated env loader — boot fails fast with a clear error when a required var is missing.

### RVC theme foundation

- [ ] **T-004** Design tokens from the RVC design language (monochrome, dark default + light), typography scale, ↗ motif link/action components, app shell (nav + page frame). No hardcoded colors outside tokens.

### CI pipeline

- [ ] **T-005** CI on PR + `develop`: lint + typecheck + build + test with caching; required status check.

### Gates & shared components

- [ ] **T-006** Point `scripts/{qa,test,security-check}.sh` at the real project commands; build the shared countdown-timer component (used by every event workspace).

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

- 2026-08-06 **T-001 done** — Next.js 16.3 (App Router, TS) + Tailwind 4 + shadcn/ui (radix base) scaffolded on `develop`; layout `src/{app,components,db,lib}` with `lib/types` seed enums; vitest wired (`utils.test.ts`, 3 passing); scripts `lint`/`typecheck` (`next typegen && tsc`)/`test`/`build` all green; gates qa+test+security PASS on real commands. Decision: `typecheck` must run `next typegen` first — Next 16 route types (`LayoutProps`) are generated, plain `tsc` fails without it.
- 2026-08-06 `/agentic-init new` bootstrapped the repo — manifest, gates, `.claude/` wiring, and the full docs set (PRD → stories → AC → tasks → backlog → 11 epics across phases 0–4) synthesized from `docs/PLAN.en.md`. Git repo initialized (`main`); loop disabled by default; no hooks template in kit (skipped gracefully).

## Dependencies

- None (opening epic).
