-- Comment attachments become generic files (Owner request 2026-08-06)
ALTER TABLE "comments" RENAME COLUMN "image_path" TO "attachment_path";
--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "attachment_name" text;
