CREATE TYPE "public"."division_role" AS ENUM('head', 'staff');--> statement-breakpoint
CREATE TYPE "public"."global_role" AS ENUM('owner', 'admin', 'member', 'external');--> statement-breakpoint
CREATE TABLE "division_members" (
	"division_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "division_role" DEFAULT 'staff' NOT NULL,
	CONSTRAINT "division_members_division_id_user_id_pk" PRIMARY KEY("division_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "divisions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text,
	"role" "global_role" DEFAULT 'member' NOT NULL,
	"phone" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "division_members" ADD CONSTRAINT "division_members_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "division_members" ADD CONSTRAINT "division_members_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;