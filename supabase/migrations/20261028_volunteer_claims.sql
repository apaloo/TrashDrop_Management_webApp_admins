-- ============================================================================
-- Volunteer groups claim illegal dumping reports (step 4).
--
-- An approved volunteer group (account_roles role 'volunteer', one shared
-- login) uses the collector app. It sees verified, unassigned reports in its
-- region and can claim one. A claim puts the report on the group's collector
-- profile exactly like an admin assignment (status stays 'verified'), so from
-- there the collector app's existing protocol runs unchanged:
-- accept → navigate → complete within 50 m → dispose.
--
-- 1. collector_profiles.collector_type: 'collector' (paid) or 'volunteer'.
--    Volunteers don't see or take pickup requests.
-- 2. illegal_dumping_mobile.assigned_at / assigned_via ('admin' | 'claim'),
--    stamped on every assignment; cleanup_photos for the photos taken when a
--    cleanup is completed (by anyone).
-- 3. volunteer_claimable_reports(), claim_dumping_report(id),
--    release_dumping_claim(id). At most 3 open claims per group.
-- 4. Claims not accepted within 24 hours, or not completed within 72 hours,
--    go back to the pool (checked on every list / claim, and hourly when
--    pg_cron is installed).
--
-- Needs 20261023, 20261026 and 20261027. One transaction.
-- Undo with supabase/diagnostics/volunteer_claims_rollback.sql.
-- ============================================================================

BEGIN;
SET LOCAL search_path = public;

-- ── 1. columns ────────────────────────────────────────────────────────────
ALTER TABLE public.collector_profiles ADD COLUMN IF NOT EXISTS collector_type text NOT NULL DEFAULT 'collector';
ALTER TABLE public.collector_profiles DROP CONSTRAINT IF EXISTS collector_profiles_collector_type_check;
ALTER TABLE public.collector_profiles ADD CONSTRAINT collector_profiles_collector_type_check
  CHECK (collector_type IN ('collector', 'volunteer'));

ALTER TABLE public.illegal_dumping_mobile ADD COLUMN IF NOT EXISTS assigned_at timestamptz;
ALTER TABLE public.illegal_dumping_mobile ADD COLUMN IF NOT EXISTS assigned_via text;
ALTER TABLE public.illegal_dumping_mobile ADD COLUMN IF NOT EXISTS cleanup_photos text[];
ALTER TABLE public.illegal_dumping_mobile DROP CONSTRAINT IF EXISTS illegal_dumping_mobile_assigned_via_check;
ALTER TABLE public.illegal_dumping_mobile ADD CONSTRAINT illegal_dumping_mobile_assigned_via_check
  CHECK (assigned_via IS NULL OR assigned_via IN ('admin', 'claim'));
CREATE INDEX IF NOT EXISTS illegal_dumping_mobile_claimable_idx
  ON public.illegal_dumping_mobile (region, district) WHERE status = 'verified' AND assigned_to IS NULL;
COMMENT ON COLUMN public.illegal_dumping_mobile.assigned_via IS 'admin = assigned by TrashDrop; claim = claimed by a volunteer group';
COMMENT ON COLUMN public.illegal_dumping_mobile.cleanup_photos IS 'Photos taken by the collector or volunteer group when completing the cleanup';

-- Existing assignments were all made by admins (other triggers paused so
-- updated_at, history and the audit log stay as they are)
ALTER TABLE public.illegal_dumping_mobile DISABLE TRIGGER USER;
UPDATE public.illegal_dumping_mobile SET assigned_via = 'admin'
WHERE assigned_to IS NOT NULL AND assigned_via IS NULL;
ALTER TABLE public.illegal_dumping_mobile ENABLE TRIGGER USER;

-- ── 2. who is who ─────────────────────────────────────────────────────────
-- Paid collectors only: volunteer profiles don't see or take pickup requests
CREATE OR REPLACE FUNCTION public.td_is_active_collector(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.collector_profiles cp
    WHERE cp.user_id = p_user_id
      AND coalesce(cp.status, '') <> 'suspended'
      AND (to_jsonb(cp) ->> 'deactivated_at') IS NULL
      AND cp.collector_type = 'collector'
  )
$$;

-- The signed-in account's volunteer profile, when the group is approved and active
CREATE OR REPLACE FUNCTION public.td_my_volunteer_profile()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT cp.id FROM public.collector_profiles cp
  WHERE auth.uid() IS NOT NULL AND cp.user_id = auth.uid()
    AND cp.collector_type = 'volunteer'
    AND coalesce(cp.status, '') <> 'suspended'
    AND (to_jsonb(cp) ->> 'deactivated_at') IS NULL
    AND public.td_my_role() = 'volunteer'
  LIMIT 1
