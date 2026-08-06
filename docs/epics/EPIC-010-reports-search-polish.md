# EPIC-010: Reports, Search & Polish

status: backlog
environment: dev
phase: 4
priority: P2
area: Polish
retries: 0
prd: ../product/PRD.md
stories: ../product/USER-STORIES.md (US-POL-1 … US-POL-4)
tasks: ../product/ENGINEERING-TASKS.md (T-100 … T-103)

## Goal

Round out the system: digests that summarize instead of spam, the event settlement
report that closes a concert cleanly, permission-scoped global search, and mobile/PWA
polish for backstage use.

## User Stories

- **US-POL-1** — Opt-in daily digest + weekly executive digest.
- **US-POL-2** — Event settlement report, exportable.
- **US-POL-3** — Global search (⌘K) scoped by permissions.
- **US-POL-4** — Core flows usable on a phone (PWA).

## Tasks

### Digests

- [ ] **T-100** node-cron + SMTP: opt-in daily digest (per-user content) + weekly executive digest for the Owner.

### Settlement report

- [ ] **T-101** Per-event settlement report: budget vs actual by division, approval history, outstanding items; print/PDF export.

### Global search

- [ ] **T-102** ⌘K search across tasks, events, files, people — every result filtered through the permission module.

### Mobile / PWA

- [ ] **T-103** PWA manifest + responsive audit of core flows (My Tasks, task detail, approvals, run of show) + offline-tolerant shell.

## Acceptance Criteria

**Epic-level**

- Digests send on schedule, respect opt-ins, and contain only the recipient's visible data.
- Settlement totals reconcile with EPIC-005 records (test).
- Search never returns a record the user can't open (negative tests per role, incl. External).
- Core flows pass mobile viewport checks; app is installable.

**Per-task**

- **T-100** — schedule + content verified in dev transport.
- **T-101** — reconciliation test green; export clean.
- **T-102** — role-scoped search tests green.
- **T-103** — Lighthouse PWA installability passes; viewport audit documented.

> Each task also satisfies `../DEFINITION-OF-DONE.md`.

## Automation Log

- 2026-08-06 Epic created by `/agentic-init` from PLAN §9 Phase 4 — pending kickoff.

## Dependencies

- EPIC-005/006 (settlement + email base), EPIC-008 (documents in search). Last epic of v1.
