-- ============================================================================
-- UNDO 20261020_bag_history.sql. Do not run unless you want to go back.
--
-- Part 1 puts the views back as 20261019 made them (re-run that file), and
-- removes the Bag History function and views. Bag History then can't load.
-- Part 2 (optional) drops the columns added to scans.
-- Part 3 (optional) restores scans from the backup taken by the migration.
-- ============================================================================

-- ── Part 1 ─────────────────────────────────────────────────────────────────
BEGIN;
DROP FUNCTION IF EXISTS public.admin_bag_history_stats(integer);
DROP VIEW IF EXISTS public.admin_bag_events;
DROP VIEW IF EXISTS public.admin_bag_batches;
DROP VIEW IF EXISTS public.admin_bag_items;
DROP VIEW IF EXISTS public.admin_bag_scans;
DROP FUNCTION IF EXISTS public.td_scan_location(jsonb);
DROP FUNCTION IF EXISTS public.td_person_label(text);
COMMIT;
-- Then run supabase/migrations/20261019_bag_batches_admin.sql again so Bag
-- Management has its views back.

-- ── Part 2 (optional): drop the columns added to scans ─────────────────────
-- Only those the migration added; check your backup first, they may have
-- existed before (compare with public.scans_backup_20261020).
-- BEGIN;
-- ALTER TABLE public.scans DROP COLUMN IF EXISTS batch_id, DROP COLUMN IF EXISTS status;
-- COMMIT;

-- ── Part 3 (optional): restore scans from the backup ───────────────────────
-- BEGIN;
-- DELETE FROM public.scans WHERE id NOT IN (SELECT id FROM public.scans_backup_20261020);
-- COMMIT;
-- (Values the migration filled in, scanned_by and scanned_at, can be cleared
--  for rows that had them empty in the backup.)
