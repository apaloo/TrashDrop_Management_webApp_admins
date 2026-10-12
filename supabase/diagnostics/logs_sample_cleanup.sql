-- ============================================================================
-- Logs: the seed / sample rows. Run after 20261018_audit_log.sql.
-- They are already hidden on the Logs page (is_sample = true). Only run the
-- DELETE if you want them gone for good. Preview first.
-- ============================================================================

-- PREVIEW: should show the 22 seed rows
SELECT id, created_at, level, source, message
FROM public.logs
WHERE is_sample
ORDER BY created_at;

-- DELETE (change COMMIT to ROLLBACK to try it safely)
BEGIN;
DELETE FROM public.logs WHERE is_sample;
COMMIT;
