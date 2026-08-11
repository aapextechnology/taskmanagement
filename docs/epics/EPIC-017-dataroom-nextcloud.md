# EPIC-017: Dataroom backed by Nextcloud

status: backlog
environment: dev
retries: 0

## Goal

A real **data room**: files held in the existing Nextcloud at
`dataroom.reddie.id`, with strict per-room access and a record of who opened
what and when. It **replaces** the per-event Documents module, which has
never held a single file — two places to keep a contract is worse than one.

Owner decisions (2026-08-10):
- Not a file browser: access lists + view/download audit are the point.
- Documents is retired, not kept alongside. Nothing is lost — it holds 0 rows.

## Findings from the server (verified, not assumed)

| Check | Result |
| --- | --- |
| `dataroom.reddie.id` | 302 → login, alive |
| `/remote.php/dav/files/` | 401 — WebDAV enabled and reachable |
| Container | `nextcloud-dataroom`, network `docker-infra_infra-net` (172.18.0.21) |
| App container | `kinsugi_task_default` — **isolated**; `wget` to Nextcloud timed out |
| `documents` table | 0 rows |

The isolation is the only infrastructure blocker. `docker-compose.yml` now
declares `docker-infra_infra-net` as an external network and attaches `app`
to it (with `default` listed explicitly, or the service would lose db and
mailpit). Traffic then stays inside Docker instead of leaving through the
public hostname and coming back.

## Design decisions

- **One service account + app password, not per-user OAuth.** The app already
  owns a permission model (`src/lib/permissions`); per-user Nextcloud accounts
  would mean two systems that can disagree, and would force a Nextcloud login
  on every member. The Nextcloud user is a robot with access to one folder.
- **Never Nextcloud public share links.** A link works for whoever holds it —
  forwarded into a group chat, it is open to all. That defeats the entire
  point of a data room. Files stream through the app, so every read passes
  the permission gate and is logged.
- **Stream, never buffer.** Downloads proxy as a `ReadableStream` with Range
  support; reading a 2 GB file into memory would take the app down.
- **The database is the index, Nextcloud is the bytes.** A file deleted from
  the Nextcloud side must degrade to an honest 404 plus a reconciliation
  sweep, not a crash.

## Tasks

- **T-170** Nextcloud WebDAV client + connection test in Admin (PROPFIND,
  PUT, GET with Range, DELETE, MKCOL), credentials from env only.
- **T-171** Schema: `datarooms`, `dataroom_files`, `dataroom_members`,
  `dataroom_access_log`. Access decision as a pure, unit-tested function,
  same shape as `src/lib/pages/access.ts`.
- **T-172** Room list + room detail UI: upload, folders, rename, delete,
  member management.
- **T-173** Gated streaming download/preview + the access log written on
  every open, and an "Activity" tab showing who opened what and when.
- **T-174** Retire Documents: remove from event nav and the route, keep the
  table until the Owner confirms nothing is wanted from it.

## Acceptance Criteria

- A file is unreachable to anyone not on the room's member list, including a
  global admin unless explicitly added.
- Every open/download is logged with actor, file, and timestamp.
- No Nextcloud credential ever reaches the browser; no public share link is
  created.
- Nextcloud being down degrades to a clear error, never a blank page.
- A file removed in Nextcloud shows as missing rather than erroring.

## Blocked on

A Nextcloud **service account + app password** (Settings → Security → Create
new app password) and a dedicated folder for the app. Credentials go into the
app's `.env` as `NEXTCLOUD_URL` / `NEXTCLOUD_USER` / `NEXTCLOUD_APP_PASSWORD`
— never into git.

## Automation Log

- **2026-08-10 — Scoping.** Verified Nextcloud reachability, WebDAV, container
  network, and that `documents` holds 0 rows. Attached `app` to
  `docker-infra_infra-net` in `docker-compose.yml` (validated with a YAML
  parse). Recreating the container was blocked by the sandbox classifier and
  handed to the Owner to run.
