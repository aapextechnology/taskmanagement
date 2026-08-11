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

Four visibility levels on a **folder** (Owner, 2026-08-10). "Public" here
always means *inside the installation* — reaching anyone outside is a
different mechanism entirely (signed links, EPIC-018) and is never a side
effect of this setting.

| Level | Who can see it |
| --- | --- |
| `sealed` | only people named on the folder's list |
| `division` | members of one named division |
| `event` | anyone who can view the event |
| `organisation` | every internal user |

Rules:

1. **The level lives on the folder; files inherit it.** Per-file levels read
   as flexible and end as a document filed at the wrong level by someone who
   never noticed the control.
2. **A sub-folder may only narrow, never widen.** Without this an
   `organisation` folder nested inside a `sealed` one leaks its contents,
   while the person who created it believes the sealed parent protects it.
   Widening is refused at save with the reason.
3. **Owner/Admin see `division`, `event` and `organisation` automatically** —
   consistent with `org.viewAllDivisions`, which already gives them every
   division's data. **`sealed` is the only level they do not get**, which
   makes the line easy to explain: if leadership must not see it, it goes in
   a sealed folder, not a division one.
4. **`external` users never reach the dataroom at all**, at any level. Guests
   receive documents only through EPIC-018 links.
5. A new folder defaults to **`event`** — useful immediately, not open to the
   whole organisation, and not so strict that people route around it.
6. Every open and download is logged with actor, file, version and timestamp,
   at every level. There is no second path to the bytes, so the log cannot be
   bypassed.

The decision is a pure function over (actor, folder, ancestors, member list),
unit-tested in the shape of `src/lib/pages/access.ts` — this is the module
that decides whether one department's contract is visible to another.

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
- **T-173** Folder visibility: the four levels, the narrow-only rule for
  sub-folders, sealed member lists, and enforcement in every query.
- **T-174** Activity view (who opened what, when) + the 80% WhatsApp warning.
- **T-175** Admin → Storage: per-event used/limit, editable limits, global
  default, real free disk. Retire the Documents module from the event nav.

## Acceptance Criteria

- A sealed folder is invisible and unreachable to anyone not on its list,
  including the Owner, unless explicitly added.
- A division folder is invisible to other divisions' staff.
- A sub-folder cannot be saved at a wider level than its parent.
- An `external` user reaches no part of the dataroom.
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

- **T-172 — Service, gated streaming, and the event Dataroom tab**
  (2026-08-11). Verified end to end against the running app, which turned up
  three defects that unit tests could not have found.
  - **Creating a sealed folder orphaned it.** A sealed folder admits only the
    people on its list, and the creator was not implicitly on it — so the
    moment it existed, nobody could open it, not even to add the first
    member. Found because the narrow-only rule refused with the wrong error
    ("Not allowed") instead of its own message. Fixed by granting the creator
    an explicit `can_edit` row rather than special-casing them in the access
    rules, which keeps the grant visible in the member list and auditable.
  - **nginx capped uploads at 50 MB** and, more seriously, buffered every
    request body to the system NVMe before passing it on — so a large upload
    would fill the app server's own disk *before* the event quota could be
    applied. `/api/dataroom/upload` now has its own location with
    `client_max_body_size 0` and `proxy_request_buffering off`, handing bytes
    straight to the counter in storage.ts. An 80 MB file, which the old cap
    rejected outright, now lands in 0.4 s.
    **The public reverse proxy in front of `rvc.reddie.id` is separate and
    needs the same two settings**, or large uploads will fail from outside.
  - A "the bytes are missing from the HDD" scare was **my own error**: the
    storage directory is owned by the container user (uid 100) and my shell
    could not read it. Confirmed from inside the container instead — 80 MB on
    `/dev/sdb1`, laid out as `<eventId>/<fileId>/<version>`.
  - Upload is a raw `PUT` with the file as the body, not multipart: multipart
    is buffered before the handler runs, so a 2 GB upload would sit in memory
    before any quota check.
  - Download resolves and logs in one step, so a read cannot happen
    unrecorded, and answers **404 rather than 403** for a file the actor may
    not see — confirming existence is itself a disclosure. Range requests
    work (206), so a PDF can be scrubbed rather than fetched whole. A file
    the index knows but the disk does not returns 410 with a plain message.
  - Live checks: upload 200; another division's staff refused on a sealed
    folder (403 on upload, 404 on download) while the same person reads an
    event-level folder normally; a 20 GB declared upload refused by the quota
    with the real numbers ("used 1.4 KB of 10 GB… that file needs 20 GB");
    a downloaded file byte-identical to the original; the access log holding
    the upload and download rows with actor, file and version.
  - Gates: lint ✅ typecheck ✅ 340 tests ✅ build ✅ security ✅. Test data
    removed from the live event afterwards.

