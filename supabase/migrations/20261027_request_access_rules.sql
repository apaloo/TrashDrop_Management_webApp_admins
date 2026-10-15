-- ============================================================================
-- Who may read and change illegal dumping reports and pickup requests.
--
-- Until now any signed-in account (household or collector app, anyone can
-- sign up) could change or delete any report and change any pickup request,
-- and anyone could read every report without signing in. This replaces those
-- rules with:
--
-- illegal_dumping_mobile
--   read    the reporter; the assigned collector; Admin / Manager; and accounts
--           whose area covers it (Authority: district, Volunteer: region,
--           Media: national; see td_my_area, 20261026)
--   add     only as yourself (reported_by = you)
--   change  Admin / Manager; the assigned collector (status and disposal
--           details only); the reporter while pending (withdraw, description,
--           photos)
--   delete  Admin only
--   anonymous: no direct access (the public map uses the
--           public_illegal_dumping_reports view, which is unaffected)
--
-- pickup_requests
--   read    the household; its collector; Admin / Manager; active collectors
--           see open requests and expired assignments (to pick up / release)
--   add     only for yourself, with no collector
--   change  Admin / Manager; the collector on it (status, timings, disposal,
--           payout and location fields); an active collector accepting an open
--           request or releasing an expired one; the household cancelling
--           and recording its sign-up points (once, at most 5)
--   delete  nobody (unchanged)
--
-- The table rules decide which rows; a trigger on each table decides which
-- columns each kind of account may change. Database jobs and the service
-- role (no signed-in user) are not limited by the triggers.
--
-- Needs 20261023_account_roles.sql and 20261026_area_scope.sql.
-- Saves the current rules to td_policy_backup_20261027 first.
-- Undo with supabase/diagnostics/request_access_rules_rollback.sql.
-- Runs as one transaction: any error leaves everything as it was.
-- ============================================================================

BEGIN;
SET LOCAL search_path = public;

-- ── 0. backup of the current rules ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.td_policy_backup_20261027 AS
SELECT now() AS saved_at, schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('illegal_dumping_mobile', 'pickup_requests');
ALTER TABLE public.td_policy_backup_20261027 ENABLE ROW LEVEL SECURITY; -- no policies: only the database owner reads it
REVOKE ALL ON public.td_policy_backup_20261027 FROM anon, authenticated;

-- ── 1. helpers ────────────────────────────────────────────────────────────
-- Admin (whitelisted emails) or an approved Manager
CREATE OR REPLACE FUNCTION public.td_can_manage_requests()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND public.td_my_role() IN ('admin', 'manager')
$$;

