# EPIC-016: Assistant upgrade — named assistant, workspace Pages, file attachments

status: on-progress
environment: dev
retries: 0

## Goal

Raise the AI assistant from a read-only analyst to something that takes in
documents and produces durable output:

1. The assistant carries the installation's own name.
2. A **Pages** module that belongs to no event — private by default, shared
   explicitly.
3. **Attachments** in the chat (Excel, CSV, PDF, Word, images) that the
   assistant can actually read.
4. A **"Save to page"** action turning an assistant answer into a page.

## Tasks

- **T-160** Standalone Pages module — schema, access rules, list + editor, sharing
- **T-161** Chat attachments — upload + text extraction pipeline
- **T-162** Vision for image attachments
- **T-163** "Save to page" from an assistant answer
- **T-164** Assistant name as a branding setting

## Acceptance Criteria

- A page is invisible to everyone but its author until shared.
- Externals never reach the module.
- Unsupported/unreadable files fail with an honest message, never a silent
  empty document sent to the model.
- Extraction is capped and the user is told what was truncated.
- The open-source default stays unbranded.

## Automation Log

- **T-164 — Assistant name as a branding setting** (2026-08-10). The Owner
  asked to rename the assistant back to "Kintsugi Intelligence". Raised the
  conflict: the rename to a generic "AI Assistant" was made deliberately days
  earlier so the public repo carries no RVC branding, and hardcoding it back
  would undo that. Resolved by making the name a setting instead of a
  decision: `assistantName` joins the existing branding trio in
  `app_settings` (+ `ASSISTANT_NAME` env for first boot), default
  "AI Assistant". It flows to the sidebar label, page title, the heading, the
  not-configured notice, and the model's own system prompt (so asking "what
  are you called?" answers correctly). RVC's installation is set to
  "Kintsugi Intelligence"; a fresh clone still reads "AI Assistant".

- **T-160 — Standalone Pages module** (2026-08-10). Owner chose
  *private-first, shareable* over an open wiki or division scoping.
  - **New tables, not a nullable `event_id` on `event_pages`.** The two have
    opposite access models — an event page is readable by anyone who can see
    the event, a standalone page starts private. Sharing one table would mean
    a single query that forgot `event_id IS NULL` could leak private notes
    into an event's wiki list. `pages` + `page_shares` instead, and the
    live event wiki was not touched.
  - `src/lib/pages/access.ts` — the access decision is a pure function with
    14 unit tests, because this is the module that decides whether one
    person's private notes are visible to another. Rules: author has full
    control; a share grants read (edit only when `can_edit`); a division
    share reaches its members; organisation-wide grants **read only**, so a
    shared SOP cannot be silently rewritten; the most permissive matching
    grant wins.
  - **A global owner/admin does NOT get automatic sight of a private page.**
    Deliberate: "private" that leadership can read anyway is not private, and
    these pages will hold assistant summaries of uploaded documents.
    Governance access, if ever wanted, should be a separate logged feature.
  - `getPage` returns null both for a missing page and for one the actor may
    not see, so probing cannot distinguish the two.
  - The 363-line Tiptap editor was **moved to `src/components/page-editor.tsx`
    and parameterised** (`save` action + `editable`) rather than duplicated;
    the event wiki now passes its own action to the same component.
  - Verified live with two real accounts: owner 200 / staff 404 on a private
    page and absent from staff's list; after a read share, staff 200 with a
    "Read only" badge and no sharing controls; after `can_edit`, the badge
    disappears; organisation-wide gives staff read but still no edit.
  - **Bug found and fixed during that run:** `/pages/<not-a-uuid>` returned
    **500**, because Postgres rejects a malformed uuid and the type error
    surfaced as an error page. Guarded in the service (all three entry
    points), so it is now an ordinary 404.
  - **Pre-existing debt surfaced:** `drizzle-kit generate` tried to re-create
    `ai_conversations`, `event_pages`, `task_external_dependencies` and the
    task lead columns, because **snapshots for migrations 0020–0024 were never
    committed** (those were hand-written). Every object it wanted to create
    was verified present in the database and stripped from `0025`, which now
    contains only the two new tables. The 0025 snapshot holds the full current
    schema, so the chain is correct again from here.
  - **Second trap:** `docker compose run migrate` reported "migrations applied
    successfully" while applying nothing — the migrate image was a stale
    cached layer without 0025. `docker compose build migrate` first; never
    trust that success line without checking the table exists.
  - Gates: lint ✅ typecheck ✅ 224 tests ✅ build ✅.
