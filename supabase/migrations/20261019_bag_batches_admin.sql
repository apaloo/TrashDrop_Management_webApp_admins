-- ============================================================================
-- Bag Management (/bin-management/manage): batch details, real bag numbers,
-- one status list.
--
-- Needs 20261018_audit_log.sql (td_is_staff, td_canon_status, td_write_log).
-- Additive only: no existing column or value is changed. Safe to re-run.
-- Undo: supabase/diagnostics/bag_batches_rollback.sql
--
-- Why statuses are worked out instead of stored:
--   batches.status ('active' → 'used') belongs to the household app: scanning
--   a batch QR only works on 'active' batches, household stats count 'used'
--   batches, and its permission rules check both. So the admin never rewrites
--   it. Instead admin_bag_items / admin_bag_batches work out each bag's step:
--     generated   batch not yet scanned by a household
--     distributed batch scanned; the bag belongs to a household
--     filled      the household asked for a pickup that uses this bag
--     collected   that pickup was collected (picked up / disposed)
--     processed   no app records this yet; reached only if a bag row says so
--   A household's pickups use the bags of the batch named on the pickup
--   (pickup_requests.batch_id), in order. A batch's step is the furthest step
--   EVERY bag has reached (its slowest bag); the counts show the spread.
--
-- 0. Backup of batches (batches_backup_20261019), admins only.
-- 1. batches: type, size, qr_prefix, generated_by (the admin who generated
--    it — created_by is overwritten with the household on scan), archived,
--    archived_at, archived_by. Filled in on insert; backfilled from notes /
--    batch_name for existing rows.
-- 2. Views admin_bag_items and admin_bag_batches (admins only).
-- 3. admin_bag_stats(): the Bag Management cards.
-- 4. admin_set_batch_archived(): archive / restore.
-- 5. Audit log: batch created, scanned by a household, archived, restored.
-- ============================================================================

-- ── 0. backup ──────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.batches_backup_20261019') IS NULL THEN
    CREATE TABLE public.batches_backup_20261019 AS SELECT * FROM public.batches;
    ALTER TABLE public.batches_backup_20261019 ENABLE ROW LEVEL SECURITY; -- no policies: not readable from the apps
    REVOKE ALL ON public.batches_backup_20261019 FROM anon, authenticated;
  END IF;
END $$;

-- ── 1. batch details ───────────────────────────────────────────────────────
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS type         text;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS size         text;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS qr_prefix    text;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS generated_by uuid;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS archived     boolean;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS archived_at  timestamptz;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS archived_by  uuid;
UPDATE public.batches SET archived = false WHERE archived IS NULL;
ALTER TABLE public.batches ALTER COLUMN archived SET DEFAULT false;

