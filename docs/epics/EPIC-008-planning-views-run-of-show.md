# EPIC-008: Planning Views, Documents & Run of Show

status: on-progress
environment: dev
phase: 3
priority: P1
area: Planning
retries: 0
prd: ../product/PRD.md
stories: ../product/USER-STORIES.md (US-PLAN-1 … US-PLAN-4)
tasks: ../product/ENGINEERING-TASKS.md (T-080 … T-083)

## Goal

Time-based planning and show-day operations: Gantt timeline with the critical path to
show day, a calendar, the per-event document library, and the minute-by-minute run of
show — replacing planning spreadsheets.

## User Stories

- **US-PLAN-1** — Gantt per event with dependencies and critical path.
- **US-PLAN-2** — Calendar of deadlines, milestones, show dates.
- **US-PLAN-3** — Per-event document library (contracts, permits, riders, stage plots) with division-level access.
- **US-PLAN-4** — Run of show: Production/Ops-owned, all-division readable, printable.

## Tasks

### Timeline (Gantt)

- [ ] **T-080** Per-event timeline: bars from task start/due dates, dependency arrows, critical-path highlight to show day; reflects live task edits.

### Calendar ✅

- [x] **T-081** Calendar view: per-event and global; deadlines, milestones, show dates; entries deep-link to tasks/events.

### Document library

- [ ] **T-082** `documents` schema + `/events/[id]/documents`: upload, categorize (contract / permit / rider / stage plot), division-level access control via permission module; files auth-gated on `/uploads`.

### Run of show

- [ ] **T-083** `run_of_show_items` schema + minute-by-minute editor (doors, opener, changeover, headliner, curfew): Production/Ops write, all divisions read; clean print/export stylesheet.

## Acceptance Criteria

**Epic-level**

- Editing a task's dates/dependencies updates the timeline without reload artifacts.
- Calendar aggregates match underlying data (tests).
- Document access respects division scoping (negative tests); external guests see none of it unless explicitly assigned.
- Run of show prints cleanly (print stylesheet check) and write-access is division-gated.

**Per-task**

- **T-080** — critical path computed correctly on a fixture with parallel chains.
- **T-081** — deep links resolve; global view merges events correctly.
- **T-082** — scoping negative tests green; categories filter.
- **T-083** — write denied for non-Production/Ops (test); export verified.

> Each task also satisfies `../DEFINITION-OF-DONE.md`.

## Automation Log

- 2026-08-06 Epic created by `/agentic-init` from PLAN §6.5–§6.7 — pending kickoff.
- 2026-08-06 /epic-loop EPIC-008 #2 "Calendar" → PASS (attempts: 3), PR: — (no remote; merged to develop locally). Decision: all calendar-day bucketing is explicit WIB via shared `dayKey` (`toWibParts`), grid-cell identity via component-based `cellKey`, today = `dayKey(now)`; review caught server-TZ bucketing twice (west- AND east-of-WIB holes) — lesson: date tests must straddle 17:00Z and run in an east-of-WIB TZ. Deep links reuse `/tasks/[id]` drawer route (no `?task=` param exists).

## Dependencies

- EPIC-003 (T-031 tasks, T-035 dependencies), EPIC-002 (events), EPIC-001 (permissions).
