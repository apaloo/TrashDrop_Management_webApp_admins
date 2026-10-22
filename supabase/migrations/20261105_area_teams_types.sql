-- ============================================================================
-- Fix: "Couldn't load the teams" when a Volunteer or Authority assigns a
-- cleanup. area_assignable_teams() (20261104) returned collector_profiles
-- columns as they are stored; where a column is varchar rather than text
-- (e.g. vehicle_type), PostgreSQL refuses with "structure of query does not
-- match function result type". Every column is now cast to the declared type
-- (vehicle_type is read by name, so a missing column is fine too).
-- Same rules as before. Safe to re-run. One transaction.
-- Undo: re-run 20261104_area_dumping_access.sql (restores the old version).
-- ============================================================================

BEGIN;
SET LOCAL search_path = public;

CREATE OR REPLACE FUNCTION public.area_assignable_teams()
RETURNS TABLE (id uuid, name text, collector_type text, region text, vehicle_type text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sc jsonb := public.td_report_scope();
  my_region text;
  my_role text := public.td_my_role();
BEGIN
  IF NOT public.can_do('dumping.assign') THEN
    RAISE EXCEPTION 'Your account can''t assign cleanups' USING ERRCODE = '42501';
  END IF;
  my_region := CASE WHEN sc ->> 'level' = 'national' THEN NULL ELSE sc ->> 'region' END;
  IF sc ->> 'level' <> 'national' AND my_region IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT cp.id::uuid,
         coalesce(nullif(btrim(concat_ws(' ', cp.first_name, cp.last_name)), ''), 'Unnamed team')::text,
         coalesce(to_jsonb(cp) ->> 'collector_type', 'collector')::text,
         public.td_collector_region(cp.id::text)::text,
         (to_jsonb(cp) ->> 'vehicle_type')::text
  FROM public.collector_profiles cp
  WHERE coalesce(cp.status, '') NOT IN ('suspended', 'inactive')
    AND (to_jsonb(cp) ->> 'deactivated_at') IS NULL
    AND (my_region IS NULL OR public.td_norm_region(public.td_collector_region(cp.id::text)) = public.td_norm_region(my_region))
    AND (my_role <> 'volunteer' OR coalesce(to_jsonb(cp) ->> 'collector_type', 'collector') = 'volunteer')
  ORDER BY 2;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
