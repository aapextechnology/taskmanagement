# EPIC-009: Playbooks & Ticket Snapshots

status: ready-for-qa
environment: dev
phase: 3
priority: P1
area: Playbooks
retries: 0
prd: ../product/PRD.md
stories: ../product/USER-STORIES.md (US-TMPL-1 … US-TMPL-3)
tasks: ../product/ENGINEERING-TASKS.md (T-090 … T-093)

## Goal

The biggest "fast to use" lever: creating an event from the "International Concert"
playbook auto-generates every division's standard checklist with lead times — plus daily
manual ticket-sales snapshots feeding the executive dashboard.

## User Stories

- **US-TMPL-1** — Editable per-division checklist templates with show-day offsets.
- **US-TMPL-2** — Create-from-template generates the event's tasks automatically.
- **US-TMPL-3** — Daily manual ticket-sales snapshots per event.

## Tasks

### Template schema & editor

- [x] **T-090** Schema `event_templates` (items: division, title, show-day offset, priority) + Admin template editor at `/admin/templates`.

### Default playbook content

- [x] **T-091** Author the "International Concert" playbook: standard checklist per all 11 divisions with realistic lead times (e.g. Legal permits with long offsets, Production technical advance) — derived from PLAN §3 responsibilities; human-reviewed before seeding.

### Generation

- [x] **T-092** Create-event-from-template: generate tasks into the right divisions with due dates computed from show-day offsets; template edits never mutate already-generated events.

### Ticket snapshots

- [x] **T-093** Schema `ticket_sales_snapshots` + daily manual entry UI for Ticketing + sales-curve chart on the executive dashboard.

## Acceptance Criteria

**Epic-level**

- A new event from the playbook lands with every division's checklist, dated off show day (fixture test with a known show date).
- Editing the template afterward changes only future generations.
- Snapshot entry is Ticketing/Admin/Owner-gated; the dashboard curve matches entered data.

**Per-task**

- **T-090** — template CRUD round-trips; items carry division+offset.
- **T-091** — playbook covers all 11 divisions; reviewed sign-off noted in this log.
- **T-092** — generation test green incl. date math across month boundaries.
- **T-093** — chart matches fixtures; permission-gated.

> Each task also satisfies `../DEFINITION-OF-DONE.md`.

## Automation Log

- 2026-08-06 Epic created by `/agentic-init` from PLAN §6.2, §6.11 — pending kickoff. Ticketing-API integration explicitly out of scope (PRD open question); manual snapshots only.

## Dependencies

- EPIC-003 (task service for generation), EPIC-006 (dashboard for the sales widget).

- **2026-08-06 — T-090..T-093 done (all gates PASS) → ready-for-qa.**
  - Schema: migration `0018_playbooks-ticket-snapshots.sql` — `event_templates`, `event_template_items` (division, title, priority, `offset_days` = days before show, sort), `ticket_sales_snapshots` (unique per event+WIB day, upsert).
  - Permissions: new `tickets.record` capability (owner/admin + ticketing-sales members); matrix tests extended — 148/148 pass. Templates CRUD gated `org.manage`; apply gated `event.create`.
  - Editor: `/admin/templates` — template tabs, add-item form (division chips, H− offset, priority picker), per-item delete.
  - Playbook: "International Concert" seeded — 36 items across all 11 divisions, lead times H−180…H−3 (legal permits H−90 urgent, talent contracts H−120, etc.). Seed idempotent (fixed UUID …ee001).
  - Generation: `applyTemplate` copies items into tasks, due = showDate − offset·day; dedupe on division+lowercased title makes it idempotent. Verified E2E on a throwaway event: apply#1 {created:36, skipped:0}, apply#2 {created:0, skipped:36}; permit due exactly H−90; 11 divisions covered. Template edits never touch generated events (copy semantics). Wired into `/events/new` (playbook chip selector) and event page ("Apply playbook").
  - Tickets: `/events/[id]/tickets` — totals (sold/%cap/revenue), daily bar chart, gated entry form (WIB day key). Dashboard "Ticket sales" widget with last-14-day mini bars via `portfolioSales`. 7 demo days seeded for Neon Horizon (4,875 sold). Guard verified: production staff denied `tickets.record`.
  - Gates: lint ✅ (removed unused import) · typecheck ✅ · tests 148 ✅ · build ✅ · deployed to DEV, live pages 200 (owner cookie).

- 2026-08-13 — Tessera API health badge on the Tickets Connect tab: pure verdict
  `apiHealth()` in `src/lib/tessera/health.ts` over the STORED status (hourly sync +
  admin tests keep it ≤1h fresh) — rendering never spends a call on the unofficial
  API. Countdown beats last-call outcome: a token past its ~5-day life is `expired`
  even if the final sync succeeded; stored 401 → `expired` with re-paste pointer;
  other errors surface verbatim; token-but-never-tested is `error`, never `live`.
  7 unit tests; verified live (state `live`, ~5 days left).
