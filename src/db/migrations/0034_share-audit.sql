ALTER TYPE "public"."dataroom_action" ADD VALUE 'share_created';--> statement-breakpoint
ALTER TYPE "public"."dataroom_action" ADD VALUE 'share_revoked';--> statement-breakpoint
ALTER TABLE "dataroom_access_log" ADD COLUMN "note" text;