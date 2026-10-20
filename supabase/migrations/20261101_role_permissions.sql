-- ============================================================================
-- One place for "who may do what" (role-based access, step 2).
--
-- Why: the Dashboard showed "Not allowed" to Managers. admin_dashboard_stats
-- and admin_stale_requests both asked td_is_staff(), which is true only for the
-- two whitelisted admin emails, so a Manager was refused by the first (an
-- error) and quietly given an empty list by the second (HTTP 200, no rows).
--
-- What this does:
--   1. td_capability_roles(capability)  the roles each capability allows (the
--      same table as src/lib/permissions.js; a test keeps the two in step)
--   2. has_any_role(roles) / can_do(capability)  the one check every admin_*
--      function now uses instead of td_is_staff()
--   3. admin_dashboard_stats: Admin and Manager. Bag and alert figures are
--      left out of the answer for roles without bags.view / alerts.view
--      (the page hides those panels; they are not sent as zeros)
--   4. admin_stale_requests: Admin and Manager, and a refused caller now gets
--      "Not allowed" like every other admin_* function (it used to get an
--      empty list)
--   5. every other admin_* function: same body as before, only the check
--      changed. They stay Admin-only, so nothing is opened up.
--
-- Roles are the ones that exist today: user, volunteer, media, manager,
-- authority, admin. No new role is created.
-- Needs 20261023_account_roles.sql (td_my_role) and everything before it.
-- Safe to re-run. Undo: supabase/diagnostics/role_permissions_rollback.sql
-- Runs as one transaction: any error leaves everything as it was.
-- ============================================================================

BEGIN;
SET LOCAL search_path = public;

-- ── 1. capability table ───────────────────────────────────────────────────
-- Keep in step with src/lib/permissions.js (CAPABILITY_ROLES)
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
    WHEN 'dumping.view' THEN ARRAY['admin', 'manager', 'authority']
    WHEN 'dumping.manage' THEN ARRAY['admin', 'manager']
    WHEN 'reports.view' THEN ARRAY['admin', 'manager', 'media']
    WHEN 'reports.export' THEN ARRAY['admin', 'manager', 'media']
    WHEN 'users.manage' THEN ARRAY['admin']
    WHEN 'settings.manage' THEN ARRAY['admin']
    ELSE ARRAY[]::text[] END
$$;

