# backstage — Conventions

This file is the stable convention entry point referenced by both `CLAUDE.md` and `AGENTS.md`. All
values are sourced from `.agentic/config.yml` so the conventions stay in sync with the manifest.

## Global Guardrails

- Never hardcode secrets. Use environment variables and `.env.example`.
- Never deploy production from autonomous loops. DEV-only automation uses
  `scripts/deploy-dev.sh`.
- Never force-push or run destructive database commands from an agent loop.
- Keep changes scoped to the task. Avoid unrelated refactors.

## Protected / Foundation Paths

Shared/foundation files are protected unless the task explicitly requires a reviewed foundation change:

`src/lib/permissions/**, src/lib/auth/**, src/db/schema/**, src/components/ui/**`

Agents (especially `code-agent`) must read but not modify these without an explicit reviewed task.

## Project Conventions

- **Page pattern:** `src/app/(app)/**/page.tsx` — new pages/routes follow this shape.
- **Shared types:** `src/lib/types` — import shared contracts/types from here;
  do not redeclare them locally.
- **Workspaces:** `— (single-app)` (tool: `none`).
- **Package manager:** `pnpm`.
- **Notes:** UI language is English; Acme monochrome theme; ALL data access goes through the central permission module (src/lib/permissions)
- Reuse existing utilities/components before creating local replacements.

## Tenant Scoping

`tenant.scope_fields` = `eventId, divisionId`.

- When **non-empty**, every data-access path / API handler must be scoped by these fields; the review
  and security gates enforce it.
- When **empty (`[]`)**, this project is single-tenant / non-SaaS and tenant checks are **skipped**
  entirely.

## Branches

- **Integration branch** (PRs target this): `develop`.
- **Primary branch** (production-tracking): `main`.

## Gates

| Gate | Script |
| ---- | ------ |
| QA (lint + static) | `scripts/qa.sh` |
| Test (build + tests) | `scripts/test.sh` |
| Security | `scripts/security-check.sh` |

Every task clears the project Definition of Done (`docs/DEFINITION-OF-DONE.md`) before it is
considered done.
