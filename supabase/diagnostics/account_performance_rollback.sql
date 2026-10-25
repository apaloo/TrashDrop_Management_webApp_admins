-- Undo supabase/migrations/20261109_account_performance.sql
--
-- Removes the dashboard functions, the 5-minute refresh and the daily totals
-- (derived data, rebuilt from account_activity if the migration is run
-- again). The metric list is kept, so admin edits are not lost; to remove it
-- too, export it first, then run the DROP TABLE at the end by hand.
-- account_activity (20261108) is not touched. One transaction.

BEGIN;
SET LOCAL search_path = public;

-- (cron.job is only looked up when pg_cron is installed)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    EXECUTE 'SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = ''td-refresh-performance''';
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.performance_overview(text, text, integer);
DROP FUNCTION IF EXISTS public.my_performance(integer, uuid);
DROP FUNCTION IF EXISTS public.td_metric_values(text, uuid[], date, date);
DROP TRIGGER IF EXISTS td_performance_metrics_changed ON public.performance_metrics;
DROP FUNCTION IF EXISTS public.td_performance_metrics_changed();
DROP FUNCTION IF EXISTS public.td_refresh_performance(integer);
DROP FUNCTION IF EXISTS public.td_in_account_area(text, text, text, text, text);
DROP FUNCTION IF EXISTS public.td_performance_accounts();
DROP TABLE IF EXISTS public.performance_daily;
DROP TABLE IF EXISTS public.performance_refresh;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Optional, after exporting the metric list:
--   DROP TABLE public.performance_metrics;
--   DROP FUNCTION public.td_valid_metric(text, jsonb);
