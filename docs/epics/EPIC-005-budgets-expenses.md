# EPIC-005: Budgets & Expenses

status: backlog
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

- [ ] **T-050** Schema `budgets`, `budget_lines`, `expense_requests`; amounts in integer minor units; currency from org settings.

### Budget setup & visibility

- [ ] **T-051** Budget setup UI (event → division lines); visibility via permission module: Owner/Admin/Finance all, Head own division only, Staff/External none.

### Expense flow

- [ ] **T-052** Expense request → threshold-routed approval chain (EPIC-004); on approve → committed; on payment marked → actual. State transitions logged.

### Rollup views

- [ ] **T-053** Views: per event, per division, portfolio totals — committed vs actual vs budget, reconciling with line data.

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

- 2026-08-06 Epic created by `/agentic-init` from PLAN §6.8 — pending kickoff.

## Dependencies

- EPIC-004 (T-041 approval service), EPIC-002 (T-020 events). Feeds budget-burn input into EPIC-002's health status (T-023).
