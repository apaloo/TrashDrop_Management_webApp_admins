-- ============================================================================
-- Illegal dumping for Authority, Media, Volunteer and User accounts.
--
--                     view                 act                                   Reports Data
--   Authority (MMDA)  own district         verify, assign cleanups, set fees,    own district
--                                          mark cleaned (own district)
--   Media             national             verify                                national
--   Volunteer         own region           verify, assign cleanups (volunteer    own region
--                                          groups), mark cleaned (own region)
--   User              own district (from   –                                     –
--                     their pickup address)
--   Admin / Manager   unchanged (national, everything, direct table access)
--
-- Reporter details stay private: Media, Volunteer and User accounts read
-- reports only through area_dumping_reports(), which leaves out who reported
-- them and their free-text description (the same rule as Reports Data). Nobody
-- gets new direct access to the illegal_dumping_mobile table; the new actions
-- are SECURITY DEFINER functions that check the account's area first.
--
-- 1. td_report_scope(): the area an account may see reports in
-- 2. area_dumping_reports(): the reports, without reporter details
-- 3. media_dumping_reports() (Reports Data) is also open to Authority
--    (district) and Volunteer (region); its rows are unchanged
-- 4. area_assignable_teams(), area_dumping_verify(), area_dumping_assign(),
--    area_dumping_mark_cleaned()
-- 5. td_guard_dumping_update lets those functions through (as it already does
--    for volunteer claims)
-- 6. td_capability_roles(): same table as src/lib/permissions.js
--
-- Needs 20261026, 20261028, 20261030, 20261101 and 20261103. One transaction.
-- Safe to re-run. Undo: supabase/diagnostics/area_dumping_access_rollback.sql
-- ============================================================================

BEGIN;
SET LOCAL search_path = public;

-- ── 1. where an account may see reports ──────────────────────────────────
-- A User's district comes from their pickup address: their saved location
-- (default first), else the district of their latest pickup request.
CREATE OR REPLACE FUNCTION public.td_user_home_district()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  g geometry;
  d record;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  IF to_regclass('public.locations') IS NOT NULL THEN
    EXECUTE $q$
      SELECT public.td_report_point(to_jsonb(l)) FROM public.locations l
      WHERE l.user_id::text = $1
      ORDER BY coalesce((to_jsonb(l) ->> 'is_default')::boolean, false) DESC,
               (to_jsonb(l) ->> 'updated_at') DESC NULLS LAST, (to_jsonb(l) ->> 'created_at') DESC NULLS LAST
      LIMIT 1 $q$ INTO g USING auth.uid()::text;
  END IF;
  IF g IS NOT NULL THEN
    SELECT a.region, a.district INTO d FROM public.td_area_at(ST_Y(g), ST_X(g)) a;
    IF d.district IS NOT NULL THEN RETURN jsonb_build_object('region', d.region, 'district', d.district); END IF;
  END IF;
  SELECT pr.region, pr.district INTO d FROM public.pickup_requests pr
  WHERE pr.user_id = auth.uid() AND pr.district IS NOT NULL
  ORDER BY pr.created_at DESC LIMIT 1;
  IF d.district IS NOT NULL THEN RETURN jsonb_build_object('region', d.region, 'district', d.district); END IF;
  RETURN NULL;
END $$;

-- {level: national | region | district | none, region, district, role}
CREATE OR REPLACE FUNCTION public.td_report_scope()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r text := public.td_my_role();
  home jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('level', 'none', 'role', r); END IF;
  IF r IN ('admin', 'manager', 'media') THEN RETURN jsonb_build_object('level', 'national', 'role', r); END IF;
  IF r IN ('authority', 'volunteer') THEN RETURN public.td_my_area(); END IF;
  home := public.td_user_home_district();
  IF home IS NULL THEN RETURN jsonb_build_object('level', 'none', 'role', r); END IF;
  RETURN home || jsonb_build_object('level', 'district', 'role', r);
END $$;

