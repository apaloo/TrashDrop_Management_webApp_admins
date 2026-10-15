-- ============================================================================
-- Pickup disposal: add the columns the collector app writes when a pickup is
-- disposed. Until now pickup_requests had no disposal_site or
-- disposal_timestamp, so that save failed (42703) and pickups could not be
-- marked disposed from the app. The payout columns come from the collector
-- app's 20260419_add_payout_columns_to_pickup_requests.sql and are added here
-- too only if missing. Adds empty columns; changes no existing data.
-- Undo: supabase/diagnostics/pickup_disposal_columns_rollback.sql
-- ============================================================================

ALTER TABLE public.pickup_requests
  ADD COLUMN IF NOT EXISTS disposal_site                text,
  ADD COLUMN IF NOT EXISTS disposal_timestamp           timestamptz,
  ADD COLUMN IF NOT EXISTS collector_core_payout        numeric(10,2),
  ADD COLUMN IF NOT EXISTS collector_urgent_payout      numeric(10,2),
  ADD COLUMN IF NOT EXISTS collector_distance_payout    numeric(10,2),
  ADD COLUMN IF NOT EXISTS collector_surge_payout       numeric(10,2),
  ADD COLUMN IF NOT EXISTS collector_tips               numeric(10,2),
  ADD COLUMN IF NOT EXISTS collector_recyclables_payout numeric(10,2),
  ADD COLUMN IF NOT EXISTS collector_loyalty_cashback   numeric(10,2),
  ADD COLUMN IF NOT EXISTS collector_total_payout       numeric(10,2),
  ADD COLUMN IF NOT EXISTS platform_share               numeric(10,2),
  ADD COLUMN IF NOT EXISTS payout_breakdown             jsonb;

COMMENT ON COLUMN public.pickup_requests.disposal_site IS 'Disposal site name (and address) chosen by the collector';

NOTIFY pgrst, 'reload schema';

-- Expect 12 rows
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'pickup_requests'
  AND column_name IN ('disposal_site', 'disposal_timestamp', 'collector_core_payout', 'collector_urgent_payout',
    'collector_distance_payout', 'collector_surge_payout', 'collector_tips', 'collector_recyclables_payout',
    'collector_loyalty_cashback', 'collector_total_payout', 'platform_share', 'payout_breakdown')
ORDER BY column_name;
