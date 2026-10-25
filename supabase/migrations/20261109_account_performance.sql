-- ============================================================================
-- Account performance, step 2: metrics, daily totals and the dashboard call.
--
-- 1. performance_metrics: the metric list. Admins add, hide, retarget or
--    reword metrics as rows (no code). Each metric picks one of a fixed set
--    of calculators, so nothing typed in can run arbitrary SQL:
--      activity_count        steps of the given kinds the account did
--                            (from account_activity, 20261108)
--      activity_avg          average value of those steps (e.g. minutes from
--                            claim to clean-up)
--      activity_ratio        % of "of" steps followed by "activities" steps
--                            (e.g. clean-ups completed / claimed)
--      area_reports          reports in the account's area: new (created) or
--                            cleaned (completed) in the period
--      area_cleaned_within   % of the area's new reports cleaned within N days
--      area_avg_clean_hours  average hours from report to clean-up in the area
--      area_open_backlog     reports in the area not cleaned yet (right now)
--    Area = the account's district for an MMDA (Authority), its region for a
--    Volunteer group; same rule as td_my_area().
-- 2. performance_daily: per account, metric and day, a numerator and a
--    denominator, so any period adds up exactly (sums, averages, %).
--    td_refresh_performance() rebuilds the last 35 days in one transaction
--    every 5 minutes (pg_cron); readers keep seeing the previous totals until
--    it commits. Only one refresh runs at a time (advisory lock).
-- 3. my_performance(days): the signed-in account's metrics for the period:
--    value, previous period, target, daily trend, and rank among approved
--    accounts of the same type in the same region ("3rd of 12 volunteer
--    groups in Greater Accra"). Other accounts' numbers are never returned.
--    Staff may pass an account id to see any account's page.
-- 4. performance_overview(role, region, days): staff only, every account of a
--    type side by side.
-- 5. Starter metrics for Volunteer groups and MMDAs.
--
-- Creates new tables and functions only; existing data is not changed. The
-- first refresh fills performance_daily from account_activity and the
-- reports. Needs 20261108. Safe to re-run (admin edits to metrics are kept).
-- One transaction. Undo: supabase/diagnostics/account_performance_rollback.sql
-- ============================================================================

BEGIN;
SET LOCAL search_path = public;

-- ── 1. the metric list ───────────────────────────────────────────────────
-- Valid params for each calculator (used by the table's CHECK)
CREATE OR REPLACE FUNCTION public.td_valid_metric(p_calc text, p_params jsonb)
RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_calc IN ('activity_count', 'activity_avg', 'activity_ratio') THEN
      jsonb_typeof(p_params -> 'activities') = 'array'
      AND jsonb_array_length(p_params -> 'activities') > 0
      AND (SELECT bool_and(a IN ('report.created', 'report.verified', 'cleanup.assigned', 'cleanup.received',
                                 'cleanup.claimed', 'cleanup.released', 'cleanup.claim_expired',
                                 'cleanup.started', 'cleanup.completed', 'cleanup.marked_cleaned'))
           FROM jsonb_array_elements_text(p_params -> 'activities') a)
      AND (p_calc <> 'activity_ratio' OR (
        jsonb_typeof(p_params -> 'of') = 'array' AND jsonb_array_length(p_params -> 'of') > 0
        AND (SELECT bool_and(a IN ('report.created', 'report.verified', 'cleanup.assigned', 'cleanup.received',
                                   'cleanup.claimed', 'cleanup.released', 'cleanup.claim_expired',
                                   'cleanup.started', 'cleanup.completed', 'cleanup.marked_cleaned'))
             FROM jsonb_array_elements_text(p_params -> 'of') a)))
    WHEN p_calc = 'area_reports' THEN p_params ->> 'status' IN ('new', 'cleaned')
    WHEN p_calc = 'area_cleaned_within' THEN
      jsonb_typeof(p_params -> 'days') = 'number' AND (p_params ->> 'days')::numeric BETWEEN 1 AND 30
    WHEN p_calc IN ('area_avg_clean_hours', 'area_open_backlog') THEN true
    ELSE false END
$$;

CREATE TABLE IF NOT EXISTS public.performance_metrics (
  key              text PRIMARY KEY,
  label            text NOT NULL,
  description      text,
  roles            text[] NOT NULL,              -- account types it applies to
  calc             text NOT NULL,
  params           jsonb NOT NULL DEFAULT '{}'::jsonb,
  unit             text NOT NULL DEFAULT 'count',
  higher_is_better boolean,                       -- NULL: shown, not ranked
  target           numeric,
  sort_order       integer NOT NULL DEFAULT 100,
  enabled          boolean NOT NULL DEFAULT true,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid,
  CONSTRAINT performance_metrics_key_chk CHECK (key ~ '^[a-z][a-z0-9_]{2,40}$'),
  CONSTRAINT performance_metrics_label_chk CHECK (length(btrim(label)) BETWEEN 2 AND 80),
  CONSTRAINT performance_metrics_roles_chk CHECK (
    cardinality(roles) > 0 AND roles <@ ARRAY['user', 'volunteer', 'media', 'manager', 'authority']),
  CONSTRAINT performance_metrics_unit_chk CHECK (unit IN ('count', 'percent', 'minutes', 'hours')),
  CONSTRAINT performance_metrics_calc_chk CHECK (public.td_valid_metric(calc, params))
);
COMMENT ON TABLE public.performance_metrics IS
  'Metrics on account performance pages; admins edit rows, no code. See 20261109_account_performance.sql.';

ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.performance_metrics FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_metrics TO authenticated;
DROP POLICY IF EXISTS "performance_metrics: staff" ON public.performance_metrics;
CREATE POLICY "performance_metrics: staff" ON public.performance_metrics
  FOR ALL TO authenticated USING (public.td_is_staff()) WITH CHECK (public.td_is_staff());

-- ── 2. daily totals ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.performance_daily (
  account_id uuid NOT NULL,
  metric_key text NOT NULL REFERENCES public.performance_metrics (key) ON DELETE CASCADE ON UPDATE CASCADE,
  day        date NOT NULL,
  num        numeric NOT NULL DEFAULT 0,
  den        numeric,
  PRIMARY KEY (account_id, metric_key, day)
);
CREATE INDEX IF NOT EXISTS performance_daily_metric_day_idx ON public.performance_daily (metric_key, day);
ALTER TABLE public.performance_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.performance_daily FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.performance_refresh (
  id           boolean PRIMARY KEY DEFAULT true CHECK (id),
  refreshed_at timestamptz,
  took_ms      integer,
  rows_written integer
);
INSERT INTO public.performance_refresh (id) VALUES (true) ON CONFLICT DO NOTHING;
ALTER TABLE public.performance_refresh ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.performance_refresh FROM PUBLIC, anon, authenticated;

-- Accounts that get a performance page: approved role, with their area
CREATE OR REPLACE FUNCTION public.td_performance_accounts()
RETURNS TABLE (account_id uuid, role text, region text, district text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ar.user_id, ar.role, ar.region, ar.district
  FROM public.account_roles ar
  WHERE ar.role IN ('volunteer', 'media', 'manager', 'authority', 'user')
$$;

-- Does a report in (region, district) belong to the account's area?
-- Authority: its district; Volunteer: its region (as td_my_area())
CREATE OR REPLACE FUNCTION public.td_in_account_area(p_role text, p_acc_region text, p_acc_district text,
                                                    p_region text, p_district text)
RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_role
    WHEN 'authority' THEN p_acc_district IS NOT NULL AND p_district = p_acc_district
    WHEN 'volunteer' THEN p_acc_region IS NOT NULL AND p_region = p_acc_region
    ELSE false END
$$;

CREATE OR REPLACE FUNCTION public.td_refresh_performance(p_days integer DEFAULT 35)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  from_day date := (now() AT TIME ZONE 'Africa/Accra')::date - greatest(1, least(p_days, 3650));
  t0 timestamptz := clock_timestamp();
  n integer := 0;
  k integer;
BEGIN
  -- One refresh at a time; a second caller just skips
  IF NOT pg_try_advisory_xact_lock(hashtext('td_refresh_performance')) THEN RETURN -1; END IF;

  DELETE FROM public.performance_daily WHERE day >= from_day;

  -- Steps the account did
  INSERT INTO public.performance_daily (account_id, metric_key, day, num, den)
  SELECT a.account_id, m.key, (a.occurred_at AT TIME ZONE 'Africa/Accra')::date,
         CASE m.calc WHEN 'activity_avg' THEN sum(a.value) ELSE count(*) END,
         CASE m.calc WHEN 'activity_avg' THEN count(a.value) END
  FROM public.performance_metrics m
  JOIN public.account_activity a
    ON a.activity IN (SELECT jsonb_array_elements_text(m.params -> 'activities'))
   AND a.occurred_at >= from_day
  JOIN public.td_performance_accounts() acc ON acc.account_id = a.account_id AND acc.role = ANY (m.roles)
  WHERE m.enabled AND m.calc IN ('activity_count', 'activity_avg')
  GROUP BY 1, 2, 3
  HAVING m.calc <> 'activity_avg' OR count(a.value) > 0;
  GET DIAGNOSTICS k = ROW_COUNT; n := n + k;

  -- Ratios: numerator and denominator steps per day
  INSERT INTO public.performance_daily (account_id, metric_key, day, num, den)
  SELECT a.account_id, m.key, (a.occurred_at AT TIME ZONE 'Africa/Accra')::date,
         count(*) FILTER (WHERE a.activity IN (SELECT jsonb_array_elements_text(m.params -> 'activities'))),
         count(*) FILTER (WHERE a.activity IN (SELECT jsonb_array_elements_text(m.params -> 'of')))
  FROM public.performance_metrics m
  JOIN public.account_activity a
    ON (a.activity IN (SELECT jsonb_array_elements_text(m.params -> 'activities'))
        OR a.activity IN (SELECT jsonb_array_elements_text(m.params -> 'of')))
   AND a.occurred_at >= from_day
  JOIN public.td_performance_accounts() acc ON acc.account_id = a.account_id AND acc.role = ANY (m.roles)
  WHERE m.enabled AND m.calc = 'activity_ratio'
  GROUP BY 1, 2, 3;
  GET DIAGNOSTICS k = ROW_COUNT; n := n + k;

  -- The account's area: new and cleaned reports, cleaned within N days,
  -- hours to clean up
  WITH acc AS (
    SELECT * FROM public.td_performance_accounts() WHERE role IN ('authority', 'volunteer')
  ), rep AS (
    SELECT r.region, r.district, r.created_at, r.completed_at,
           lower(coalesce(r.status, '')) IN ('completed', 'disposed') AS cleaned
    FROM public.illegal_dumping_mobile r
    WHERE lower(coalesce(r.status, '')) <> 'cancelled'
      AND (r.created_at >= from_day OR r.completed_at >= from_day)
  )
  INSERT INTO public.performance_daily (account_id, metric_key, day, num, den)
  SELECT acc.account_id, m.key, x.day, sum(x.num), CASE WHEN m.calc = 'area_reports' THEN NULL ELSE sum(x.den) END
  FROM public.performance_metrics m
  JOIN acc ON acc.role = ANY (m.roles)
  JOIN rep ON public.td_in_account_area(acc.role, acc.region, acc.district, rep.region, rep.district)
  CROSS JOIN LATERAL (
    SELECT (rep.created_at AT TIME ZONE 'Africa/Accra')::date AS day, 1 AS num, NULL::numeric AS den
    WHERE m.calc = 'area_reports' AND m.params ->> 'status' = 'new' AND rep.created_at >= from_day
    UNION ALL
    SELECT (rep.completed_at AT TIME ZONE 'Africa/Accra')::date, 1, NULL
    WHERE m.calc = 'area_reports' AND m.params ->> 'status' = 'cleaned' AND rep.cleaned AND rep.completed_at >= from_day
    UNION ALL
    SELECT (rep.created_at AT TIME ZONE 'Africa/Accra')::date,
           CASE WHEN rep.cleaned AND rep.completed_at <= rep.created_at + make_interval(days => (m.params ->> 'days')::int) THEN 1 ELSE 0 END,
           1
    WHERE m.calc = 'area_cleaned_within' AND rep.created_at >= from_day
    UNION ALL
    SELECT (rep.completed_at AT TIME ZONE 'Africa/Accra')::date,
           round(extract(epoch FROM (rep.completed_at - rep.created_at)) / 3600.0, 2), 1
    WHERE m.calc = 'area_avg_clean_hours' AND rep.cleaned AND rep.completed_at >= from_day
      AND rep.completed_at >= rep.created_at
  ) x
  WHERE m.enabled AND m.calc IN ('area_reports', 'area_cleaned_within', 'area_avg_clean_hours')
  GROUP BY 1, 2, 3, m.calc;
  GET DIAGNOSTICS k = ROW_COUNT; n := n + k;

  UPDATE public.performance_refresh
  SET refreshed_at = now(), took_ms = (extract(epoch FROM clock_timestamp() - t0) * 1000)::int, rows_written = n;
  RETURN n;
END $$;

-- An admin edit to the metric list shows on the next page load: the totals
-- are marked out of date, so my_performance() refreshes them first
CREATE OR REPLACE FUNCTION public.td_performance_metrics_changed()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.performance_refresh SET refreshed_at = NULL;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS td_performance_metrics_changed ON public.performance_metrics;
CREATE TRIGGER td_performance_metrics_changed AFTER INSERT OR UPDATE OR DELETE ON public.performance_metrics
  FOR EACH STATEMENT EXECUTE FUNCTION public.td_performance_metrics_changed();

-- ── 3. values for a metric, for a set of accounts and days ────────────────
CREATE OR REPLACE FUNCTION public.td_metric_values(p_key text, p_accounts uuid[], p_from date, p_to date)
RETURNS TABLE (account_id uuid, value numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m public.performance_metrics;
BEGIN
  SELECT * INTO m FROM public.performance_metrics WHERE key = p_key;
  IF NOT FOUND THEN RETURN; END IF;

  IF m.calc = 'area_open_backlog' THEN
    -- Right now, not per period
    RETURN QUERY
    SELECT acc.account_id, count(r.id)::numeric
    FROM public.td_performance_accounts() acc
    LEFT JOIN public.illegal_dumping_mobile r
      ON lower(coalesce(r.status, 'pending')) IN ('pending', 'verified', 'in_progress')
     AND public.td_in_account_area(acc.role, acc.region, acc.district, r.region, r.district)
    WHERE acc.account_id = ANY (p_accounts)
    GROUP BY acc.account_id;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT ids.id,
         CASE
           WHEN m.calc IN ('activity_count', 'area_reports') THEN coalesce(sum(d.num), 0)
           WHEN m.calc IN ('activity_ratio', 'area_cleaned_within') THEN round(100 * sum(d.num) / nullif(sum(d.den), 0), 1)
           ELSE round(sum(d.num) / nullif(sum(d.den), 0), 1)
         END
  FROM unnest(p_accounts) AS ids(id)
  LEFT JOIN public.performance_daily d
    ON d.account_id = ids.id AND d.metric_key = m.key AND d.day BETWEEN p_from AND p_to
  GROUP BY ids.id;
END $$;

-- ── 4. the dashboard call ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.my_performance(p_days integer DEFAULT 30, p_account uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  who uuid := coalesce(p_account, auth.uid());
  days integer := greatest(1, least(coalesce(p_days, 30), 365));
  today date := (now() AT TIME ZONE 'Africa/Accra')::date;
  p_from date;
  prev_from date;
  me record;
  peers uuid[];
  m public.performance_metrics;
  mine numeric;
  prev numeric;
  rnk integer;
  ranked integer;
  trend jsonb;
  result jsonb := '[]'::jsonb;
  refreshed timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to see performance' USING ERRCODE = '42501';
  END IF;
  IF who IS DISTINCT FROM auth.uid() AND NOT public.td_is_staff() THEN
    RAISE EXCEPTION 'You can only see your own performance' USING ERRCODE = '42501';
  END IF;

  -- Totals older than 5 minutes (no pg_cron, or it lags): refresh now
  SELECT refreshed_at INTO refreshed FROM public.performance_refresh;
  IF refreshed IS NULL OR refreshed < now() - interval '5 minutes' THEN
    PERFORM public.td_refresh_performance();
    SELECT refreshed_at INTO refreshed FROM public.performance_refresh;
  END IF;

  SELECT ar.user_id, ar.role, ar.org_name, ar.region, ar.district INTO me
  FROM public.account_roles ar WHERE ar.user_id = who;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('account_id', who, 'role', 'user', 'metrics', '[]'::jsonb, 'refreshed_at', refreshed);
  END IF;

  p_from := today - (days - 1);
  prev_from := p_from - days;

  -- Peers: approved accounts of the same type in the same region (or all of
  -- Ghana when the account has no region)
  SELECT array_agg(acc.account_id) INTO peers
  FROM public.td_performance_accounts() acc
  WHERE acc.role = me.role
    AND (me.region IS NULL OR public.td_norm_region(acc.region) = public.td_norm_region(me.region));

  FOR m IN
    SELECT * FROM public.performance_metrics
    WHERE enabled AND me.role = ANY (roles)
    ORDER BY sort_order, key
  LOOP
    SELECT v.value INTO mine FROM public.td_metric_values(m.key, ARRAY[who], p_from, today) v;
    prev := NULL;
    trend := NULL;
    IF m.calc <> 'area_open_backlog' THEN
      SELECT v.value INTO prev FROM public.td_metric_values(m.key, ARRAY[who], prev_from, p_from - 1) v;
      SELECT coalesce(jsonb_agg(jsonb_build_object('day', d.day,
               'value', CASE
                 WHEN m.calc IN ('activity_count', 'area_reports') THEN d.num
                 WHEN m.calc IN ('activity_ratio', 'area_cleaned_within') THEN round(100 * d.num / nullif(d.den, 0), 1)
                 ELSE round(d.num / nullif(d.den, 0), 1) END) ORDER BY d.day), '[]'::jsonb)
      INTO trend
      FROM public.performance_daily d
      WHERE d.account_id = who AND d.metric_key = m.key AND d.day BETWEEN p_from AND today;
    END IF;

    rnk := NULL;
    ranked := NULL;
    IF m.higher_is_better IS NOT NULL AND mine IS NOT NULL THEN
      SELECT count(*) FILTER (WHERE v.value IS NOT NULL),
             1 + count(*) FILTER (WHERE v.value IS NOT NULL AND
                   CASE WHEN m.higher_is_better THEN v.value > mine ELSE v.value < mine END)
      INTO ranked, rnk
      FROM public.td_metric_values(m.key, peers, p_from, today) v;
    END IF;

    result := result || jsonb_build_object(
      'key', m.key, 'label', m.label, 'description', m.description, 'unit', m.unit,
      'higher_is_better', m.higher_is_better, 'target', m.target,
      'value', mine, 'previous', prev, 'trend', trend,
      'rank', rnk, 'of', ranked, 'live', m.calc = 'area_open_backlog');
  END LOOP;

  RETURN jsonb_build_object(
    'account_id', who, 'role', me.role, 'name', me.org_name,
    'region', me.region, 'district', me.district,
    'rank_area', coalesce(me.region, 'Ghana'),
    'period', jsonb_build_object('from', p_from, 'to', today, 'days', days),
    'refreshed_at', refreshed,
    'metrics', result);
END $$;

-- ── 5. staff: every account of a type side by side ───────────────────────
CREATE OR REPLACE FUNCTION public.performance_overview(p_role text, p_region text DEFAULT NULL, p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  days integer := greatest(1, least(coalesce(p_days, 30), 365));
  today date := (now() AT TIME ZONE 'Africa/Accra')::date;
  ids uuid[];
  metrics jsonb;
  acc_rows jsonb;
BEGIN
  IF NOT public.td_is_staff() THEN
    RAISE EXCEPTION 'Only TrashDrop admins can compare accounts' USING ERRCODE = '42501';
  END IF;
  SELECT array_agg(account_id) INTO ids FROM public.td_performance_accounts()
  WHERE role = p_role AND (p_region IS NULL OR public.td_norm_region(region) = public.td_norm_region(p_region));

  SELECT coalesce(jsonb_agg(jsonb_build_object('key', key, 'label', label, 'unit', unit,
           'higher_is_better', higher_is_better, 'target', target) ORDER BY sort_order, key), '[]'::jsonb)
  INTO metrics FROM public.performance_metrics WHERE enabled AND p_role = ANY (roles);

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'account_id', acc.account_id, 'name', ar.org_name, 'region', acc.region, 'district', acc.district,
           'values', (SELECT coalesce(jsonb_object_agg(m.key, (SELECT v.value FROM public.td_metric_values(m.key, ARRAY[acc.account_id], today - (days - 1), today) v)), '{}'::jsonb)
                      FROM public.performance_metrics m WHERE m.enabled AND p_role = ANY (m.roles)))
         ORDER BY ar.org_name NULLS LAST), '[]'::jsonb)
  INTO acc_rows
  FROM public.td_performance_accounts() acc
  JOIN public.account_roles ar ON ar.user_id = acc.account_id
  WHERE acc.account_id = ANY (coalesce(ids, '{}'));

  RETURN jsonb_build_object('role', p_role, 'region', p_region, 'days', days,
    'refreshed_at', (SELECT refreshed_at FROM public.performance_refresh),
    'metrics', metrics, 'accounts', acc_rows);
END $$;

REVOKE ALL ON FUNCTION public.td_valid_metric(text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.td_performance_accounts() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.td_in_account_area(text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.td_refresh_performance(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.td_performance_metrics_changed() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.td_metric_values(text, uuid[], date, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.my_performance(integer, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.performance_overview(text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.td_valid_metric(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_performance(integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.performance_overview(text, text, integer) TO authenticated;

-- ── 6. starter metrics (kept as they are if already there) ────────────────
INSERT INTO public.performance_metrics (key, label, description, roles, calc, params, unit, higher_is_better, sort_order) VALUES
  ('vol_cleanups_completed', 'Clean-ups completed', 'Sites your group cleaned up', ARRAY['volunteer'],
   'activity_count', '{"activities": ["cleanup.completed"]}', 'count', true, 10),
  ('vol_claims', 'Reports claimed', 'Reports your group took on', ARRAY['volunteer'],
   'activity_count', '{"activities": ["cleanup.claimed"]}', 'count', true, 20),
  ('vol_completion_rate', 'Claims completed', 'Share of the clean-ups your group took on that it finished', ARRAY['volunteer'],
   'activity_ratio', '{"activities": ["cleanup.completed"], "of": ["cleanup.claimed", "cleanup.received"]}', 'percent', true, 30),
  ('vol_avg_cleanup_time', 'Average time to clean up', 'From taking a report on to finishing the clean-up', ARRAY['volunteer'],
   'activity_avg', '{"activities": ["cleanup.completed"]}', 'minutes', false, 40),
  ('vol_claims_expired', 'Claims that ran out', 'Claims not accepted in 24 hours or finished in 72 hours', ARRAY['volunteer'],
   'activity_count', '{"activities": ["cleanup.claim_expired"]}', 'count', false, 50),
  ('vol_reports_verified', 'Reports verified', 'Reports your group checked and confirmed', ARRAY['volunteer'],
   'activity_count', '{"activities": ["report.verified"]}', 'count', true, 60),
  ('mmda_new_reports', 'New reports in your district', 'Illegal dumping reported in your district', ARRAY['authority'],
   'area_reports', '{"status": "new"}', 'count', NULL, 10),
  ('mmda_verified', 'Reports verified', 'Reports your assembly checked and confirmed', ARRAY['authority'],
   'activity_count', '{"activities": ["report.verified"]}', 'count', true, 20),
  ('mmda_assigned', 'Clean-ups assigned', 'Reports your assembly put a team on', ARRAY['authority'],
   'activity_count', '{"activities": ["cleanup.assigned"]}', 'count', true, 30),
  ('mmda_cleaned', 'Sites cleaned in your district', 'Reports in your district cleaned up, by anyone', ARRAY['authority'],
   'area_reports', '{"status": "cleaned"}', 'count', true, 40),
  ('mmda_cleaned_within_7d', 'Cleaned within 7 days', 'Share of new reports in your district cleaned within 7 days', ARRAY['authority'],
   'area_cleaned_within', '{"days": 7}', 'percent', true, 50),
  ('mmda_avg_clean_hours', 'Average time to clean up', 'From report to clean-up, in your district', ARRAY['authority'],
   'area_avg_clean_hours', '{}', 'hours', false, 60),
  ('mmda_open_backlog', 'Waiting for clean-up now', 'Reports in your district not cleaned up yet', ARRAY['authority'],
   'area_open_backlog', '{}', 'count', false, 70)
ON CONFLICT (key) DO NOTHING;

-- ── 7. every 5 minutes with pg_cron (my_performance also refreshes stale totals) ─
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('td-refresh-performance', '*/5 * * * *', 'SELECT public.td_refresh_performance()');
    RAISE NOTICE 'Performance totals refresh every 5 minutes (pg_cron)';
  ELSE
    RAISE NOTICE 'pg_cron not installed: totals refresh when a page asks and they are over 5 minutes old';
  END IF;
END $$;

-- First fill (last 400 days)
SELECT public.td_refresh_performance(400) AS rows_written;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Check
SELECT
  (SELECT count(*) FROM public.performance_metrics) AS metrics,
  (SELECT count(*) FROM public.performance_daily) AS daily_rows,
  (SELECT refreshed_at FROM public.performance_refresh) AS refreshed_at,
  (SELECT took_ms FROM public.performance_refresh) AS took_ms;
