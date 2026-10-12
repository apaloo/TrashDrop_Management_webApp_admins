-- ============================================================================
-- Alerts page (/request-pickup/alerts) and automatic alert rules
--
-- Needs, in this order: 20261015_pickup_requests_admin.sql (admin_pickup_requests
-- view) and 20261016_collectors_admin.sql (service_zones, td_gh_phone).
--
-- 1. alerts: status, priority (severity), type, related record, assignee,
--    resolution columns; existing values normalised (no rows deleted).
-- 2. alert_activity: timeline (created, status, assignment, comment, action).
--    20261018_audit_log.sql copies each entry to public.logs (the audit trail);
--    this file never replaces that logger.
-- 3. alert_rule_settings: on/off and thresholds per rule.
-- 4. service_zones: centre + radius so "outside the service area" can be checked.
-- 5. run_alert_rules(dry_run): the rules job; scheduled every 5 minutes with pg_cron.
-- 6. Notifications for new High/Critical alerts and assignments (header bell).
-- 7. Row level security: only the admin accounts that can open Request Pickup.
--
-- Safe to run more than once.
-- ============================================================================

-- ── 0. who is staff ────────────────────────────────────────────────────────
-- Same list as FULL_ACCESS_ADMIN_EMAILS in src/constants/accessControl.js
-- (Request Pickup is admin-only). The email comes from the verified JWT.
CREATE OR REPLACE FUNCTION public.td_admin_emails()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['otisadomako50@gmail.com', 'xahlijah@gmail.com']
$$;

CREATE OR REPLACE FUNCTION public.td_is_staff()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce(lower(auth.jwt() ->> 'email') = ANY (public.td_admin_emails()), false)
$$;

-- Staff accounts for "Assign to"
CREATE OR REPLACE FUNCTION public.td_staff_users()
RETURNS TABLE (id uuid, email text, name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  IF NOT public.td_is_staff() THEN RETURN; END IF;
  RETURN QUERY
    SELECT u.id, u.email::text,
           coalesce(nullif(btrim(concat_ws(' ', u.raw_user_meta_data ->> 'firstName', u.raw_user_meta_data ->> 'lastName')), ''),
                    u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1))::text
    FROM auth.users u
    WHERE lower(u.email) = ANY (public.td_admin_emails())
    ORDER BY 3;
END $$;
REVOKE ALL ON FUNCTION public.td_staff_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.td_staff_users() TO authenticated;

