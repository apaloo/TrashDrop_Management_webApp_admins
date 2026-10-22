-- ============================================================================
-- Who may assign pickup requests to collectors, and where.
--
-- Until now any approved Manager could put any collector on any pickup
-- request, anywhere in Ghana. From now on:
--   Admin    any request, any collector (unchanged)
--   Manager  only when the account type is Waste Management and the account
--            has a region (account_roles.company_type / region), and then
--            only requests in that region, to collectors in that region
--   others   unchanged (collectors still accept and release their own jobs
--            in the collector app; households still cancel their own)
--
-- A request's region: pickup_requests.region (tagged from its location by
-- td_tag_area, 20261026), else its location; a digital bin's region comes
-- from its bin location. A collector's region: collector_profiles.region
-- (chosen at sign-up from Ghana's 16 regions), else assigned_region.
--
-- Everything else a Manager could do on a request (status, cancel, view)
-- stays as it is. Additive; safe to re-run. One transaction.
-- Needs 20261023 (account_roles), 20261026 (td_area_at) and 20261027.
-- Undo: supabase/diagnostics/manager_assign_scope_rollback.sql
-- ============================================================================

BEGIN;
SET LOCAL search_path = public;

-- ── 1. helpers ─────────────────────────────────────────────────────────────
-- "Greater Accra Region " → "greater accra", so spellings of the same region match
CREATE OR REPLACE FUNCTION public.td_norm_region(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT nullif(lower(btrim(regexp_replace(coalesce(p, ''), '\s+region\s*$', '', 'i'))), '')
$$;

-- The region the signed-in account may assign in: '*' for Admin, the region
-- of a Waste Management Manager, NULL for everyone else
CREATE OR REPLACE FUNCTION public.td_my_assign_region()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN public.td_is_staff() THEN '*'
    WHEN public.td_my_role() = 'manager' THEN (
      SELECT ar.region FROM public.account_roles ar
      WHERE ar.user_id = auth.uid()
        AND lower(coalesce(ar.company_type, '')) = 'waste_management'
        AND public.td_norm_region(ar.region) IS NOT NULL)
    ELSE NULL END
$$;

-- A collector's region, by auth user id or collector profile id
CREATE OR REPLACE FUNCTION public.td_collector_region(p_ref text)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(nullif(btrim(cp.region), ''), nullif(btrim(cp.assigned_region), ''))
  FROM public.collector_profiles cp
  WHERE cp.user_id::text = p_ref OR cp.id::text = p_ref
  ORDER BY (cp.user_id::text = p_ref) DESC
  LIMIT 1
$$;

-- A request row's region (pickup_requests, digital_bins, scheduled_pickups)
CREATE OR REPLACE FUNCTION public.td_request_region(p_table text, p_row jsonb)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  g geometry;
  reg text := nullif(btrim(p_row ->> 'region'), '');
BEGIN
  IF reg IS NOT NULL THEN RETURN reg; END IF;
  IF p_table = 'digital_bins' AND (p_row ->> 'location_id') IS NOT NULL AND to_regclass('public.bin_locations') IS NOT NULL THEN
    SELECT public.td_report_point(to_jsonb(bl)) INTO g FROM public.bin_locations bl WHERE bl.id::text = p_row ->> 'location_id';
  END IF;
  g := coalesce(g, public.td_report_point(p_row));
  IF g IS NULL THEN RETURN NULL; END IF;
  SELECT a.region INTO reg FROM public.td_area_at(ST_Y(g), ST_X(g)) a;
  RETURN reg;
END $$;

REVOKE ALL ON FUNCTION public.td_my_assign_region() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.td_collector_region(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.td_request_region(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.td_my_assign_region() TO authenticated;
GRANT EXECUTE ON FUNCTION public.td_collector_region(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.td_request_region(text, jsonb) TO authenticated;

-- ── 2. the rule, on every table a request can live in ─────────────────────
-- Runs only when a Manager (not an Admin) puts a collector on a request.
CREATE OR REPLACE FUNCTION public.td_guard_manager_assign()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_collector text := to_jsonb(NEW) ->> 'collector_id';
  old_collector text;
  mine text;
  req_region text;
  col_region text;
BEGIN
  IF auth.uid() IS NULL OR new_collector IS NULL OR public.td_is_staff()
     OR public.td_my_role() IS DISTINCT FROM 'manager' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    old_collector := to_jsonb(OLD) ->> 'collector_id';
    IF old_collector IS NOT DISTINCT FROM new_collector THEN RETURN NEW; END IF;
  END IF;

  mine := public.td_my_assign_region();
  IF mine IS NULL THEN
    RAISE EXCEPTION 'Only Waste Management managers with a region can assign collectors. Ask an admin to set your account type and region.'
      USING ERRCODE = '42501';
  END IF;

  req_region := public.td_request_region(TG_TABLE_NAME, to_jsonb(NEW));
  IF public.td_norm_region(req_region) IS DISTINCT FROM public.td_norm_region(mine) THEN
    RAISE EXCEPTION 'This request is in % region. You can only assign requests in % region.',
      coalesce(req_region, 'an unknown'), mine USING ERRCODE = '42501';
  END IF;

  col_region := public.td_collector_region(new_collector);
  IF public.td_norm_region(col_region) IS DISTINCT FROM public.td_norm_region(mine) THEN
    RAISE EXCEPTION 'This collector works in % region. Choose a collector in % region.',
      coalesce(col_region, 'no'), mine USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pickup_requests', 'digital_bins', 'scheduled_pickups'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'collector_id') THEN
      EXECUTE format('DROP TRIGGER IF EXISTS ab_td_manager_assign ON public.%I', t);
      EXECUTE format('CREATE TRIGGER ab_td_manager_assign BEFORE INSERT OR UPDATE ON public.%I
                      FOR EACH ROW EXECUTE FUNCTION public.td_guard_manager_assign()', t);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
