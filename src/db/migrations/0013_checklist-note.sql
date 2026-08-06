-- Checklist item note/keterangan (Owner request 2026-08-06)
ALTER TABLE "task_checklist_items" ADD COLUMN "note" text DEFAULT '' NOT NULL;
