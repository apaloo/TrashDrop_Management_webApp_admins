-- Pickup Requests page (/request-pickup/requests): one view for server-side
-- paging, plus database rules for status changes. Review, then run once in
-- the Supabase SQL editor. Safe to re-run. Does not change existing rows.
--
-- 1. Cancellation columns: cancelled_at, cancelled_by, cancellation_reason.
-- 2. public.admin_pickup_requests view: pickup_requests, digital_bins and
--    scheduled_pickups in one shape (customer, collector, address, lat/lng,
--    priority, fee...). Optional columns are read through to_jsonb(), so the
--    view works whatever extra columns each table has. security_invoker: the
--    viewer's own row-level security applies.
-- 3. Status rules on pickup_requests and digital_bins (BEFORE UPDATE OF status):
--      pending → accepted → en_route → arrived → collecting → disposed/completed
--    plus the collector app's shortcuts (accepted → arrived/collecting,
--    en_route → collecting, arrived → disposed, completed → disposed,
--    accepted → pending when an assignment expires, → expired).
--    Cancel only before collecting. Statuses from accepted to collecting
--    need a collector_id. Escape hatch for data fixes, in one transaction:
--      SET LOCAL app.skip_status_flow = 'on';
-- 4. Logging: status changes are logged by 20261018_audit_log.sql (one audit
--    trail). This file only removes its old log trigger if one is left over.

-- ── helpers ─────────────────────────────────────────────────────────────────

-- Point from a row as JSON: tries coordinates, location (WKT, EWKT, hex EWKB
-- or GeoJSON), then latitude/longitude. NULL when nothing readable.
CREATE OR REPLACE FUNCTION public.td_row_point(r jsonb)
RETURNS geometry
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, extensions
AS $$
DECLARE
  k text;
  v jsonb;
  g geometry;
