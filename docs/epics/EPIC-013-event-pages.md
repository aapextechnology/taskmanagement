# EPIC-013: Event Pages (Mini-Wiki)

status: ready-for-qa
environment: dev
phase: 4
priority: P2
area: Collaboration
retries: 0
prd: ../product/PRD.md
tasks: ../product/ENGINEERING-TASKS.md (T-130)

## Goal

Owner request 2026-08-07 (screenshot: Plane-style page editor): every event
carries a list of free-form **Pages** — briefs, meeting notes, riders — each
opening a rich-text editor.

## Tasks

- [x] **T-130** `event_pages` schema (Tiptap JSON content) + list at
  `/events/[id]/pages` + editor at `/events/[id]/pages/[pageId]` + sidebar
  "Pages" entry + image upload endpoint.

## Acceptance Criteria

- Any internal user with event access can create/read/edit pages (wiki
  semantics); only the author or owner/admin can delete. Externals never
  reach the service (defended in-service, not just at the layout redirect).
- Editor: block types (text/H1–H3), text color, bold/italic/underline/strike,
  alignment, ordered/bullet/to-do lists, quote, code block, tables, image
  upload — autosaving ~1.2s after the last keystroke.
- Content stored as editor JSON (never HTML) — no markup injection surface.
- Images go through the auth-gated `/api/files` tree (5 MB, jpg/png/webp).

## Automation Log

- **2026-08-07 — T-130 done → ready-for-qa.** Migration `0021_event-pages.sql`;
  `src/lib/pages/service.ts` (read/write = `event.view` + internal, delete =
  author or `org.manage`, renames logged, autosaves not — keeps the feed
  readable); editor = Tiptap v3 (`@tiptap/react` + StarterKit/TextStyleKit/
  TableKit/task lists/TextAlign/Image/Placeholder, `immediatelyRender: false`
  for SSR), styled toolbar per the no-basic-controls rule; upload route
  `/api/pages/upload` → `saveImageUpload(…, "pages")`. Verified: service E2E
  (staff edits wiki page, non-author delete denied, admin delete OK) + live
  200 on `/events/[id]/pages`. Gates: lint/typecheck/179 tests/build ✅;
  deployed DEV.
