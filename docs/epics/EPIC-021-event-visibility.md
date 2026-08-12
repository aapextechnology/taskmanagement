# EPIC-021: Event visibility follows involvement

status: ready-for-qa
environment: dev
retries: 0

## Goal

You see the events you are part of. Leadership sees them all.

Until now `event.view` returned `true` for every internal user — anyone could
browse every show. The Owner narrowed it (2026-08-11).

## The rule

- **Owner and Admin** — every event. That is the point of the role.
- **Everyone else** — an event whose **division participates**, or one where
  they are lead, assignee or watcher of a task.
- **External** — never, unchanged.

Division participation counts on its own, deliberately: requiring a task
would mean a division added to an event sees nothing until someone hands them
work, which is backwards — seeing the event is how they pick the work up.

## Why this was the dangerous kind of change

Twelve surfaces read events. Scoping the obvious list would have looked fixed
while the same rows still arrived through the dashboard, search, the calendar,
the ticket portfolio and the AI snapshot. So the decision lives in **one**
module and every surface asks it:

| Surface | Now scoped |
| --- | --- |
| `listActiveEvents`, `listArchivedEvents` | events page + sidebar |
| **`getEvent`** | **the direct-URL guard** — without it, scoping the lists only hides events from people who did not know the address |
| `getPortfolio`, `getUpcomingMilestones`, `getBottlenecks`, `getBlockers`, `getOverdueHotspots`, `getActivityFeed` | dashboard |
| `globalSearch` | ⌘K would otherwise be the back door |
| `buildAssistantContext` | the AI must not describe an event the reader cannot open |
| `portfolioSales` | tickets |
| `listFolders` / `requireFolder` | **dataroom** — these passed `canViewEvent: true` as a constant, so an "event"-level folder would have leaked to people not on the event |

The activity feed keeps event-less entries (user created, branding changed)
for whoever sees every event; they are org-level, not event news.

## Consequences to expect, not bugs

- **A staff member's dashboard now counts only their own events.** Portfolio,
  bottleneck and overdue figures differ between a staff account and the
  Owner. That is the requested behaviour.
- Task visibility *inside* an event **changed too** — see below.

## Task visibility inside an event (Owner 2026-08-11)

The default is now **open across divisions**: a shared event needs a shared
picture, so Production can read Marketing's board on the same event. The
exception is a **sealed task**, which a division head marks when creating it.

- A sealed task is visible to its own division, to Owner/Admin, and **to the
  people actually working on it whatever division they are in** — otherwise
  assigning across divisions would create work its owner cannot open, which
  reads as a bug and gets worked around.
- **Only a head of that division (or leadership) may seal.** Staff cannot hide
  their own work from the rest of the event; the lock is a management
  decision, not a personal one.
- The choice is made at creation, and the row carries a small lock so its own
  division can tell it is not on show.

Replaces the previous rule, where a member simply never saw another
division's tasks. The Owner rejected a broader "All divisions" tab in favour
of this, and it is the better shape: open by default with a named exception,
rather than a second view that quietly bypasses the first.

## Automation Log

- **2026-08-11 — Built and verified.** The pure predicates sit in
  `visibility-rules.ts` so they test without a database — the same split as
  `bottleneck-math.ts` and `dataroom/access.ts`; the first attempt put them
  beside the queries and the test dragged in the db module and the whole env
  schema with it.
  - `scopeCondition` returns `sql\`false\`` for an empty scope rather than
    `inArray(x, [])`, which some drivers reject and which "no filter" would
    answer catastrophically wrongly.
  - Verified with a probe event attached to no division: the Owner sees it in
    the list and opens it; a staff account neither sees it nor can open it by
    URL. Probe deleted afterwards. The demo divisions participate in every
    seeded event, so a negative case had to be created deliberately — the
    obvious test would have passed while proving nothing.
  - Gates: lint ✅ typecheck ✅ 374 tests ✅ build ✅ security ✅.

- **2026-08-11 — Cross-division tasks with a per-task lock.** Migration 0031
  adds `tasks.restricted`. The rule is pure and unit-tested (9 cases); the
  service applies it in ONE place, `filterVisible`, after the query rather
  than inside it — "may see" depends on assignees and watchers, and a
  three-way EXISTS repeated in every task query is far easier to get subtly
  wrong than one rule applied once.
  - `getTaskScoped` moved to the same rule. Without that, a cross-division
    task would have appeared in the list and then refused to open.
  - Verified with real accounts: Marketing sees both its tasks; Production
    sees the open one and neither sees nor can open the sealed one; the Owner
    sees both; **after being assigned, Production sees the sealed task**;
    ordinary staff are refused when they try to seal; the marketing head is
    allowed.