-- ── helpers ────────────────────────────────────────────────────────────────
-- Canonical pickup status (same mapping as src/constants/pickupStatus.js)
CREATE OR REPLACE FUNCTION public.td_canon_status(s text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN v IN ('pending', 'available', 'new', 'requested', 'scheduled', 'open') THEN 'pending'
    WHEN v IN ('accepted', 'assigned', 'confirmed', 'reserved') THEN 'accepted'
    WHEN v IN ('en_route', 'in_transit', 'started', 'in_progress') THEN 'en_route'
    WHEN v = 'arrived' THEN 'arrived'
    WHEN v IN ('collecting', 'picked_up') THEN 'collecting'
    WHEN v IN ('disposed', 'completed', 'collected', 'done') THEN 'disposed'
    WHEN v IN ('cancelled', 'canceled', 'rejected', 'declined', 'failed') THEN 'cancelled'
    WHEN v = 'expired' THEN 'expired'
    ELSE v END
  FROM (SELECT regexp_replace(lower(btrim(coalesce(s, 'pending'))), '[\s-]+', '_', 'g') AS v) x
$$;

CREATE OR REPLACE FUNCTION public.td_try_ts(t text)
RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN t::timestamptz;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.td_try_num(t text)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN nullif(btrim(t), '')::numeric;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END $$;

-- ── 1. alerts columns ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  type text DEFAULT 'system',
  severity text DEFAULT 'medium',
  entity_type text,
  entity_id uuid,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS description      text;
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS type             text;
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS severity         text;
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS entity_type      text;
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS created_by       uuid;
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS status           text NOT NULL DEFAULT 'open';
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS rule_key         text;          -- NULL = created by a person
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS entity_source    text;          -- pickup_requests | digital_bins | scheduled_pickups | collector_profiles | service_zones
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS entity_ref       text;          -- id of the related record (zone name for regions)
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS assigned_to      uuid;
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS metadata         jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS location_lat     double precision;
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS location_lng     double precision;
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS location_address text;
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS acknowledged_at  timestamptz;
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS resolved_at      timestamptz;
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS closed_at        timestamptz;
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS resolution_note  text;
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS resolved_by      uuid;
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS auto_resolved    boolean NOT NULL DEFAULT false;
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS last_seen_at     timestamptz;   -- last time a rule still saw the problem

-- One canonical spelling for status / priority / type, whatever wrote the row
CREATE OR REPLACE FUNCTION public.td_alert_normalise()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s text; p text; t text;
BEGIN
  s := regexp_replace(lower(btrim(coalesce(NEW.status, 'open'))), '[\s-]+', '_', 'g');
  NEW.status := CASE
    WHEN s IN ('open', 'new', 'active', 'triggered') THEN 'open'
    WHEN s IN ('acknowledged', 'ack', 'seen') THEN 'acknowledged'
    WHEN s IN ('in_progress', 'investigating', 'working') THEN 'in_progress'
    WHEN s IN ('resolved', 'auto_resolved', 'fixed', 'done') THEN 'resolved'
    WHEN s IN ('closed', 'dismissed', 'archived', 'ignored') THEN 'closed'
    ELSE 'open' END;
  p := lower(btrim(coalesce(NEW.severity, 'medium')));
  NEW.severity := CASE
    WHEN p IN ('critical', 'urgent', 'emergency', 'p1') THEN 'critical'
    WHEN p IN ('high', 'error', 'p2') THEN 'high'
    WHEN p IN ('low', 'info', 'minor', 'p4') THEN 'low'
    ELSE 'medium' END;
  t := regexp_replace(lower(btrim(coalesce(NEW.type, 'system'))), '[\s-]+', '_', 'g');
  NEW.type := CASE
    WHEN t IN ('', 'info', 'warning', 'error', 'success', 'general') THEN 'system'
    ELSE t END;
  NEW.entity_type := CASE lower(coalesce(NEW.entity_type, ''))
    WHEN '' THEN CASE WHEN NEW.entity_ref IS NULL THEN 'system' ELSE 'pickup_request' END
    WHEN 'request' THEN 'pickup_request'
    WHEN 'pickup' THEN 'pickup_request'
    ELSE lower(NEW.entity_type) END;
  IF NEW.entity_ref IS NULL AND NEW.entity_id IS NOT NULL THEN NEW.entity_ref := NEW.entity_id::text; END IF;
  -- timestamps for each step
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'acknowledged' AND NEW.acknowledged_at IS NULL THEN NEW.acknowledged_at := now(); END IF;
    IF NEW.status = 'resolved' THEN NEW.resolved_at := coalesce(NEW.resolved_at, now()); END IF;
    IF NEW.status = 'closed' THEN NEW.closed_at := coalesce(NEW.closed_at, now()); END IF;
    IF NEW.status IN ('open', 'acknowledged', 'in_progress') THEN
      NEW.resolved_at := NULL; NEW.closed_at := NULL;
      IF TG_OP = 'UPDATE' THEN NEW.auto_resolved := false; END IF;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS td_alert_normalise ON public.alerts;
CREATE TRIGGER td_alert_normalise BEFORE INSERT OR UPDATE ON public.alerts
  FOR EACH ROW EXECUTE FUNCTION public.td_alert_normalise();

-- Normalise what is already stored (fires the trigger above)
UPDATE public.alerts SET status = status;

-- One open alert per rule and record
CREATE UNIQUE INDEX IF NOT EXISTS alerts_one_open_per_rule
  ON public.alerts (rule_key, entity_ref)
  WHERE rule_key IS NOT NULL AND status IN ('open', 'acknowledged', 'in_progress');
CREATE INDEX IF NOT EXISTS alerts_status_idx ON public.alerts (status, severity, created_at DESC);

-- ── 2. activity timeline ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.alert_activity (
  id          bigserial PRIMARY KEY,
  alert_id    uuid NOT NULL REFERENCES public.alerts (id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('created', 'status', 'assigned', 'escalated', 'comment', 'action')),
  from_value  text,
  to_value    text,
  note        text,
  data        jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id    uuid,
  actor_name  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS alert_activity_alert_idx ON public.alert_activity (alert_id, created_at);

-- Who is acting: a rule (set by run_alert_rules) or the signed-in admin
CREATE OR REPLACE FUNCTION public.td_alert_actor()
RETURNS TABLE (actor_id uuid, actor_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE rule text := nullif(current_setting('app.alert_actor', true), '');
BEGIN
  IF rule IS NOT NULL THEN
    RETURN QUERY SELECT NULL::uuid, rule;
    RETURN;
  END IF;
  RETURN QUERY
    SELECT u.id, coalesce(nullif(btrim(concat_ws(' ', u.raw_user_meta_data ->> 'firstName', u.raw_user_meta_data ->> 'lastName')), ''), u.email)::text
    FROM auth.users u WHERE u.id = auth.uid();
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, 'System'::text;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.td_alert_track()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record;
BEGIN
  SELECT * INTO a FROM public.td_alert_actor() LIMIT 1;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.alert_activity (alert_id, kind, to_value, note, data, actor_id, actor_name)
    VALUES (NEW.id, 'created', NEW.status, NEW.title,
            jsonb_build_object('priority', NEW.severity, 'type', NEW.type, 'rule', NEW.rule_key),
            coalesce(a.actor_id, NEW.created_by), a.actor_name);
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.alert_activity (alert_id, kind, from_value, to_value, note, actor_id, actor_name)
    VALUES (NEW.id, 'status', OLD.status, NEW.status,
            CASE WHEN NEW.status IN ('resolved', 'closed') THEN NEW.resolution_note END, a.actor_id, a.actor_name);
  END IF;
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    INSERT INTO public.alert_activity (alert_id, kind, from_value, to_value, actor_id, actor_name)
    VALUES (NEW.id, 'assigned', OLD.assigned_to::text, NEW.assigned_to::text, a.actor_id, a.actor_name);
  END IF;
  IF NEW.severity IS DISTINCT FROM OLD.severity THEN
    INSERT INTO public.alert_activity (alert_id, kind, from_value, to_value, actor_id, actor_name)
    VALUES (NEW.id, 'escalated', OLD.severity, NEW.severity, a.actor_id, a.actor_name);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS td_alert_track ON public.alerts;
CREATE TRIGGER td_alert_track AFTER INSERT OR UPDATE ON public.alerts
  FOR EACH ROW EXECUTE FUNCTION public.td_alert_track();

-- Who acted, on every timeline entry. The audit-log version of this function
-- (20261018_audit_log.sql) also copies the entry to public.logs; when it is
-- already installed it is kept, otherwise a stand-in fills in the actor only
-- and 20261018 replaces it.
DO $do$
BEGIN
  IF to_regprocedure('public.td_write_log(text, text, text, text, text, text, jsonb, jsonb, jsonb, uuid, text, text)') IS NULL THEN
    CREATE OR REPLACE FUNCTION public.td_alert_activity_to_logs()
    RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
    BEGIN
      IF NEW.actor_name IS NULL OR NEW.actor_id IS NULL THEN
        SELECT coalesce(NEW.actor_id, x.actor_id), coalesce(NEW.actor_name, x.actor_name) INTO NEW.actor_id, NEW.actor_name
        FROM public.td_alert_actor() x LIMIT 1;
      END IF;
      RETURN NEW;
    END $fn$;
  END IF;
END $do$;
DROP TRIGGER IF EXISTS td_alert_activity_to_logs ON public.alert_activity;
CREATE TRIGGER td_alert_activity_to_logs BEFORE INSERT ON public.alert_activity
  FOR EACH ROW EXECUTE FUNCTION public.td_alert_activity_to_logs();

-- ── 3. rule settings ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.alert_rule_settings (
  rule_key    text PRIMARY KEY,
  enabled     boolean NOT NULL DEFAULT true,
  params      jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid
);
INSERT INTO public.alert_rule_settings (rule_key, params) VALUES
  ('_general',                 '{"snooze_hours": 24}'),
  ('pending_unassigned',       '{"high_minutes": 30, "critical_minutes": 120}'),
  ('in_progress_no_collector', '{}'),
  ('stalled_job',              '{"assigned_minutes": 60, "collecting_minutes": 180}'),
  ('invalid_location',         '{}'),
  ('outside_service_area',     '{}'),
  ('duplicate_request',        '{"radius_m": 50, "window_hours": 48}'),
  ('collector_offline',        '{"minutes": 30, "start_hour": 7, "end_hour": 19, "days": [1, 2, 3, 4, 5, 6]}'),
  ('collector_capacity',       '{"percent": 90}'),
  ('fee_mismatch',             '{"days": 30}'),
  ('invalid_contact',          '{}')
ON CONFLICT (rule_key) DO NOTHING;

-- ── 4. service zone coverage (approximate centres: check and adjust) ───────
ALTER TABLE public.service_zones ADD COLUMN IF NOT EXISTS center_lat double precision;
ALTER TABLE public.service_zones ADD COLUMN IF NOT EXISTS center_lng double precision;
ALTER TABLE public.service_zones ADD COLUMN IF NOT EXISTS radius_km  double precision;
UPDATE public.service_zones z SET center_lat = v.lat, center_lng = v.lng, radius_km = v.r
FROM (VALUES
  ('Accra – Ga North', 5.665, -0.270, 5), ('Accra – Ga South', 5.550, -0.330, 7),
  ('Accra – Ga East', 5.715, -0.200, 6), ('Accra – Ga West', 5.700, -0.300, 7),
  ('Accra – Ga Central', 5.620, -0.290, 4), ('Accra – Ayawaso West', 5.610, -0.200, 3),
  ('Accra – Ayawaso East', 5.585, -0.205, 2.5), ('Accra – Okaikwei North', 5.600, -0.230, 3),
  ('Accra – Ablekuma', 5.580, -0.250, 4), ('Accra – Accra Metro', 5.550, -0.200, 4),
  ('Accra – La Dade-Kotopon', 5.565, -0.165, 4), ('Accra – Ledzokuku', 5.585, -0.100, 4),
  ('Accra – Adentan', 5.710, -0.155, 4), ('Accra – La Nkwantanang-Madina', 5.680, -0.165, 4),
  ('Tema', 5.670, -0.017, 8), ('Kasoa', 5.535, -0.420, 6), ('Kumasi', 6.690, -1.620, 15),
  ('Tamale', 9.400, -0.850, 12), ('Takoradi', 4.900, -1.760, 10), ('Cape Coast', 5.110, -1.250, 8)
) AS v(name, lat, lng, r)
WHERE z.name = v.name AND z.center_lat IS NULL;

-- ── 5. the rules job ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.run_alert_rules(p_dry_run boolean DEFAULT true)
RETURNS TABLE (rule_key text, enabled boolean, matched integer, already_open integer,
               created integer, escalated integer, resolved integer, note text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  cfg jsonb := '{}'::jsonb;
  r record;
  p jsonb;
  snooze interval;
  skipped jsonb := '{}'::jsonb;
  ran text[] := ARRAY[]::text[];
  now_accra timestamp := now() AT TIME ZONE 'Africa/Accra';
  open_states text[] := ARRAY['open', 'acknowledged', 'in_progress'];
  active_states text[] := ARRAY['pending', 'accepted', 'en_route', 'arrived', 'collecting'];
BEGIN
  -- Users may only call this when they are staff; pg_cron runs without a JWT
  IF auth.role() IS NOT NULL AND auth.role() <> 'service_role' AND NOT public.td_is_staff() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = 'insufficient_privilege';
  END IF;

  FOR r IN SELECT s.rule_key, s.enabled, s.params FROM public.alert_rule_settings s LOOP
    cfg := cfg || jsonb_build_object(r.rule_key, jsonb_build_object('enabled', r.enabled, 'params', r.params));
  END LOOP;
  snooze := make_interval(hours => coalesce((cfg #>> '{_general,params,snooze_hours}')::int, 24));

  DROP TABLE IF EXISTS pg_temp.td_req;
  CREATE TEMP TABLE td_req ON COMMIT DROP AS
    SELECT v.*, public.td_canon_status(v.status) AS canon
    FROM public.admin_pickup_requests v;

  DROP TABLE IF EXISTS pg_temp.td_col;
  CREATE TEMP TABLE td_col ON COMMIT DROP AS
    SELECT c.id::text AS id, c.user_id::text AS user_id, j,
           nullif(btrim(concat_ws(' ', j ->> 'first_name', j ->> 'last_name')), '') AS name,
           lower(coalesce(j ->> 'status', '')) AS status,
           nullif(btrim(j ->> 'assigned_region'), '') AS zone,
           coalesce(public.td_try_ts(j ->> 'location_updated_at'), public.td_try_ts(j ->> 'last_active'), public.td_try_ts(j ->> 'last_active_at')) AS last_seen
    FROM public.collector_profiles c, LATERAL (SELECT to_jsonb(c) AS j) x;

  DROP TABLE IF EXISTS pg_temp.td_done;
  CREATE TEMP TABLE td_done (rule_key text, kind text) ON COMMIT DROP;

  DROP TABLE IF EXISTS pg_temp.td_cand;
  CREATE TEMP TABLE td_cand (
    rule_key text, entity_source text, entity_type text, entity_ref text,
    severity text, type text, title text, description text, metadata jsonb,
    lat double precision, lng double precision
  ) ON COMMIT DROP;

  -- 1. pending and not assigned
  IF coalesce((cfg #>> '{pending_unassigned,enabled}')::boolean, false) THEN
    p := cfg #> '{pending_unassigned,params}';
    INSERT INTO td_cand
    SELECT 'pending_unassigned', q.source, 'pickup_request', q.id,
           CASE WHEN q.age >= make_interval(mins => coalesce((p ->> 'critical_minutes')::int, 120)) THEN 'critical' ELSE 'high' END,
           'request_delay',
           format('Request #%s not assigned for %s', left(q.id, 8),
                  CASE WHEN q.age >= make_interval(mins => coalesce((p ->> 'critical_minutes')::int, 120))
                       THEN coalesce((p ->> 'critical_minutes')::int, 120) || '+ min'
                       ELSE coalesce((p ->> 'high_minutes')::int, 30) || '+ min' END),
           format('Pending since %s with no collector.', to_char(q.created_at AT TIME ZONE 'Africa/Accra', 'DD Mon HH24:MI')),
           jsonb_build_object('customer', q.customer_name, 'address', q.address, 'status', q.status),
           q.lat, q.lng
    FROM (SELECT t.*, now() - t.created_at AS age FROM td_req t) q
    WHERE q.canon = 'pending' AND q.collector_ref IS NULL
      AND q.age >= make_interval(mins => coalesce((p ->> 'high_minutes')::int, 30))
      AND coalesce(public.td_try_ts(q.scheduled_date), now()) <= now(); -- scheduled for later: not late yet
    ran := array_append(ran, 'pending_unassigned');
  END IF;

  -- 2. in progress / assigned with no (known) collector
  IF coalesce((cfg #>> '{in_progress_no_collector,enabled}')::boolean, false) THEN
    INSERT INTO td_cand
    SELECT 'in_progress_no_collector', q.source, 'pickup_request', q.id, 'critical', 'unassigned_job',
           format('Request #%s is %s with no collector', left(q.id, 8), replace(q.canon, '_', ' ')),
           CASE WHEN q.collector_ref IS NULL THEN 'No collector is set on this request.'
                ELSE format('Collector %s does not match any collector profile.', q.collector_ref) END,
           jsonb_build_object('customer', q.customer_name, 'address', q.address, 'status', q.status, 'collector_ref', q.collector_ref),
           q.lat, q.lng
    FROM td_req q
    WHERE q.canon IN ('accepted', 'en_route', 'arrived', 'collecting')
      AND (q.collector_ref IS NULL OR q.collector_profile_id IS NULL);
    ran := array_append(ran, 'in_progress_no_collector');
  END IF;

  -- 3. assigned but not started / collecting too long
  IF coalesce((cfg #>> '{stalled_job,enabled}')::boolean, false) THEN
    p := cfg #> '{stalled_job,params}';
    INSERT INTO td_cand
    SELECT 'stalled_job', q.source, 'pickup_request', q.id, 'high', 'stalled_job',
           CASE WHEN q.canon = 'accepted' THEN format('Request #%s assigned but not started', left(q.id, 8))
                ELSE format('Request #%s collecting for over %s h', left(q.id, 8), floor(coalesce((p ->> 'collecting_minutes')::int, 180) / 60.0)::int) END,
           format('%s since %s.', CASE WHEN q.canon = 'accepted' THEN 'Assigned' ELSE 'Collecting' END,
                  to_char(q.since AT TIME ZONE 'Africa/Accra', 'DD Mon HH24:MI')),
           jsonb_build_object('customer', q.customer_name, 'address', q.address, 'status', q.status, 'collector', q.collector_name),
           q.lat, q.lng
    FROM (SELECT t.*, CASE WHEN t.canon = 'accepted' THEN coalesce(t.accepted_at, t.updated_at, t.created_at)
                           ELSE coalesce(t.updated_at, t.created_at) END AS since
          FROM td_req t) q
    WHERE q.collector_profile_id IS NOT NULL AND (
      (q.canon = 'accepted' AND now() - q.since > make_interval(mins => coalesce((p ->> 'assigned_minutes')::int, 60)))
      OR (q.canon = 'collecting' AND now() - q.since > make_interval(mins => coalesce((p ->> 'collecting_minutes')::int, 180))));
    ran := array_append(ran, 'stalled_job');
  END IF;

  -- 4. invalid coordinates (open requests)
  IF coalesce((cfg #>> '{invalid_location,enabled}')::boolean, false) THEN
    INSERT INTO td_cand
    SELECT 'invalid_location', q.source, 'pickup_request', q.id, 'medium', 'invalid_location',
           format('Request #%s: %s', left(q.id, 8), q.problem), 'The location can''t be used for collection or the map.',
           jsonb_build_object('customer', q.customer_name, 'address', q.address, 'status', q.status, 'problem', q.problem, 'lat', q.lat, 'lng', q.lng),
           NULL, NULL
    FROM (SELECT t.*, CASE
            WHEN t.lat IS NULL OR t.lng IS NULL THEN 'missing coordinates'
            WHEN t.lat = 0 AND t.lng = 0 THEN 'coordinates are 0,0'
            WHEN t.lat BETWEEN -3.3 AND 1.2 AND t.lng BETWEEN 4.5 AND 11.2 THEN 'latitude and longitude look swapped'
            WHEN NOT (t.lat BETWEEN 4.5 AND 11.2 AND t.lng BETWEEN -3.3 AND 1.2) THEN 'location is outside Ghana'
          END AS problem FROM td_req t) q
    WHERE q.canon = ANY (active_states) AND q.problem IS NOT NULL;
    ran := array_append(ran, 'invalid_location');
  END IF;

  -- 5. outside the service area: no zone with an active collector covers the point
  IF coalesce((cfg #>> '{outside_service_area,enabled}')::boolean, false) THEN
    IF NOT EXISTS (SELECT 1 FROM td_col c JOIN public.service_zones z ON lower(z.name) = lower(c.zone)
                   WHERE c.status = 'active' AND z.center_lat IS NOT NULL) THEN
      skipped := skipped || jsonb_build_object('outside_service_area', 'Skipped: no active collector has a service zone with a centre yet');
    ELSE
      INSERT INTO td_cand
      SELECT 'outside_service_area', q.source, 'pickup_request', q.id, 'medium', 'outside_service_area',
             format('Request #%s is outside the service area', left(q.id, 8)),
             'No service zone with an active collector covers this location.',
             jsonb_build_object('customer', q.customer_name, 'address', q.address, 'status', q.status),
             q.lat, q.lng
      FROM td_req q
      WHERE q.canon = ANY (active_states)
        AND q.lat BETWEEN 4.5 AND 11.2 AND q.lng BETWEEN -3.3 AND 1.2
        AND NOT EXISTS (
          SELECT 1 FROM public.service_zones z
          JOIN td_col c ON lower(c.zone) = lower(z.name) AND c.status = 'active'
          WHERE z.active AND z.center_lat IS NOT NULL
            AND ST_DWithin(ST_SetSRID(ST_MakePoint(q.lng, q.lat), 4326)::geography,
                           ST_SetSRID(ST_MakePoint(z.center_lng, z.center_lat), 4326)::geography,
                           coalesce(z.radius_km, 5) * 1000));
    END IF;
    ran := array_append(ran, 'outside_service_area');
  END IF;

  -- 6. possible duplicates: same customer, within 50 m, both open, within 48 h
  IF coalesce((cfg #>> '{duplicate_request,enabled}')::boolean, false) THEN
    p := cfg #> '{duplicate_request,params}';
    INSERT INTO td_cand
    SELECT DISTINCT ON (b.id) 'duplicate_request', b.source, 'pickup_request', b.id, 'low', 'duplicate_request',
           format('Request #%s may duplicate #%s', left(b.id, 8), left(a.id, 8)),
           format('Same customer, %s m apart, %s apart, both still open.',
                  round(ST_Distance(ST_SetSRID(ST_MakePoint(a.lng, a.lat), 4326)::geography, ST_SetSRID(ST_MakePoint(b.lng, b.lat), 4326)::geography)),
                  CASE WHEN b.created_at - a.created_at < interval '1 hour' THEN floor(extract(epoch FROM b.created_at - a.created_at) / 60)::int || ' min'
                       ELSE floor(extract(epoch FROM b.created_at - a.created_at) / 3600)::int || ' h' END),
           jsonb_build_object('customer', b.customer_name, 'address', b.address, 'status', b.status,
                              'duplicate_of', a.id, 'duplicate_of_source', a.source),
           b.lat, b.lng
    FROM td_req a
    JOIN td_req b ON b.user_id = a.user_id AND b.id <> a.id
     AND (a.created_at, a.id) < (b.created_at, b.id)
     AND b.created_at - a.created_at <= make_interval(hours => coalesce((p ->> 'window_hours')::int, 48))
    WHERE a.user_id IS NOT NULL
      AND a.canon = ANY (active_states) AND b.canon = ANY (active_states)
      AND a.lat IS NOT NULL AND b.lat IS NOT NULL
      AND ST_DWithin(ST_SetSRID(ST_MakePoint(a.lng, a.lat), 4326)::geography,
                     ST_SetSRID(ST_MakePoint(b.lng, b.lat), 4326)::geography,
                     coalesce((p ->> 'radius_m')::numeric, 50))
    ORDER BY b.id, a.created_at;
    ran := array_append(ran, 'duplicate_request');
  END IF;

  -- 7. collector on duty but silent during working hours
  IF coalesce((cfg #>> '{collector_offline,enabled}')::boolean, false) THEN
    p := cfg #> '{collector_offline,params}';
    IF extract(isodow FROM now_accra)::int IN (SELECT jsonb_array_elements_text(coalesce(p -> 'days', '[1,2,3,4,5,6]'))::int)
       AND extract(hour FROM now_accra) >= coalesce((p ->> 'start_hour')::int, 7)
       AND extract(hour FROM now_accra) < coalesce((p ->> 'end_hour')::int, 19) THEN
      INSERT INTO td_cand
      SELECT 'collector_offline', 'collector_profiles', 'collector', c.id, 'medium', 'collector_offline',
             format('%s is on duty but not reporting a location', coalesce(c.name, 'Collector ' || left(c.id, 8))),
             CASE WHEN c.last_seen IS NULL THEN 'Never reported a location.'
                  ELSE format('Last location update %s.', to_char(c.last_seen AT TIME ZONE 'Africa/Accra', 'DD Mon HH24:MI')) END,
             jsonb_build_object('name', c.name, 'last_seen', c.last_seen, 'phone', c.j ->> 'phone'),
             NULL, NULL
      FROM td_col c
      WHERE (CASE WHEN c.j ? 'is_online' THEN coalesce((c.j ->> 'is_online')::boolean, false) ELSE c.status = 'active' END)
        AND c.status <> 'inactive'
        AND (c.last_seen IS NULL OR now() - c.last_seen > make_interval(mins => coalesce((p ->> 'minutes')::int, 30)));
    END IF;
    ran := array_append(ran, 'collector_offline'); -- outside working hours: open alerts resolve
  END IF;

  -- 8. collector at or over capacity
  IF coalesce((cfg #>> '{collector_capacity,enabled}')::boolean, false) THEN
    p := cfg #> '{collector_capacity,params}';
    INSERT INTO td_cand
    SELECT 'collector_capacity', 'collector_profiles', 'collector', x.id, 'medium', 'collector_capacity',
           format('%s is at %s%%+ capacity', coalesce(x.name, 'Collector ' || left(x.id, 8)), coalesce((p ->> 'percent')::int, 90)),
           format('Vehicle about %s%% full; send them to dispose before new jobs.', round(x.pct)),
           jsonb_build_object('name', x.name, 'percent', round(x.pct), 'last_seen', x.last_seen), NULL, NULL
    FROM (
      SELECT c.id, c.name, c.last_seen, coalesce(
               nullif(public.td_try_num(coalesce(c.j ->> 'capacity_used', c.j ->> 'capacity_percent')), 0),
               (SELECT sum(coalesce(q.bag_count, 1)) FROM td_req q
                 WHERE q.collector_profile_id = c.id AND q.canon IN ('accepted', 'en_route', 'arrived', 'collecting'))
               * 100.0 / nullif(public.td_try_num(c.j ->> 'vehicle_capacity_bags'), 0)) AS pct
      FROM td_col c WHERE c.status = 'active') x
    WHERE x.pct >= coalesce((p ->> 'percent')::numeric, 90);
    ran := array_append(ran, 'collector_capacity');
  END IF;

  -- 9. stored fee doesn't match the pricing logic
  IF coalesce((cfg #>> '{fee_mismatch,enabled}')::boolean, false) THEN
    p := cfg #> '{fee_mismatch,params}';
    INSERT INTO td_cand
    SELECT 'fee_mismatch', f.source, 'pickup_request', f.id, 'low', 'fee_mismatch',
           format('Request #%s fee GHS %s, expected GHS %s', left(f.id, 8), to_char(f.fee, 'FM999990.00'), to_char(f.expected, 'FM999990.00')),
           f.basis,
           jsonb_build_object('customer', f.customer_name, 'address', f.address, 'status', f.status, 'fee', f.fee, 'expected', f.expected),
           f.lat, f.lng
    FROM (
      SELECT q.*,
        CASE
          WHEN q.source = 'digital_bins' AND q.promotional_fee IS NOT NULL THEN q.promotional_fee
          WHEN q.source = 'digital_bins' THEN round((bc.cost * coalesce(q.bag_count, 1)) * (CASE WHEN q.is_urgent THEN 1.3 ELSE 1 END) + 1, 2)
          WHEN q.source = 'pickup_requests' AND q.batch_id IS NOT NULL AND to_regclass('public.batches') IS NOT NULL
            THEN (SELECT trunc(public.td_try_num(to_jsonb(bt) ->> 'unit_price')) FROM public.batches bt WHERE bt.id::text = q.batch_id)
        END AS expected,
        CASE WHEN q.source = 'digital_bins' THEN 'Bin price × bags (+30% urgent) + GHS 1 request fee.'
             ELSE 'Unit price of the customer''s bag batch.' END AS basis
      FROM td_req q
      LEFT JOIN (VALUES (60, 15), (80, 18), (90, 22), (100, 25), (120, 30), (240, 40), (340, 55), (360, 60), (660, 85), (1100, 120))
        AS bc(liters, cost) ON bc.liters = coalesce(q.bin_size_liters, 120)
      WHERE q.canon <> 'cancelled' AND q.fee IS NOT NULL
        AND q.created_at > now() - make_interval(days => coalesce((p ->> 'days')::int, 30))) f
    WHERE f.expected IS NOT NULL AND abs(f.fee - f.expected) > 0.01;
    ran := array_append(ran, 'fee_mismatch');
  END IF;

  -- 10. collector with an invalid email or phone
  IF coalesce((cfg #>> '{invalid_contact,enabled}')::boolean, false) THEN
    INSERT INTO td_cand
    SELECT 'invalid_contact', 'collector_profiles', 'collector', c.id, 'low', 'invalid_contact',
           format('%s has %s', coalesce(c.name, 'Collector ' || left(c.id, 8)), x.problem),
           'Fix it on the Collectors page (Edit).',
           jsonb_build_object('name', c.name, 'email', c.j ->> 'email', 'phone', c.j ->> 'phone', 'problem', x.problem), NULL, NULL
    FROM td_col c, LATERAL (SELECT concat_ws(' and ',
        CASE WHEN nullif(btrim(c.j ->> 'phone'), '') IS NULL THEN 'no phone number'
             WHEN public.td_gh_phone(c.j ->> 'phone') IS NULL THEN 'an invalid phone number' END,
        CASE WHEN nullif(btrim(c.j ->> 'email'), '') IS NOT NULL
              AND (c.j ->> 'email') !~* '^[^[:space:]@]+@[^[:space:]@]+\.[a-z]{2,}$' THEN 'an invalid email' END) AS problem) x
    WHERE x.problem <> '';
    ran := array_append(ran, 'invalid_contact');
  END IF;

  -- ── report (dry run) or apply ────────────────────────────────────────────
  IF NOT p_dry_run THEN
    -- escalate (e.g. pending 30 min High → 2 h Critical); refresh the text only when it changed
    FOR r IN
      SELECT a.id, a.severity AS old_severity, c.rule_key, c.severity, c.title, c.description, c.metadata
      FROM public.alerts a JOIN td_cand c ON c.rule_key = a.rule_key AND c.entity_ref = a.entity_ref
      WHERE a.status = ANY (open_states)
        AND (array_position(ARRAY['low', 'medium', 'high', 'critical'], c.severity)
               > array_position(ARRAY['low', 'medium', 'high', 'critical'], a.severity)
             OR a.title IS DISTINCT FROM c.title OR a.description IS DISTINCT FROM c.description)
    LOOP
      PERFORM set_config('app.alert_actor', 'Rule: ' || r.rule_key, true);
      UPDATE public.alerts a SET
        severity = CASE WHEN array_position(ARRAY['low', 'medium', 'high', 'critical'], r.severity)
                           > array_position(ARRAY['low', 'medium', 'high', 'critical'], a.severity) THEN r.severity ELSE a.severity END,
        title = r.title, description = r.description, metadata = a.metadata || r.metadata, last_seen_at = now()
      WHERE a.id = r.id;
      IF array_position(ARRAY['low', 'medium', 'high', 'critical'], r.severity)
           > array_position(ARRAY['low', 'medium', 'high', 'critical'], r.old_severity) THEN
        INSERT INTO td_done VALUES (r.rule_key, 'escalated');
      END IF;
    END LOOP;

    -- create new alerts (one open per rule + record; respect the snooze after a person closed one)
    FOR r IN
      SELECT c.* FROM td_cand c
      WHERE NOT EXISTS (SELECT 1 FROM public.alerts a WHERE a.rule_key = c.rule_key AND a.entity_ref = c.entity_ref AND a.status = ANY (open_states))
        AND NOT EXISTS (SELECT 1 FROM public.alerts a WHERE a.rule_key = c.rule_key AND a.entity_ref = c.entity_ref
                          AND a.status IN ('resolved', 'closed') AND NOT a.auto_resolved
                          AND coalesce(a.closed_at, a.resolved_at, a.updated_at) > now() - snooze)
    LOOP
      PERFORM set_config('app.alert_actor', 'Rule: ' || r.rule_key, true);
      INSERT INTO public.alerts (title, description, type, severity, status, rule_key, entity_type, entity_source, entity_ref,
                                 metadata, location_lat, location_lng, location_address, last_seen_at)
      VALUES (r.title, r.description, r.type, r.severity, 'open', r.rule_key, r.entity_type, r.entity_source, r.entity_ref,
              r.metadata, r.lat, r.lng, r.metadata ->> 'address', now())
      ON CONFLICT DO NOTHING;
      IF FOUND THEN INSERT INTO td_done VALUES (r.rule_key, 'created'); END IF;
    END LOOP;

    -- auto-resolve when the condition has cleared (only for rules that ran)
    FOR r IN
      SELECT a.id, a.rule_key FROM public.alerts a
      WHERE a.rule_key = ANY (ran) AND NOT (skipped ? a.rule_key) AND a.status = ANY (open_states)
        AND NOT EXISTS (SELECT 1 FROM td_cand c WHERE c.rule_key = a.rule_key AND c.entity_ref = a.entity_ref)
    LOOP
      PERFORM set_config('app.alert_actor', 'Rule: ' || r.rule_key, true);
      UPDATE public.alerts SET status = 'resolved', auto_resolved = true,
        resolution_note = 'Auto-resolved: the condition has cleared'
      WHERE id = r.id;
      INSERT INTO td_done VALUES (r.rule_key, 'resolved');
    END LOOP;
    PERFORM set_config('app.alert_actor', '', true);
  END IF;

  -- One row per rule. In a dry run created/escalated/resolved are what would happen.
  RETURN QUERY
  WITH rules AS (
    SELECT s.rule_key AS rk, s.enabled AS en FROM public.alert_rule_settings s WHERE s.rule_key <> '_general'
  ),
  cand AS (SELECT c.rule_key AS rk, c.entity_ref, c.severity FROM td_cand c),
  opn AS (SELECT a.rule_key AS rk, a.entity_ref, a.severity, a.status, a.updated_at, a.auto_resolved, a.resolved_at, a.closed_at FROM public.alerts a),
  done AS (SELECT d.rule_key AS rk, d.kind, count(*)::int AS n FROM td_done d GROUP BY 1, 2)
  SELECT rules.rk, rules.en,
    (SELECT count(*)::int FROM cand WHERE cand.rk = rules.rk),
    CASE WHEN p_dry_run THEN
      (SELECT count(*)::int FROM cand JOIN opn ON opn.rk = cand.rk AND opn.entity_ref = cand.entity_ref AND opn.status = ANY (open_states) WHERE cand.rk = rules.rk)
    ELSE (SELECT count(*)::int FROM cand WHERE cand.rk = rules.rk) - coalesce((SELECT n FROM done WHERE done.rk = rules.rk AND kind = 'created'), 0) END,
    CASE WHEN p_dry_run THEN
      (SELECT count(*)::int FROM cand WHERE cand.rk = rules.rk
        AND NOT EXISTS (SELECT 1 FROM opn WHERE opn.rk = cand.rk AND opn.entity_ref = cand.entity_ref AND opn.status = ANY (open_states))
        AND NOT EXISTS (SELECT 1 FROM opn WHERE opn.rk = cand.rk AND opn.entity_ref = cand.entity_ref AND opn.status IN ('resolved', 'closed')
                          AND NOT opn.auto_resolved AND coalesce(opn.closed_at, opn.resolved_at, opn.updated_at) > now() - snooze))
    ELSE coalesce((SELECT n FROM done WHERE done.rk = rules.rk AND kind = 'created'), 0) END,
    CASE WHEN p_dry_run THEN
      (SELECT count(*)::int FROM cand JOIN opn ON opn.rk = cand.rk AND opn.entity_ref = cand.entity_ref AND opn.status = ANY (open_states)
         WHERE cand.rk = rules.rk AND array_position(ARRAY['low', 'medium', 'high', 'critical'], cand.severity)
                                     > array_position(ARRAY['low', 'medium', 'high', 'critical'], opn.severity))
    ELSE coalesce((SELECT n FROM done WHERE done.rk = rules.rk AND kind = 'escalated'), 0) END,
    CASE WHEN p_dry_run THEN
      (SELECT count(*)::int FROM opn WHERE opn.rk = rules.rk AND rules.rk = ANY (ran) AND NOT (skipped ? rules.rk) AND opn.status = ANY (open_states)
         AND NOT EXISTS (SELECT 1 FROM cand WHERE cand.rk = opn.rk AND cand.entity_ref = opn.entity_ref))
    ELSE coalesce((SELECT n FROM done WHERE done.rk = rules.rk AND kind = 'resolved'), 0) END,
    CASE WHEN NOT rules.en THEN 'Off' ELSE skipped ->> rules.rk END
  FROM rules
  ORDER BY rules.rk;
END $$;
REVOKE ALL ON FUNCTION public.run_alert_rules(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_alert_rules(boolean) TO authenticated;

-- ── 6. notifications (header bell) ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.td_alert_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  recipients uuid[];
  label text := initcap(NEW.severity);
BEGIN
  BEGIN
    -- Assigned to someone: tell them
    IF TG_OP = 'UPDATE' AND NEW.assigned_to IS NOT NULL AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
      INSERT INTO public.notifications (user_id, title, message, type, read)
      VALUES (NEW.assigned_to, 'Alert assigned to you', format('[%s] %s', label, NEW.title), 'alert_assigned', false);
    END IF;
    -- New (or newly escalated) High / Critical alert: assignee, or every admin
    IF NEW.severity IN ('high', 'critical') AND NEW.status IN ('open', 'acknowledged', 'in_progress')
       AND (TG_OP = 'INSERT' OR NEW.severity IS DISTINCT FROM OLD.severity) THEN
      IF NEW.assigned_to IS NOT NULL THEN
        recipients := ARRAY[NEW.assigned_to];
      ELSE
        SELECT array_agg(u.id) INTO recipients FROM auth.users u WHERE lower(u.email) = ANY (public.td_admin_emails());
      END IF;
      INSERT INTO public.notifications (user_id, title, message, type, read)
      SELECT rid, format('%s alert', label), NEW.title, 'alert_' || NEW.severity, false
      FROM unnest(coalesce(recipients, ARRAY[]::uuid[])) rid;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- a notification problem never blocks the alert
  END;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS td_alert_notify ON public.alerts;
CREATE TRIGGER td_alert_notify AFTER INSERT OR UPDATE OF severity, assigned_to ON public.alerts
  FOR EACH ROW EXECUTE FUNCTION public.td_alert_notify();

-- Fix a request's coordinates from the Alerts page ("Fix location"), wherever the app stores them
CREATE OR REPLACE FUNCTION public.admin_set_request_location(p_source text, p_id text, p_lat double precision, p_lng double precision)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  tbl text; key_id text; col record; n int := 0; pt text;
BEGIN
  IF NOT public.td_is_staff() THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE = 'insufficient_privilege'; END IF;
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
END $$;
REVOKE ALL ON FUNCTION public.admin_set_request_location(text, text, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_request_location(text, text, double precision, double precision) TO authenticated;

-- ── 7. row level security: admins only ─────────────────────────────────────
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'alerts' LOOP
    EXECUTE format('DROP POLICY %I ON public.alerts', pol.policyname);
  END LOOP;
END $$;
CREATE POLICY "alerts: admins read"   ON public.alerts FOR SELECT TO authenticated USING (public.td_is_staff());
CREATE POLICY "alerts: admins create" ON public.alerts FOR INSERT TO authenticated WITH CHECK (public.td_is_staff());
CREATE POLICY "alerts: admins update" ON public.alerts FOR UPDATE TO authenticated USING (public.td_is_staff()) WITH CHECK (public.td_is_staff());
GRANT SELECT, INSERT, UPDATE ON public.alerts TO authenticated;

ALTER TABLE public.alert_activity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "alert_activity: admins read" ON public.alert_activity;
DROP POLICY IF EXISTS "alert_activity: admins add" ON public.alert_activity;
CREATE POLICY "alert_activity: admins read" ON public.alert_activity FOR SELECT TO authenticated USING (public.td_is_staff());
CREATE POLICY "alert_activity: admins add"  ON public.alert_activity FOR INSERT TO authenticated
  WITH CHECK (public.td_is_staff() AND kind IN ('comment', 'action'));
GRANT SELECT, INSERT ON public.alert_activity TO authenticated;
GRANT USAGE ON SEQUENCE public.alert_activity_id_seq TO authenticated;

ALTER TABLE public.alert_rule_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "alert_rule_settings: admins read" ON public.alert_rule_settings;
DROP POLICY IF EXISTS "alert_rule_settings: admins change" ON public.alert_rule_settings;
CREATE POLICY "alert_rule_settings: admins read"   ON public.alert_rule_settings FOR SELECT TO authenticated USING (public.td_is_staff());
CREATE POLICY "alert_rule_settings: admins change" ON public.alert_rule_settings FOR UPDATE TO authenticated
  USING (public.td_is_staff()) WITH CHECK (public.td_is_staff());
GRANT SELECT, UPDATE ON public.alert_rule_settings TO authenticated;

-- Realtime for the header bell and the Alerts page
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; EXCEPTION WHEN duplicate_object OR undefined_table THEN NULL; END;
  END IF;
END $$;

-- ── 5b. schedule: every 5 minutes (needs the pg_cron extension) ────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'trashdrop-alert-rules';
    PERFORM cron.schedule('trashdrop-alert-rules', '*/5 * * * *', 'SELECT * FROM public.run_alert_rules(false)');
  ELSE
    RAISE NOTICE 'pg_cron is not enabled. Enable it (Database → Extensions → pg_cron), then run this file again to schedule the rules.';
  END IF;
END $$;

-- Check: what the rules would do right now (changes nothing)
SELECT * FROM public.run_alert_rules(true);
