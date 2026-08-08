# EPIC-003: Tasks Core & Collaboration

status: ready-for-qa
environment: dev
phase: 1
priority: P0
area: Tasks
retries: 0
prd: ../product/PRD.md
stories: ../product/USER-STORIES.md (US-TASK-1 … US-TASK-7)
tasks: ../product/ENGINEERING-TASKS.md (T-030 … T-037)

## Goal

The MVP heart: division-scoped tasks with kanban and My Tasks, comments and @mentions,
attachments, cross-division handoffs, dependencies, and realtime in-app notifications —
so a division runs its entire event workload in the system instead of WhatsApp.

## User Stories

- **US-TASK-1** — My Tasks (today / this week / overdue) as the staff landing page.
- **US-TASK-2** — Kanban per division per event with the six-status flow.
- **US-TASK-3** — Tasks carry assignees, watchers, priority, dates, checklist, labels, attachments.
- **US-TASK-4** — Comments with @mentions keep discussion on the task.
- **US-TASK-5** — Cross-division handoffs: request → accept → linked dependency.
- **US-TASK-6** — In-app notifications so nobody polls boards.
- **US-TASK-7** — Dependencies and recurring tasks model real sequencing.

## Tasks

### Task schema

- [x] **T-030** Schema `tasks`, `task_assignees`, `task_watchers`, `task_dependencies`, `task_checklist_items`, `labels`; status enum Backlog → To do → In progress → In review → Blocked → Done.

### Task service & CRUD

- [x] **T-031** Task service + detail UI (drawer): status flow, priority, start/due dates, checklist, labels — every read/write through `src/lib/permissions`.

### Views: kanban & list

- [x] **T-032** Kanban per division per event (drag-drop persists status) + list view with per-user saved filters.

### My Tasks

- [x] **T-033** `/my-tasks` landing: today / this week / overdue buckets; default post-login route for Staff.

### Comments & attachments

- [x] **T-034** Comments with @mention typeahead (scoped to users the author may see); attachments upload/download auth-gated on `/uploads`.

### Dependencies & recurrence

- [x] **T-035** Blocked-by / blocks links; completing a blocker fires "unblocked"; recurring tasks spawn next instances via cron.

### Cross-division handoffs

- [x] **T-036** Handoff request → receiving Division Head accept/decline → on accept, a linked task appears on their board as a dependency of the origin task.

### In-app notifications (SSE)

- [x] **T-037** `notifications` table + SSE stream + bell UI; triggers: assigned, @mentioned, due in 24h, overdue, unblocked, handoff request (PLAN §6.10 in-app column).

## Acceptance Criteria

**Epic-level**

- A Staff member completes the "My Tasks → do → done" loop; a new user understands it in under 5 minutes (human QA check).
- Handoff flow matches the worked example in `../product/ACCEPTANCE-CRITERIA.md`; External role denied (test).
- Notifications arrive over SSE in < 5s without reload.
- Every mutation is permission-scoped by division+event (negative tests per surface).
- Task activity (create/status/assign) lands in the activity log.

**Per-task**

- **T-030** — migrations apply; enum + FK constraints hold.
- **T-031** — cross-division mutation denied (test); checklist/labels round-trip.
- **T-032** — drag persists; saved filters survive re-login.
- **T-033** — buckets match seeded due dates exactly.
- **T-034** — mention notifies; attachment access auth-gated.
- **T-035** — unblocked event fires; recurrence spawns exactly one next instance.
- **T-036** — accept creates linked dependency; decline notifies requester.
- **T-037** — all six triggers verified end-to-end.

> Each task also satisfies `../DEFINITION-OF-DONE.md`.

## Automation Log

- 2026-08-06 **Full demo seeder** (`src/db/seed-data.ts` + runner) — 3 events (planning/promotion/settlement), 12 internal users across 6 divisions + 1 external, 20 tasks covering all statuses/priorities/labels/deps/checklists/recurrence, comments w/ mentions, pending+accepted handoffs, seeded notifications. Idempotent (fixed UUIDs; checklists delete+reinsert). Note: seeder never overwrites user edits — YE Live had been archived+advanced during human QA and was manually restored to demo state (planning, unarchived) via SQL.

- 2026-08-06 **T-030..T-037 done — EPIC COMPLETE → ready-for-qa (MVP complete)** — 11 new tables (migration 0004); task service with scoped fetch (division view OR assignment) + `handoff.decide` capability (65-case permission suite total 59 tests green). Kanban: native HTML5 drag-drop, optimistic + server-action persist. My Tasks: WIB bucketing (`bucketForDue`, unit-tested) as default landing. Comments with @-typeahead mention (mentions of externals filtered server-side); attachments 20 MB whitelist via auth-gated /api/files. Recurrence spawns exactly one next instance on completion; completing the last blocker notifies "unblocked". Handoffs: request → receiving-Head accept creates linked task + dependency on origin. Notifications: table w/ dedup keys + SSE stream (4s poll, nginx buffering off) + bell UI; hourly cron sweeps due-soon/overdue (assignee + division Head). Health now reads real signals — seeded overdue task flipped demo event to **at_risk** live. Verified on your-domain.example: owner+staff page matrix 200s, staff sees only own-division board tabs, SSE frames arrive. **Human QA notes:** (1) drag a card between columns in the browser (drag-drop not curl-testable); (2) mention someone and watch their bell update within ~5s; (3) upload an attachment; (4) run one handoff request→accept round-trip as marketing→production; (5) "<5 minutes to understand My Tasks" check with a fresh user.
- 2026-08-06 Epic created by `/agentic-init` from PLAN §6.3–§6.5, §6.10 — pending kickoff.

## Dependencies

- EPIC-001 (T-012 permissions), EPIC-002 (T-020 events). Completing this epic completes the MVP (EPIC-000 → 003).