CREATE OR REPLACE FUNCTION public.td_in_scope(p_scope jsonb, p_region text, p_district text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_scope ->> 'level'
    WHEN 'national' THEN true
    WHEN 'region' THEN p_region IS NOT NULL AND p_region = p_scope ->> 'region'
    WHEN 'district' THEN p_district IS NOT NULL AND p_district = p_scope ->> 'district'
    ELSE false END
$$;

-- ── 2. reports without reporter details ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.area_dumping_reports(
  p_status text DEFAULT NULL, p_region text DEFAULT NULL, p_district text DEFAULT NULL)
RETURNS SETOF jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  sc jsonb := public.td_report_scope();
BEGIN
  IF sc ->> 'level' = 'none' THEN RETURN; END IF;
  RETURN QUERY
  SELECT jsonb_build_object(
    'id', r.id,
    'reported_at', r.created_at,
    'updated_at', r.updated_at,
    'status', lower(coalesce(r.status, 'pending')),
    'severity', lower(coalesce(j ->> 'severity', 'medium')),
    'waste_type', lower(coalesce(j ->> 'waste_type', 'mixed')),
    'size', j ->> 'size',
    'region', r.region,
    'district', r.district,
    'area_name', nullif(btrim(j ->> 'area_name'), ''),
    'latitude', ST_Y(p.g),
    'longitude', ST_X(p.g),
    'completed_at', CASE WHEN r.status IN ('completed', 'disposed')
                      THEN coalesce((j ->> 'completed_at')::timestamptz, r.updated_at) END,
    'disposed_at', (j ->> 'disposed_at')::timestamptz,
    'disposal_site_name', j ->> 'disposal_site_name',
    'assigned_to', j ->> 'assigned_to',
    'assigned_via', j ->> 'assigned_via',
    'team_name', (SELECT nullif(btrim(concat_ws(' ', cp.first_name, cp.last_name)), '')
                  FROM public.collector_profiles cp WHERE cp.id::text = j ->> 'assigned_to'),
    'photos', public.td_https_links(j -> 'photos'),
    'cleanup_photos', public.td_https_links(j -> 'cleanup_photos'))
  FROM public.illegal_dumping_mobile r
  CROSS JOIN LATERAL (SELECT to_jsonb(r) AS j) jr
  CROSS JOIN LATERAL (SELECT public.td_report_point(jr.j) AS g) p
  WHERE public.td_in_scope(sc, r.region, r.district)
    AND (p_status IS NULL OR lower(r.status) = lower(p_status))
    AND (p_region IS NULL OR r.region = p_region)
    AND (p_district IS NULL OR r.district = p_district)
  ORDER BY r.created_at DESC
  LIMIT 5000;
END $$;

-- ── 3. Reports Data for Authority and Volunteer, in their area ───────────
-- Same rows as 20261030; only who may call it and the area filter change.
CREATE OR REPLACE FUNCTION public.td_can_read_media_data()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND public.td_my_role() IN ('media', 'manager', 'admin', 'authority', 'volunteer')
$$;

CREATE OR REPLACE FUNCTION public.media_dumping_reports(
  p_from date DEFAULT NULL, p_to date DEFAULT NULL,
  p_region text DEFAULT NULL, p_district text DEFAULT NULL, p_status text DEFAULT NULL)
RETURNS SETOF jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  sc jsonb := public.td_report_scope();
BEGIN
  IF NOT public.td_can_read_media_data() THEN
    RAISE EXCEPTION 'Only approved Media accounts can read this data' USING ERRCODE = '42501';
  END IF;
  IF p_from IS NOT NULL AND p_to IS NOT NULL AND p_to < p_from THEN
    RAISE EXCEPTION 'The end date is before the start date' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT jsonb_build_object(
    'id', r.id,
    'reported_at', r.created_at,
    'status', lower(coalesce(r.status, 'pending')),
    'severity', lower(coalesce(j ->> 'severity', 'medium')),
    'waste_type', lower(coalesce(j ->> 'waste_type', 'mixed')),
    'size', j ->> 'size',
    'region', r.region,
    'district', r.district,
    'area_name', nullif(btrim(j ->> 'area_name'), ''),
    'latitude', ST_Y(p.g),
    'longitude', ST_X(p.g),
    'cleaned_at', CASE WHEN r.status IN ('completed', 'disposed')
                    THEN coalesce((j ->> 'completed_at')::timestamptz, r.updated_at) END,
    'disposed_at', (j ->> 'disposed_at')::timestamptz,
    'cleanup_by', CASE j ->> 'assigned_via' WHEN 'claim' THEN 'volunteer group'
                    WHEN 'admin' THEN 'TrashDrop collector' END,
    'photos', public.td_https_links(j -> 'photos'),
    'cleanup_photos', public.td_https_links(j -> 'cleanup_photos'))
  FROM public.illegal_dumping_mobile r
  CROSS JOIN LATERAL (SELECT to_jsonb(r) AS j) jr
  CROSS JOIN LATERAL (SELECT public.td_report_point(jr.j) AS g) p
  WHERE public.td_in_scope(sc, r.region, r.district)
    AND (p_from IS NULL OR r.created_at >= p_from)
    AND (p_to IS NULL OR r.created_at < p_to + 1)
    AND (p_region IS NULL OR r.region = p_region)
    AND (p_district IS NULL OR r.district = p_district)
    AND (p_status IS NULL OR lower(r.status) = lower(p_status))
  ORDER BY r.created_at DESC
  LIMIT 5000;
END $$;

-- ── 4. actions for Authority, Media and Volunteer accounts ───────────────
-- The report, locked, when the caller may act on it with this action
CREATE OR REPLACE FUNCTION public.td_area_report_for(p_id uuid, p_action text)
RETURNS public.illegal_dumping_mobile
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.illegal_dumping_mobile;
  role text := public.td_my_role();
  sc jsonb := public.td_report_scope();
BEGIN
  IF NOT public.can_do('dumping.' || p_action) THEN
    RAISE EXCEPTION 'Your account can''t do this on illegal dumping reports' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public.illegal_dumping_mobile WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Report not found'; END IF;
  IF NOT public.td_in_scope(sc, r.region, r.district) THEN
    RAISE EXCEPTION 'This report is outside your area' USING ERRCODE = '42501';
  END IF;
  RETURN r;
END $$;

-- Teams the caller may assign: in the caller's region; Volunteers only volunteer groups
CREATE OR REPLACE FUNCTION public.area_assignable_teams()
RETURNS TABLE (id uuid, name text, collector_type text, region text, vehicle_type text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sc jsonb := public.td_report_scope();
  my_region text;
  role text := public.td_my_role();
BEGIN
  IF NOT public.can_do('dumping.assign') THEN
    RAISE EXCEPTION 'Your account can''t assign cleanups' USING ERRCODE = '42501';
  END IF;
  my_region := CASE WHEN sc ->> 'level' = 'national' THEN NULL ELSE sc ->> 'region' END;
  IF sc ->> 'level' <> 'national' AND my_region IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT cp.id,
         coalesce(nullif(btrim(concat_ws(' ', cp.first_name, cp.last_name)), ''), 'Unnamed team'),
         coalesce(to_jsonb(cp) ->> 'collector_type', 'collector'),
         public.td_collector_region(cp.id::text),
         cp.vehicle_type
  FROM public.collector_profiles cp
  WHERE coalesce(cp.status, '') NOT IN ('suspended', 'inactive')
    AND (to_jsonb(cp) ->> 'deactivated_at') IS NULL
    AND (my_region IS NULL OR public.td_norm_region(public.td_collector_region(cp.id::text)) = public.td_norm_region(my_region))
    AND (role <> 'volunteer' OR coalesce(to_jsonb(cp) ->> 'collector_type', 'collector') = 'volunteer')
  ORDER BY 2;
END $$;

CREATE OR REPLACE FUNCTION public.area_dumping_verify(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.illegal_dumping_mobile := public.td_area_report_for(p_id, 'verify');
BEGIN
  IF lower(coalesce(r.status, 'pending')) <> 'pending' THEN
    RAISE EXCEPTION 'Only pending reports can be verified (this one is %)', r.status USING ERRCODE = 'P0001';
  END IF;
  PERFORM set_config('app.td_area_action', 'on', true);
  UPDATE public.illegal_dumping_mobile SET status = 'verified', updated_at = now() WHERE id = p_id;
  PERFORM set_config('app.td_area_action', '', true);
  RETURN jsonb_build_object('id', p_id, 'status', 'verified');
END $$;

CREATE OR REPLACE FUNCTION public.area_dumping_mark_cleaned(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.illegal_dumping_mobile := public.td_area_report_for(p_id, 'markCleaned');
BEGIN
  IF lower(coalesce(r.status, '')) <> 'in_progress' THEN
    RAISE EXCEPTION 'Only reports being cleaned up can be marked cleaned (this one is %)', r.status USING ERRCODE = 'P0001';
  END IF;
  PERFORM set_config('app.td_area_action', 'on', true);
  UPDATE public.illegal_dumping_mobile SET status = 'completed', updated_at = now() WHERE id = p_id;
  PERFORM set_config('app.td_area_action', '', true);
  RETURN jsonb_build_object('id', p_id, 'status', 'completed');
END $$;

CREATE OR REPLACE FUNCTION public.area_dumping_assign(p_id uuid, p_team uuid, p_fee numeric DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.illegal_dumping_mobile := public.td_area_report_for(p_id, 'assign');
  team record;
  fee numeric := NULL;
BEGIN
  IF lower(coalesce(r.status, 'pending')) <> 'verified' OR r.assigned_to IS NOT NULL THEN
    RAISE EXCEPTION 'Only verified reports with no cleanup team can be assigned' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO team FROM public.area_assignable_teams() t WHERE t.id = p_team;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Choose an active team in your region' USING ERRCODE = '42501';
  END IF;
  -- Fees only for paid collectors, and only from accounts that may set them
  IF p_fee IS NOT NULL AND p_fee > 0 AND team.collector_type <> 'volunteer' AND public.can_do('dumping.fee') THEN
    fee := round(p_fee, 2);
  END IF;
  PERFORM set_config('app.td_area_action', 'on', true);
  EXECUTE 'UPDATE public.illegal_dumping_mobile SET assigned_to = $1, updated_at = now()'
       || CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
                              AND table_name = 'illegal_dumping_mobile' AND column_name = 'cleanup_fee')
               THEN ', cleanup_fee = $2' ELSE '' END
       || ' WHERE id = $3'
    USING p_team, fee, p_id;
  PERFORM set_config('app.td_area_action', '', true);
  RETURN jsonb_build_object('id', p_id, 'assigned_to', p_team, 'team_name', team.name, 'cleanup_fee', fee);
END $$;

-- ── 5. the table guard lets the functions above through ──────────────────
-- Same as 20261028, plus app.td_area_action
CREATE OR REPLACE FUNCTION public.td_guard_dumping_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  changed text[];
  allowed text[];
  bad text[];
BEGIN
  IF auth.uid() IS NULL OR public.td_can_manage_requests()
     OR coalesce(current_setting('app.td_claim', true), '') = 'on'
     OR coalesce(current_setting('app.td_area_action', true), '') = 'on' THEN
    RETURN NEW;
  END IF;
  changed := public.td_changed_columns(to_jsonb(OLD), to_jsonb(NEW));
  IF OLD.assigned_to IS NOT NULL AND OLD.assigned_to IN (SELECT public.td_my_collector_profile_ids()) THEN
    allowed := ARRAY['status', 'disposed_at', 'disposal_site_id', 'disposal_site_name', 'completed_at',
                     'cleanup_completed_date', 'notes', 'photos', 'cleanup_photos'];
  ELSIF OLD.reported_by = auth.uid() THEN
    allowed := ARRAY['status', 'description', 'photos'];
  ELSE
    allowed := '{}';
  END IF;
  bad := ARRAY(SELECT c FROM unnest(changed) c
               WHERE c <> ALL (allowed || ARRAY['updated_at', 'region', 'district']));
  IF cardinality(bad) > 0 THEN
    RAISE EXCEPTION 'Not allowed to change % on this report', array_to_string(bad, ', ')
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

-- ── 6. capability table (keep in step with src/lib/permissions.js) ───────
CREATE OR REPLACE FUNCTION public.td_capability_roles(p_capability text)
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_capability
    WHEN 'dashboard.stats' THEN ARRAY['admin', 'manager']
    WHEN 'dashboard.liveQueue' THEN ARRAY['admin', 'manager']
    WHEN 'requests.view' THEN ARRAY['admin', 'manager']
    WHEN 'requests.assign' THEN ARRAY['admin', 'manager']
    WHEN 'requests.cancel' THEN ARRAY['admin', 'manager']
    WHEN 'requests.locate' THEN ARRAY['admin']
    WHEN 'collectors.view' THEN ARRAY['admin']
    WHEN 'alerts.view' THEN ARRAY['admin']
    WHEN 'logs.view' THEN ARRAY['admin']
    WHEN 'bags.view' THEN ARRAY['admin']
    WHEN 'bags.manage' THEN ARRAY['admin']
    WHEN 'dumping.view' THEN ARRAY['admin', 'manager', 'authority', 'media', 'volunteer', 'user']
    WHEN 'dumping.reporters' THEN ARRAY['admin', 'manager', 'authority']
    WHEN 'dumping.verify' THEN ARRAY['admin', 'manager', 'authority', 'media', 'volunteer']
    WHEN 'dumping.assign' THEN ARRAY['admin', 'manager', 'authority', 'volunteer']
    WHEN 'dumping.fee' THEN ARRAY['admin', 'manager', 'authority']
    WHEN 'dumping.markCleaned' THEN ARRAY['admin', 'manager', 'authority', 'volunteer']
    WHEN 'dumping.manage' THEN ARRAY['admin', 'manager']
    WHEN 'reports.view' THEN ARRAY['admin', 'manager', 'media', 'authority', 'volunteer']
    WHEN 'reports.export' THEN ARRAY['admin', 'manager', 'media', 'authority', 'volunteer']
    WHEN 'users.manage' THEN ARRAY['admin']
    WHEN 'settings.manage' THEN ARRAY['admin']
    ELSE ARRAY[]::text[] END
$$;

REVOKE ALL ON FUNCTION public.td_user_home_district() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.td_report_scope() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.area_dumping_reports(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.td_area_report_for(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.area_assignable_teams() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.area_dumping_verify(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.area_dumping_mark_cleaned(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.area_dumping_assign(uuid, uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.td_user_home_district() TO authenticated;
GRANT EXECUTE ON FUNCTION public.td_report_scope() TO authenticated;
GRANT EXECUTE ON FUNCTION public.area_dumping_reports(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.area_assignable_teams() TO authenticated;
GRANT EXECUTE ON FUNCTION public.area_dumping_verify(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.area_dumping_mark_cleaned(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.area_dumping_assign(uuid, uuid, numeric) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
