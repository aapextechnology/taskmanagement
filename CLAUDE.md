@AGENTS.md
@CONVENTIONS.md
@~/.claude/persona.md
@~/.claude/gotchas.md

# rvc-backstage — Project Operating System

## Stack

`single-app` · package manager `pnpm` · monorepo tool
`none` · workspaces `— (single-app)`.

- Pages follow `src/app/(app)/**/page.tsx`.
- Shared types come from `src/lib/types`.
- **Never modify** the protected/foundation paths without a reviewed task: `src/lib/permissions/**, src/lib/auth/**, src/db/schema/**, src/components/ui/**`.
- UI language is English; RVC monochrome theme; ALL data access goes through the central permission module (src/lib/permissions)

---

## The Front Door — `/nerve`

`/nerve "<task>"` is the centralized brain. Drop any task there and it senses, retrieves context,
routes to the best agent or organ command, runs the gates, and learns from the result. It is a thin
frontend over `~/.agentic-workflows/nerve-runbook.md`.

Organ commands `/nerve` (and you) orchestrate:

| Command | Use for |
| ------- | ------- |
| `/nerve "<task>"` | Front door — auto-selects persona, routes, runs gates, learns |
| `/engage <persona> "<task>"` | Force a specific expert persona, then execute via `/nerve` |
| `/agentic-start "<brief>"` | Raw task/enhancement drop → epic/task shaping → optional dev start |
| `/task-work EPIC-XXX <n>` | Work ONE task group → gates → branch/push/PR to `develop` |
| `/epic-loop docs/epics/EPIC-XXX.md` | Run a whole epic end-to-end with gates + DEV deploy |
| `/epic-new "<feature>"` | Plan a feature → write a local epic file only (push manually) |
| `/agentic-init [mode]` | Bootstrap/maintain the agentic wiring (additive, non-destructive) |

---

## The Nervous System (how work flows)

This project runs the agentic nervous system defined in the global rules
`~/.claude/rules/ecc/common/*.md`. Read and follow them:

- **`nervous-system.md`** — three layers: **L1 Sense/Reflex** (hooks + cheap classifier; trivial edits
  direct) → **L2 Coordinate** (multi-agent orchestration, MCP tools, skills) → **L3 Escalate** (human
  + deepest reasoning + `status: blocked`). Spend the cheapest capable tier; escalate fast.
- **`agent-routing.md`** — **discovery-first** routing: derive the capability, ask the recommender
  (`guidance_recommend` / `hooks_route`), prefer pre-built ECC/Ruflo agents, fall back to custom
  agents only for project-specific behavior.
- **`self-learning.md`** + **`memory-protocol.md`** — the **retrieve → judge → distill → consolidate**
  loop that wraps every gated task. Memory is a cache; durable decisions are ALSO copied to the epic
  `Automation Log`.
- **`graph-intelligence.md`** — unified RETRIEVE over Graphify (structure) + AgentDB (decisions) +
  Context7 (external docs).
- **`docs-source-of-truth.md`** — the standard `/docs` set and canonicity order.
- **`testing-taxonomy.md`** — what each gate must cover.

> **Graceful degradation.** Every memory/graph/hook/recommender call no-ops cleanly when Ruflo,
> AgentDB, Graphify, Context7, or `claude` is absent. The workflow still runs on plain tools.

---

## Agents

The kit ships these custom project agents in `.claude/agents/` (project-specific slice only — generic
quality/security is handled by pre-built ECC/Ruflo agents):

| Agent | Purpose |
| ----- | ------- |
| `epic-orchestrator` | Reads `docs/epics/`, drives the task loop (discovery-first routing) |
| `code-agent` | Implements one task with a minimal, convention-following change |
| `review-qa-agent` | Acceptance criteria + project conventions + tenant scoping |
| `test-agent` | Runs `scripts/qa.sh` + `scripts/test.sh` |
| `security-agent` | Runs `scripts/security-check.sh` + project-specific risks |
| `deploy-agent` | DEV-only deploy via `scripts/deploy-dev.sh` |

**Reuse policy.** Before creating or invoking a custom agent, check the pre-built ECC and Ruflo
families. Reuse a pre-built agent when one fits; use a custom agent only for genuinely
project-specific behavior. Do not call every installed agent.

---

## Expert Personas (Default Dev Memory)

The 10 expert personas in `~/.agentic-workflows/expert-personas.md` are the default mindset
modes for every development and debugging session. `/nerve` auto-selects the right one;
`/engage <persona>` forces a specific one.

| Persona | Use when |
| ------- | -------- |
| `startup-mvp` | Building an MVP or greenfield project from scratch |
| `codebase-audit` | Joining an unfamiliar codebase, architecture review |
| `debug-production` | Investigating a bug, production issue, or outage |
| `perf-optimize` | Performance bottlenecks, memory leaks, scaling |
| `clean-architecture` | Refactoring messy code into clean architecture |
| `backend-systems` | API design, database schema, caching, infra |
| `frontend-engineer` | UI components, accessibility, responsive design |
| `tech-lead` | Pre-code planning, tradeoffs, architecture decisions |
| `security-audit` | Security review, vulnerabilities, auth, injection |
| `devops-deploy` | CI/CD, Docker, Kubernetes, monitoring, deployment |

---

## Epic Lifecycle

```
backlog → on-progress → coding → review → testing → deploying-dev → ready-for-qa → done
                                                                   ↘ blocked (on failure)
```

Only epics with `status: on-progress` (or a mid-flight phase) are picked up by automation;
`backlog`, `done`, and `blocked` are skipped. Epic files live under `docs/epics/` and
carry frontmatter (`status`, `environment`, `retries`) plus a `## Automation Log` — the durable record
the self-learning loop writes to.

---

## Deployment Rules

**Allowed:** DEV deployment only (`scripts/deploy-dev.sh`).

**Forbidden:** production deploy · production infra changes · force push · secret exposure ·
destructive database operations · editing production env files · changing CI/CD deploy targets without review.

**Production always requires human approval.**

---

## Security Rules

Never: commit secrets · print credentials · disable security checks · bypass tests · modify production
environment files · run `DROP TABLE` / `TRUNCATE` / `DELETE` without `WHERE` · `rm -rf` important
directories. Run the security gate before deployment.

---

## Gate Scripts

| Script | Purpose |
| ------ | ------- |
| `scripts/qa.sh` | Lint + static checks |
| `scripts/test.sh` | Install + build/type-check + tests |
| `scripts/security-check.sh` | Secrets, env files, destructive SQL, dep audit |
| `scripts/deploy-dev.sh` | DEV-only deployment (refuses production) |

---

## What Remains Manual

Production deployment · epic creation and prioritization · QA sign-off on `ready-for-qa` epics ·
security audit for CRITICAL findings · infrastructure and database schema changes.
