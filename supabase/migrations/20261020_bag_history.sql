-- ============================================================================
-- Bag History (/bin-management/history): scan history without the broken
-- scans → scanned_by join, real scan counts, history numbers.
--
-- Needs 20261019_bag_batches_admin.sql. Additive; safe to re-run. It replaces
-- the views admin_bag_items / admin_bag_batches from 20261019 with versions
-- that also carry scan counts, so if 20261019 is ever run again, run this
-- file again after it.
-- Undo: supabase/diagnostics/bag_history_rollback.sql
--
-- Why "View History" failed: the page asked PostgREST to join scans to a
-- person through scans.scanned_by, but no foreign key backs that column (older
-- setup scripts created scans with collector_id instead). PostgREST can only
-- join along foreign keys, and it can't join to auth.users at all. History is
-- now read from the views below, which look the names up themselves, so no
-- join is needed and no foreign key is added (old rows may hold collector
-- profile ids, which a key to auth.users would reject).
--
-- What counts as a scan:
--   * a household scanning the batch QR (the household app then creates the
--     household's bag rows: their created_at is the scan time), and
--   * any row in scans (no app writes these yet; they'll show up when one does).
--
-- 0. Backup of scans (scans_backup_20261020), admins only.
-- 1. scans: batch_id, scanned_by, scanned_at, status added if missing; filled
--    from collector_id / created_at / bags where empty.
-- 2. Views: admin_bag_scans, admin_bag_items (+ scan columns), admin_bag_events
--    (one timeline per bag), admin_bag_batches (+ scanned count / % / last scan).
-- 3. admin_bag_history_stats(days): the Bag History cards and chart.
-- ============================================================================

-- ── 0. backup ──────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.scans') IS NULL THEN
    CREATE TABLE public.scans (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      bag_id uuid,
      created_at timestamptz DEFAULT now()
    );
    ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;
  END IF;
  IF to_regclass('public.scans_backup_20261020') IS NULL THEN
    CREATE TABLE public.scans_backup_20261020 AS SELECT * FROM public.scans;
    ALTER TABLE public.scans_backup_20261020 ENABLE ROW LEVEL SECURITY; -- no policies: not readable from the apps
    REVOKE ALL ON public.scans_backup_20261020 FROM anon, authenticated;
  END IF;
END $$;

-- ── 1. scans columns ───────────────────────────────────────────────────────
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS batch_id   uuid;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS scanned_by uuid;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS scanned_at timestamptz;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS status     text;

DO $$
DECLARE has_col boolean;
BEGIN
  -- who: older scripts named the column collector_id
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'scans' AND column_name = 'collector_id') INTO has_col;
  IF has_col THEN
    EXECUTE 'UPDATE public.scans SET scanned_by = collector_id::text::uuid WHERE scanned_by IS NULL AND collector_id IS NOT NULL';
  END IF;
  -- when
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'scans' AND column_name = 'created_at') INTO has_col;
  IF has_col THEN
    EXECUTE 'UPDATE public.scans SET scanned_at = created_at WHERE scanned_at IS NULL';
  END IF;
  ALTER TABLE public.scans ALTER COLUMN scanned_at SET DEFAULT now();
END $$;
UPDATE public.scans s SET batch_id = g.batch_id FROM public.bags g WHERE s.batch_id IS NULL AND g.id = s.bag_id;
CREATE INDEX IF NOT EXISTS scans_bag_idx   ON public.scans (bag_id);
CREATE INDEX IF NOT EXISTS scans_batch_idx ON public.scans (batch_id, scanned_at DESC);

