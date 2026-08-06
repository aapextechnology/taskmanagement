# EPIC-006: Executive Dashboard & Activity Log

status: backlog
environment: dev
phase: 2
priority: P1
area: Exec
retries: 0
prd: ../product/PRD.md
stories: ../product/USER-STORIES.md (US-EXEC-1 … US-EXEC-5)
tasks: ../product/ENGINEERING-TASKS.md (T-060 … T-063)

## Goal

The Owner's cockpit: portfolio cards, an inline approvals queue, risk widgets, and an
activity feed on one screen — plus email notifications and the audit UI that complete
the Owner layer.

## User Stories

- **US-EXEC-1** — Portfolio cards: countdown, phase, health, budget burn % per active event.
- **US-EXEC-2** — Pending approvals inline with one-click approve/reject + comment.
- **US-EXEC-3** — Email notifications for the PLAN §6.10 matrix.
- **US-EXEC-4** — Milestones (14 days), cross-division blockers, overdue hotspots, activity feed.
- **US-EXEC-5** — Filterable audit log UI.

## Tasks

### Dashboard core

- [ ] **T-060** `/dashboard` (Owner default landing; Admin read-only optional): portfolio cards + pending-approvals queue with inline approve/reject/comment calling the same EPIC-004 service (no parallel path).

### Risk & activity widgets

- [ ] **T-061** Widgets: upcoming milestones (next 14 days), cross-division blockers, overdue hotspots, recent activity feed — each deep-linking to source records.

### Email notifications

- [ ] **T-062** SMTP transport (dev: mailpit/console): emails for the §6.10 email column (assigned, mentioned, due/overdue, approval requested/decided, external submission, handoff); per-user preferences for opt-in rows.

### Audit UI

- [ ] **T-063** `/admin/audit`: filter by actor, entity type, event, date range; Owner/Admin only.

## Acceptance Criteria

**Epic-level**

- The Owner lands on the dashboard and can clear their approvals queue without leaving it.
- Widget counts match direct queries (tests); every widget links correctly.
- Each email trigger sends exactly once per event in dev transport; opt-outs honored.
- Audit UI reproduces any recorded action's who/what/when; Staff denied.

**Per-task**

- **T-060** — inline decision === EPIC-004 service call (verified in code review + test).
- **T-061** — counts reconcile; links resolve.
- **T-062** — all matrix triggers verified; no duplicate sends.
- **T-063** — filters compose; access gated.

> Each task also satisfies `../DEFINITION-OF-DONE.md`.

## Automation Log

- 2026-08-06 Epic created by `/agentic-init` from PLAN §6.10–§6.12 — pending kickoff. Ticket-sales widget deliberately deferred to EPIC-009 (T-093) per PLAN phasing.

## Dependencies

- EPIC-004 (approvals queue), EPIC-005 (burn %), EPIC-002 (T-024 cards), EPIC-001 (T-014 activity log).
