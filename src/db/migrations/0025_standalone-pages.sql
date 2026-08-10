-- EPIC-016 T-160: standalone (non-event) pages with private-first sharing.
--
-- NOTE for whoever reads this next: drizzle-kit generated far more than this
-- because snapshots for 0020–0024 were never committed (those were written by
-- hand), so it diffed against 0019 and tried to re-create tables that already
-- exist. Everything it emitted beyond these two tables was verified present in
-- the database and removed from this file. The 0025 snapshot holds the FULL
-- current schema, so the chain is correct again from here — future migrations
-- must be produced with `drizzle-kit generate`, never hand-written.

CREATE TYPE "public"."page_visibility" AS ENUM('private', 'organisation');--> statement-breakpoint
CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text DEFAULT 'Untitled' NOT NULL,
	"content" jsonb,
	"owner_id" uuid NOT NULL,
	"visibility" "page_visibility" DEFAULT 'private' NOT NULL,
	"source_conversation_id" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"user_id" uuid,
	"division_id" text,
	"can_edit" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_shares" ADD CONSTRAINT "page_shares_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_shares" ADD CONSTRAINT "page_shares_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_shares" ADD CONSTRAINT "page_shares_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pages_owner_idx" ON "pages" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "pages_visibility_idx" ON "pages" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "page_shares_page_idx" ON "page_shares" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "page_shares_user_idx" ON "page_shares" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "page_shares_page_user_idx" ON "page_shares" USING btree ("page_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "page_shares_page_division_idx" ON "page_shares" USING btree ("page_id","division_id");
