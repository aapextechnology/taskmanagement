# EPIC-002: Events Workspace

status: backlog
environment: dev
phase: 1
priority: P0
area: Events
retries: 0
prd: ../product/PRD.md
stories: ../product/USER-STORIES.md (US-EVT-1 … US-EVT-4)
tasks: ../product/ENGINEERING-TASKS.md (T-020 … T-024)

## Goal

Each concert gets one shared workspace with lifecycle phases, a live countdown to show
day, and auto-computed health status — the container all division work lives in.

## User Stories

- **US-EVT-1** — As an Admin, I want to create an event with name, artists, venue, show date, capacity, and poster, so that each concert has one shared workspace.
- **US-EVT-2** — As a Staff member, I want the workspace to show a countdown and the lifecycle phase, so that urgency is always visible.
- **US-EVT-3** — As an Owner, I want event health (On track / At risk / Critical) computed automatically, so that I see trouble without asking.
- **US-EVT-4** — As a Head, I want a portfolio view of active events, so that I can jump between concerts my division serves.

## Tasks

### Event schema

- [ ] **T-020** Schema `events` (name, artists, venue, show date, capacity, status, cover image, phase) + `event_divisions`; phase enum constrained to Planning → Pre-production → Promotion → Show week → Show day → Settlement.

### Event CRUD & poster

- [ ] **T-021** Events CRUD + archive, gated Owner/Admin via permission module; poster upload to `/uploads` (auth-gated, nginx-served).

### Workspace shell

- [ ] **T-022** Event workspace layout: header with live countdown (shared component from T-006), phase indicator, poster; phase advance control for Owner/Admin.

### Health status

- [ ] **T-023** Health computation per PRD Appendix B (overdue/blocked tasks + budget burn): recompute on relevant change + node-cron sweep; thresholds in org settings.

### Portfolio page

- [ ] **T-024** `/events`: gallery grid of active events (poster, countdown, phase, health badge) per the RVC design language.

## Acceptance Criteria

**Epic-level**

- An event travels the full lifecycle; archived events leave default views but stay queryable.
- Countdown ticks live in the workspace header.
- Health status matches the deterministic rule in unit tests for all three states and updates when inputs change.
- Create/archive attempts by Staff are denied by the permission module (test).

**Per-task**

- **T-020** — migration applies; invalid phase transition rejected.
- **T-021** — poster uploads render; unauthenticated file access denied.
- **T-022** — countdown correct across timezones (server date authoritative).
- **T-023** — all three states covered by tests; cron sweep runs.
- **T-024** — portfolio matches design language; links into workspaces.

> Each task also satisfies `../DEFINITION-OF-DONE.md`.

## Automation Log

- 2026-08-06 Epic created by `/agentic-init` from PLAN §6.1 — pending kickoff.

## Dependencies

- EPIC-001 (T-010 schema base, T-012 permission module). Budget-burn input of T-023 arrives with EPIC-005 — until then health uses task signals only (note this in code).
