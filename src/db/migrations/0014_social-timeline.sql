-- Social timeline (Owner request 2026-08-06): comment images + seen markers
ALTER TABLE "comments" ADD COLUMN "image_path" text;
--> statement-breakpoint
CREATE TABLE "timeline_reads" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"timeline_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"mentions_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "timeline_reads" ADD CONSTRAINT "timeline_reads_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
