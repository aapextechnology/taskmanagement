# EPIC-022: Ticketing channels — Tessera + Megatix

status: ready-for-qa
environment: dev
retries: 0

## Goal

Let one show sell through more than one ticketing platform and have the app
read both, without either channel's numbers hiding the other's. Tessera
arrived first (2026-08-12); Megatix is the second channel (Owner 2026-08-17:
"ini bedakan jadi megatix ya jadi ada 2 channel — tessera dan megatix").

## Tasks

### T-220 One transaction store for every provider

`ticket_transactions` replaces `tessera_transactions`: same typed columns plus
`provider`, `quantity`, `buyer_phone`, keyed unique on
(provider, event_id, provider_txn_id). `event_ticket_channels` replaces the
single `events.tessera_event_id` column, so an event can hold a Tessera row
AND a Megatix row at once.

### T-221 Megatix client and readers

`src/lib/megatix/` — documented v4 Data API: `auth/login`, `presenters`,
`events`, `reports/orders`. Pure readers with 13 tests pinned to the
documented payload.

### T-222 Two-channel Connect tab

Per-channel cards (tickets / revenue / fees), a combined line, a per-channel
transaction filter, and one health pill per platform.

## Acceptance Criteria

- An event may link Tessera, Megatix, or both; unlinking one leaves the
  other and keeps stored history.
- Ticket counts sum `quantity` (Megatix orders carry several tickets).
- Money renders in the currency the row reports, not always IDR.
- The page makes zero provider API calls; it reads the database.
- Each sync fails independently — a dead provider cannot stop the other.

## Automation Log

- 2026-08-17 — Shipped. Migrations 0038 (new tables) → 0039 (data copy) →
  0040 (drop legacy) deliberately split so no generated DROP could run before
  the rows were copied; drizzle-kit's interactive rename prompt would have
  risked exactly that. Verified live: 54 Tessera transactions and their
  Rp 21,873,857 gross carried across unchanged, the old table gone, and a
  fresh Tessera sync still upserting to 54 rows (no duplication).
- 2026-08-17 — **Auth shapes differ, and that is the operational headline.**
  Tessera = a hand-pasted token that dies in ~5 days. Megatix = email +
  password → ~8-hour token, so the server re-logs-in by itself and there is
  no paste ritual. The cost is that a Megatix PASSWORD sits in `app_settings`:
  stored write-only, never returned to a browser, never logged. Owner advised
  to use a dedicated Megatix API login, not a personal admin account.
- 2026-08-17 — Megatix reports no promoter-net figure, so `net_sales` stays
  NULL for its rows rather than being inferred from amount − fees. The
  Connect tab shows "—". Guessing here would have produced a settlement
  number nobody could defend.
- 2026-08-17 — Megatix timestamps arrive with NO zone ("2024-07-01 11:36:54").
  Read as WIB, with the untouched string kept in `raw` so the assumption is
  auditable. Reading them as UTC would file Jakarta orders seven hours early
  and land some on the wrong sales day.
- 2026-08-17 — Currency is per event on Megatix (their sample is AUD), so
  `formatMoney(amount, currency)` replaced blanket `formatIDR` on this
  surface, and the combined total refuses to add across currencies.
- **Pending Owner input**: Megatix account email/password and the API host
  for their region (default assumes `api.megatix.com.au`). Until those are
  entered in Admin → Megatix ticketing, the channel stays dormant — verified
  that an unconfigured Megatix sync no-ops cleanly rather than erroring.
