# EPIC-023: Agent API — external agents over WhatsApp

status: ready-for-qa
environment: dev
retries: 0

## Goal

Let an external agent (OpenClaw / Hermes / any framework) read, write and
update rvc.reddie.id on behalf of people chatting with it on WhatsApp —
WITHOUT an all-access token. Owner asked for a god token (2026-08-18); the
shipped design replaces it with two credentials per request, because WhatsApp
is a hostile input channel: one injected message in a group must never be able
to read a sealed dataroom folder through the agent.

## Design

- `Authorization: Bearer rvca_…` — proves WHICH AGENT calls. Stored as a
  SHA-256 hash only (`agent_api_keys`, migration 0042); plaintext shown once.
- `X-On-Behalf-Of: <nomor WA>` — names WHICH HUMAN it speaks for. Normalised
  via the existing `normalizeMsisdn` and matched against `profiles.phone`;
  the request then runs as that user through `src/lib/permissions`. A key
  alone can read nothing. Externals and deactivated users are refused.
- Per-key rate limit 120/min (in-memory, single-container honest).
- Admin → "Agent API keys": create (token displayed once), list with tail +
  last-used stamp, revoke.

## Endpoints (v1)

| Method | Path | Does |
|---|---|---|
| GET | /api/agent/me | identity + role + memberships |
| GET | /api/agent/events | visible events |
| GET | /api/agent/events/:id | header, crew, divisions, latest ticket figures |
| GET | /api/agent/tasks?eventId= / ?mine=1 | scoped task lists |
| POST | /api/agent/tasks | create (marks description "via agent …") |
| GET/PATCH | /api/agent/tasks/:id | detail / status·priority·title·dueDate |
| POST | /api/agent/tasks/:id/comments | comment, suffixed "via <key>" |

## Automation Log

- 2026-08-18 — Shipped and verified end-to-end over live HTTP: no token → 401;
  token without identity → 401 with instruction; unknown phone → 403; owner
  phone → me/events/event-detail read OK, task created + status/priority
  patched + comment posted, ticket summary served (124 tickets across both
  channels with the staleness note). Probe task deleted, probe key revoked.
- 2026-08-18 — Every mutation is attributable twice: the activity log carries
  the acting USER (not the key), and created tasks/comments carry a plain
  "via <key>" suffix so a relayed action never masquerades as a hand-typed one.
- Next (when the Owner builds the agent): point OpenClaw/Hermes tools at
  these endpoints; the agent's WA layer must pass each sender's number in
  X-On-Behalf-Of. Group chat = identity of the SENDER, never the group.