-- ── 2. the one check ──────────────────────────────────────────────────────
-- td_my_role(): 'admin' for the whitelisted emails, else the approved role in
-- account_roles, else 'user'. 'user' is in no capability, so signed-out and
-- unapproved accounts are refused.
CREATE OR REPLACE FUNCTION public.has_any_role(p_roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(public.td_my_role() = ANY (p_roles), false)
$$;

CREATE OR REPLACE FUNCTION public.can_do(p_capability text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_any_role(public.td_capability_roles(p_capability))
$$;

REVOKE ALL ON FUNCTION public.td_capability_roles(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_any_role(text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_do(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.td_capability_roles(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_role(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_do(text) TO authenticated;

-- ── 3. admin_dashboard_stats: Admin and Manager ────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_dashboard_stats(p_from timestamp with time zone, p_to timestamp with time zone, p_assign_min integer DEFAULT 30, p_complete_hours integer DEFAULT 24)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  len interval;
  prev_from timestamptz;
  by_day boolean;
  res jsonb;
BEGIN
  IF NOT public.can_do('dashboard.stats') THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_to <= p_from OR p_to - p_from > interval '400 days' THEN
    RAISE EXCEPTION 'Choose a period of up to 400 days' USING ERRCODE = 'check_violation';
  END IF;
  len := p_to - p_from;
  prev_from := p_from - len;
  by_day := len <= interval '31 days';

  WITH req AS (
    SELECT r.source, r.id, r.status, r.created_at, r.collector_ref, r.accepted_at, r.completed_at,
           public.td_request_group(r.status, r.collector_ref) AS grp
    FROM public.admin_pickup_requests r
    WHERE r.created_at >= prev_from AND r.created_at < p_to
  ),
  cur AS (SELECT * FROM req WHERE created_at >= p_from),
  prev AS (SELECT * FROM req WHERE created_at < p_from),
  sla AS (
    -- completed requests that have both timestamps; met = within both limits
    SELECT CASE WHEN created_at >= p_from THEN 'cur' ELSE 'prev' END AS p,
           count(*) FILTER (WHERE accepted_at - created_at <= make_interval(mins => p_assign_min)
                              AND completed_at - created_at <= make_interval(hours => p_complete_hours)) AS met,
           count(*) AS measured
    FROM req
    WHERE grp = 'completed' AND accepted_at IS NOT NULL AND completed_at IS NOT NULL
    GROUP BY 1
  ),
  buckets AS (
    SELECT b AS start, b + CASE WHEN by_day THEN interval '1 day' ELSE interval '7 days' END AS stop
    FROM generate_series(
      CASE WHEN by_day THEN date_trunc('day', p_from) ELSE date_trunc('week', p_from) END,
      p_to - interval '1 second',
      CASE WHEN by_day THEN interval '1 day' ELSE interval '7 days' END) b
  ),
  col AS (
    SELECT c.id::text AS id, c.user_id::text AS user_id,
           nullif(btrim(concat_ws(' ', j ->> 'first_name', j ->> 'last_name')), '') AS name,
           lower(coalesce(j ->> 'status', '')) AS status,
           coalesce(public.td_try_ts(j ->> 'location_updated_at'), public.td_try_ts(j ->> 'last_active'),
                    public.td_try_ts(j ->> 'last_active_at')) AS last_seen
    FROM public.collector_profiles c, LATERAL (SELECT to_jsonb(c) AS j) x
  ),
  live AS (
    SELECT r.collector_ref, public.td_request_group(r.status, r.collector_ref) AS grp, r.completed_at, r.created_at
    FROM public.admin_pickup_requests r
  ),
  colstate AS (
    SELECT col.*,
           EXISTS (SELECT 1 FROM live WHERE live.collector_ref IN (col.id, col.user_id) AND live.grp IN ('assigned', 'in_progress')) AS on_job,
           (SELECT count(*) FROM live WHERE live.collector_ref IN (col.id, col.user_id) AND live.grp = 'completed'
              AND live.completed_at >= date_trunc('day', now())) AS done_today,
           CASE
             WHEN col.status IN ('on_break', 'break', 'on break') THEN 'on_break'
             WHEN col.last_seen >= now() - interval '10 minutes'
               THEN CASE WHEN EXISTS (SELECT 1 FROM live WHERE live.collector_ref IN (col.id, col.user_id)
                                      AND live.grp IN ('assigned', 'in_progress')) THEN 'active' ELSE 'idle' END
             ELSE 'off_duty' END AS state
    FROM col
  ),
  live_batches AS (SELECT * FROM public.admin_bag_batches WHERE stage <> 'archived'),
  bag_items AS (SELECT i.* FROM public.admin_bag_items i JOIN live_batches b ON b.id = i.batch_id)
  SELECT jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to, 'prev_from', prev_from, 'bucket', CASE WHEN by_day THEN 'day' ELSE 'week' END),
    'definitions', jsonb_build_object('sla_assign_min', p_assign_min, 'sla_complete_hours', p_complete_hours, 'online_minutes', 10),
    'requests', jsonb_build_object(
      'total', (SELECT count(*) FROM cur),
      'prev_total', (SELECT count(*) FROM prev),
      'pending', (SELECT count(*) FROM cur WHERE grp = 'pending'),
      'prev_pending', (SELECT count(*) FROM prev WHERE grp = 'pending'),
      'by_status', (SELECT jsonb_object_agg(g, coalesce(n, 0)) FROM
                      (SELECT g, (SELECT count(*) FROM cur WHERE grp = g) AS n
                       FROM unnest(ARRAY['pending', 'assigned', 'in_progress', 'completed', 'cancelled', 'other']) g) s),
      'by_source', (SELECT coalesce(jsonb_object_agg(source, n), '{}'::jsonb) FROM (SELECT source, count(*) AS n FROM cur GROUP BY source) s),
      -- open now, any date (matches the Alerts rule)
      'pending_all_dates', (SELECT count(*) FROM live WHERE grp = 'pending'),
      'oldest_pending_at', (SELECT min(created_at) FROM live WHERE grp = 'pending')),
    'sla', jsonb_build_object(
      'met', (SELECT met FROM sla WHERE p = 'cur'), 'measured', (SELECT measured FROM sla WHERE p = 'cur'),
      'completed', (SELECT count(*) FROM cur WHERE grp = 'completed'),
      'prev_met', (SELECT met FROM sla WHERE p = 'prev'), 'prev_measured', (SELECT measured FROM sla WHERE p = 'prev')),
    'collectors', jsonb_build_object(
      'total', (SELECT count(*) FROM colstate),
      'active', (SELECT count(*) FROM colstate WHERE state = 'active'),
      'idle', (SELECT count(*) FROM colstate WHERE state = 'idle'),
      'on_break', (SELECT count(*) FROM colstate WHERE state = 'on_break'),
      'off_duty', (SELECT count(*) FROM colstate WHERE state = 'off_duty'),
      'unassigned_waiting', (SELECT count(*) FROM live WHERE grp = 'pending'),
      'completed_today', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', coalesce(name, left(id, 8)), 'done', done_today, 'state', state)
                                                    ORDER BY done_today DESC, name), '[]'::jsonb)
                          FROM colstate WHERE done_today > 0 OR state IN ('active', 'idle'))),
    'waste', (SELECT coalesce(jsonb_object_agg(t, n), '{}'::jsonb) FROM (
                SELECT coalesce(nullif(btrim(type), ''), 'Unclassified') AS t, sum(bag_count) AS n
                FROM live_batches WHERE created_at >= p_from AND created_at < p_to GROUP BY 1) w),
    'bags', jsonb_build_object(
      'series', (SELECT jsonb_agg(jsonb_build_object(
                   'start', bk.start,
                   'generated', (SELECT coalesce(sum(bag_count), 0) FROM live_batches b WHERE b.created_at >= bk.start AND b.created_at < bk.stop),
                   'distributed', (SELECT count(*) FROM bag_items i WHERE i.household_id IS NOT NULL AND i.created_at >= bk.start AND i.created_at < bk.stop),
                   'collected', (SELECT count(*) FROM bag_items i WHERE i.collected_at >= bk.start AND i.collected_at < bk.stop)) ORDER BY bk.start)
                 FROM buckets bk),
      'all_time', jsonb_build_object(
        'batches', (SELECT count(*) FROM live_batches),
        'bags', (SELECT coalesce(sum(bag_count), 0) FROM live_batches),
        'distributed', (SELECT count(*) FROM bag_items WHERE stage_rank >= 2),
        'collected', (SELECT count(*) FROM bag_items WHERE stage_rank >= 4))),
    'dumping', (SELECT jsonb_agg(jsonb_build_object('start', bk.start,
                  'reports', (SELECT count(*) FROM public.illegal_dumping_mobile d WHERE d.created_at >= bk.start AND d.created_at < bk.stop))
                  ORDER BY bk.start) FROM buckets bk),
    'dumping_total', (SELECT count(*) FROM public.illegal_dumping_mobile d WHERE d.created_at >= p_from AND d.created_at < p_to),
    'alerts', jsonb_build_object(
      'open', (SELECT count(*) FROM public.alerts a WHERE a.status IN ('open', 'acknowledged', 'in_progress')),
      'latest', (SELECT coalesce(jsonb_agg(x ORDER BY x.sev DESC, x.raised_at DESC), '[]'::jsonb) FROM (
         SELECT a.id, a.title, a.description, a.severity, a.status, a.rule_key, a.entity_type, a.entity_source, a.entity_ref,
                a.created_at AS raised_at, a.last_seen_at,
                CASE a.severity WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END AS sev,
                r.created_at AS request_created_at, r.status AS request_status, r.collector_ref AS request_collector
         FROM public.alerts a
         LEFT JOIN public.admin_pickup_requests r
           ON a.entity_type = 'pickup_request' AND r.id = a.entity_ref AND r.source = coalesce(a.entity_source, r.source)
         WHERE a.status IN ('open', 'acknowledged', 'in_progress')
         ORDER BY CASE a.severity WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END DESC, a.created_at DESC
         LIMIT 6) x)),
    'fetched_at', now()
  ) INTO res;
  -- Parts of the page this role may not see are left out (null), not sent as zeros
  IF NOT public.can_do('bags.view') THEN res := res - 'waste' - 'bags'; END IF;
  IF NOT public.can_do('alerts.view') THEN res := res - 'alerts'; END IF;
  RETURN res;
END $function$;

-- ── 4. admin_stale_requests: Admin and Manager; refused callers get an error ─
CREATE OR REPLACE FUNCTION public.admin_stale_requests(p_days integer DEFAULT 30)
RETURNS TABLE (source text, id text, status text, created_at timestamptz, days_waiting integer,
               customer_name text, address text, open_alerts integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_do('dashboard.liveQueue') THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE = 'insufficient_privilege'; END IF;
  RETURN QUERY
  SELECT r.source, r.id, r.status, r.created_at, (extract(epoch FROM now() - r.created_at) / 86400)::int,
         r.customer_name, r.address,
         (SELECT count(*)::int FROM public.alerts a WHERE a.entity_ref = r.id AND a.status IN ('open', 'acknowledged', 'in_progress'))
  FROM public.admin_pickup_requests r
  WHERE public.td_request_group(r.status, r.collector_ref) = 'pending'
    AND r.created_at < now() - make_interval(days => greatest(coalesce(p_days, 30), 1))
  ORDER BY r.created_at;
END $$;
REVOKE ALL ON FUNCTION public.admin_stale_requests(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_stale_requests(integer) TO authenticated;

-- ── 5. the other admin_* functions: same bodies, the one check ─────────────
-- admin_bag_history_stats
CREATE OR REPLACE FUNCTION public.admin_bag_history_stats(p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  days integer := greatest(1, least(coalesce(p_days, 30), 366));
  first_day date := (now() AT TIME ZONE 'Africa/Accra')::date - (days - 1);
  res jsonb;
BEGIN
  IF NOT public.can_do('bags.view') THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE = 'insufficient_privilege'; END IF;
  WITH live AS (SELECT * FROM public.admin_bag_batches WHERE stage <> 'archived'),
  bags AS (SELECT i.* FROM public.admin_bag_items i JOIN live ON live.id = i.batch_id),
  ev AS (
    SELECT (e.at AT TIME ZONE 'Africa/Accra')::date AS day
    FROM public.admin_bag_events e JOIN live ON live.id = e.batch_id
    WHERE e.kind IN ('household_scan', 'scan') AND e.at >= (first_day::timestamp AT TIME ZONE 'Africa/Accra')
  )
  SELECT jsonb_build_object(
    'total_batches', (SELECT count(*) FROM live),
    'total_bags', (SELECT coalesce(sum(bag_count), 0) FROM live),
    'bag_rows', (SELECT count(*) FROM bags),
    'bags_scanned', (SELECT count(*) FROM bags WHERE scan_count > 0),
    'bags_collected', (SELECT count(*) FROM bags WHERE stage_rank >= 4),
    -- household scan (bag handed over) → collected, minutes
    'avg_distributed_to_collected_minutes', (
      SELECT round(avg(extract(epoch FROM (collected_at - created_at)) / 60))
      FROM bags WHERE collected_at IS NOT NULL AND household_id IS NOT NULL AND collected_at > created_at),
    'days', days,
    'scans_per_day', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('day', d::date, 'scans', coalesce(c.n, 0)) ORDER BY d), '[]'::jsonb)
      FROM generate_series(first_day, (now() AT TIME ZONE 'Africa/Accra')::date, interval '1 day') d
      LEFT JOIN (SELECT day, count(*) AS n FROM ev GROUP BY day) c ON c.day = d::date),
    'fetched_at', now()
  ) INTO res;
  RETURN res;
END $function$;

-- admin_bag_stats
CREATE OR REPLACE FUNCTION public.admin_bag_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  day_start timestamptz := date_trunc('day', now() AT TIME ZONE 'Africa/Accra') AT TIME ZONE 'Africa/Accra';
  week_start timestamptz := date_trunc('week', now() AT TIME ZONE 'Africa/Accra') AT TIME ZONE 'Africa/Accra';
  res jsonb;
BEGIN
  IF NOT public.can_do('bags.view') THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE = 'insufficient_privilege'; END IF;
  WITH p AS (
    SELECT pr.created_at,
           greatest(1, least(500, coalesce(
             CASE WHEN to_jsonb(pr) ->> 'estimated_volume' ~ '^\d+(\.\d+)?$' THEN round((to_jsonb(pr) ->> 'estimated_volume')::numeric)::int END,
             CASE WHEN to_jsonb(pr) ->> 'bag_count' ~ '^\d+$' THEN (to_jsonb(pr) ->> 'bag_count')::int END, 1))) AS n,
           public.td_canon_status(to_jsonb(pr) ->> 'status') AS st,
           coalesce((to_jsonb(pr) ->> 'completed_at')::timestamptz, (to_jsonb(pr) ->> 'disposed_at')::timestamptz,
                    (to_jsonb(pr) ->> 'picked_up_at')::timestamptz, (to_jsonb(pr) ->> 'updated_at')::timestamptz) AS done_at
    FROM public.pickup_requests pr
    WHERE to_jsonb(pr) ->> 'batch_id' IS NOT NULL
  ), w AS (
    SELECT p.*, p.st IN ('collecting', 'disposed') AS collected,
           p.st NOT IN ('collecting', 'disposed', 'cancelled', 'expired') AS open
    FROM p WHERE p.st NOT IN ('cancelled', 'expired')
  )
  SELECT jsonb_build_object(
    'requests_today',     (SELECT count(*) FROM p WHERE p.created_at >= day_start),
    'pending_collection', (SELECT count(*) FROM w WHERE w.open),
    'collected_today',    (SELECT count(*) FROM w WHERE w.collected AND w.done_at >= day_start),
    'bags_awaiting',      (SELECT count(*) FROM public.admin_bag_items i WHERE i.stage = 'distributed'),
    'this_week', jsonb_build_object(
      'bags_requested', (SELECT coalesce(sum(n), 0) FROM w WHERE w.created_at >= week_start),
      'bags_collected', (SELECT coalesce(sum(n), 0) FROM w WHERE w.created_at >= week_start AND w.collected)),
    'last_week', jsonb_build_object(
      'bags_requested', (SELECT coalesce(sum(n), 0) FROM w WHERE w.created_at >= week_start - interval '7 days' AND w.created_at < week_start),
      'bags_collected', (SELECT coalesce(sum(n), 0) FROM w WHERE w.created_at >= week_start - interval '7 days' AND w.created_at < week_start AND w.collected)),
    -- request → collected, last 30 days, in minutes
    'avg_fill_to_collect_minutes', (SELECT round(avg(extract(epoch FROM (w.done_at - w.created_at)) / 60))
                                     FROM w WHERE w.collected AND w.done_at > w.created_at AND w.done_at >= now() - interval '30 days'),
    'collected_last_30_days', (SELECT count(*) FROM w WHERE w.collected AND w.done_at >= now() - interval '30 days')
  ) INTO res;
  RETURN res;
END $function$;

-- admin_generate_batches
CREATE OR REPLACE FUNCTION public.admin_generate_batches(p_type text, p_size text, p_bags_per_batch integer, p_batches integer, p_price_per_batch numeric DEFAULT NULL::numeric, p_qr_prefix text DEFAULT NULL::text, p_max_total integer DEFAULT 5000)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  max_total integer := least(greatest(coalesce(p_max_total, 5000), 1), 5000); -- the client can lower the cap, never raise it
  v_type text := initcap(btrim(coalesce(p_type, '')));
  v_size text := initcap(btrim(coalesce(p_size, '')));
  v_prefix text := upper(btrim(coalesce(p_qr_prefix, '')));
  v_price numeric(12, 2);
  v_unit numeric(12, 2);
  v_stamp text := to_char(now() AT TIME ZONE 'Africa/Accra', 'YYMMDDHH24MI');
  v_num text;
  v_bag_status text := 'generated';
  v_batch record;
  v_ids uuid[] := '{}';
  v_numbers text[] := '{}';
  v_has_scanned boolean := EXISTS (SELECT 1 FROM information_schema.columns
                                   WHERE table_schema = 'public' AND table_name = 'bags' AND column_name = 'scanned');
  i integer;
BEGIN
  IF NOT public.can_do('bags.manage') THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE = 'insufficient_privilege'; END IF;

  IF v_type NOT IN ('Organic', 'Recyclable', 'General', 'Hazardous', 'Electronic', 'Other') THEN
    RAISE EXCEPTION 'Unknown trash type "%"', p_type USING ERRCODE = 'check_violation';
  END IF;
  IF v_size NOT IN ('Small', 'Medium', 'Large') THEN
    RAISE EXCEPTION 'Unknown bag size "%"', p_size USING ERRCODE = 'check_violation';
  END IF;
  IF p_bags_per_batch IS NULL OR p_bags_per_batch < 1 OR p_bags_per_batch > 1000 THEN
    RAISE EXCEPTION 'Bags per batch must be a whole number from 1 to 1000' USING ERRCODE = 'check_violation';
  END IF;
  IF p_batches IS NULL OR p_batches < 1 OR p_batches > 1000 THEN
    RAISE EXCEPTION 'Number of batches must be a whole number from 1 to 1000' USING ERRCODE = 'check_violation';
  END IF;
  IF p_bags_per_batch::bigint * p_batches > max_total THEN
    RAISE EXCEPTION 'That is % bags; the limit per submission is %', p_bags_per_batch::bigint * p_batches, max_total USING ERRCODE = 'check_violation';
  END IF;
  IF p_price_per_batch IS NOT NULL THEN
    IF p_price_per_batch < 0 OR p_price_per_batch > 1000000 THEN
      RAISE EXCEPTION 'Price per batch must be between 0 and 1,000,000' USING ERRCODE = 'check_violation';
    END IF;
    v_price := round(p_price_per_batch, 2);
    v_unit := round(p_price_per_batch / p_bags_per_batch, 2);
  END IF;
  IF v_prefix = '' THEN
    v_prefix := public.td_bag_type_code(v_type) || '-' || to_char(now() AT TIME ZONE 'Africa/Accra', 'YYYYMMDD');
  END IF;
  IF v_prefix !~ '^[A-Z0-9]+(-[A-Z0-9]+)*$' OR length(v_prefix) > 30 THEN
    RAISE EXCEPTION 'QR prefix may only use letters, numbers and single dashes (max 30 characters)' USING ERRCODE = 'check_violation';
  END IF;

  -- Older bags tables may only allow some status values
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.bags'::regclass AND contype = 'c'
             AND pg_get_constraintdef(oid) ILIKE '%status%' AND pg_get_constraintdef(oid) NOT ILIKE '%generated%') THEN
    v_bag_status := 'active';
  END IF;

  FOR i IN 1..p_batches LOOP
    v_num := v_stamp || lpad(i::text, 3, '0');
    WHILE EXISTS (SELECT 1 FROM public.batches b WHERE to_jsonb(b) ->> 'batch_number' = v_num) LOOP
      v_num := v_stamp || lpad(i::text, 3, '0') || '-' || lpad((floor(random() * 1000))::int::text, 3, '0');
    END LOOP;

    INSERT INTO public.batches (batch_number, batch_name, bag_count, status, notes, type, size, qr_prefix,
                                generated_by, created_by, total_batch_price, unit_price)
    VALUES (v_num, v_type || ' - ' || v_size, p_bags_per_batch, 'active',
            format('Type: %s, Size: %s', v_type, v_size), v_type, v_size, v_prefix,
            auth.uid(), auth.uid(), v_price, v_unit)
    RETURNING id, batch_number INTO v_batch;

    -- Bag codes: <prefix>-<batch number>-0001 … (the printed QR still holds the batch link)
    IF EXISTS (SELECT 1 FROM public.bags WHERE qr_code LIKE v_prefix || '-' || v_num || '-%') THEN
      RAISE EXCEPTION 'Bag codes for % already exist', v_prefix || '-' || v_num USING ERRCODE = 'unique_violation';
    END IF;
    IF v_has_scanned THEN
      INSERT INTO public.bags (batch_id, qr_code, status, scanned, unit_price)
      SELECT v_batch.id, v_prefix || '-' || v_num || '-' || lpad(g::text, 4, '0'), v_bag_status, false, v_unit
      FROM generate_series(1, p_bags_per_batch) g;
    ELSE
      INSERT INTO public.bags (batch_id, qr_code, status, unit_price)
      SELECT v_batch.id, v_prefix || '-' || v_num || '-' || lpad(g::text, 4, '0'), v_bag_status, v_unit
      FROM generate_series(1, p_bags_per_batch) g;
    END IF;

    v_ids := v_ids || v_batch.id;
    v_numbers := v_numbers || v_batch.batch_number::text;
  END LOOP;

  RETURN jsonb_build_object(
    'batch_ids', to_jsonb(v_ids), 'batch_numbers', to_jsonb(v_numbers),
    'batches', p_batches, 'bags_per_batch', p_bags_per_batch, 'total_bags', p_bags_per_batch * p_batches,
    'qr_prefix', v_prefix, 'price_per_batch', v_price, 'unit_price', v_unit, 'bag_status', v_bag_status);
END $function$;

-- admin_list_account_roles
CREATE OR REPLACE FUNCTION public.admin_list_account_roles(p_status text DEFAULT 'pending'::text)
 RETURNS TABLE(user_id uuid, email text, name text, company_type text, org_name text, requested_role text, role text, status text, region text, district text, details jsonb, review_note text, reviewed_at timestamp with time zone, created_at timestamp with time zone, signed_up_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  IF NOT public.can_do('users.manage') THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE = 'insufficient_privilege'; END IF;
  RETURN QUERY
    SELECT r.user_id, u.email::text,
           coalesce(nullif(btrim(concat_ws(' ', u.raw_user_meta_data ->> 'firstName', u.raw_user_meta_data ->> 'lastName')), ''),
                    u.raw_user_meta_data ->> 'name', split_part(u.email, '@', 1))::text,
           r.company_type, r.org_name, r.requested_role, r.role, r.status, r.region, r.district, r.details,
           r.review_note, r.reviewed_at, r.created_at, u.created_at
    FROM public.account_roles r JOIN auth.users u ON u.id = r.user_id
    WHERE p_status IS NULL OR r.status = p_status
    ORDER BY (r.status = 'pending') DESC, r.created_at DESC
    LIMIT 500;
END $function$;

-- admin_review_account_role
CREATE OR REPLACE FUNCTION public.admin_review_account_role(p_user_id uuid, p_approve boolean, p_role text DEFAULT NULL::text, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  cur public.account_roles;
  new_role text;
  who text;
BEGIN
  IF NOT public.can_do('users.manage') THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE = 'insufficient_privilege'; END IF;
  SELECT * INTO cur FROM public.account_roles WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Account not found' USING ERRCODE = 'no_data_found'; END IF;
  SELECT email INTO who FROM auth.users WHERE id = p_user_id;
  IF NOT p_approve AND nullif(btrim(coalesce(p_note, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Give a reason when rejecting' USING ERRCODE = 'check_violation';
  END IF;
  new_role := CASE WHEN p_approve THEN lower(coalesce(nullif(btrim(p_role), ''), cur.requested_role)) ELSE cur.role END;
  IF new_role NOT IN ('user', 'volunteer', 'media', 'manager', 'authority') THEN
    RAISE EXCEPTION 'Unknown role "%"', p_role USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.account_roles SET
    role = new_role,
    requested_role = CASE WHEN p_approve THEN new_role ELSE requested_role END,
    status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
    review_note = nullif(btrim(coalesce(p_note, '')), ''),
    reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  WHERE user_id = p_user_id;
  PERFORM public.td_write_log('info', 'auth', CASE WHEN p_approve THEN 'account.role_approved' ELSE 'account.role_rejected' END,
    'user', p_user_id::text,
    format('%s: %s', coalesce(who, p_user_id::text),
           CASE WHEN p_approve THEN 'approved as ' || new_role ELSE cur.requested_role || ' access rejected' END),
    jsonb_build_object('role', cur.role, 'status', cur.status, 'requested_role', cur.requested_role),
    jsonb_build_object('role', new_role, 'status', CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END),
    jsonb_strip_nulls(jsonb_build_object('note', p_note)));
  -- tell the person (in-app notification), never blocks the review
  BEGIN
    INSERT INTO public.notifications (user_id, title, message, type, read)
    VALUES (p_user_id,
            CASE WHEN p_approve THEN 'Access approved' ELSE 'Access request not approved' END,
            CASE WHEN p_approve THEN format('Your TrashDrop account now has %s access.', new_role)
                 ELSE format('Your request for %s access was not approved: %s', cur.requested_role, p_note) END,
            CASE WHEN p_approve THEN 'success' ELSE 'info' END, false);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $function$;

-- admin_set_account_area
CREATE OR REPLACE FUNCTION public.admin_set_account_area(p_user_id uuid, p_region text, p_district text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  reg text := nullif(btrim(coalesce(p_region, '')), '');
  dis text := nullif(btrim(coalesce(p_district, '')), '');
  old public.account_roles;
  me text := auth.jwt() ->> 'email';
BEGIN
  IF NOT public.can_do('users.manage') THEN RAISE EXCEPTION 'Only TrashDrop admins can change an account''s area'; END IF;
  IF reg IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.gh_districts WHERE region = reg) THEN
    RAISE EXCEPTION 'Unknown region: %', reg;
  END IF;
  IF dis IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.gh_districts WHERE name = dis AND region = reg) THEN
    RAISE EXCEPTION 'Choose a district in the % region', coalesce(reg, 'selected');
  END IF;
  SELECT * INTO old FROM public.account_roles WHERE user_id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
  IF old.region IS NOT DISTINCT FROM reg AND old.district IS NOT DISTINCT FROM dis THEN
    RETURN jsonb_build_object('region', reg, 'district', dis, 'changed', false);
  END IF;
  UPDATE public.account_roles SET region = reg, district = dis, updated_at = now() WHERE user_id = p_user_id;
  PERFORM public.td_write_log('info', 'admin', 'account.area_changed', 'user', p_user_id::text,
    format('%s set the area of %s to %s', coalesce(me, 'An admin'),
           coalesce((SELECT email FROM auth.users WHERE id = p_user_id), p_user_id::text),
           coalesce(concat_ws(', ', dis, reg), 'none')),
    jsonb_build_object('region', old.region, 'district', old.district),
    jsonb_build_object('region', reg, 'district', dis),
    '{}'::jsonb, auth.uid(), me, 'admin');
  RETURN jsonb_build_object('region', reg, 'district', dis, 'changed', true);
END $function$;

-- admin_set_batch_archived
CREATE OR REPLACE FUNCTION public.admin_set_batch_archived(p_batch_id uuid, p_archived boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.can_do('bags.manage') THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE = 'insufficient_privilege'; END IF;
  UPDATE public.batches
  SET archived = p_archived,
      archived_at = CASE WHEN p_archived THEN now() END,
      archived_by = CASE WHEN p_archived THEN auth.uid() END
  WHERE id = p_batch_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Batch not found' USING ERRCODE = 'no_data_found'; END IF;
END $function$;

-- admin_set_request_location
CREATE OR REPLACE FUNCTION public.admin_set_request_location(p_source text, p_id text, p_lat double precision, p_lng double precision)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  tbl text; key_id text; col record; n int := 0; pt text;
BEGIN
  IF NOT public.can_do('requests.locate') THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF NOT (p_lat BETWEEN 4.5 AND 11.2 AND p_lng BETWEEN -3.3 AND 1.2) THEN RAISE EXCEPTION 'Location must be in Ghana'; END IF;
  pt := format('SRID=4326;POINT(%s %s)', p_lng, p_lat);
  -- digital bins and scheduled pickups keep the point on a linked location row
  IF p_source = 'digital_bins' AND to_regclass('public.bin_locations') IS NOT NULL THEN
    EXECUTE 'SELECT to_jsonb(b) ->> ''location_id'' FROM public.digital_bins b WHERE b.id::text = $1' INTO key_id USING p_id;
    tbl := CASE WHEN key_id IS NOT NULL THEN 'bin_locations' END;
  ELSIF p_source = 'scheduled_pickups' AND to_regclass('public.locations') IS NOT NULL THEN
    EXECUTE 'SELECT to_jsonb(s) ->> ''location_id'' FROM public.scheduled_pickups s WHERE s.id::text = $1' INTO key_id USING p_id;
    tbl := CASE WHEN key_id IS NOT NULL THEN 'locations' END;
  END IF;
  IF tbl IS NULL THEN
    IF p_source NOT IN ('pickup_requests', 'digital_bins', 'scheduled_pickups') THEN RAISE EXCEPTION 'Unknown source %', p_source; END IF;
    tbl := p_source; key_id := p_id;
  END IF;
  FOR col IN
    SELECT column_name, udt_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = tbl
      AND column_name IN ('coordinates', 'location', 'latitude', 'longitude')
  LOOP
    IF col.column_name = 'latitude' THEN
      EXECUTE format('UPDATE public.%I SET latitude = $1 WHERE id::text = $2', tbl) USING p_lat, key_id;
    ELSIF col.column_name = 'longitude' THEN
      EXECUTE format('UPDATE public.%I SET longitude = $1 WHERE id::text = $2', tbl) USING p_lng, key_id;
    ELSIF col.udt_name IN ('geometry', 'geography') THEN
      EXECUTE format('UPDATE public.%I SET %I = $1::%s WHERE id::text = $2', tbl, col.column_name, col.udt_name) USING pt, key_id;
    ELSIF col.udt_name IN ('jsonb', 'json') THEN
      EXECUTE format('UPDATE public.%I SET %I = $1::%s WHERE id::text = $2', tbl, col.column_name, col.udt_name)
        USING json_build_object('type', 'Point', 'coordinates', json_build_array(p_lng, p_lat))::text, key_id;
    ELSE
      EXECUTE format('UPDATE public.%I SET %I = $1 WHERE id::text = $2', tbl, col.column_name) USING pt, key_id;
    END IF;
    GET DIAGNOSTICS n = ROW_COUNT;
  END LOOP;
  IF n = 0 THEN RAISE EXCEPTION 'Request not found or it has no location field'; END IF;
END $function$;

NOTIFY pgrst, 'reload schema';
COMMIT;
