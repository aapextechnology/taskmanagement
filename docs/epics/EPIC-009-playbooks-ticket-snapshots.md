# EPIC-009: Playbooks & Ticket Snapshots

status: backlog
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

- [ ] **T-090** Schema `event_templates` (items: division, title, show-day offset, priority) + Admin template editor at `/admin/templates`.

### Default playbook content

- [ ] **T-091** Author the "International Concert" playbook: standard checklist per all 11 divisions with realistic lead times (e.g. Legal permits with long offsets, Production technical advance) — derived from PLAN §3 responsibilities; human-reviewed before seeding.

### Generation

- [ ] **T-092** Create-event-from-template: generate tasks into the right divisions with due dates computed from show-day offsets; template edits never mutate already-generated events.

### Ticket snapshots

- [ ] **T-093** Schema `ticket_sales_snapshots` + daily manual entry UI for Ticketing + sales-curve chart on the executive dashboard.

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
