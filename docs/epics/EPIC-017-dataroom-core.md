# EPIC-017: Dataroom — core (Phase 1)

status: on-progress
environment: dev
retries: 0

## Goal

A per-event document room held on the app's own storage, with folders,
versioning, a storage quota the Owner controls, explicit access on the
sensitive parts, and a record of who opened what. It **replaces** the
per-event Documents module, which has never held a file.

This is Phase 1 of a DocSend-style product (see *Roadmap* below). It is
deliberately useful on its own: nothing here depends on the later phases.

## The storage decision — and why Nextcloud was rejected

The Owner already runs Nextcloud at `dataroom.reddie.id` on the same host, so
the obvious move was to use it as the backing store. It was investigated
properly and rejected. Recorded here because the reasoning will look wrong to
anyone who only sees the outcome.

Verified on the server, not assumed:

| Check | Result |
| --- | --- |
| `dataroom.reddie.id` | 302 → login, alive |
| `/remote.php/dav/files/` | 401 — WebDAV enabled |
| Container | `nextcloud-dataroom`, `docker-infra_infra-net`, 172.18.0.21 |
| App container | separate network — a request from the app **timed out** |
| `/mnt/hdd2/nextcloud-dataroom` | 4 KB — the instance was never populated |
| `documents` table | 0 rows |

The decisive argument was not the network isolation, which is a one-line
compose change. It was this: **choosing Nextcloud does not reduce the work.**
Rooms, access lists, the access log, share links and version history all have
to be built either way. Nextcloud adds WebDAV plumbing, chunked uploads,
`fileid` tracking and a reconciliation job on top — and buys back only what
the team does not use.

- Its one irreplaceable advantage is desktop/mobile sync. **The team does not
  use it** (Owner, 2026-08-10), so that value is zero here.
- The Owner chose a *real* data room: strict access plus a record of who
  opened what. A folder humans can also browse in Nextcloud breaks that by
  construction — files can be taken without the app ever knowing, which makes
  the log a comforting fiction. Sealing the folder to a robot account fixes
  the leak but reduces Nextcloud to a filesystem behind HTTP that nobody
  visits: all of the cost, none of the benefit.
- Two sources of truth is a permanent tax, not a one-off: any rename, move or
  delete on the Nextcloud side rots the index forever.
- It puts a second failure domain in front of a core feature.

What Nextcloud would have given for free — versioning and trash — is cheap to
build and better suited here: never overwrite, keep every version, soft-delete
into a trash with a retention window. App-native versions are tied to a user
and an event ("version 3, uploaded by Andi on 12 August"), which Nextcloud
cannot express because it does not know the app's users.

**Mitigation against being wrong.** All storage access is confined to one
module (`src/lib/dataroom/storage.ts`) — write, read, stream, delete. Nothing
else in the app knows where the bytes live. Swapping to Nextcloud, S3 or
anything else later is one file, not a rewrite.

## Storage layout

- Bind mount **`/mnt/hdd2/rvc-dataroom`** as a new `dataroom` volume. hdd2 is
  a 3.6 TB disk holding nothing but the empty Nextcloud folder; hdd1 already
  hosts `cdn` and `websites` for other projects and would compete for space.
- The existing `uploads` volume stays on NVMe. Small, hot files (avatars,
  posters, task attachments, **the WhatsApp session credentials**) must not
  move to a spinning disk, and must not be swept up by any dataroom cleanup.
- Path layout: `<eventId>/<fileId>/<versionNo>` — a version is a new object,
  never an overwrite, so a signed contract can always be recovered.
- The docker-compose change that attached the app to `docker-infra_infra-net`
  is reverted: with Nextcloud out of the picture there is no reason to keep a
  live connection to another stack's network.

## Quota rules

Default **10 GB per event** (Owner, 2026-08-10), overridable per event, with
the default itself stored in `app_settings`.

Three rules decide whether the number is honest:

1. **Old versions count.** Otherwise someone re-uploads a 500 MB file ten
   times, the quota still reads 500 MB, and the disk has lost 5 GB.
2. **Trashed files count until they are actually purged**, so trash needs a
   retention window (30 days) and a purge job. Without it a quota never
   recovers.
