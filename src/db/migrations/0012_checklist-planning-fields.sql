-- Checklist items get their own planning fields (Owner request 2026-08-06)
ALTER TABLE "task_checklist_items" ADD COLUMN "start_date" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "task_checklist_items" ADD COLUMN "due_date" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "task_checklist_items" ADD COLUMN "priority" "task_priority";