$$;

-- ── 3. stamp every assignment; let the claim functions through the guard ──
CREATE OR REPLACE FUNCTION public.td_stamp_assignment()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to THEN RETURN NEW; END IF;
  IF NEW.assigned_to IS NULL THEN
    NEW.assigned_at := NULL;
    NEW.assigned_via := NULL;
  ELSE
    NEW.assigned_at := now();
    NEW.assigned_via := CASE WHEN coalesce(current_setting('app.td_claim', true), '') = 'on' THEN 'claim' ELSE 'admin' END;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS td_stamp_assignment ON public.illegal_dumping_mobile;
CREATE TRIGGER td_stamp_assignment BEFORE INSERT OR UPDATE ON public.illegal_dumping_mobile
  FOR EACH ROW EXECUTE FUNCTION public.td_stamp_assignment();

-- Same as 20261027, plus: the claim functions pass (app.td_claim), and the
-- assigned collector may save its cleanup photos
CREATE OR REPLACE FUNCTION public.td_guard_dumping_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  changed text[];
  allowed text[];
  bad text[];
BEGIN
  IF auth.uid() IS NULL OR public.td_can_manage_requests()
     OR coalesce(current_setting('app.td_claim', true), '') = 'on' THEN
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

-- ── 4. expired claims go back to the pool ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.td_release_expired_claims()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n integer;
BEGIN
  PERFORM set_config('app.td_claim', 'on', true);
  PERFORM set_config('app.skip_status_flow', 'on', true); -- in_progress → verified is not a normal step
  UPDATE public.illegal_dumping_mobile
  SET assigned_to = NULL, status = 'verified', updated_at = now()
  WHERE assigned_via = 'claim'
    AND ((status = 'verified' AND assigned_at < now() - interval '24 hours')
      OR (status = 'in_progress' AND assigned_at < now() - interval '72 hours'));
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM set_config('app.td_claim', '', true);
  PERFORM set_config('app.skip_status_flow', '', true);
  IF n > 0 THEN
    PERFORM public.td_write_log('info', 'system', 'dumping.claim_expired', 'illegal_dumping', NULL,
      format('%s volunteer claim(s) expired and went back to the pool', n), NULL, NULL,
      jsonb_build_object('count', n), NULL, 'System', 'system');
  END IF;
  RETURN n;
END $$;

-- ── 5. what a volunteer group can claim ───────────────────────────────────
-- Verified, unassigned reports in the group's region. No reporter details.
CREATE OR REPLACE FUNCTION public.volunteer_claimable_reports()
RETURNS SETOF jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF public.td_my_volunteer_profile() IS NULL THEN
    RAISE EXCEPTION 'Only approved volunteer groups can see reports to claim' USING ERRCODE = '42501';
  END IF;
  PERFORM public.td_release_expired_claims();
  RETURN QUERY
  SELECT jsonb_build_object(
           'id', r.id,
           'location', j ->> 'location',
           'area_name', j ->> 'area_name',
           'region', r.region,
           'district', r.district,
           'latitude', ST_Y(p.g),
           'longitude', ST_X(p.g),
           'severity', j ->> 'severity',
           'waste_type', j ->> 'waste_type',
           'size', j ->> 'size',
           'description', j ->> 'description',
           'photos', j -> 'photos',
           'created_at', r.created_at)
  FROM public.illegal_dumping_mobile r
  CROSS JOIN LATERAL (SELECT to_jsonb(r) AS j) jr
  CROSS JOIN LATERAL (SELECT public.td_report_point(jr.j) AS g) p
  WHERE r.status = 'verified' AND r.assigned_to IS NULL
    AND public.td_in_my_area(r.region, r.district)
  ORDER BY r.created_at;
END $$;

