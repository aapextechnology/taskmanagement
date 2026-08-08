-- Owner request 2026-08-07: single accountable Lead/PIC per task, distinct
-- from the assignee list.
ALTER TABLE "tasks" ADD COLUMN "lead_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_lead_id_profiles_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