-- A collector profile that is not suspended or deactivated (same as the
-- collector app's own check; profile completeness stays an app check)
CREATE OR REPLACE FUNCTION public.td_is_active_collector(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.collector_profiles cp
    WHERE cp.user_id = p_user_id
      AND coalesce(cp.status, '') <> 'suspended'
      AND (to_jsonb(cp) ->> 'deactivated_at') IS NULL
  )
$$;

-- The signed-in account's collector profile ids (illegal_dumping_mobile.assigned_to holds these)
CREATE OR REPLACE FUNCTION public.td_my_collector_profile_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT cp.id FROM public.collector_profiles cp WHERE auth.uid() IS NOT NULL AND cp.user_id = auth.uid()
$$;

-- Columns that differ between two versions of a row
CREATE OR REPLACE FUNCTION public.td_changed_columns(o jsonb, n jsonb)
RETURNS text[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_agg(k ORDER BY k), '{}')
  FROM (SELECT jsonb_object_keys(o) AS k UNION SELECT jsonb_object_keys(n)) keys
  WHERE (o -> k) IS DISTINCT FROM (n -> k)
$$;

REVOKE ALL ON FUNCTION public.td_can_manage_requests() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.td_is_active_collector(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.td_my_collector_profile_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.td_can_manage_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.td_is_active_collector(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.td_my_collector_profile_ids() TO authenticated;

-- ── 2. illegal_dumping_mobile: rows ───────────────────────────────────────
ALTER TABLE public.illegal_dumping_mobile ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for anonymous users" ON public.illegal_dumping_mobile;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.illegal_dumping_mobile;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.illegal_dumping_mobile;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.illegal_dumping_mobile;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.illegal_dumping_mobile;
DROP POLICY IF EXISTS "Enable update for assigned collectors and admins" ON public.illegal_dumping_mobile;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.illegal_dumping_mobile;
DROP POLICY IF EXISTS td_dumping_read ON public.illegal_dumping_mobile;
DROP POLICY IF EXISTS td_dumping_insert ON public.illegal_dumping_mobile;
DROP POLICY IF EXISTS td_dumping_update ON public.illegal_dumping_mobile;
DROP POLICY IF EXISTS td_dumping_delete ON public.illegal_dumping_mobile;
-- "Allow all for service role" is kept as it is.

CREATE POLICY td_dumping_read ON public.illegal_dumping_mobile FOR SELECT TO authenticated USING (
  reported_by = auth.uid()
  OR public.td_can_manage_requests()
  OR assigned_to IN (SELECT public.td_my_collector_profile_ids())
  OR public.td_in_my_area(region, district)
);

CREATE POLICY td_dumping_insert ON public.illegal_dumping_mobile FOR INSERT TO authenticated WITH CHECK (
  reported_by = auth.uid() OR public.td_can_manage_requests()
);

CREATE POLICY td_dumping_update ON public.illegal_dumping_mobile FOR UPDATE TO authenticated
USING (
  public.td_can_manage_requests()
  OR assigned_to IN (SELECT public.td_my_collector_profile_ids())
  OR (reported_by = auth.uid() AND status = 'pending')
)
WITH CHECK (
  public.td_can_manage_requests()
  OR assigned_to IN (SELECT public.td_my_collector_profile_ids())
  OR (reported_by = auth.uid() AND status IN ('pending', 'cancelled'))
);

CREATE POLICY td_dumping_delete ON public.illegal_dumping_mobile FOR DELETE TO authenticated USING (
  public.td_is_staff()
);

-- ── 3. illegal_dumping_mobile: columns ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.td_guard_dumping_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  changed text[];
  allowed text[];
  bad text[];
BEGIN
  IF auth.uid() IS NULL OR public.td_can_manage_requests() THEN RETURN NEW; END IF;
  changed := public.td_changed_columns(to_jsonb(OLD), to_jsonb(NEW));
  IF OLD.assigned_to IS NOT NULL AND OLD.assigned_to IN (SELECT public.td_my_collector_profile_ids()) THEN
    -- the collector app: accept, complete, dispose
    allowed := ARRAY['status', 'disposed_at', 'disposal_site_id', 'disposal_site_name', 'completed_at',
                     'cleanup_completed_date', 'notes', 'photos'];
  ELSIF OLD.reported_by = auth.uid() THEN
    -- the reporter, while pending (the row rule): withdraw or add detail
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

-- "aa_" so it runs before the other BEFORE triggers and sees only the caller's changes
DROP TRIGGER IF EXISTS aa_td_guard_update ON public.illegal_dumping_mobile;
CREATE TRIGGER aa_td_guard_update BEFORE UPDATE ON public.illegal_dumping_mobile
  FOR EACH ROW EXECUTE FUNCTION public.td_guard_dumping_update();

-- ── 4. pickup_requests: rows ──────────────────────────────────────────────
ALTER TABLE public.pickup_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.pickup_requests;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.pickup_requests;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.pickup_requests;
DROP POLICY IF EXISTS td_request_read ON public.pickup_requests;
DROP POLICY IF EXISTS td_request_insert ON public.pickup_requests;
DROP POLICY IF EXISTS td_request_update ON public.pickup_requests;

CREATE POLICY td_request_read ON public.pickup_requests FOR SELECT TO authenticated USING (
  user_id = auth.uid()
  OR collector_id::text = auth.uid()::text
  OR public.td_can_manage_requests()
  OR (public.td_is_active_collector() AND (
        (lower(status) IN ('pending', 'available') AND collector_id IS NULL)
     OR (lower(status) IN ('accepted', 'en_route', 'arrived') AND assignment_expires_at < now())))
);

CREATE POLICY td_request_insert ON public.pickup_requests FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() OR public.td_can_manage_requests()
);

CREATE POLICY td_request_update ON public.pickup_requests FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  OR collector_id::text = auth.uid()::text
  OR public.td_can_manage_requests()
  OR (public.td_is_active_collector() AND (
        (lower(status) IN ('pending', 'available') AND collector_id IS NULL)
     OR (lower(status) IN ('accepted', 'en_route', 'arrived') AND assignment_expires_at < now())))
)
WITH CHECK (
  user_id = auth.uid()
  OR collector_id::text = auth.uid()::text
  OR public.td_can_manage_requests()
  OR (public.td_is_active_collector() AND collector_id IS NULL AND lower(status) IN ('pending', 'available'))
);
-- No delete rule: deleting stays blocked, as today.

-- ── 5. pickup_requests: columns ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.td_guard_request_write()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  changed text[];
  allowed text[] := '{}';
  bad text[];
  o jsonb;
  n jsonb := to_jsonb(NEW);
  new_collector text := n ->> 'collector_id';
  old_collector text;
  new_points numeric;
BEGIN
  IF me IS NULL OR public.td_can_manage_requests() THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    -- also covers database functions that insert on the caller's behalf
    IF NEW.user_id IS DISTINCT FROM me THEN
      RAISE EXCEPTION 'A pickup request can only be created for your own account' USING ERRCODE = '42501';
    END IF;
    IF new_collector IS NOT NULL THEN
      RAISE EXCEPTION 'A new pickup request can''t already have a collector' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  o := to_jsonb(OLD);
  old_collector := o ->> 'collector_id';
  changed := public.td_changed_columns(o, n);

  IF old_collector = me::text OR new_collector = me::text
     OR (public.td_is_active_collector() AND (old_collector IS NULL OR (o ->> 'assignment_expires_at')::timestamptz < now())) THEN
    -- the collector app: accept, release, navigate, collect, dispose, payouts, live location
    IF new_collector IS NOT NULL AND new_collector <> me::text THEN
      RAISE EXCEPTION 'You can only take a request for yourself' USING ERRCODE = '42501';
    END IF;
    allowed := ARRAY['status', 'collector_id', 'accepted_at', 'assignment_expires_at', 'picked_up_at',
                     'en_route_at', 'arrived_at', 'started_at', 'completed_at', 'disposal_site', 'disposal_timestamp',
                     'disposed_at', 'platform_share', 'payout_breakdown', 'reserved_by', 'reserved_at',
                     'reserved_until', 'reservation_expires_at']
               || ARRAY(SELECT c FROM unnest(changed) c WHERE c LIKE 'collector\_%');
  END IF;

  IF OLD.user_id = me THEN
    -- the household app: cancel, and its one-off sign-up points
    allowed := allowed || ARRAY['cancellation_reason', 'cancelled_at', 'cancelled_by'];
    IF 'status' = ANY (changed) AND lower(NEW.status) IN ('cancelled', 'canceled') THEN
      allowed := allowed || ARRAY['status'];
    END IF;
    IF 'points_earned' = ANY (changed) THEN
      new_points := (n ->> 'points_earned')::numeric;
      IF coalesce((o ->> 'points_earned')::numeric, 0) = 0 AND new_points BETWEEN 0 AND 5 THEN
        allowed := allowed || ARRAY['points_earned'];
      END IF;
    END IF;
  END IF;

  bad := ARRAY(SELECT c FROM unnest(changed) c
               WHERE c <> ALL (allowed || ARRAY['updated_at', 'region', 'district']));
  IF cardinality(bad) > 0 THEN
    RAISE EXCEPTION 'Not allowed to change % on this pickup request', array_to_string(bad, ', ')
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS aa_td_guard_write ON public.pickup_requests;
CREATE TRIGGER aa_td_guard_write BEFORE INSERT OR UPDATE ON public.pickup_requests
  FOR EACH ROW EXECUTE FUNCTION public.td_guard_request_write();

COMMIT;

NOTIFY pgrst, 'reload schema';

-- The rules now in place
SELECT tablename, policyname, cmd, roles FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('illegal_dumping_mobile', 'pickup_requests') ORDER BY 1, 3, 2;
