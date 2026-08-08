-- T-100: digest opt-ins. Both default OFF — digests are strictly opt-in.
--
-- IF NOT EXISTS is deliberate: these two columns were added to the dev
-- database out-of-band before this migration existed, so a plain ADD COLUMN
-- would abort the migration run there. A fresh database still gets both.
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "daily_digest" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "weekly_digest" boolean DEFAULT false NOT NULL;
