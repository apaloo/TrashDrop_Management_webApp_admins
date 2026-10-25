-- ============================================================================
-- Account performance, step 1: record who did what (account_activity).
--
-- Volunteer groups, MMDAs and other accounts verify, assign, claim and clean
-- up illegal dumping reports, but the report only keeps its latest state, not
-- which account did each step. The performance dashboards (next steps) need
-- that, so from now on every step is recorded here, credited to the account
-- that did it:
--
--   report.created          the reporter (household app)
--   report.verified         the account that verified it
--   cleanup.assigned        the account that put a team on it (admin, MMDA, …)
--   cleanup.received        the team it was assigned to
--   cleanup.claimed         the volunteer group that claimed it
--   cleanup.released        the group that gave its claim back
--   cleanup.claim_expired   the group whose claim ran out (24 h / 72 h)
--   cleanup.started         the team that accepted it (collector app)
--   cleanup.completed       the team assigned to it; value = minutes from
--                           assignment to completion
--   cleanup.marked_cleaned  an account other than the team that marked it
--                           cleaned (e.g. an MMDA)
--
-- How:
-- 1. account_activity: append-only, one row per step. Steps that happen once
--    per report (created, verified, completed, marked_cleaned) carry a unique
--    dedupe_key, so they are never counted twice.
-- 2. Triggers on illegal_dumping_mobile write the rows in the same
--    transaction as the change, whichever app or function made it (web, the
--    collector app, claim functions, the expiry job). It only adds rows: no
--    shared counters, so accounts acting at the same time never wait on each
--    other. If recording ever fails, the action itself still goes through (a
--    warning is logged instead).
-- 3. Nobody reads or writes the table from the apps: only staff can SELECT
--    it; the dashboards will read it through functions in the next step.
--
-- No existing data is changed. Activity before this migration is not
-- recorded; what can be proven from existing data is in
-- supabase/diagnostics/account_activity_backfill.sql (run only on approval).
-- Needs 20261026 (region/district) and 20261028 (assigned_at/assigned_via).
-- Safe to re-run. One transaction.
-- Undo: supabase/diagnostics/account_activity_rollback.sql
-- ============================================================================

BEGIN;
SET LOCAL search_path = public;

