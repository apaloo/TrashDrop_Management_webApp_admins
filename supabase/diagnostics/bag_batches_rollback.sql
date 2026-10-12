-- ============================================================================
-- UNDO 20261019_bag_batches_admin.sql. Do not run unless you want to go back.
-- The Bag Management page then can't load (it reads admin_bag_batches).
--
-- Part 1 removes what the migration added except data. Safe.
-- Part 2 (optional) drops the new columns and the values written into them.
-- Part 3 (optional) restores batches from the backup taken by the migration;
--   only needed if something else went wrong, and it loses changes made since.
-- ============================================================================

-- ── Part 1: views, functions, triggers ─────────────────────────────────────
BEGIN;
DROP VIEW IF EXISTS public.admin_bag_batches;
DROP VIEW IF EXISTS public.admin_bag_items;
DROP FUNCTION IF EXISTS public.admin_bag_stats();
DROP FUNCTION IF EXISTS public.admin_set_batch_archived(uuid, boolean);
DROP TRIGGER IF EXISTS td_audit_batch ON public.batches;
DROP FUNCTION IF EXISTS public.td_audit_batch();
DROP TRIGGER IF EXISTS td_batches_fill_details ON public.batches;
DROP FUNCTION IF EXISTS public.td_batches_fill_details();
DROP FUNCTION IF EXISTS public.td_bag_status_rank(text);
DROP FUNCTION IF EXISTS public.td_bag_stage_name(integer);
DROP FUNCTION IF EXISTS public.td_bag_stage_rank(text);
DROP FUNCTION IF EXISTS public.td_user_label(uuid);
DROP FUNCTION IF EXISTS public.td_batch_size_from_text(text, text);
DROP FUNCTION IF EXISTS public.td_batch_type_from_text(text, text);
DROP FUNCTION IF EXISTS public.td_bag_qr_prefix(text, text);
COMMIT;

-- ── Part 2 (optional): drop the new columns ────────────────────────────────
-- BEGIN;
-- ALTER TABLE public.batches DROP COLUMN IF EXISTS type, DROP COLUMN IF EXISTS size,
--   DROP COLUMN IF EXISTS qr_prefix, DROP COLUMN IF EXISTS generated_by,
--   DROP COLUMN IF EXISTS archived, DROP COLUMN IF EXISTS archived_at, DROP COLUMN IF EXISTS archived_by;
-- COMMIT;

-- ── Part 3 (optional): restore batches from the backup ─────────────────────
-- Compare first:
--   SELECT count(*) FROM public.batches_backup_20261019;
-- Then put back the columns that existed before the migration, matching on id
-- (status and created_by may have changed since because households scanned
-- batches; only restore them if you are sure):
-- BEGIN;
-- UPDATE public.batches b SET status = k.status, created_by = k.created_by, updated_at = k.updated_at
-- FROM public.batches_backup_20261019 k WHERE k.id = b.id;
-- COMMIT;