BEGIN
  IF r IS NULL THEN RETURN NULL; END IF;
  FOREACH k IN ARRAY ARRAY['coordinates', 'location', 'current_location'] LOOP
    v := r -> k;
    CONTINUE WHEN v IS NULL OR v = 'null'::jsonb;
    BEGIN
      IF jsonb_typeof(v) = 'object' THEN
        g := ST_GeomFromGeoJSON(v::text);
      ELSIF jsonb_typeof(v) = 'string' THEN
        g := (v #>> '{}')::geometry;
      END IF;
      IF g IS NOT NULL AND GeometryType(g) = 'POINT' THEN RETURN g; END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL; -- not a point; try the next field
    END;
  END LOOP;
  BEGIN
    IF r ? 'latitude' AND r ? 'longitude' THEN
      RETURN ST_SetSRID(ST_MakePoint((r ->> 'longitude')::double precision, (r ->> 'latitude')::double precision), 4326);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.td_num(v text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$ SELECT CASE WHEN v ~ '^\s*-?\d+(\.\d+)?\s*$' THEN v::numeric END $$;

-- ── 1. cancellation columns ────────────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pickup_requests', 'digital_bins', 'scheduled_pickups'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS cancelled_at timestamptz', t);
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS cancelled_by uuid', t);
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS cancellation_reason text', t);
    END IF;
  END LOOP;
END;
$$;

-- ── 2. view ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  parts text[] := ARRAY[]::text[];
BEGIN
  IF to_regclass('public.pickup_requests') IS NOT NULL THEN
    parts := array_append(parts, $q$
      SELECT 'pickup_requests'::text AS source, to_jsonb(p) AS j, public.td_row_point(to_jsonb(p)) AS pt, NULL::text AS place
      FROM public.pickup_requests p$q$);
  END IF;
  IF to_regclass('public.digital_bins') IS NOT NULL THEN
    parts := array_append(parts, CASE WHEN to_regclass('public.bin_locations') IS NOT NULL THEN $q$
      SELECT 'digital_bins', to_jsonb(b), public.td_row_point(to_jsonb(l)), coalesce(to_jsonb(l) ->> 'address', to_jsonb(l) ->> 'location_name')
      FROM public.digital_bins b LEFT JOIN public.bin_locations l ON l.id::text = to_jsonb(b) ->> 'location_id'$q$
    ELSE $q$
      SELECT 'digital_bins', to_jsonb(b), public.td_row_point(to_jsonb(b)), NULL FROM public.digital_bins b$q$ END);
  END IF;
  IF to_regclass('public.scheduled_pickups') IS NOT NULL THEN
    parts := array_append(parts, CASE WHEN to_regclass('public.locations') IS NOT NULL THEN $q$
      SELECT 'scheduled_pickups', to_jsonb(s), public.td_row_point(to_jsonb(l)), coalesce(to_jsonb(l) ->> 'address', to_jsonb(l) ->> 'location_name')
      FROM public.scheduled_pickups s LEFT JOIN public.locations l ON l.id::text = to_jsonb(s) ->> 'location_id'$q$
    ELSE $q$
      SELECT 'scheduled_pickups', to_jsonb(s), public.td_row_point(to_jsonb(s)), NULL FROM public.scheduled_pickups s$q$ END);
  END IF;

  IF cardinality(parts) = 0 THEN
    RAISE NOTICE 'No request tables found; view not created';
    RETURN;
  END IF;

  EXECUTE 'DROP VIEW IF EXISTS public.admin_pickup_requests';
  EXECUTE format($v$
    CREATE VIEW public.admin_pickup_requests WITH (security_invoker = true) AS
    WITH src AS (%s)
    SELECT
      src.j ->> 'id'                                              AS id,
      src.source,
      lower(coalesce(src.j ->> 'status', 'pending'))              AS status,
      (src.j ->> 'created_at')::timestamptz                       AS created_at,
      (src.j ->> 'updated_at')::timestamptz                       AS updated_at,
      src.j ->> 'user_id'                                         AS user_id,
      nullif(trim(concat_ws(' ', pr.first_name, pr.last_name)), '') AS customer_name,
      pr.email                                                    AS customer_email,
      pr.phone                                                    AS customer_phone,
      coalesce(nullif(src.j ->> 'address', ''), src.place)        AS address,
      ST_Y(src.pt)                                                AS lat,
      ST_X(src.pt)                                                AS lng,
      coalesce(src.j ->> 'waste_type', 'general')                 AS waste_type,
      coalesce(public.td_num(src.j ->> 'bag_count'), public.td_num(src.j ->> 'bags'), public.td_num(src.j ->> 'estimated_volume')) AS bag_count,
      public.td_num(src.j ->> 'bin_size_liters')                  AS bin_size_liters,
      public.td_num(src.j ->> 'fee')                              AS fee,
      coalesce((src.j ->> 'is_urgent')::boolean, (src.j ->> 'urgent_enabled')::boolean, false) AS is_urgent,
      CASE
        WHEN coalesce((src.j ->> 'is_urgent')::boolean, (src.j ->> 'urgent_enabled')::boolean, false) THEN 'high'
        WHEN lower(src.j ->> 'priority') IN ('high', 'urgent', 'critical') THEN 'high'
        WHEN lower(src.j ->> 'priority') = 'low' THEN 'low'
        ELSE 'medium'
      END                                                         AS priority,
      CASE
        WHEN coalesce((src.j ->> 'is_urgent')::boolean, (src.j ->> 'urgent_enabled')::boolean, false)
          OR lower(src.j ->> 'priority') IN ('high', 'urgent', 'critical') THEN 3
        WHEN lower(src.j ->> 'priority') = 'low' THEN 1
        ELSE 2
      END                                                         AS priority_rank,
      CASE lower(coalesce(src.j ->> 'status', 'pending'))
        WHEN 'pending' THEN 0 WHEN 'available' THEN 0 WHEN 'scheduled' THEN 0
        WHEN 'accepted' THEN 1 WHEN 'assigned' THEN 1
        WHEN 'en_route' THEN 2 WHEN 'in_transit' THEN 2 WHEN 'in_progress' THEN 2
        WHEN 'arrived' THEN 3
        WHEN 'collecting' THEN 4 WHEN 'picked_up' THEN 4
        WHEN 'completed' THEN 5 WHEN 'disposed' THEN 5
        WHEN 'cancelled' THEN 6 WHEN 'canceled' THEN 6
        WHEN 'expired' THEN 7
        ELSE 8
      END                                                         AS status_rank,
      src.j ->> 'priority'                                        AS raw_priority,
      coalesce(src.j ->> 'collector_id', src.j ->> 'assigned_to') AS collector_ref,
      cp.user_id::text                                            AS collector_user_id,
      cp.id::text                                                 AS collector_profile_id,
      nullif(trim(concat_ws(' ', cp.first_name, cp.last_name)), '') AS collector_name,
      (src.j ->> 'accepted_at')::timestamptz                      AS accepted_at,
      (src.j ->> 'picked_up_at')::timestamptz                     AS picked_up_at,
      coalesce((src.j ->> 'disposed_at')::timestamptz, (src.j ->> 'completed_at')::timestamptz, (src.j ->> 'collected_at')::timestamptz) AS completed_at,
      (src.j ->> 'cancelled_at')::timestamptz                     AS cancelled_at,
      src.j ->> 'cancelled_by'                                    AS cancelled_by,
      src.j ->> 'cancellation_reason'                             AS cancellation_reason,
      coalesce(src.j ->> 'special_instructions', src.j ->> 'notes') AS notes,
      coalesce(src.j ->> 'scheduled_date', src.j ->> 'pickup_date') AS scheduled_date,
      src.j ->> 'batch_id'                                        AS batch_id,
      public.td_num(src.j ->> 'promotional_client_fee')           AS promotional_fee,
      public.td_num(src.j ->> 'collector_core_payout')            AS collector_core_payout,
      public.td_num(src.j ->> 'collector_urgent_payout')          AS collector_urgent_payout,
      public.td_num(src.j ->> 'collector_distance_payout')        AS collector_distance_payout,
      public.td_num(src.j ->> 'collector_total_payout')           AS collector_total_payout,
      public.td_num(src.j ->> 'platform_share')                   AS platform_share,
      public.td_num(coalesce(src.j ->> 'collector_rating', src.j ->> 'rating')) AS customer_rating,
      (src.j ->> 'rated_at')::timestamptz                         AS rated_at
    FROM src
    LEFT JOIN public.profiles pr ON pr.id::text = src.j ->> 'user_id'
    LEFT JOIN LATERAL (
      SELECT c.id, c.user_id, c.first_name, c.last_name
      FROM public.collector_profiles c
      WHERE c.user_id::text = coalesce(src.j ->> 'collector_id', src.j ->> 'assigned_to')
         OR c.id::text = coalesce(src.j ->> 'collector_id', src.j ->> 'assigned_to')
      LIMIT 1
    ) cp ON true
  $v$, array_to_string(parts, ' UNION ALL '));

  EXECUTE 'GRANT SELECT ON public.admin_pickup_requests TO authenticated';
END;
$$;

-- ── 3. status rules ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_pickup_status_flow()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  old_s text := lower(coalesce(OLD.status, 'pending'));
  new_s text := lower(coalesce(NEW.status, 'pending'));
  collector text := coalesce(to_jsonb(NEW) ->> 'collector_id', to_jsonb(NEW) ->> 'assigned_to');
  canon_old text;
  canon_new text;
BEGIN
  IF coalesce(current_setting('app.skip_status_flow', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  -- Map aliases to canonical statuses
  canon_old := CASE
    WHEN old_s IN ('available', 'new', 'requested', 'open') THEN 'pending'
    WHEN old_s IN ('assigned', 'confirmed', 'reserved') THEN 'accepted'
    WHEN old_s IN ('in_transit', 'started', 'in_progress') THEN 'en_route'
    WHEN old_s = 'picked_up' THEN 'collecting'
    WHEN old_s IN ('canceled', 'rejected', 'declined') THEN 'cancelled'
    ELSE old_s END;
  canon_new := CASE
    WHEN new_s IN ('available', 'new', 'requested', 'open') THEN 'pending'
    WHEN new_s IN ('assigned', 'confirmed', 'reserved') THEN 'accepted'
    WHEN new_s IN ('in_transit', 'started', 'in_progress') THEN 'en_route'
    WHEN new_s = 'picked_up' THEN 'collecting'
    WHEN new_s IN ('canceled', 'rejected', 'declined') THEN 'cancelled'
    ELSE new_s END;

  -- A collector must be assigned for every in-progress status
  IF canon_new IN ('accepted', 'en_route', 'arrived', 'collecting') AND collector IS NULL THEN
    RAISE EXCEPTION 'Status % needs an assigned collector (collector_id)', new_s
      USING ERRCODE = 'check_violation';
  END IF;

  IF canon_old = canon_new THEN
    RETURN NEW;
  END IF;

  IF (canon_old, canon_new) IN (
    ('pending', 'accepted'), ('pending', 'cancelled'), ('pending', 'expired'),
    ('accepted', 'en_route'), ('accepted', 'arrived'), ('accepted', 'collecting'),
    ('accepted', 'pending'), ('accepted', 'cancelled'), ('accepted', 'expired'),
    ('en_route', 'arrived'), ('en_route', 'collecting'), ('en_route', 'cancelled'), ('en_route', 'expired'),
    ('arrived', 'collecting'), ('arrived', 'completed'), ('arrived', 'disposed'), ('arrived', 'cancelled'),
    ('collecting', 'completed'), ('collecting', 'disposed'),
    ('completed', 'disposed')
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Status cannot change from % to %', old_s, new_s
    USING ERRCODE = 'check_violation',
          HINT = 'Allowed: pending → accepted → en_route → arrived → collecting → completed/disposed; cancel only before collecting.';
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pickup_requests', 'digital_bins'] LOOP
    CONTINUE WHEN to_regclass('public.' || t) IS NULL;
    EXECUTE format('DROP TRIGGER IF EXISTS enforce_pickup_status_flow ON public.%I', t);
    EXECUTE format('CREATE TRIGGER enforce_pickup_status_flow BEFORE UPDATE OF %s ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_pickup_status_flow()',
      CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'collector_id')
           THEN 'status, collector_id' ELSE 'status' END, t);
    RAISE NOTICE 'Status rules on %', t;
  END LOOP;
  FOREACH t IN ARRAY ARRAY['pickup_requests', 'digital_bins', 'scheduled_pickups'] LOOP
    CONTINUE WHEN to_regclass('public.' || t) IS NULL;
    -- old status logger, replaced by td_audit_request (20261018)
    EXECUTE format('DROP TRIGGER IF EXISTS log_pickup_status_change ON public.%I', t);
  END LOOP;
END;
$$;

-- Check
SELECT source, status, count(*) FROM public.admin_pickup_requests GROUP BY 1, 2 ORDER BY 1, 2;
