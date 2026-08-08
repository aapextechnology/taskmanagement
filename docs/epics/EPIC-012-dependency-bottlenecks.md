# EPIC-012: Dependency Bottlenecks & External Waits

status: ready-for-qa
environment: dev
phase: 4
priority: P1
area: Tasks
retries: 0
prd: ../product/PRD.md
stories: ../product/USER-STORIES.md (US-DEP-1 … US-DEP-4)
tasks: ../product/ENGINEERING-TASKS.md (T-120 … T-124)

## Goal

Make bottlenecks visible and escalate them automatically. Dependencies become
cross-division **and cross-event**; a task many others wait on turns red, is
auto-bumped to Urgent, and lands on an Owner/CEO "Bottlenecks" panel. Waits on
parties outside the system (permits, vendors, sponsors) are tracked as
**external dependencies** — informational, manually check-off-able.

Owner decisions locked 2026-08-07:

1. **Priority auto-bump: YES** — critical bottleneck ⇒ priority `urgent`,
   with guardrails: previous priority stored, bump logged as `system` in the
   activity feed, and auto-reverted when the bottleneck clears **unless** a
   human changed priority after the bump (manual always wins).
2. **Status stays manual** — open dependencies show a separate "Waiting on N"
   indicator; they never force status `blocked`.
3. **External check-off: any member of the task's division** (`task.edit`).
4. **Critical threshold: ≥3 open waiters, OR ≥1 waiter while the blocker
   itself is overdue or `blocked`.**

## The semantics (direction matters)

- "X depends on Y" = Y blocks X. The **critical** one is Y (fan-in: how many
  open tasks wait on it), not X.
- X shows "Waiting on N" (grey indicator); Y shows "N tasks waiting on this"
  and is the one that turns red / gets bumped / hits the Owner panel.
- A task is **clear** only when all internal blockers are `done` AND all
  external dependencies are checked off → assignees get the "Unblocked"
  notification (extends the existing `onTaskCompleted` flow).

## User Stories

- **US-DEP-1** — As a division member, I can add a dependency on any task in
  any division or event, so my wait is tracked instead of remembered.
- **US-DEP-2** — As a blocking team, we see and get notified that others wait
  on our task, so we know we are the bottleneck.
- **US-DEP-3** — As the Owner/CEO, I see a ranked red list of critical
  bottlenecks (who waits on whom, across divisions/events) to discuss.
- **US-DEP-4** — As a division member, I can record a wait on an external
  party (no system access) and check it off myself when it's delivered.

## Tasks

### Schema & service core

- [x] **T-120** Schema `task_external_dependencies` (taskId, label, party,
  note, resolvedAt/resolvedBy, createdBy) + migration. Service: drop the
  same-event guard on `addDependency`, full cycle detection (DFS, any depth),
  new `removeDependency`, external-dep CRUD + check-off (`task.edit` on the
  task's division), unblock check extended to require external deps resolved.

### Bottleneck scoring & auto-priority

- [x] **T-121** Pure scoring module: `waiters(taskId)` = open dependents;
  levels none / bottleneck (1–2) / **critical** (≥3, or ≥1 + blocker
  overdue/`blocked`). Auto-bump: on becoming critical set priority `urgent`
  (store `priorityBeforeAuto`, log `system` activity); on clearing revert
  unless priority was manually changed after the bump. Unit tests for the
  matrix incl. revert-vs-manual-override.

### Task drawer UI

- [x] **T-122** Drawer sections: "Blocked by" (internal deps with live status
  chips + external deps with styled check-off, per the no-basic-controls
  rule) and "Blocking" (reverse list with waiter count). Remove-edge action.
  Cross-event deps get an EventChip.

### Surfaces & notifications

- [x] **T-123** Board/list card badge ("Waiting on N" grey · "N waiting" red
  when critical). Dashboard: replace "Cross-division blockers" with ranked
  **Bottlenecks** panel (waiter count, division, event, red = critical).
  One-time notification to the blocker task's assignees when a new dependent
  is added. Cross-event edges listed under the Gantt (arrows stay per-event).

### Verification

- [x] **T-124** Tests: permission matrix additions, scoring + auto-bump unit
  tests, cycle-detection test, role-scoped E2E (member adds cross-division
  dep; external check-off; Owner sees ranked panel; bump + revert observed in
  activity log).

## Acceptance Criteria

**Epic-level**

- A task waited on by ≥3 open tasks (or overdue with ≥1 waiter) shows red,
  has priority `urgent` (auto, logged), and appears on the Owner panel.
- When its last waiter clears (or it completes), priority reverts to the
  stored value unless manually overridden meanwhile — verified via activity log.
- External dependency blocks the "Unblocked" notification until checked off;
  any division member can check it off; check-off is logged with actor.
- No dependency cycle of any length can be created (test).
- All new reads/writes go through `src/lib/permissions`; cross-event edges
  only visible when both ends are visible to the actor.

**Per-task** — see Exit column in `../product/ENGINEERING-TASKS.md` (T-120…T-124).

> Each task also satisfies `../DEFINITION-OF-DONE.md`.

## Automation Log

- **2026-08-07 — T-120..T-124 done (all gates PASS) → ready-for-qa.**
  - Schema: migration `0020_dependency-bottlenecks.sql` — `task_external_dependencies` + `tasks.priority_before_auto`/`auto_urgent_at`.
  - Service: same-event guard dropped (cross-division/event deps), BFS cycle detection any depth, `removeDependency`, external-dep CRUD + check-off (`task.edit`), unblock notification now gated on internal blockers done AND external deps resolved (dedup-keyed).
  - Engine: `bottleneck-math.ts` (pure, 10 unit tests) + `dependency-engine.ts` (recompute, hourly sweep in cron, badge batch). Auto-bump logs `task.priority_auto_bump` / `_revert` as system (actorId null); manual priority edit clears flags via `updateTaskFields`.
  - UI: drawer DependencySection (search-picker via permission-scoped /api/search, styled check-off — old native `<select>` DependencyForm deleted per no-basic-controls); board/list `DependencyBadge` (⧗ waiting / N↩ red); dashboard **Bottlenecks — most waited-on** panel (replaces status-based blockers; shows auto-urgent tag); cross-event edges listed under Gantt.
  - Verified: E2E script 16/16 PASS on dev DB — bump at exactly 3rd waiter (cross-event edge counted), system activity rows, direct + transitive cycle rejected, Owner panel ranks critical, external dep blocks unblock until check-off, cross-division check-off denied, auto-revert on close, manual override survives, removeDependency. Gates: lint/typecheck/179 tests/build ✅; deployed DEV, live pages 200 (owner session).

- 2026-08-07 Epic planned from Owner concern (bottleneck visibility, external
  waits). Design decisions recorded in Goal section — auto-bump WITH revert
  guardrail chosen by Owner over badge-only recommendation; status stays
  manual; external check-off open to division members; threshold ≥3-or-overdue.
  Pending Owner go to flip `backlog` → `on-progress`.

## Dependencies

- T-035 (task dependencies, EPIC-003), T-037 (notifications), T-060
  (dashboard), EPIC-008 Gantt. No schema changes to existing tables except
  additive columns on `tasks` for the priority-revert bookkeeping
  (`priority_before_auto`, `auto_urgent_at`).
