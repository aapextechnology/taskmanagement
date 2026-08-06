# RVC Backstage

Task management system for **Raw Vision Collective** — an international-scale concert
promoter. One workspace per event, 11 divisions, cross-division handoffs, an approval
engine, and scoped external collaborator access. *"Everything behind the show."*

## Stack

Next.js (App Router, TypeScript) · Tailwind + shadcn/ui (RVC monochrome, dark default) ·
PostgreSQL (self-hosted) + Drizzle ORM · Auth.js v5 · SSE realtime · Docker Compose.

## Getting started

```bash
pnpm install
pnpm dev          # app on http://localhost:3000
```

Quality checks:

```bash
pnpm lint         # eslint
pnpm typecheck    # next typegen + tsc
pnpm test         # vitest
bash scripts/qa.sh && bash scripts/test.sh && bash scripts/security-check.sh  # full gates
```

## Where the truth lives

| Question | Answer |
| --- | --- |
| Why are we building this? | [docs/product/PRD.md](docs/product/PRD.md) (source plan: [docs/PLAN.en.md](docs/PLAN.en.md)) |
| What is the live state of work? | [docs/epics/README.md](docs/epics/README.md) — canonical registry |
| What tasks exist? | [docs/product/ENGINEERING-TASKS.md](docs/product/ENGINEERING-TASKS.md) |
| When is something "done"? | [docs/DEFINITION-OF-DONE.md](docs/DEFINITION-OF-DONE.md) |
| Agentic workflow config | [.agentic/config.yml](.agentic/config.yml) · [CLAUDE.md](CLAUDE.md) |

## Layout

```
src/
  app/          # Next.js App Router routes
  components/   # UI components (components/ui = shadcn base — protected path)
  db/           # Drizzle schema + migrations (schema/ is a protected path)
  lib/          # services, shared types (lib/types), utilities
                # lib/permissions (T-012) will be the central authz module — protected
```

Protected paths (see manifest) require an explicitly reviewed task to change.
