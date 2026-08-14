CREATE TABLE "dataroom_share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"label" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"passcode_hash" text,
	"require_email" boolean DEFAULT true NOT NULL,
	"allowed_emails" jsonb,
	"allow_download" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dataroom_access_log" ADD COLUMN "viewer_email" text;--> statement-breakpoint
ALTER TABLE "dataroom_access_log" ADD COLUMN "share_link_id" uuid;--> statement-breakpoint
ALTER TABLE "dataroom_share_links" ADD CONSTRAINT "dataroom_share_links_file_id_dataroom_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."dataroom_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dataroom_share_links" ADD CONSTRAINT "dataroom_share_links_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dataroom_share_links" ADD CONSTRAINT "dataroom_share_links_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dataroom_share_links_token_idx" ON "dataroom_share_links" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "dataroom_share_links_file_idx" ON "dataroom_share_links" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "dataroom_share_links_event_idx" ON "dataroom_share_links" USING btree ("event_id");