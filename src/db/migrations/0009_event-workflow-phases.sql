-- Per-event workflow phases (Owner request 2026-08-06):
-- fixed event_phase enum → event_phases table + events.current_phase_id.
-- Existing events get the six default phases and keep their current position.

CREATE TABLE "event_phases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_phases" ADD CONSTRAINT "event_phases_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "event_phases_event_name_idx" ON "event_phases" USING btree ("event_id","name");
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "current_phase_id" uuid;
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_current_phase_id_event_phases_id_fk" FOREIGN KEY ("current_phase_id") REFERENCES "public"."event_phases"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "event_phases" ("event_id", "name", "sort_order")
SELECT e."id", p.name, p.ord
FROM "events" e
CROSS JOIN (VALUES ('Planning',0),('Pre-production',1),('Promotion',2),('Show week',3),('Show day',4),('Settlement',5)) AS p(name, ord);
--> statement-breakpoint
UPDATE "events" SET "current_phase_id" = ep."id"
FROM "event_phases" ep
WHERE ep."event_id" = "events"."id"
  AND lower(replace(replace(ep."name", '-', '_'), ' ', '_')) = "events"."phase"::text;
--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN "phase";
--> statement-breakpoint
DROP TYPE "public"."event_phase";