-- "TD-ORG-M" from type and size (same codes as the Generate Bag page)
CREATE OR REPLACE FUNCTION public.td_bag_qr_prefix(p_type text, p_size text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN nullif(btrim(p_type), '') IS NULL THEN NULL ELSE
    'TD-' || CASE lower(btrim(p_type))
      WHEN 'recyclable' THEN 'REC' WHEN 'organic' THEN 'ORG' WHEN 'hazardous' THEN 'HAZ'
      WHEN 'general' THEN 'GEN' WHEN 'electronic' THEN 'ELE' ELSE 'OTH' END
    || '-' || CASE lower(btrim(coalesce(p_size, '')))
      WHEN 'small' THEN 'S' WHEN 'large' THEN 'L' ELSE 'M' END
  END
$$;

-- Type / size written by older versions of the admin into notes ("Type: X, Size: Y")
-- or batch_name ("X - Y"). 'Unknown', 'Bags' and 'Standard' were placeholders.
CREATE OR REPLACE FUNCTION public.td_batch_type_from_text(p_notes text, p_name text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT nullif(nullif(nullif(btrim(coalesce(
    substring(p_notes FROM 'Type:\s*([^,]+)'),
    CASE WHEN p_name LIKE '% - %' THEN split_part(p_name, ' - ', 1) END)), ''), 'Unknown'), 'Bags')
$$;
CREATE OR REPLACE FUNCTION public.td_batch_size_from_text(p_notes text, p_name text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT nullif(nullif(nullif(btrim(coalesce(
    substring(p_notes FROM 'Size:\s*([^,]+)'),
    CASE WHEN p_name LIKE '% - %' THEN split_part(p_name, ' - ', 2) END)), ''), 'Unknown'), 'Standard')
$$;

CREATE OR REPLACE FUNCTION public.td_batches_fill_details()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE j jsonb := to_jsonb(NEW);
BEGIN
  NEW.type := coalesce(nullif(btrim(NEW.type), ''), public.td_batch_type_from_text(j ->> 'notes', j ->> 'batch_name'));
  NEW.size := coalesce(nullif(btrim(NEW.size), ''), public.td_batch_size_from_text(j ->> 'notes', j ->> 'batch_name'));
  NEW.qr_prefix := coalesce(nullif(btrim(NEW.qr_prefix), ''), public.td_bag_qr_prefix(NEW.type, NEW.size));
  IF NEW.generated_by IS NULL AND public.td_is_staff() THEN
    BEGIN NEW.generated_by := auth.uid(); EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  NEW.archived := coalesce(NEW.archived, false);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS td_batches_fill_details ON public.batches;
CREATE TRIGGER td_batches_fill_details BEFORE INSERT ON public.batches
  FOR EACH ROW EXECUTE FUNCTION public.td_batches_fill_details();

-- Backfill (new columns only)
UPDATE public.batches b SET
  type = coalesce(b.type, public.td_batch_type_from_text(to_jsonb(b) ->> 'notes', to_jsonb(b) ->> 'batch_name')),
  size = coalesce(b.size, public.td_batch_size_from_text(to_jsonb(b) ->> 'notes', to_jsonb(b) ->> 'batch_name'))
WHERE b.type IS NULL OR b.size IS NULL;
UPDATE public.batches SET qr_prefix = public.td_bag_qr_prefix(type, size)
WHERE qr_prefix IS NULL AND type IS NOT NULL;
-- Until a household scans it, created_by is the admin who generated the batch
UPDATE public.batches b SET generated_by = b.created_by
WHERE b.generated_by IS NULL AND b.created_by IS NOT NULL AND lower(coalesce(b.status, '')) = 'active'
  AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = b.created_by AND lower(u.email) = ANY (public.td_admin_emails()));
-- Older admin builds archived by writing status 'Archived'
UPDATE public.batches SET archived = true, archived_at = coalesce(archived_at, updated_at)
WHERE lower(coalesce(status, '')) = 'archived' AND NOT archived;

-- ── 2. views ───────────────────────────────────────────────────────────────
-- Name for a user id (household or admin): profile name, else sign-up name, else email
CREATE OR REPLACE FUNCTION public.td_user_label(p_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE r text;
BEGIN
  IF p_id IS NULL OR NOT public.td_is_staff() THEN RETURN NULL; END IF; -- names are for admins only
  IF to_regclass('public.profiles') IS NOT NULL THEN
    EXECUTE $q$SELECT nullif(btrim(concat_ws(' ', to_jsonb(p) ->> 'first_name', to_jsonb(p) ->> 'last_name')), '')
               FROM public.profiles p WHERE p.id = $1$q$ INTO r USING p_id;
  END IF;
  IF r IS NULL THEN
    SELECT coalesce(nullif(btrim(concat_ws(' ', u.raw_user_meta_data ->> 'firstName', u.raw_user_meta_data ->> 'lastName')), ''),
                    nullif(btrim(concat_ws(' ', u.raw_user_meta_data ->> 'first_name', u.raw_user_meta_data ->> 'last_name')), ''),
                    u.raw_user_meta_data ->> 'full_name', u.email)
    INTO r FROM auth.users u WHERE u.id = p_id;
  END IF;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.td_user_label(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.td_user_label(uuid) TO authenticated; -- the views below call it as the viewer

CREATE OR REPLACE FUNCTION public.td_bag_stage_rank(p_stage text)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_stage WHEN 'generated' THEN 1 WHEN 'distributed' THEN 2 WHEN 'filled' THEN 3
                      WHEN 'collected' THEN 4 WHEN 'processed' THEN 5 ELSE 0 END
$$;
CREATE OR REPLACE FUNCTION public.td_bag_stage_name(p_rank integer)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT (ARRAY['generated', 'distributed', 'filled', 'collected', 'processed'])[greatest(1, least(5, coalesce(p_rank, 1)))]
$$;
-- A step a bag row itself records (no app writes these today; kept for when one does)
CREATE OR REPLACE FUNCTION public.td_bag_status_rank(p_status text)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN v IN ('processed', 'recycled') THEN 5
    WHEN v IN ('collected', 'picked_up', 'disposed', 'completed', 'scanned') THEN 4
    WHEN v IN ('filled', 'used', 'pending', 'requested', 'full') THEN 3
    ELSE 0 END
  FROM (SELECT lower(btrim(coalesce(p_status, ''))) AS v) x
$$;

DROP VIEW IF EXISTS public.admin_bag_batches;
DROP VIEW IF EXISTS public.admin_bag_items;

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
-- Once a household scans a batch its own bag rows are created; the admin's
-- placeholder rows (no household) are left out so bags aren't counted twice.
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
                (i.j ->> 'collected_at')::timestamptz, pk.last_event_at) AS last_activity_at,
       i.created_at
FROM items i
LEFT JOIN pk ON pk.batch_id = i.batch_id::text AND i.bag_no > pk.cum_end - pk.n AND i.bag_no <= pk.cum_end
CROSS JOIN LATERAL (SELECT greatest(
  public.td_bag_status_rank(i.status),
  CASE WHEN pk.st IN ('collecting', 'disposed') THEN 4 WHEN pk.id IS NOT NULL THEN 3 ELSE 0 END,
  CASE WHEN i.activated OR i.user_id IS NOT NULL THEN 2 ELSE 1 END) AS rank) r
WHERE public.td_is_staff();

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
       lower(concat_ws(' ', b.id::text, to_jsonb(b) ->> 'batch_number', to_jsonb(b) ->> 'batch_name', b.type, b.size, b.qr_prefix)) AS search_text
FROM public.batches b
CROSS JOIN LATERAL (SELECT lower(coalesce(b.status, '')) IN ('used', 'activated', 'scanned', 'completed', 'distributed') AS activated) act
LEFT JOIN LATERAL (
  SELECT count(*) AS total, min(i.stage_rank) AS min_rank,
         count(*) FILTER (WHERE i.stage_rank >= 2) AS reached_distributed,
         count(*) FILTER (WHERE i.stage_rank >= 3) AS reached_filled,
         count(*) FILTER (WHERE i.stage_rank >= 4) AS reached_collected,
         count(*) FILTER (WHERE i.stage_rank >= 5) AS reached_processed,
         max(i.last_activity_at) AS last_activity_at
  FROM public.admin_bag_items i WHERE i.batch_id = b.id
) s ON true
WHERE public.td_is_staff();

REVOKE ALL ON public.admin_bag_items, public.admin_bag_batches FROM anon;
GRANT SELECT ON public.admin_bag_items, public.admin_bag_batches TO authenticated;

-- ── 3. cards ───────────────────────────────────────────────────────────────
-- Pickups that use bags (they name a batch). Times are Africa/Accra days / weeks.
CREATE OR REPLACE FUNCTION public.admin_bag_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  day_start timestamptz := date_trunc('day', now() AT TIME ZONE 'Africa/Accra') AT TIME ZONE 'Africa/Accra';
  week_start timestamptz := date_trunc('week', now() AT TIME ZONE 'Africa/Accra') AT TIME ZONE 'Africa/Accra';
  res jsonb;
BEGIN
  IF NOT public.td_is_staff() THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE = 'insufficient_privilege'; END IF;
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
END $$;
REVOKE ALL ON FUNCTION public.admin_bag_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_bag_stats() TO authenticated;

-- ── 4. archive / restore ───────────────────────────────────────────────────
-- Archiving only hides a batch in the admin; it does not change batches.status.
CREATE OR REPLACE FUNCTION public.admin_set_batch_archived(p_batch_id uuid, p_archived boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.td_is_staff() THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE = 'insufficient_privilege'; END IF;
  UPDATE public.batches
  SET archived = p_archived,
      archived_at = CASE WHEN p_archived THEN now() END,
      archived_by = CASE WHEN p_archived THEN auth.uid() END
  WHERE id = p_batch_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Batch not found' USING ERRCODE = 'no_data_found'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.admin_set_batch_archived(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_batch_archived(uuid, boolean) TO authenticated;

-- ── 5. audit log ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.td_audit_batch()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  label text := coalesce(nullif(to_jsonb(NEW) ->> 'batch_number', ''), left(NEW.id::text, 8));
  was_active boolean;
BEGIN
  BEGIN
    IF TG_OP = 'INSERT' THEN
      PERFORM public.td_write_log('info', 'bags', 'batch.created', 'batch', NEW.id::text,
        format('Batch %s generated: %s bags%s', label, coalesce(NEW.bag_count, 0),
               coalesce(' (' || concat_ws(' · ', NEW.type, NEW.size) || ')', '')),
        NULL, jsonb_strip_nulls(jsonb_build_object('bag_count', NEW.bag_count, 'type', NEW.type, 'size', NEW.size, 'qr_prefix', NEW.qr_prefix)));
      RETURN NEW;
    END IF;
    was_active := lower(coalesce(OLD.status, '')) = 'active';
    IF was_active AND lower(coalesce(NEW.status, '')) IN ('used', 'activated', 'scanned') THEN
      PERFORM public.td_write_log('info', 'bags', 'batch.distributed', 'batch', NEW.id::text,
        format('Batch %s scanned by a household (%s bags)', label, coalesce(NEW.bag_count, 0)),
        jsonb_build_object('status', OLD.status), jsonb_build_object('status', NEW.status),
        jsonb_build_object('household_id', NEW.created_by));
    END IF;
    IF coalesce(OLD.archived, false) IS DISTINCT FROM coalesce(NEW.archived, false) THEN
      PERFORM public.td_write_log('info', 'bags', CASE WHEN NEW.archived THEN 'batch.archived' ELSE 'batch.restored' END,
        'batch', NEW.id::text, format('Batch %s %s', label, CASE WHEN NEW.archived THEN 'archived' ELSE 'restored' END),
        jsonb_build_object('archived', coalesce(OLD.archived, false)), jsonb_build_object('archived', NEW.archived));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- logging never blocks the change
  END;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS td_audit_batch ON public.batches;
CREATE TRIGGER td_audit_batch AFTER INSERT OR UPDATE ON public.batches
  FOR EACH ROW EXECUTE FUNCTION public.td_audit_batch();

-- Check (the views only answer signed-in admins, so this reads the table)
SELECT count(*) AS batches,
       count(*) FILTER (WHERE type IS NOT NULL) AS with_type,
       count(*) FILTER (WHERE size IS NOT NULL) AS with_size,
       count(*) FILTER (WHERE qr_prefix IS NOT NULL) AS with_qr_prefix,
       count(*) FILTER (WHERE generated_by IS NOT NULL) AS with_admin,
       count(*) FILTER (WHERE archived) AS archived
FROM public.batches;
