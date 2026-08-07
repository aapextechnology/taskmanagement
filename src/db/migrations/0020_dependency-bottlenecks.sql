-- EPIC-012 T-120: external dependencies + auto-priority bookkeeping.
CREATE TABLE "task_external_dependencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"label" text NOT NULL,
	"party" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "task_external_dependencies" ADD CONSTRAINT "task_external_dependencies_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_external_dependencies" ADD CONSTRAINT "task_external_dependencies_resolved_by_profiles_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_external_dependencies" ADD CONSTRAINT "task_external_dependencies_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_external_deps_task_idx" ON "task_external_dependencies" ("task_id");--> statement-breakpoint
-- auto-bump bookkeeping: when set, priority was bumped by the system and may
-- be auto-reverted; a manual priority edit clears both columns
ALTER TABLE "tasks" ADD COLUMN "priority_before_auto" task_priority;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "auto_urgent_at" timestamp with time zone;
