CREATE TYPE "public"."event_health" AS ENUM('on_track', 'at_risk', 'critical');--> statement-breakpoint
CREATE TYPE "public"."event_phase" AS ENUM('planning', 'pre_production', 'promotion', 'show_week', 'show_day', 'settlement');--> statement-breakpoint
CREATE TABLE "event_divisions" (
	"event_id" uuid NOT NULL,
	"division_id" text NOT NULL,
	CONSTRAINT "event_divisions_event_id_division_id_pk" PRIMARY KEY("event_id","division_id")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"artists" text DEFAULT '' NOT NULL,
	"venue" text DEFAULT '' NOT NULL,
	"show_date" timestamp with time zone NOT NULL,
	"capacity" integer,
	"phase" "event_phase" DEFAULT 'planning' NOT NULL,
	"health" "event_health" DEFAULT 'on_track' NOT NULL,
	"cover_image_path" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_divisions" ADD CONSTRAINT "event_divisions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_divisions" ADD CONSTRAINT "event_divisions_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE cascade ON UPDATE no action;