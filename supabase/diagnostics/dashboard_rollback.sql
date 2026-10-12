-- UNDO 20261022_dashboard.sql (read-only functions; no data was changed).
-- The Dashboard then can't load its numbers until the migration is run again.
BEGIN;
DROP FUNCTION IF EXISTS public.admin_dashboard_stats(timestamptz, timestamptz, integer, integer);
DROP FUNCTION IF EXISTS public.admin_stale_requests(integer);
DROP FUNCTION IF EXISTS public.td_request_group(text, text);
COMMIT;