-- ── 6. claim and release ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_dumping_report(p_report_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_profile uuid := public.td_my_volunteer_profile();
  v_group text;
  r public.illegal_dumping_mobile;
  open_claims integer;
BEGIN
  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'Only approved volunteer groups can claim reports' USING ERRCODE = '42501';
  END IF;
  PERFORM public.td_release_expired_claims();

  SELECT * INTO r FROM public.illegal_dumping_mobile WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Report not found'; END IF;
  IF r.assigned_to IS NOT NULL OR r.status IN ('in_progress', 'completed', 'disposed') THEN
    RAISE EXCEPTION 'Someone has already taken this report' USING ERRCODE = 'P0001';
  END IF;
  IF r.status <> 'verified' THEN
    RAISE EXCEPTION 'This report can''t be claimed (it is %)', r.status USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.td_in_my_area(r.region, r.district) THEN
    RAISE EXCEPTION 'This report is outside your region' USING ERRCODE = '42501';
  END IF;
  SELECT count(*) INTO open_claims FROM public.illegal_dumping_mobile
  WHERE assigned_to = v_profile AND status IN ('verified', 'in_progress');
  IF open_claims >= 3 THEN
    RAISE EXCEPTION 'Finish one of your 3 open clean-ups before claiming another' USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.td_claim', 'on', true);
  UPDATE public.illegal_dumping_mobile SET assigned_to = v_profile, updated_at = now() WHERE id = p_report_id;
  PERFORM set_config('app.td_claim', '', true);

  SELECT coalesce(nullif(btrim(concat_ws(' ', first_name, last_name)), ''), 'A volunteer group') INTO v_group
  FROM public.collector_profiles WHERE id = v_profile;
  PERFORM public.td_write_log('info', 'collector', 'dumping.claimed', 'illegal_dumping', p_report_id::text,
    format('%s claimed the cleanup at %s', v_group, coalesce(r.location, 'a reported site')),
    jsonb_build_object('assigned_to', NULL), jsonb_build_object('assigned_to', v_profile),
    jsonb_build_object('district', r.district, 'region', r.region), auth.uid(), v_group, 'volunteer');

  RETURN jsonb_build_object('id', p_report_id, 'assigned_to', v_profile,
    'accept_by', now() + interval '24 hours', 'finish_by', now() + interval '72 hours');
END $$;

-- The group gives a claim back (before or after accepting it)
CREATE OR REPLACE FUNCTION public.release_dumping_claim(p_report_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_profile uuid := public.td_my_volunteer_profile();
  r public.illegal_dumping_mobile;
BEGIN
  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'Only approved volunteer groups can release claims' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public.illegal_dumping_mobile WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND OR r.assigned_to IS DISTINCT FROM v_profile OR r.assigned_via IS DISTINCT FROM 'claim' THEN
    RAISE EXCEPTION 'This report is not claimed by your group' USING ERRCODE = '42501';
  END IF;
  IF r.status NOT IN ('verified', 'in_progress') THEN
    RAISE EXCEPTION 'A completed cleanup can''t be given back' USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.td_claim', 'on', true);
  PERFORM set_config('app.skip_status_flow', 'on', true);
  UPDATE public.illegal_dumping_mobile SET assigned_to = NULL, status = 'verified', updated_at = now() WHERE id = p_report_id;
  PERFORM set_config('app.td_claim', '', true);
  PERFORM set_config('app.skip_status_flow', '', true);

  PERFORM public.td_write_log('info', 'collector', 'dumping.claim_released', 'illegal_dumping', p_report_id::text,
    'A volunteer group gave a cleanup back', jsonb_build_object('assigned_to', v_profile, 'status', r.status),
    jsonb_build_object('assigned_to', NULL, 'status', 'verified'), '{}'::jsonb, auth.uid(), NULL, 'volunteer');
  RETURN jsonb_build_object('id', p_report_id, 'released', true);
END $$;

REVOKE ALL ON FUNCTION public.td_my_volunteer_profile() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.td_release_expired_claims() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.volunteer_claimable_reports() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_dumping_report(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.release_dumping_claim(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.td_my_volunteer_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.volunteer_claimable_reports() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_dumping_report(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_dumping_claim(uuid) TO authenticated;

-- ── 7. hourly expiry when pg_cron is available ────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('td-release-expired-claims', '15 * * * *', 'SELECT public.td_release_expired_claims()');
    RAISE NOTICE 'Hourly expiry scheduled with pg_cron';
  ELSE
    RAISE NOTICE 'pg_cron not installed: expired claims are released whenever a group lists or claims reports';
  END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';

SELECT
  (SELECT count(*) FROM public.collector_profiles WHERE collector_type = 'volunteer') AS volunteer_profiles,
  (SELECT count(*) FROM public.illegal_dumping_mobile WHERE assigned_via = 'admin') AS admin_assigned_reports,
  (SELECT count(*) FROM public.illegal_dumping_mobile WHERE status = 'verified' AND assigned_to IS NULL) AS claimable_now;
