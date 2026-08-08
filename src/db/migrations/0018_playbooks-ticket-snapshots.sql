-- EPIC-009: event playbooks + daily ticket sales snapshots
CREATE TABLE "event_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_templates_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "event_template_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"division_id" text NOT NULL,
	"title" text NOT NULL,
	"priority" "task_priority" DEFAULT 'medium' NOT NULL,
	"offset_days" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_sales_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"day" text NOT NULL,
	"tickets_sold" integer NOT NULL,
	"revenue" bigint DEFAULT 0 NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"recorded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_template_items" ADD CONSTRAINT "event_template_items_template_id_event_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."event_templates"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_template_items" ADD CONSTRAINT "event_template_items_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ticket_sales_snapshots" ADD CONSTRAINT "ticket_sales_snapshots_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ticket_sales_snapshots" ADD CONSTRAINT "ticket_sales_snapshots_recorded_by_profiles_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_snapshots_event_day_idx" ON "ticket_sales_snapshots" USING btree ("event_id","day");
