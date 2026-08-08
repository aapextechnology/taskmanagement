# EPIC-005: Budgets & Expenses

status: ready-for-qa
environment: dev
phase: 2
priority: P1
area: Finance
retries: 0
prd: ../product/PRD.md
stories: ../product/USER-STORIES.md (US-BUD-1 … US-BUD-4)
tasks: ../product/ENGINEERING-TASKS.md (T-050 … T-053)

## Goal

Structured spend: event budgets broken into division lines, expense requests flowing
through the approval engine, and committed-vs-actual visibility for Finance and the
Owner — with financial data scoped exactly per the permission matrix.

## User Stories

- **US-BUD-1** — Budget per event with division budget lines.
- **US-BUD-2** — Expense requests (amount, vendor, justification, quote) through approval chains.
- **US-BUD-3** — Committed vs actual vs budget per event and portfolio-wide.
- **US-BUD-4** — A Head sees only their own division's lines.

## Tasks

### Schema

- [x] **T-050** Schema `budgets`, `budget_lines`, `expense_requests`; amounts in integer minor units; currency from org settings.

### Budget setup & visibility

- [x] **T-051** Budget setup UI (event → division lines); visibility via permission module: Owner/Admin/Finance all, Head own division only, Staff/External none.

### Expense flow

- [x] **T-052** Expense request → threshold-routed approval chain (EPIC-004); on approve → committed; on payment marked → actual. State transitions logged.

### Rollup views

- [x] **T-053** Views: per event, per division, portfolio totals — committed vs actual vs budget, reconciling with line data.

## Acceptance Criteria

**Epic-level**

- An expense above threshold B reaches the Owner; below A stops at the Head (integration tests).
- available → committed → actual totals reconcile at line, division, event, portfolio levels (property-based or fixture tests).
- Visibility matrix enforced with negative tests (Head cross-division denied; Staff/External denied).
- Every financial mutation appears in the activity log.

**Per-task**

- **T-050** — migrations apply; no floating-point money anywhere.
- **T-051** — visibility tests green.
- **T-052** — full flow: request → chain → committed → actual.
- **T-053** — rollups reconcile in tests.

> Each task also satisfies `../DEFINITION-OF-DONE.md`.

## Automation Log

- 2026-08-06 **T-050..T-053 done — EPIC COMPLETE → ready-for-qa** — `budgets` (one per event, unique) + `budget_lines` + `expense_requests` (migration 0006), integer IDR everywhere. Money flow: planned → committed (approval chain fully approved, synced from EPIC-004 `decide()` via lazy import) → actual (`markExpensePaid`). New caps `budget.manage` + `expense.markPaid` = owner/admin/finance members (75 tests green). Committed/actual always DERIVED from expense rows, never stored. Budget burn now feeds event health (`budgetHealthSignals` → gatherSignals). Live service E2E verified: line guard (head cannot manage), full flow pending→committed→paid with correct rollups, visibility matrix (marketing head blind to production lines, staff sees no lines but own expenses), pay guard. UI: `/events/[id]/budget` — totals strip (Planned/Committed/Actual/Remaining), per-line table with over-budget highlighting, line management (finance), expense form wired into the approval engine with "chain ↗" links, Mark-paid button. Demo: 6 lines across 2 events + 2 expenses linked to the pending demo approvals. Seed gotcha: budgets are unique per event — resolve the existing budget id instead of assuming the fixed seed id. **Human QA:** approve "PA system rental" as head.production@ + head.finance@ → watch it turn Committed on the budget page → Mark paid as finance → Actual moves; check a Head sees only their division's lines.

- 2026-08-06 Epic created by `/agentic-init` from PLAN §6.8 — pending kickoff.

## Dependencies

- EPIC-004 (T-041 approval service), EPIC-002 (T-020 events). Feeds budget-burn input into EPIC-002's health status (T-023).
