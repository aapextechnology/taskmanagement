# EPIC-001: Auth, Org & Permissions

status: backlog
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

- [ ] **T-010** Schema `profiles`, `divisions`, `division_members` (user + division + role); migration; idempotent seed of the 11 divisions from PLAN §3.

### Staff authentication

- [ ] **T-011** Auth.js v5 credentials provider (email+password), session strategy, sign-out; login page in RVC theme.

### Central permission module (protected path)

- [ ] **T-012** `src/lib/permissions`: capability checks for the full PLAN §4 matrix (role × division × event). Unit tests per matrix row **including negative cases** (Staff cross-division read denied, non-finance Head reading another division's budget denied, External reaching internal data denied).

### Admin UI

- [ ] **T-013** `/admin`: manage users, divisions, memberships, role assignment; gated to Owner/Admin.

### Activity log foundation

- [ ] **T-014** `activity_log` table + write helper; log all auth, permission, and admin mutations.

### Demo seed

- [ ] **T-015** `pnpm seed`: demo users for all 5 roles across ≥3 divisions + fixture data for dev/smoke (includes `owner@rawvision.demo`).

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

- 2026-08-06 Epic created by `/agentic-init` from PLAN §3–§4 — pending kickoff.

## Dependencies

- EPIC-000 (T-003 Drizzle pipeline, T-004 theme shell).
