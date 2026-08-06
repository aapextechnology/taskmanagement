# RVC Backstage — Acceptance Criteria Standard

> The single, shared definition of "what makes a story or task acceptable" for this
> project. User stories (`USER-STORIES.md`) and epics (`docs/epics/*`) embed acceptance
> criteria written to this standard. This file defines the **format**; individual
> stories/epics supply the **content**.

---

## Two complementary forms

Use **both**, picking the one that fits the criterion:

### 1. Given / When / Then (behavioural)

For anything observable through the product's interface — the default for user stories.

```
Given {precondition / starting state}
When  {the user or system does X}
Then  {the observable, verifiable outcome}
And   {any additional guaranteed outcome}
```

- **Given** sets the world up (data, role, page).
- **When** is a single triggering action.
- **Then** is observable and testable — assertable by a human or an automated test.
- Cover the **happy path first**, then add scenarios for negative / edge / error paths.
  For this project the negative paths that matter most are **permission denials**:
  every story touching data needs at least one "wrong role / wrong division / wrong
  event → rejected, no state change" scenario.

### 2. Checklist (structural / non-behavioural)

For constraints that aren't a user flow — schema rules, performance budgets, security
invariants, convention compliance:

- [ ] {Verifiable structural requirement}
- [ ] {Performance / limit budget, with the number}
- [ ] {Security or scoping invariant}
- [ ] {Convention the change must follow}

---

## How acceptance criteria are embedded

| Location | What it carries |
| --- | --- |
| **User stories** | One **Acceptance:** paragraph per domain — the shared bar for that domain. |
| **Epics (epic-level)** | `## Acceptance Criteria` → the outcomes that mark the whole epic acceptable. |
| **Epics (per-task)** | Per-`### task group` criteria — the bar one PR-sized task must clear. |

A criterion is **done** only when it is demonstrably true: an automated test asserts it,
a gate (qa/test/security) passes on it, or a reviewer verifies it against the running app.
Unverifiable criteria ("works well", "is fast") are not acceptable — quantify or restate
them as Given/When/Then.

---

## Worked example (this project)

Story: *US-TASK-5 — As a Head, I want to request a handoff to another division…*

**Given/When/Then**

```
Given a signed-in Marketing Head with a task in event "YE Live Concert"
When  they request a handoff to Production with a note
Then  the Production Head receives a handoff notification
And   accepting it creates a linked task on Production's board, set as a
      dependency of the origin task

Given a signed-in External guest on the same event
When  they attempt to create or accept a handoff via the API
Then  the request is rejected by the permission module with no state change
```

**Checklist**

- [ ] Data access is scoped by `eventId` + `divisionId` through `src/lib/permissions` (never inline role checks).
- [ ] Shared types come from `src/lib/types` / the Drizzle schema (not redeclared).
- [ ] Protected paths (`src/lib/permissions/**`, `src/lib/auth/**`, `src/db/schema/**`, `src/components/ui/**`) untouched, or the change is an explicitly reviewed task.
- [ ] Covered by unit tests (permission branches) + an integration test (handoff flow); gates green.

> See `../DEFINITION-OF-DONE.md` for the cross-project completion checklist that wraps these
> criteria (criteria pass **and** gates/tests/docs/deploy steps complete).