- **T-171 — Schema and the access decision** (2026-08-11).
  - `access.ts` (21 tests) — the four levels as a pure function over
    (subject, folder chain). Tests assert the rules that are easy to get
    wrong rather than the easy ones: an `external` user is refused at **every**
    level even when explicitly listed as a member; a sealed folder refuses the
    Owner and Admin until they are added by name; a division folder refuses
    another division but admits Owner/Admin, consistent with
    `org.viewAllDivisions`; and a folder whose `division_id` was never set
    admits nobody rather than everybody.
  - **The whole ancestor chain is checked, not just the folder itself.** The
    narrow-only rule keeps the chain monotonic in theory, but a row that
    predates the rule or arrives by import must not become a way in — a test
    covers an `organisation` folder nested under a `sealed` one, which stays
    closed to everyone including the Owner.
  - `canManage` can never exceed `canView`: the Owner who created a sealed
    folder but is not on its list controls nothing, because they cannot see
    it. Management without sight would be a back door with extra steps.
  - Five tables (migration 0027). Two deliberate shapes:
    `dataroom_files.event_id` is denormalised from the folder so a quota sum
    never needs a join, and **`dataroom_access_log` carries no foreign key to
    the file and copies its name**, because the record of who read a contract
    must outlive the contract. Verified in the database: the log has exactly
    one FK, to the actor.
  - `events.dataroom_quota_bytes` is nullable — null means "follow the global
    default" — so raising the default later moves every event that never had
    an override, without a data migration.
  - Storage volume confirmed live: `/data/dataroom` writable by the container
    user, 3.4 TB free, and `/data/uploads` still holding the WhatsApp session
    untouched.
  - Gates: lint ✅ typecheck ✅ 340 tests ✅ build ✅ security ✅.

- **T-170 — Storage module, path safety and quota arithmetic** (2026-08-11).
  Built and proven before any schema or UI sits on top of it.
  - `quota.ts` (18 tests) — pure arithmetic for the three rules that decide
    whether a quota figure is honest. `decideUpload` checks the **global disk
    floor first**, so when the server itself is nearly full the refusal names
    the real cause instead of blaming the event's quota. Refusals carry the
    actual numbers ("used 9.6 GB of 10 GB, that file needs 1 GB").
    `crossesWarningLine` fires only on the upload that passes 80%, so the
    WhatsApp alert cannot repeat on every subsequent upload.
    `isOverLimit` exists so lowering a limit blocks uploads without ever
    implying a deletion.
  - `paths.ts` (13 tests) — kept separate because this is where
    caller-supplied ids become filesystem paths, the classic traversal bug.
    Ids are validated as UUIDs **before** any `path.join`, `resolveInRoot`
    refuses anything escaping the root (including the sibling-prefix case
    `/srv/dataroom-old` against `/srv/dataroom`), and `safeDownloadName`
    strips the CR/LF that would inject a response header.
  - `storage.ts` (19 tests, real filesystem in a temp root) — the only module
    that knows where bytes live, so the rejected Nextcloud decision stays
    reversible in one file. A version is always a new object; nothing is ever
    overwritten. The write **counts bytes mid-stream** and aborts past the
    allowance, because the browser's declared size is a claim, not a fact —
    and a failed write is removed, since a partial file would count against
    the quota while being unreadable. `statVersion` returns null when the
    index knows a file the disk does not, which is the drift rule from the
    epic. Range parsing supports open-ended and suffix ranges and flags
    unsatisfiable ones for a 416.
  - A test asserts the storage root cannot write outside itself, standing in
    for the rule that no dataroom operation may reach the `uploads` volume
    and its WhatsApp credentials.
  - Two test failures during the run were my own wrong expectations, but the
    first exposed a real flaw: `\r\n` in a filename became two spaces.
    Whitespace runs are now collapsed.
  - Compose gained a `dataroom` volume bound to `/mnt/hdd2/rvc-dataroom`
    (overridable via `DATAROOM_DEVICE`) plus `DATAROOM_DIR`, with `uploads`
    left untouched on NVMe. **The host directory must be created by hand**
    (`sudo` needs a terminal): the container runs as uid 100/gid 101, so the
    directory has to be owned by it.
  - Gates: lint ✅ typecheck ✅ 319 tests ✅ build ✅ security ✅.

- **2026-08-10 — Scoping and the storage decision.** Investigated Nextcloud
  against the running server (reachability, WebDAV, container network, empty
  data directory) and rejected it for the reasons above, after the Owner
  confirmed the team does not use Nextcloud's desktop or mobile clients.
  Owner set the default quota at 10 GB, chose hdd2, asked for the 80% warning
  over WhatsApp, and confirmed Word/Excel need no watermark. Owner then asked
  for department-scoped, event-scoped and organisation-wide folders alongside
  sealed ones, which became the four-level model above; the narrow-only rule
  for sub-folders was added because a wide folder nested in a sealed one
  would otherwise leak while looking safe.
  Quota limits are editable per event by Owner/Admin only — a division head
  raising their own ceiling would turn the quota into a suggestion — and
  lowering a limit never deletes anything: existing files stay, new uploads
  are refused until usage falls under the new figure.
  Also found while scoping, and reported separately: this installation has
  **no backup of any kind** — no `pg_dump`, no volume backup, no cron. Not
  urgent while the data is dummy, but it must exist before the first real
  contract is stored.
