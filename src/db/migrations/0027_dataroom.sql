CREATE TYPE "public"."dataroom_action" AS ENUM('view', 'download', 'upload', 'trash', 'restore');--> statement-breakpoint
CREATE TYPE "public"."dataroom_visibility" AS ENUM('sealed', 'division', 'event', 'organisation');--> statement-breakpoint
CREATE TABLE "dataroom_access_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"file_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"version_no" integer,
	"action" "dataroom_action" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dataroom_file_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"version_no" integer NOT NULL,
	"size_bytes" bigint NOT NULL,
	"mime_type" text DEFAULT 'application/octet-stream' NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dataroom_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"folder_id" uuid NOT NULL,
	"name" text NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"trashed_at" timestamp with time zone,
	"trashed_by" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dataroom_folder_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"folder_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"can_edit" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dataroom_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"visibility" "dataroom_visibility" DEFAULT 'event' NOT NULL,
	"division_id" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "dataroom_quota_bytes" bigint;--> statement-breakpoint
ALTER TABLE "dataroom_access_log" ADD CONSTRAINT "dataroom_access_log_actor_id_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dataroom_file_versions" ADD CONSTRAINT "dataroom_file_versions_file_id_dataroom_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."dataroom_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dataroom_file_versions" ADD CONSTRAINT "dataroom_file_versions_uploaded_by_profiles_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dataroom_files" ADD CONSTRAINT "dataroom_files_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dataroom_files" ADD CONSTRAINT "dataroom_files_folder_id_dataroom_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."dataroom_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dataroom_files" ADD CONSTRAINT "dataroom_files_trashed_by_profiles_id_fk" FOREIGN KEY ("trashed_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dataroom_files" ADD CONSTRAINT "dataroom_files_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dataroom_folder_members" ADD CONSTRAINT "dataroom_folder_members_folder_id_dataroom_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."dataroom_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dataroom_folder_members" ADD CONSTRAINT "dataroom_folder_members_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dataroom_folders" ADD CONSTRAINT "dataroom_folders_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dataroom_folders" ADD CONSTRAINT "dataroom_folders_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dataroom_folders" ADD CONSTRAINT "dataroom_folders_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dataroom_access_log_file_idx" ON "dataroom_access_log" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "dataroom_access_log_event_idx" ON "dataroom_access_log" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "dataroom_access_log_actor_idx" ON "dataroom_access_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "dataroom_file_versions_file_idx" ON "dataroom_file_versions" USING btree ("file_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dataroom_file_versions_file_no_idx" ON "dataroom_file_versions" USING btree ("file_id","version_no");--> statement-breakpoint
CREATE INDEX "dataroom_files_event_idx" ON "dataroom_files" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "dataroom_files_folder_idx" ON "dataroom_files" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX "dataroom_files_trashed_idx" ON "dataroom_files" USING btree ("trashed_at");--> statement-breakpoint
CREATE INDEX "dataroom_folder_members_folder_idx" ON "dataroom_folder_members" USING btree ("folder_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dataroom_folder_members_folder_user_idx" ON "dataroom_folder_members" USING btree ("folder_id","user_id");--> statement-breakpoint
CREATE INDEX "dataroom_folders_event_idx" ON "dataroom_folders" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "dataroom_folders_parent_idx" ON "dataroom_folders" USING btree ("parent_id");