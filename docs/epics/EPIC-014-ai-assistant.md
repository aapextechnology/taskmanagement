# EPIC-014: Kintsugi Intelligence (Predictive Chat)

status: ready-for-qa
environment: dev
phase: 4
priority: P1
area: Intelligence
retries: 0
prd: ../product/PRD.md
tasks: ../product/ENGINEERING-TASKS.md (T-140, T-141)

## Goal

Owner request 2026-08-07: a Claude-style chat for leadership (owner / admin /
division heads) that answers questions over the org's live task data,
predicts whether an event will run smoothly **with reasons** (time pressure,
dependency load, one-person overload, external waits, budget burn, ticket
pace), and benchmarks against general industry practice. Backed by OpenAI
(`gpt-5.6`, Owner's choice — configurable via `OPENAI_MODEL`).

## Tasks

- [x] **T-140** `ai.assistant` capability (owner/admin/any-head) + matrix
  tests; permission-scoped context gatherer (`src/lib/ai/context.ts`);
  streaming chat route `/api/ai/chat` (plain-fetch OpenAI client, no SDK);
  `/assistant` chat UI (streaming render, markdown-lite, event-focus chips,
  suggested prompts, stop button); sidebar "AI Assistant" entry (Sparkles),
  visible only to permitted roles.

## Acceptance Criteria

- Only owner/admin/heads see the menu and can call the API (staff → 403,
  page redirects; verified live per role).
- The context injected into the prompt is re-scoped per actor: owner/admin
  get the whole org; a head gets only their divisions' tasks. The assistant
  can never surface data the user couldn't open in the app.
- Prediction answers lead with a verdict (ON COURSE / AT RISK / CRITICAL) +
  ranked reasons grounded in the snapshot; benchmarks are explicitly generic
  industry heuristics — the prompt forbids inventing named events/sources.
- `OPENAI_API_KEY` lives ONLY in the environment (.env, gitignored;
  docker-compose interpolates from host env). Empty key = graceful 503 +
  a friendly notice in the UI. Every chat is audit-logged (`ai.chat` with a
  truncated question).

## Automation Log

- 2026-08-07 **Fullscreen mode + history menu fix (Owner screenshot
  feedback).** `/assistant` now hides the main app sidebar (client
  `AppFrame` wrapper around the shell; hamburger sheet becomes visible on
  desktop too for that route, so navigation stays one click away) and the
  chat well widens to max-w-4xl. The history row's "Move to / Delete"
  popover was clipped by the scrollable history column (reported as a
  z-index bug — actual cause was `overflow-y-auto` ancestor clipping) —
  replaced with an INLINE expansion under the row, which cannot clip.

- **2026-08-07 — T-141 done: saved conversations + groups; renamed to
  "Kintsugi Intelligence"** (Owner picked the name mid-build, twice —
  final: Kintsugi Intelligence; route stays `/assistant`).
  - Schema (migration 0024): `ai_conversation_groups` (unique name per
    user), `ai_conversations` (groupId nullable = "Ungrouped"; FK ON DELETE
    SET NULL so deleting a group NEVER deletes its chats), `ai_messages`
    (cascade). All PRIVATE per user — every service query filters userId;
    even owner cannot read another user's chats.
  - Chat route now creates/resumes a conversation (404 on foreign id),
    returns `X-Conversation-Id` header so a fresh chat pins its URL
    (`history.replaceState` → reload/back keeps the thread), and persists
    the user+assistant exchange AFTER the stream completes — including
    partial/errored answers, so history matches what the user saw.
  - UI: history panel on /assistant — New chat, user-created groups with
    per-row "Move to" chips + delete, implicit Ungrouped bucket, per-chat
    delete (redirects home if it was open). Title auto = first question
    (80 chars). History list refreshes via router.refresh() after each
    exchange.
  - Verified live: chat → id captured → appears under Ungrouped → reload by
    id shows persisted messages; cross-user isolation (head opening owner's
    convo: page 307 away, API 404); service E2E 4/4 (move to group, foreign
    read/move denied, group delete → Ungrouped fallback with messages
    intact). Gates green (182 tests).

- **2026-08-07 — T-140 done → ready-for-qa.**
  - Permission: `ai.assistant` = owner/admin or head of ANY division; 3 new
    matrix tests (182 total). Gate opens the door; `buildAssistantContext`
    separately re-scopes data per actor (heads: own divisions only).
  - Context snapshot per event: days-to-show, phase position, task progress
    (shared rule), overdue list, per-person open workload (top 8),
    dependency fan-in bottlenecks, unresolved external waits, ticket
    sold/revenue vs capacity, budget planned/committed/paid. Focused event
    gets a deep dive (overdue detail + per-division open counts).
  - OpenAI: plain-fetch streaming client (`src/lib/ai/openai.ts`) parsing
    SSE frames — no SDK dependency. Model verified live: `gpt-5.1` and
    `gpt-5.6` both respond on this key; Owner chose **gpt-5.6** mid-build.
    Existing `proxy_buffering off` in nginx + `X-Accel-Buffering: no` keeps
    tokens streaming through the tunnel.
  - Live E2E: owner asked (in Indonesian) whether "Midnight Frequency" runs
    smoothly → verdict **AT RISK** with correct grounded reasons (show 16
    days past with 3/4 tasks open at 25%, urgent overdue Finance payment
    task, named bottleneck holding settlement). Staff API 403 + page 307 to
    /my-tasks + no sidebar entry; head 200.
  - Security: key only in gitignored .env (verified `git grep` clean +
    security gate PASS). **Owner note: the key was pasted in chat — rotate
    it at platform.openai.com and update .env when convenient.**
  - Known limits (deliberate MVP scope): conversation history is in-memory
    per browser session (refresh clears it); last 12 turns sent per request;
    no DB persistence of chats.
