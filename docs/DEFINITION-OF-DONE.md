# Backstage — Definition of Done

> The single, cross-project bar every task clears before it counts as **done**.
> It *wraps* the per-story/-task Acceptance Criteria (`ACCEPTANCE-CRITERIA.md`):
> acceptance criteria say *what* must be true; this checklist adds the *process*
> proof — gates, tests, security, docs, deploy. The test/QA gates and the
> `/nerve` orchestrator reference this file, so "done" means the same thing
> whether a human or an agent declares it.
>
> Path: declared in `.agentic/config.yml` → `docs.definition_of_done`.

---

## The checklist

A task is **done** only when every box is checked:

- [ ] **Merged** — change is on the integration branch via a reviewed PR (never force-pushed, never direct to the primary/production branch).
- [ ] **Acceptance Criteria pass** — every criterion for the story/task (`ACCEPTANCE-CRITERIA.md` form) is demonstrably true: an automated test asserts it, a gate passes on it, or a reviewer verified it against the running app. No "works well"-style unverifiable claims. Reviewer verification is **interim evidence only**: before the epic advances past `ready-for-qa`, every epic-level criterion must be asserted by an automated test that runs in `gates.test` — a feature is only as protected as the tripwire it leaves behind.
- [ ] **Gates green** — `gates.qa`, `gates.test`, and `gates.security` (from `.agentic/config.yml`) all PASS on the change. A red gate blocks done.
- [ ] **Tests added/updated** — new or changed behavior is covered by unit / integration / E2E tests as appropriate; coverage does not regress.
- [ ] **Security reviewed** — no secrets committed, no new injection/authz/SSRF surface; tenant scoping honored where `tenant.scope_fields` is non-empty; protected paths untouched (or change explicitly reviewed).
- [ ] **Docs updated** — the owning epic's **Automation Log** records the outcome, and any affected doc (PRD / stories / tasks / codemaps / README) is updated. Memory is a cache; the Automation Log is the durable record.
- [ ] **Deployed to DEV** — change is deployed to the DEV environment via `deploy.dev_command` and the health/smoke check passes. **Never production from automation** — production is a human-triggered step.

---

## Who enforces each line

| DoD line              | Enforced by                                                            |
| --------------------- | --------------------------------------------------------------------- |
| Merged                | PR review + branch guardrail (no force-push, no primary-branch write) |
| Acceptance Criteria   | review/QA gate against `ACCEPTANCE-CRITERIA.md` + the epic's criteria  |
| Gates green           | `gates.qa` · `gates.test` · `gates.security` scripts                   |
| Tests added           | test gate + coverage check                                            |
| Security reviewed     | security gate + security reviewer                                     |
| Docs updated          | doc/Automation-Log update step in `/nerve`                            |
| Deployed to DEV       | deploy gate (`deploy.dev_command` + `deploy.health_url` smoke)        |

---

## How it's used

- **Gates** — the test/QA/security gates treat these lines as their pass condition; any unchecked box keeps the task open.
- **`/nerve`** — the orchestrator reads this file to decide when a task may move `→ ready-for-qa` (all boxes) versus `→ blocked` (a box cannot be checked after `retries` exhausted).
- **Epics** — when every task in an epic satisfies this checklist, the epic advances to `ready-for-qa` (human QA), then `done`.

> Single-tenant projects (empty `tenant.scope_fields`) skip the tenant-scoping
> sub-item. Projects with no DEV deploy (empty `deploy.dev_command`) skip the
> deploy line — every other line still applies.
