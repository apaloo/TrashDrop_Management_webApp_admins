-- Undo supabase/migrations/20261110_team_members.sql
--
-- Puts back td_my_role (20261023), td_my_area (20261026), my_access
-- (20261023), td_record_activity (20261108), td_refresh_performance and
-- my_performance (20261109) exactly as those migrations define them, and
-- removes the team functions and tables: every member loses the group's
-- access at once. Steps members already did stay in account_activity (their
-- team_id column is kept, so nothing recorded is lost; the group's totals
-- stop counting them at the next refresh). Export team_members first if you
-- want the member list. One transaction.

BEGIN;
SET LOCAL search_path = public;

CREATE OR REPLACE FUNCTION public.td_my_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN public.td_is_staff() THEN 'admin'
    ELSE coalesce((SELECT r.role FROM public.account_roles r WHERE r.user_id = auth.uid()), 'user') END
$$;

CREATE OR REPLACE FUNCTION public.td_my_area()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (
    SELECT public.td_my_role() AS role,
           (SELECT d.region FROM public.gh_districts d WHERE d.region = ar.region LIMIT 1) AS region,
           (SELECT d.name FROM public.gh_districts d WHERE d.name = ar.district AND d.region = ar.region) AS district
    FROM (SELECT 1) one
    LEFT JOIN public.account_roles ar ON ar.user_id = auth.uid()
  )
  SELECT CASE
    WHEN role IN ('admin', 'manager', 'media') THEN jsonb_build_object('level', 'national', 'role', role)
    WHEN role = 'authority' AND district IS NOT NULL THEN jsonb_build_object('level', 'district', 'role', role, 'region', region, 'district', district)
    WHEN role = 'volunteer' AND region IS NOT NULL THEN jsonb_build_object('level', 'region', 'role', role, 'region', region)
    ELSE jsonb_build_object('level', 'none', 'role', role)
  END
  FROM me
$$;

CREATE OR REPLACE FUNCTION public.my_access()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE r public.account_roles;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('role', 'user', 'status', 'approved'); END IF;
  SELECT * INTO r FROM public.account_roles WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    INSERT INTO public.account_roles (user_id) VALUES (auth.uid()) ON CONFLICT DO NOTHING RETURNING * INTO r;
    IF r.user_id IS NULL THEN SELECT * INTO r FROM public.account_roles WHERE user_id = auth.uid(); END IF;
  END IF;
  RETURN jsonb_build_object(
    'role', public.td_my_role(),
    'requested_role', CASE WHEN public.td_is_staff() THEN 'admin' ELSE r.requested_role END,
    'status', CASE WHEN public.td_is_staff() THEN 'approved' ELSE r.status END,
    'company_type', r.company_type, 'org_name', r.org_name, 'region', r.region, 'district', r.district,
    'review_note', r.review_note);
END $$;

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

DROP FUNCTION IF EXISTS public.team_member_stats(integer);
DROP FUNCTION IF EXISTS public.team_leave();
DROP FUNCTION IF EXISTS public.team_remove_member(uuid);
DROP FUNCTION IF EXISTS public.team_set_role(uuid, text);
DROP FUNCTION IF EXISTS public.team_members();
DROP FUNCTION IF EXISTS public.td_user_name(uuid);
DROP FUNCTION IF EXISTS public.team_accept_invite(text);
DROP FUNCTION IF EXISTS public.team_invite_info(text);
DROP FUNCTION IF EXISTS public.team_revoke_invite(uuid);
DROP FUNCTION IF EXISTS public.team_invites();
DROP FUNCTION IF EXISTS public.team_create_invite(text, integer, integer);
DROP FUNCTION IF EXISTS public.td_my_team();
DROP FUNCTION IF EXISTS public.td_effective_account(uuid);
DROP FUNCTION IF EXISTS public.td_team_of(uuid);
DROP TABLE IF EXISTS public.team_invites;
DROP TABLE IF EXISTS public.team_members;

COMMIT;

NOTIFY pgrst, 'reload schema';
