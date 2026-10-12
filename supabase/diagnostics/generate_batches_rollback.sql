-- ============================================================================
-- UNDO 20261021_generate_batches.sql. Do not run unless you want to go back.
-- The Generate Bags page and Bag Management's "Create New Batch" then can't
-- create batches until the migration is run again.
--
-- Batches and bags already generated stay (they are normal rows). To compare
-- with the state before the migration, see batches_backup_20261021 and
-- bags_backup_20261021.
-- ============================================================================
BEGIN;
DROP FUNCTION IF EXISTS public.admin_generate_batches(text, text, integer, integer, numeric, text, integer);
DROP FUNCTION IF EXISTS public.td_bag_type_code(text);
DROP INDEX IF EXISTS public.bags_qr_code_unique;
COMMIT;

-- Optional, only if you are sure nothing else uses them (they existed before
-- in most databases; check the backup tables first):
-- ALTER TABLE public.bags DROP COLUMN IF EXISTS unit_price;
-- ALTER TABLE public.batches DROP COLUMN IF EXISTS total_batch_price, DROP COLUMN IF EXISTS unit_price;
