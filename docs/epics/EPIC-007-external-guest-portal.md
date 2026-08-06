# EPIC-007: External Guest Portal & Forms

status: backlog
environment: dev
phase: 3
priority: P1
area: External
retries: 0
prd: ../product/PRD.md
stories: ../product/USER-STORIES.md (US-EXT-1 … US-EXT-5)
tasks: ../product/ENGINEERING-TASKS.md (T-070 … T-075)

## Goal

Vendors, artist management, venue and sponsor reps, and freelance crew work *inside* the
system — magic-link sign-in, strictly scoped to one event + one division + explicit
assignments, submitting structured forms into a review queue, expirable and fully audited.

## User Stories

- **US-EXT-1** — Heads invite externals by email, scoped event+division+assignments.
- **US-EXT-2** — Magic-link sign-in, no password friction.
- **US-EXT-3** — Guests update status, comment, upload, and fill structured forms.
- **US-EXT-4** — Every submission lands in a review queue (accept / request changes).
- **US-EXT-5** — Invites expire (7 days post-settlement default), are revocable, and all guest actions are audited.

## Tasks

### Schema

- [ ] **T-070** Schema `external_invites` (scope: event + division + assignments, expiry, revoked-at), `form_templates`, `form_submissions`.

### Magic-link auth & invite lifecycle

- [ ] **T-071** Auth.js email provider for guests; Head invite issue/revoke UI; expiry job (node-cron, default 7 days post-settlement); revocation kills sessions immediately.

### Guest portal

- [ ] **T-072** Guest surface: assigned tasks only — status update, comment, deliverable upload. Nothing else renders or resolves.

### Structured forms

- [ ] **T-073** Form renderer + submission for the four types: vendor quotation, technical rider, logistics manifest, crew/guest list; validation + draft persistence.

### Review queue

- [ ] **T-074** Per-division review queue: accept / request changes with comment; round-trips to the guest; reviewer notifications (in-app + email).

### Hardening

- [ ] **T-075** Rate limits on magic-link issuance/redemption; permission fuzz tests on every guest endpoint; all guest actions in the audit log.

## Acceptance Criteria

**Epic-level**

- Scoping tests prove a guest never sees budgets, other vendors, internal tasks, or a second event/division — API-level, not just UI.
- Expired or revoked invites are dead immediately (session + link).
- No external submission reaches task/data state without a review decision.
- Security gate + fuzz suite green; every guest action audited.

**Per-task**

- **T-070** — migrations apply; scope fields non-nullable.
- **T-071** — link signs in; revoke/expire kills access in the same request cycle.
- **T-072** — scoping negative tests green.
- **T-073** — all four forms validate and persist drafts.
- **T-074** — decision round-trip verified both directions.
- **T-075** — rate limits enforced; fuzz finds no leak.

> Each task also satisfies `../DEFINITION-OF-DONE.md`.

## Automation Log

- 2026-08-06 Epic created by `/agentic-init` from PLAN §5, §6.2-adjacent forms — pending kickoff. Highest-risk epic (external access): security-reviewer routing mandatory on every task.

## Dependencies

- EPIC-001 (T-011 Auth.js base), EPIC-003 (tasks/comments/uploads), EPIC-006 (T-062 email for invites).
