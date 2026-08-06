# EPIC-011: Plane-like UI/UX Overhaul

status: on-progress
environment: dev
phase: 1
priority: P0
area: UI/UX
retries: 0
prd: ../product/PRD.md
stories: ../product/USER-STORIES.md
tasks: ../product/ENGINEERING-TASKS.md (T-110 … T-114)

## Goal

Owner feedback (2026-08-06): the MVP UI feels stiff ("kaku"). Rework the experience to
feel like Plane.so / Jira — sidebar navigation, denser and friendlier surfaces,
functional status/priority colors, and task details opening in a **dialog/drawer**
instead of a page navigation. Keep the RVC monochrome chrome; color becomes functional
(status, priority), not decorative.

## Tasks

### Sidebar app shell

- [x] **T-110** Replace the top-bar shell with a Plane-style collapsible left sidebar: logo, primary nav (My Tasks / Events / Dashboard / Admin), active-events quick list, user block (avatar, name, sign out) + bell + theme toggle. Slim content top bar.

### Task peek dialog

- [x] **T-111** Intercepting route (`@modal` slot + `(...)tasks/[id]`) so clicking a task anywhere opens a right-side drawer over the current view; URL still `/tasks/[id]` (shareable, refresh → full page). Shared detail panel between drawer and full page.

### Functional color system

- [x] **T-112** Status + priority color tokens (both themes) and shared `StatusDot` / `PriorityIcon` components; monochrome chrome unchanged.

### Board & list polish

- [x] **T-113** Plane-style kanban cards (priority icon, due chip, avatar stack), colored column headers with counts; list + My Tasks rows with dots/icons/avatars and hover states.

### Consistency pass

- [ ] **T-114** Events gallery + workspace + forms aligned to the new density/tone; dark/light verified.

## Acceptance Criteria

- Clicking a task from board/list/My Tasks opens a drawer without losing the underlying view; browser back closes it; direct URL loads the full page.
- Sidebar navigation works on desktop and collapses on mobile.
- Status/priority are color-coded consistently across board, list, My Tasks, and the peek.
- All existing permission gates and actions keep working (no service-layer changes).

## Automation Log

- 2026-08-06 **T-110..T-113 done** — sidebar shell (desktop fixed + mobile sheet, events quick list with health dots, user block), task peek drawer via Next intercepting route (`@modal` slot + `(...)tasks/[id]`; back closes, refresh → full page, shared `TaskDetailPanel`), functional color tokens + `task-meta.tsx` atoms (StatusDot/Chip, PriorityIcon Jira-style chevrons, AvatarStack), kanban/List/My-Tasks re-skinned. `/` now redirects to my-tasks. Gotcha: react-hooks v7 `purity` rule bans `Date.now()` in render — capture via `useState(() => Date.now())`. Deployed to DEV; all pages 200. **T-114 open**: Owner reviews the new look (esp. dark/light + events pages density) and reports what still feels stiff.
- 2026-08-06 Epic created from Owner UX feedback — supersedes the top-bar shell from T-004.

## Dependencies

- EPIC-003 (the surfaces being reworked).
