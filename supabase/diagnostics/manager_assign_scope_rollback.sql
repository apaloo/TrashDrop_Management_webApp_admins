-- Undo 20261103_manager_assign_scope.sql: Managers can again assign any
-- collector to any request (the rules from 20261027). Nothing else changes.
BEGIN;
SET LOCAL search_path = public;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pickup_requests', 'digital_bins', 'scheduled_pickups'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS ab_td_manager_assign ON public.%I', t);
    END IF;
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.td_guard_manager_assign();
DROP FUNCTION IF EXISTS public.td_request_region(text, jsonb);
DROP FUNCTION IF EXISTS public.td_collector_region(text);
DROP FUNCTION IF EXISTS public.td_my_assign_region();
DROP FUNCTION IF EXISTS public.td_norm_region(text);

NOTIFY pgrst, 'reload schema';
COMMIT;
