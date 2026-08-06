# EPIC-006: Executive Dashboard & Activity Log

status: ready-for-qa
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

- [x] **T-060** `/dashboard` (Owner default landing; Admin read-only optional): portfolio cards + pending-approvals queue with inline approve/reject/comment calling the same EPIC-004 service (no parallel path).

### Risk & activity widgets

- [x] **T-061** Widgets: upcoming milestones (next 14 days), cross-division blockers, overdue hotspots, recent activity feed — each deep-linking to source records.

### Email notifications

- [x] **T-062** SMTP transport (dev: mailpit/console): emails for the §6.10 email column (assigned, mentioned, due/overdue, approval requested/decided, external submission, handoff); per-user preferences for opt-in rows.

### Audit UI

- [x] **T-063** `/admin/audit`: filter by actor, entity type, event, date range; Owner/Admin only.

### WhatsApp channel (Owner decision 2026-08-06)

- [x] **T-064** WhatsApp notification adapter behind the same notification service as email (provider: Business Cloud API or gateway — Owner to confirm): mirror high-value triggers (assigned, approval requested/decided, due/overdue, external submission) with per-user opt-in; credentials via env, never in repo.

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

- 2026-08-06 **Owner request: task-progress bar on the portfolio cards.** The rule
  now lives in ONE place — `src/lib/tasks/progress.ts`, unit-tested — and both the
  dashboard card and the Owner's progress-report PDF call it, so an event can never
  show two different completion figures. **Rule: `pct = done / (total − backlog −
  cancelled)`.** Backlog is out of the denominator (an idea, not a commitment) and
  cancelled is out of both sides; **`blocked` deliberately stays in** — it is
  committed, unfinished work, which is exactly what the Owner needs to see.
  Two guards make the number safe on a cockpit: (1) the backlog count is always
  rendered next to the bar, so `100% · +12 backlog` can never be misread as
  "finished"; (2) with **no** committed work the card shows "No tasks planned yet"
  and the PDF "no tasks committed yet" — never a dishonest 0% or 100%.
  Status-weighting (`in_review` = 0.75) was considered and **rejected**: it is
  unexplainable to a crew and invites arguing about the weights.
  **This changed an already-delivered artifact** — the progress-report PDF
  previously counted backlog in the denominator, so its percentage will now read
  higher for events with a groomed backlog. Portfolio counts come from one grouped
  query (`group by event_id, status`), not per-event, to avoid an N+1.
  Verified live against seed data: 1/4 → 25%, 0/36 → 0%, 1/9 with +2 backlog → 11%,
  and an event with only backlog → "No tasks planned yet"; PDF prints
  `25% (1/4 committed tasks done)`, matching its card. Dashboard still measures
  390px at a phone viewport with the extra bar.

- 2026-08-06 **T-060..T-064 done — EPIC COMPLETE → ready-for-qa (Phase 2 complete)** — `/dashboard` (Owner/Admin gate): portfolio cards with countdown/phase/health/**burn-bar** (committed+actual vs planned, amber >90% red >100%), inline approvals queue calling the SAME `decideAction` as the approvals page, milestones-14d (high/urgent), cross-division blockers, overdue hotspots, activity feed. Channel fan-out in `notify()`: email (nodemailer→SMTP; matrix routing — everything except `unblocked`) + WhatsApp adapter (Meta Cloud API when `WHATSAPP_TOKEN`/`WHATSAPP_PHONE_ID` set, no-op otherwise — provider choice still open with Owner); per-user prefs on profiles (`email_notifications` default ON, `whatsapp_notifications` opt-in, migration 0007); fan-out only fires when the in-app row is new (dedup holds across channels) and never fails the caller. **mailpit** added to compose (UI localhost:8025, SMTP 1025) — verified live: `assigned` email landed in mailpit, `unblocked` correctly in-app only. Audit UI `/admin/audit` (filters: actor/entity/event/date, WIB). Ops gotchas: nginx needs a restart after app-container recreate (stale upstream IP → 502); **owner demo account was found deactivated (is_active=false, likely mis-clicked /admin toggle during QA) → reactivated via SQL** — consider a confirm-dialog on that toggle. **Human QA:** open the dashboard as owner, approve something inline, check mailpit at `localhost:8025` (server-side) for the emails; WhatsApp activates once credentials are provided.

- 2026-08-06 **Owner decisions recorded**: notification channels = email + WhatsApp → added T-064 (WhatsApp adapter, P1, depends T-062). Currency = IDR default; threshold figures remain proposed defaults in `app_settings` until Owner confirms.
- 2026-08-06 Epic created by `/agentic-init` from PLAN §6.10–§6.12 — pending kickoff. Ticket-sales widget deliberately deferred to EPIC-009 (T-093) per PLAN phasing.

## Dependencies

- EPIC-004 (approvals queue), EPIC-005 (burn %), EPIC-002 (T-024 cards), EPIC-001 (T-014 activity log).