-- ── 2. views ───────────────────────────────────────────────────────────────
-- Name for whoever scanned: a collector (profile id or account id) or any user
CREATE OR REPLACE FUNCTION public.td_person_label(p_ref text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r text;
BEGIN
  IF p_ref IS NULL OR NOT public.td_is_staff() THEN RETURN NULL; END IF;
  SELECT nullif(btrim(concat_ws(' ', c.first_name, c.last_name)), '') INTO r
  FROM public.collector_profiles c WHERE c.id::text = p_ref OR c.user_id::text = p_ref LIMIT 1;
  IF r IS NULL AND p_ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    r := public.td_user_label(p_ref::uuid);
  END IF;
  RETURN coalesce(r, left(p_ref, 8));
END $$;
REVOKE ALL ON FUNCTION public.td_person_label(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.td_person_label(text) TO authenticated; -- views below call it as the viewer

-- "lat, lng" or the text the scanner saved
CREATE OR REPLACE FUNCTION public.td_scan_location(j jsonb)
RETURNS text LANGUAGE plpgsql STABLE SET search_path = public, extensions AS $$
DECLARE g geometry;
BEGIN
  BEGIN g := public.td_row_point(j); EXCEPTION WHEN OTHERS THEN g := NULL; END;
  IF g IS NOT NULL THEN
    RETURN round(ST_Y(g)::numeric, 5)::text || ', ' || round(ST_X(g)::numeric, 5)::text;
  END IF;
  RETURN nullif(btrim(coalesce(j ->> 'location_name', j ->> 'address',
    CASE WHEN jsonb_typeof(j -> 'location') = 'string' AND j ->> 'location' !~ '^(SRID=|0101|POINT)' THEN j ->> 'location' END)), '');
END $$;

DROP VIEW IF EXISTS public.admin_bag_batches;
DROP VIEW IF EXISTS public.admin_bag_events;
DROP VIEW IF EXISTS public.admin_bag_items;
DROP VIEW IF EXISTS public.admin_bag_scans;

-- Rows of scans, with names and places looked up (no join through a key)
CREATE VIEW public.admin_bag_scans AS
SELECT s.id, s.bag_id, coalesce(s.batch_id, g.batch_id) AS batch_id,
       coalesce(s.scanned_at, (to_jsonb(s) ->> 'created_at')::timestamptz) AS scanned_at,
       s.scanned_by::text AS scanned_by, public.td_person_label(s.scanned_by::text) AS scanned_by_name,
       public.td_scan_location(to_jsonb(s)) AS location, s.status
FROM public.scans s
LEFT JOIN public.bags g ON g.id = s.bag_id
WHERE public.td_is_staff();

-- Same as 20261019, plus pickup times and scan columns
CREATE VIEW public.admin_bag_items AS
WITH bt AS (
  SELECT b.id, b.bag_count, b.created_by, b.status,
         lower(coalesce(b.status, '')) IN ('used', 'activated', 'scanned', 'completed', 'distributed') AS activated
  FROM public.batches b
),
bg AS (
  SELECT g.id, g.batch_id, g.user_id, g.qr_code, g.status, g.created_at, g.updated_at,
         to_jsonb(g) AS j, bt.activated,
         bool_or(g.user_id IS NOT NULL) OVER (PARTITION BY g.batch_id) AS has_household_bags
  FROM public.bags g JOIN bt ON bt.id = g.batch_id
),
items AS (
  SELECT bg.*, row_number() OVER (PARTITION BY bg.batch_id ORDER BY bg.created_at, bg.id) AS bag_no
  FROM bg
  WHERE NOT (bg.activated AND bg.has_household_bags AND bg.user_id IS NULL)
),
pk AS (
  SELECT p.*,
         sum(p.n) OVER (PARTITION BY p.batch_id ORDER BY p.created_at, p.id) AS cum_end
  FROM (
    SELECT pr.id, (to_jsonb(pr) ->> 'batch_id') AS batch_id, pr.created_at,
           greatest(1, least(500, coalesce(
             CASE WHEN to_jsonb(pr) ->> 'estimated_volume' ~ '^\d+(\.\d+)?$' THEN round((to_jsonb(pr) ->> 'estimated_volume')::numeric)::int END,
             CASE WHEN to_jsonb(pr) ->> 'bag_count' ~ '^\d+$' THEN (to_jsonb(pr) ->> 'bag_count')::int END, 1))) AS n,
           public.td_canon_status(to_jsonb(pr) ->> 'status') AS st,
           coalesce(to_jsonb(pr) ->> 'collector_id', to_jsonb(pr) ->> 'assigned_to') AS collector_ref,
           to_jsonb(pr) ->> 'address' AS address,
           coalesce(
             (to_jsonb(pr) ->> 'completed_at')::timestamptz, (to_jsonb(pr) ->> 'disposed_at')::timestamptz,
             (to_jsonb(pr) ->> 'picked_up_at')::timestamptz, (to_jsonb(pr) ->> 'updated_at')::timestamptz, pr.created_at) AS last_event_at
    FROM public.pickup_requests pr
    WHERE to_jsonb(pr) ->> 'batch_id' IS NOT NULL
      AND public.td_canon_status(to_jsonb(pr) ->> 'status') NOT IN ('cancelled', 'expired')
  ) p
),
sc AS (
  SELECT s.bag_id, count(*) AS n, max(s.scanned_at) AS last_at,
         (array_agg(s.scanned_by_name ORDER BY s.scanned_at DESC))[1] AS last_by,
         (array_agg(s.location ORDER BY s.scanned_at DESC))[1] AS last_location
  FROM public.admin_bag_scans s WHERE s.bag_id IS NOT NULL GROUP BY s.bag_id
)
SELECT i.id, i.batch_id, i.bag_no, i.qr_code, i.status AS raw_status,
       public.td_bag_stage_name(r.rank) AS stage, r.rank AS stage_rank,
       i.user_id AS household_id, public.td_user_label(i.user_id) AS household_name,
       pk.id AS pickup_id, pk.address AS pickup_address, pk.st AS pickup_status,
       pk.collector_ref AS collector_id,
       (SELECT nullif(btrim(concat_ws(' ', c.first_name, c.last_name)), '') FROM public.collector_profiles c
         WHERE pk.collector_ref IS NOT NULL AND (c.user_id::text = pk.collector_ref OR c.id::text = pk.collector_ref) LIMIT 1) AS collector_name,
       -- real events only (row updated_at also moves for bulk fixes, e.g. a price backfill)
       greatest(i.created_at, (i.j ->> 'scan_date')::timestamptz, (i.j ->> 'scanned_at')::timestamptz,
                (i.j ->> 'collected_at')::timestamptz, pk.last_event_at, sc.last_at) AS last_activity_at,
       i.created_at,
       pk.created_at AS pickup_requested_at,
       CASE WHEN pk.st IN ('collecting', 'disposed') THEN pk.last_event_at END AS collected_at,
       -- scans: the household's batch-QR scan (its bag rows are created then) + scans rows
       (CASE WHEN i.user_id IS NOT NULL THEN 1 ELSE 0 END + coalesce(sc.n, 0))::int AS scan_count,
       greatest(CASE WHEN i.user_id IS NOT NULL THEN i.created_at END, sc.last_at) AS last_scan_at,
       CASE WHEN sc.last_at IS NOT NULL AND (i.user_id IS NULL OR sc.last_at >= i.created_at) THEN sc.last_by
            WHEN i.user_id IS NOT NULL THEN public.td_user_label(i.user_id) END AS last_scanned_by_name,
       CASE WHEN sc.last_at IS NOT NULL AND (i.user_id IS NULL OR sc.last_at >= i.created_at) THEN sc.last_location
            ELSE pk.address END AS last_location
FROM items i
LEFT JOIN pk ON pk.batch_id = i.batch_id::text AND i.bag_no > pk.cum_end - pk.n AND i.bag_no <= pk.cum_end
LEFT JOIN sc ON sc.bag_id = i.id
CROSS JOIN LATERAL (SELECT greatest(
  public.td_bag_status_rank(i.status),
  CASE WHEN pk.st IN ('collecting', 'disposed') THEN 4 WHEN pk.id IS NOT NULL THEN 3 ELSE 0 END,
  CASE WHEN i.activated OR i.user_id IS NOT NULL THEN 2 ELSE 1 END) AS rank) r
WHERE public.td_is_staff();

-- One timeline per bag: scanned by the household, pickup requested, collected, scans rows
CREATE VIEW public.admin_bag_events AS
SELECT i.id AS bag_id, i.batch_id, i.bag_no, 'household_scan'::text AS kind, i.created_at AS at,
       i.household_name AS actor, NULL::text AS location, 'Batch QR scanned by household'::text AS label
FROM public.admin_bag_items i WHERE i.household_id IS NOT NULL
UNION ALL
SELECT i.id, i.batch_id, i.bag_no, 'pickup_requested', i.pickup_requested_at, i.household_name, i.pickup_address, 'Pickup requested'
FROM public.admin_bag_items i WHERE i.pickup_id IS NOT NULL
UNION ALL
SELECT i.id, i.batch_id, i.bag_no, 'collected', i.collected_at, i.collector_name, i.pickup_address, 'Collected'
FROM public.admin_bag_items i WHERE i.collected_at IS NOT NULL
UNION ALL
SELECT s.bag_id, s.batch_id, i.bag_no, 'scan', s.scanned_at, s.scanned_by_name, s.location,
       'Scanned' || coalesce(' (' || s.status || ')', '')
FROM public.admin_bag_scans s LEFT JOIN public.admin_bag_items i ON i.id = s.bag_id;

-- Same as 20261019, plus scanned count / % / last scan
CREATE VIEW public.admin_bag_batches AS
SELECT b.id, b.id::text AS id_text, to_jsonb(b) ->> 'batch_number' AS batch_number, to_jsonb(b) ->> 'batch_name' AS batch_name,
       coalesce(b.bag_count, 0) AS bag_count, b.type, b.size, b.qr_prefix, b.status AS raw_status,
       b.unit_price, (to_jsonb(b) ->> 'total_batch_price')::numeric AS total_batch_price,
       b.created_at, b.updated_at, coalesce(b.archived, false) OR lower(coalesce(b.status, '')) = 'archived' AS archived, b.archived_at,
       b.generated_by, public.td_user_label(b.generated_by) AS generated_by_name,
       CASE WHEN act.activated THEN b.created_by END AS household_id,
       CASE WHEN act.activated THEN public.td_user_label(b.created_by) END AS household_name,
       CASE WHEN act.activated THEN b.updated_at END AS scanned_by_household_at,
       coalesce(s.total, 0) AS bag_rows,
       coalesce(s.reached_distributed, 0) AS distributed_count,
       coalesce(s.reached_filled, 0) AS filled_count,
       coalesce(s.reached_collected, 0) AS collected_count,
       coalesce(s.reached_processed, 0) AS processed_count,
       CASE
         WHEN coalesce(b.archived, false) OR lower(coalesce(b.status, '')) = 'archived' THEN 'archived'
         WHEN coalesce(s.total, 0) = 0 THEN CASE WHEN act.activated THEN 'distributed' ELSE 'generated' END
         ELSE public.td_bag_stage_name(s.min_rank)
       END AS stage,
       s.last_activity_at,
       lower(concat_ws(' ', b.id::text, to_jsonb(b) ->> 'batch_number', to_jsonb(b) ->> 'batch_name', b.type, b.size, b.qr_prefix)) AS search_text,
       coalesce(s.scanned, 0) AS scanned_count,
       CASE WHEN greatest(coalesce(s.total, 0), coalesce(b.bag_count, 0)) > 0
            THEN round(100.0 * coalesce(s.scanned, 0) / greatest(coalesce(s.total, 0), coalesce(b.bag_count, 0)))::int ELSE 0 END AS scanned_pct,
       s.last_scan_at,
       coalesce(s.scan_events, 0) AS scan_count
FROM public.batches b
CROSS JOIN LATERAL (SELECT lower(coalesce(b.status, '')) IN ('used', 'activated', 'scanned', 'completed', 'distributed') AS activated) act
LEFT JOIN LATERAL (
  SELECT count(*) AS total, min(i.stage_rank) AS min_rank,
         count(*) FILTER (WHERE i.stage_rank >= 2) AS reached_distributed,
         count(*) FILTER (WHERE i.stage_rank >= 3) AS reached_filled,
         count(*) FILTER (WHERE i.stage_rank >= 4) AS reached_collected,
         count(*) FILTER (WHERE i.stage_rank >= 5) AS reached_processed,
         max(i.last_activity_at) AS last_activity_at,
         count(*) FILTER (WHERE i.scan_count > 0) AS scanned,
         sum(i.scan_count) AS scan_events,
         max(i.last_scan_at) AS last_scan_at
  FROM public.admin_bag_items i WHERE i.batch_id = b.id
) s ON true
WHERE public.td_is_staff();

REVOKE ALL ON public.admin_bag_scans, public.admin_bag_items, public.admin_bag_events, public.admin_bag_batches FROM anon;
GRANT SELECT ON public.admin_bag_scans, public.admin_bag_items, public.admin_bag_events, public.admin_bag_batches TO authenticated;

-- ── 3. Bag History numbers ─────────────────────────────────────────────────
-- Archived batches are left out, as on the page. Days are Africa/Accra days.
CREATE OR REPLACE FUNCTION public.admin_bag_history_stats(p_days integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  days integer := greatest(1, least(coalesce(p_days, 30), 366));
  first_day date := (now() AT TIME ZONE 'Africa/Accra')::date - (days - 1);
  res jsonb;
BEGIN
  IF NOT public.td_is_staff() THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE = 'insufficient_privilege'; END IF;
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
END $$;
REVOKE ALL ON FUNCTION public.admin_bag_history_stats(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_bag_history_stats(integer) TO authenticated;

-- PostgREST: pick up the new views and columns now
NOTIFY pgrst, 'reload schema';

-- Check (the views only answer signed-in admins, so this reads the tables)
SELECT (SELECT count(*) FROM public.scans) AS scan_rows,
       (SELECT count(*) FROM public.scans WHERE scanned_by IS NOT NULL) AS scan_rows_with_scanner,
       (SELECT count(*) FROM public.batches) AS batches,
       (SELECT count(*) FROM public.bags WHERE user_id IS NOT NULL) AS household_bags;