-- ── 1. the record ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.account_activity (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id   uuid NOT NULL,          -- auth user credited with the step
  account_role text,                   -- their role at the time
  activity     text NOT NULL,
  entity_type  text NOT NULL DEFAULT 'illegal_dumping',
  entity_id    text NOT NULL,
  region       text,
  district     text,
  value        numeric,                -- e.g. minutes to complete a cleanup
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  dedupe_key   text UNIQUE,            -- set for once-per-report steps
  CONSTRAINT account_activity_activity_chk CHECK (activity IN (
    'report.created', 'report.verified',
    'cleanup.assigned', 'cleanup.received', 'cleanup.claimed', 'cleanup.released',
    'cleanup.claim_expired', 'cleanup.started', 'cleanup.completed', 'cleanup.marked_cleaned'))
);
CREATE INDEX IF NOT EXISTS account_activity_account_idx ON public.account_activity (account_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS account_activity_activity_idx ON public.account_activity (activity, occurred_at DESC);
CREATE INDEX IF NOT EXISTS account_activity_area_idx ON public.account_activity (region, district, occurred_at DESC);
COMMENT ON TABLE public.account_activity IS
  'Who did each step on a report, for account performance dashboards. Append-only; written by td_dumping_activity(). See 20261108_account_activity.sql.';

ALTER TABLE public.account_activity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_activity FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.account_activity TO authenticated;
DROP POLICY IF EXISTS "account_activity: staff read" ON public.account_activity;
CREATE POLICY "account_activity: staff read" ON public.account_activity
  FOR SELECT TO authenticated USING (public.td_is_staff());

-- ── 2. helpers ───────────────────────────────────────────────────────────
-- An account's role for the record: its approved role, else 'collector' for
-- a paid collector, else 'user'
CREATE OR REPLACE FUNCTION public.td_activity_role(p_user uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(
    (SELECT r.role FROM public.account_roles r WHERE r.user_id = p_user AND r.role <> 'user'),
    (SELECT 'collector' FROM public.collector_profiles cp
      WHERE cp.user_id = p_user AND coalesce(to_jsonb(cp) ->> 'collector_type', 'collector') = 'collector' LIMIT 1),
    'user')
$$;

-- The login behind a collector / volunteer team profile
CREATE OR REPLACE FUNCTION public.td_team_user(p_profile uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT cp.user_id::uuid FROM public.collector_profiles cp WHERE cp.id::text = p_profile::text LIMIT 1
$$;

-- Add one row. once = true: at most one such row per report (dedupe_key).
-- Callers catch errors (td_dumping_activity), so a failure never undoes the
-- action being recorded.
CREATE OR REPLACE FUNCTION public.td_record_activity(
  p_account uuid, p_activity text, p_entity_id text, p_region text, p_district text,
  p_value numeric DEFAULT NULL, p_metadata jsonb DEFAULT '{}'::jsonb, p_once boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_account IS NULL OR p_entity_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.account_activity
    (account_id, account_role, activity, entity_id, region, district, value, metadata, dedupe_key)
  VALUES
    (p_account, public.td_activity_role(p_account), p_activity, p_entity_id, p_region, p_district,
     p_value, coalesce(p_metadata, '{}'::jsonb),
     CASE WHEN p_once THEN p_activity || ':' || p_entity_id END)
  ON CONFLICT (dedupe_key) DO NOTHING;
END $$;

REVOKE ALL ON FUNCTION public.td_activity_role(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.td_team_user(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.td_record_activity(uuid, text, text, text, text, numeric, jsonb, boolean)
  FROM PUBLIC, anon, authenticated;

-- ── 3. the trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.td_dumping_activity()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor uuid := auth.uid();
  n jsonb := to_jsonb(NEW);
  o jsonb;
  v_id text := NEW.id::text;
  reg text := n ->> 'region';
  dist text := n ->> 'district';
  s_old text;
  s_new text := lower(btrim(coalesce(n ->> 'status', 'pending')));
  new_team uuid;
  old_team uuid;
  team_user uuid;
  old_team_user uuid;
  v_assigned_at timestamptz;
  overdue boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.td_record_activity(nullif(n ->> 'reported_by', '')::uuid, 'report.created', v_id, reg, dist,
      NULL, '{}'::jsonb, true);
    RETURN NULL;
  END IF;

  o := to_jsonb(OLD);
  s_old := lower(btrim(coalesce(o ->> 'status', 'pending')));
  new_team := nullif(n ->> 'assigned_to', '')::uuid;
  old_team := nullif(o ->> 'assigned_to', '')::uuid;
  team_user := public.td_team_user(new_team);

  -- verified
  IF s_old = 'pending' AND s_new = 'verified' THEN
    PERFORM public.td_record_activity(actor, 'report.verified', v_id, reg, dist, NULL, '{}'::jsonb, true);
  END IF;

  -- a claim given back or run out (before the new assignment, if any)
  IF old_team IS NOT NULL AND new_team IS DISTINCT FROM old_team AND o ->> 'assigned_via' = 'claim' THEN
    old_team_user := public.td_team_user(old_team);
    v_assigned_at := (o ->> 'assigned_at')::timestamptz;
    -- Same limits as td_release_expired_claims(): 24 h to accept, 72 h to finish
    overdue := v_assigned_at IS NOT NULL AND (
      (s_old = 'verified' AND v_assigned_at < now() - interval '24 hours') OR
      (s_old = 'in_progress' AND v_assigned_at < now() - interval '72 hours'));
    PERFORM public.td_record_activity(old_team_user,
      CASE WHEN overdue THEN 'cleanup.claim_expired' ELSE 'cleanup.released' END,
      v_id, reg, dist, NULL, jsonb_build_object('team_id', old_team, 'status', s_old));
  END IF;

  -- assigned or claimed
  IF new_team IS NOT NULL AND new_team IS DISTINCT FROM old_team THEN
    IF n ->> 'assigned_via' = 'claim' THEN
      PERFORM public.td_record_activity(team_user, 'cleanup.claimed', v_id, reg, dist,
        NULL, jsonb_build_object('team_id', new_team));
    ELSE
      PERFORM public.td_record_activity(actor, 'cleanup.assigned', v_id, reg, dist,
        nullif(n ->> 'cleanup_fee', '')::numeric,
        jsonb_build_object('team_id', new_team, 'team_user', team_user));
      PERFORM public.td_record_activity(team_user, 'cleanup.received', v_id, reg, dist,
        NULL, jsonb_build_object('team_id', new_team, 'assigned_by', actor));
    END IF;
  END IF;

  -- accepted in the collector app
  IF s_old = 'verified' AND s_new = 'in_progress' THEN
    PERFORM public.td_record_activity(coalesce(team_user, actor), 'cleanup.started', v_id, reg, dist,
      NULL, jsonb_build_object('team_id', new_team));
  END IF;

  -- completed: credit the team; and whoever else marked it cleaned
  IF s_new = 'completed' AND s_old <> 'completed' THEN
    v_assigned_at := (n ->> 'assigned_at')::timestamptz;
    PERFORM public.td_record_activity(coalesce(team_user, actor), 'cleanup.completed', v_id, reg, dist,
      CASE WHEN v_assigned_at IS NOT NULL THEN round(extract(epoch FROM (now() - v_assigned_at)) / 60.0, 1) END,
      jsonb_build_object('team_id', new_team, 'marked_by', actor, 'assigned_via', n ->> 'assigned_via'), true);
    IF actor IS NOT NULL AND actor IS DISTINCT FROM team_user THEN
      PERFORM public.td_record_activity(actor, 'cleanup.marked_cleaned', v_id, reg, dist,
        NULL, jsonb_build_object('team_id', new_team), true);
    END IF;
  END IF;

  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- Recording must never block the change itself
  RAISE WARNING 'account_activity: skipped for report %: %', v_id, SQLERRM;
  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.td_dumping_activity() FROM PUBLIC, anon, authenticated;

-- Only changes of status or team are recorded, so other edits (photos,
-- notes, updated_at) cost nothing
DROP TRIGGER IF EXISTS td_dumping_activity_insert ON public.illegal_dumping_mobile;
DROP TRIGGER IF EXISTS td_dumping_activity_update ON public.illegal_dumping_mobile;
CREATE TRIGGER td_dumping_activity_insert AFTER INSERT ON public.illegal_dumping_mobile
  FOR EACH ROW EXECUTE FUNCTION public.td_dumping_activity();
CREATE TRIGGER td_dumping_activity_update AFTER UPDATE ON public.illegal_dumping_mobile
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to)
  EXECUTE FUNCTION public.td_dumping_activity();

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Check: the table exists and is empty until reports change; the triggers are on
SELECT
  (SELECT count(*) FROM public.account_activity) AS activity_rows,
  (SELECT count(*) FROM pg_trigger WHERE tgname IN ('td_dumping_activity_insert', 'td_dumping_activity_update')
     AND NOT tgisinternal) AS triggers_installed, -- 2
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.account_activity'::regclass) AS rls_on;
