-- Fix event workflow phases whose sort_order collided (root cause: the
-- seeder's bulk phase insert relied on onConflictDoNothing keyed on
-- (event_id, name), so a manually-added phase with a DIFFERENT name at the
-- same slot never conflicted and both rows kept sort_order 0 — e.g. a
-- "Plan" phase and the seeded "Planning" phase both at 0). Owner-reported
-- 2026-08-07.

-- Step 1: for any (event_id, sort_order) collision, keep — in order of
-- preference — the phase that is the event's current phase, then a phase
-- whose name matches the canonical DEFAULT_PHASES list (the seeded name,
-- not a stray manual one), then the lowest id as a last-resort tiebreak.
WITH ranked AS (
  SELECT
    ep.id,
    ROW_NUMBER() OVER (
      PARTITION BY ep.event_id, ep.sort_order
      ORDER BY
        (ep.id = e.current_phase_id) DESC,
        (ep.name IN ('Planning', 'Pre-production', 'Promotion', 'Show week', 'Show day', 'Settlement')) DESC,
        ep.id
    ) AS rn
  FROM event_phases ep
  JOIN events e ON e.id = ep.event_id
)
DELETE FROM event_phases
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
--> statement-breakpoint

-- Step 2: renumber every event's remaining phases contiguously (0..n-1),
-- closing any gaps left by past deletes along the way.
WITH renumbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY sort_order, id) - 1 AS new_order
  FROM event_phases
)
UPDATE event_phases ep
SET sort_order = r.new_order
FROM renumbered r
WHERE ep.id = r.id;
--> statement-breakpoint

-- Step 3: make this class of bug structurally impossible going forward.
CREATE UNIQUE INDEX "event_phases_event_sort_idx" ON "event_phases" ("event_id", "sort_order");
