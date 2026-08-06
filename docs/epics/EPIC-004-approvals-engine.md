# EPIC-004: Approvals Engine

status: backlog
environment: dev
phase: 2
priority: P1
area: Approvals
retries: 0
prd: ../product/PRD.md
stories: ../product/USER-STORIES.md (US-APPR-1 … US-APPR-4)
tasks: ../product/ENGINEERING-TASKS.md (T-040 … T-043)

## Goal

A generic, configurable multi-step approval engine — expenses by threshold tier, artist
offers, contracts, sponsorship deals, public content — so sign-off is structured,
traceable, and never ad-hoc.

## User Stories

- **US-APPR-1** — Submit a typed request into the right chain automatically.
- **US-APPR-2** — Approvers approve / reject / request changes with a comment.
- **US-APPR-3** — Chains and thresholds configurable per type without code changes.
- **US-APPR-4** — Requesters see chain position and full history.

## Tasks

### Schema & chain configuration

- [ ] **T-040** Schema `approvals`, `approval_steps`; org-settings storage for chain definitions, thresholds A/B, and currency; chain resolution per PRD Appendix B defaults, unit-tested.

### Approval service

- [ ] **T-041** Service: create typed request → resolve chain → advance step-by-step; approve / reject / request-changes with required comment on non-approve; full immutable history.

### Approval UI

- [ ] **T-042** Request submission surfaces + `/approvals` approver queue + per-request status/history view.

### Notifications

- [ ] **T-043** In-app triggers: requested → current approver; decided → requester (deep links; email joins in T-062).

## Acceptance Criteria

**Epic-level**

- Chain resolution matches PRD Appendix B for every type and threshold boundary (boundary-value tests at A and B).
- No step can be skipped; terminal states immutable; history complete.
- Only the current-step approver can decide (permission tests, incl. Admin cannot final-approve what only Owner may).
- Changing a threshold in org settings re-routes new requests without code changes.

**Per-task**

- **T-040** — resolution table tests green, incl. boundaries.
- **T-041** — state machine tests: skip attempts rejected; reject returns to requester with comment.
- **T-042** — approver decides from queue; requester sees position/history.
- **T-043** — both triggers fire with working deep links.

> Each task also satisfies `../DEFINITION-OF-DONE.md`.

## Automation Log

- 2026-08-06 Epic created by `/agentic-init` from PLAN §6.9 — pending kickoff. Threshold values + currency remain an open PRD question; build threshold-driven with proposed defaults.

## Dependencies

- EPIC-001 (T-012 permissions), EPIC-003 (T-037 notifications — triggers can write rows before SSE if sequenced early).
