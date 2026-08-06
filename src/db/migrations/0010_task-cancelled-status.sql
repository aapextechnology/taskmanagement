-- "Cancelled" task status (Owner request 2026-08-06, Plane-style list groups)
ALTER TYPE "public"."task_status" ADD VALUE IF NOT EXISTS 'cancelled';
