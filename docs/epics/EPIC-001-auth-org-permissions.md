# EPIC-001: Auth, Org & Permissions

status: ready-for-qa
environment: dev
phase: 1
priority: P0
area: Auth/Org
retries: 0
prd: ../product/PRD.md
stories: ../product/USER-STORIES.md (US-AUTH-1 … US-AUTH-4)
tasks: ../product/ENGINEERING-TASKS.md (T-010 … T-015)

## Goal

Staff of all five roles sign in, the 11-division org structure exists in the system, and
every capability is enforced by one central permission module (`src/lib/permissions`) —
the security core every later epic builds on.

## User Stories

- **US-AUTH-1** — As a Staff member, I want to sign in with email+password, so that I can access my division's workspace.
- **US-AUTH-2** — As an Admin, I want to manage users, divisions, and role assignments, so that the org structure in the tool mirrors reality.
- **US-AUTH-3** — As an Owner, I want every capability enforced by role+division+event scope in one central module, so that no screen can leak data.
- **US-AUTH-4** — As an Admin, I want every permission change and sensitive action recorded, so that we can audit who did what, when.

## Tasks

### Org schema & seed

- [x] **T-010** Schema `profiles`, `divisions`, `division_members` (user + division + role); migration; idempotent seed of the 11 divisions from PLAN §3.

### Staff authentication

- [x] **T-011** Auth.js v5 credentials provider (email+password), session strategy, sign-out; login page in RVC theme.

### Central permission module (protected path)

- [x] **T-012** `src/lib/permissions`: capability checks for the full PLAN §4 matrix (role × division × event). Unit tests per matrix row **including negative cases** (Staff cross-division read denied, non-finance Head reading another division's budget denied, External reaching internal data denied).

### Admin UI

- [x] **T-013** `/admin`: manage users, divisions, memberships, role assignment; gated to Owner/Admin.

### Activity log foundation

- [x] **T-014** `activity_log` table + write helper; log all auth, permission, and admin mutations.

### Demo seed

- [x] **T-015** `pnpm seed`: demo users for all 5 roles across ≥3 divisions + fixture data for dev/smoke (includes `owner@rawvision.demo`).

## Acceptance Criteria

**Epic-level**

- Seeded users of all five roles sign in and land on role-appropriate pages.
- The permission matrix test suite passes, including every negative case.
- No service-layer query bypasses `src/lib/permissions` (spot-checked in review; convention documented).
- Admin manages the org end-to-end; Staff cannot reach `/admin`.
- Every sensitive mutation produces an activity-log row.

**Per-task**

- **T-010** — migration applies; re-running seed changes nothing.
- **T-011** — valid login succeeds; invalid rejected without user enumeration.
- **T-012** — matrix suite green; module is a protected path from this point on.
- **T-013** — role assignment round-trips; unauthorized access denied.
- **T-014** — log rows carry actor, entity, action, timestamp.
- **T-015** — fresh DB + seed produces a demo org usable by every later epic.

> Each task also satisfies `../DEFINITION-OF-DONE.md`.

## Automation Log

- 2026-08-06 **T-013 + T-014 done — EPIC COMPLETE → ready-for-qa** — `/admin` (users table, create user, assign/remove membership, activate/deactivate) with every mutation through `src/lib/org/service.ts` (assertCan + logActivity); `activity_log` table + `logActivity` helper; `auth.signin` events logged. Verified on the DEPLOYED stack (nginx :3000): owner login → session role owner → `/admin` 200; staff → 307 redirect; audit rows present. Docker gotcha: `next build` page-data collection imports env-reading modules — build stage needs placeholder `DATABASE_URL`/`AUTH_SECRET` (postgres.js never connects at build; real values from compose at runtime). **Human QA notes:** exercise the admin forms in a browser; consider forcing password reset flow later (not in scope v1).
- 2026-08-06 **T-012 done** — central permission module: 39-test matrix suite green (incl. all negative cases). Key rules encoded: Admin has NO approval powers; final approval Owner-only; Finance members see all budgets, Heads own-division only, non-finance staff none; externals hard-whitelisted to assigned-task updates + form submit.
- 2026-08-06 **T-010, T-011, T-015 done** — org schema + 11-division seed; Auth.js v5 credentials (scrypt via node:crypto, no-enumeration authorize, JWT carries id+role only — memberships always fresh from DB); demo seed 9 users / 5 roles / 3 divisions (password `backstage123`, DEV only). Curl E2E: valid login ✓, wrong password ✗, external ✗, unauth redirect ✓.
- 2026-08-06 Epic created by `/agentic-init` from PLAN §3–§4 — pending kickoff.

## Dependencies

- EPIC-000 (T-003 Drizzle pipeline, T-004 theme shell).