3. **A global floor.** When free disk falls below 50 GB, uploads are refused
   regardless of any event's remaining quota. Quotas protect events from each
   other; the floor protects the server.

Usage is an indexed `SUM` over the file rows, not a stored counter. A counter
is faster and can drift, and once it drifts nobody ever finds out. If the sum
becomes slow, cache in front of it — do not replace it.

Enforcement happens **before a byte is written**, using the declared upload
size, and again mid-stream in case that size lied. A refusal states the
numbers: "This event has used 9.6 GB of 10 GB."

At **80% a WhatsApp warning** goes to Owner/Admin, through the existing
notification fan-out, so its wording is editable in Admin → Notification
templates like every other message.

## Access model

- A room's ordinary folders are readable by anyone who can view the event —
  otherwise nobody will use it and it becomes Documents all over again.
- A folder can be marked **Sealed**: an explicit member list, invisible to
  everyone else. **A global owner/admin gets no automatic sight of a sealed
  folder** — same rule as Pages (EPIC-016). "Restricted" that leadership can
  read anyway is not restricted. Governance access, if ever wanted, is a
  separate and separately logged feature.
- Every open and download is logged with actor, file, version and timestamp,
  in both kinds of folder.

## Tasks

- **T-170** Storage module + quota math. Path layout, write/stream/delete,
  never-overwrite versioning; quota arithmetic as a pure, unit-tested
  function (versions and trash included, global floor).
- **T-171** Schema + service: `dataroom_folders`, `dataroom_files`,
  `dataroom_file_versions`, `dataroom_folder_access`, `dataroom_access_log`,
  per-event quota. Access decision as a pure function with tests, in the
  shape of `src/lib/pages/access.ts`.
- **T-172** Event → Dataroom tab: folders, upload with progress, file list,
  version history, download through the gated stream.
- **T-173** Sealed folders: mark, manage members, enforce invisibility.
- **T-174** Activity view (who opened what, when) + the 80% WhatsApp warning.
- **T-175** Admin → Storage: per-event used/limit, editable limits, global
  default, real free disk. Retire the Documents module from the event nav.

## Acceptance Criteria

- A sealed folder is invisible and unreachable to anyone not on its list,
  including the Owner, unless explicitly added.
- Every open/download is logged; the log cannot be bypassed, because there is
  no second way to reach the bytes.
- Uploading past the quota is refused with the actual numbers, before
  anything is written.
- A quota cannot be beaten by re-uploading versions or by deleting into trash.
- The WhatsApp session and other `uploads` files are untouched by any
  dataroom operation.
- Free disk below the floor stops uploads everywhere, with a clear message.

## Roadmap (later epics, not in scope here)

- **EPIC-018 — external share links.** Expiring, revocable, signed links for
  vendors and clients: email gate, passcode, download on/off, WhatsApp
  notification when opened. Never Nextcloud-style public links, which work
  for anyone holding the URL forever.
- **EPIC-019 — per-recipient watermarking.** Burned into the PDF server-side
  at view time (viewer email + timestamp on every page) via `pdf-lib`;
  images via `sharp`. **Word/Excel are out of scope** (Owner, 2026-08-10) —
  watermarking them needs LibreOffice in the container; documents that need a
  watermark are exported to PDF first. A watermark makes a leak *traceable*,
  it does not prevent one; nothing does, including DocSend.
- **EPIC-020 — in-app viewer + per-page analytics.** Time spent per page,
  completion. Needs the app's own pdf.js viewer; the largest single piece,
  which is why it is last.

## Automation Log

- **2026-08-10 — Scoping and the storage decision.** Investigated Nextcloud
  against the running server (reachability, WebDAV, container network, empty
  data directory) and rejected it for the reasons above, after the Owner
  confirmed the team does not use Nextcloud's desktop or mobile clients.
  Owner set the default quota at 10 GB, chose hdd2, asked for the 80% warning
  over WhatsApp, and confirmed Word/Excel need no watermark.
  Also found while scoping, and reported separately: this installation has
  **no backup of any kind** — no `pg_dump`, no volume backup, no cron. Not
  urgent while the data is dummy, but it must exist before the first real
  contract is stored.
