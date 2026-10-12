-- ============================================================================
-- One audit trail for the admin: public.logs
--
-- Runs on its own, or after 20261015 / 20261016 / 20261017 (it replaces
-- their logging triggers so every change is written once, in one shape).
-- Needs PostGIS (already used by the Live Map); pg_cron is optional.
--
-- 1. logs: action, entity, actor, before/after, metadata, user_agent, is_sample columns;
--    lower-case levels (debug|info|warn|error|critical); old rows converted.
-- 2. The 22 seed rows are marked is_sample = true (hidden by default).
-- 3. td_write_log(): the one writer. log_audit(): the RPC the app's
--    logAudit() calls (fills in the signed-in user).
-- 4. Triggers (safety net, also for changes made outside the admin):
--    pickup requests (created, status, collector, fee, location, merged as
--    duplicate), collectors (created, status, region + other edited fields),
--    alerts (through the alert timeline).
-- 5. RLS: admins read; nobody updates or deletes from the client; inserts only
--    through log_audit() or the triggers.
-- 6. Retention: rows older than 12 months move to logs_archive, daily, with
--    the same pg_cron scheduler as the alert rules.
-- Safe to run more than once.
-- ============================================================================

-- ── 0. shared helpers ──────────────────────────────────────────────────────
-- Same definitions as in 20261015 / 20261017, repeated here so this file also
-- runs on its own (CREATE OR REPLACE: running both is harmless).
-- Admin emails: keep in sync with FULL_ACCESS_ADMIN_EMAILS (src/constants/accessControl.js).
CREATE OR REPLACE FUNCTION public.td_admin_emails()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['otisadomako50@gmail.com', 'xahlijah@gmail.com']
$$;

CREATE OR REPLACE FUNCTION public.td_is_staff()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce(lower(auth.jwt() ->> 'email') = ANY (public.td_admin_emails()), false)
$$;

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

-- ── 1. table ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level      text NOT NULL DEFAULT 'info',
  source     text,
  message    text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS level       text;
ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS source      text;
ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS message     text;
ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS data        jsonb;
ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS user_id     uuid;
ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS created_at  timestamptz;
ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS action      text;
ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS entity_type text;
ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS entity_id   text;
ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS actor_id    uuid;
ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS actor_name  text;
ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS actor_role  text;
ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS before      jsonb;
ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS after       jsonb;
ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS metadata    jsonb;
ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS is_sample   boolean;
ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS user_agent  text;

-- created_at must be a real timestamptz (some old schemas used "timestamp")
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'logs'
             AND column_name = 'created_at' AND data_type = 'timestamp without time zone') THEN
    ALTER TABLE public.logs ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
  END IF;
END $$;

-- Old level checks only allowed 4 levels; replace with one lower-case check
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
           WHERE conrelid = 'public.logs'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%level%'
  LOOP
    EXECUTE format('ALTER TABLE public.logs DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.td_log_level(l text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE lower(btrim(coalesce(l, 'info')))
    WHEN 'warning' THEN 'warn' WHEN 'warn' THEN 'warn'
    WHEN 'err' THEN 'error' WHEN 'error' THEN 'error'
    WHEN 'fatal' THEN 'critical' WHEN 'critical' THEN 'critical' WHEN 'crit' THEN 'critical'
    WHEN 'debug' THEN 'debug' WHEN 'trace' THEN 'debug'
    ELSE 'info' END
$$;

-- Every row arrives in one shape, whoever wrote it
CREATE OR REPLACE FUNCTION public.td_logs_normalise()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.level := public.td_log_level(NEW.level);
  NEW.created_at := coalesce(NEW.created_at, now());
  NEW.metadata := coalesce(NEW.metadata, NEW.data, '{}'::jsonb);
  NEW.actor_id := coalesce(NEW.actor_id, NEW.user_id);
  NEW.user_id := coalesce(NEW.user_id, NEW.actor_id);
  NEW.message := coalesce(NEW.message, '');
  NEW.is_sample := coalesce(NEW.is_sample, false);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS td_logs_normalise ON public.logs;
CREATE TRIGGER td_logs_normalise BEFORE INSERT OR UPDATE ON public.logs
  FOR EACH ROW EXECUTE FUNCTION public.td_logs_normalise();

-- Convert existing rows (old "timestamp" column, data → metadata, user_id → actor)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'logs' AND column_name = 'timestamp') THEN
    EXECUTE 'UPDATE public.logs SET created_at = coalesce(created_at, "timestamp"::timestamptz) WHERE created_at IS NULL';
  END IF;
END $$;
UPDATE public.logs SET
  level = level,
  entity_id = coalesce(entity_id, data ->> 'request_id', data ->> 'alert_id', data ->> 'collector_id'),
  entity_type = coalesce(entity_type, CASE source
    WHEN 'pickup_requests' THEN 'pickup_request' WHEN 'collectors' THEN 'collector' WHEN 'alerts' THEN 'alert' END),
  action = coalesce(action, CASE source
    WHEN 'pickup_requests' THEN 'request.status_changed'
    WHEN 'collectors' THEN 'collector.status_changed'
    WHEN 'alerts' THEN 'alert.' || coalesce(data ->> 'kind', 'updated') END),
  source = CASE source WHEN 'pickup_requests' THEN 'requests' ELSE source END,
  actor_role = coalesce(actor_role, CASE WHEN coalesce(actor_id, user_id) IS NULL THEN 'system' END),
  actor_name = coalesce(actor_name, data ->> 'actor', CASE WHEN coalesce(actor_id, user_id) IS NULL THEN 'System' END);

ALTER TABLE public.logs ALTER COLUMN level SET DEFAULT 'info';
ALTER TABLE public.logs ALTER COLUMN level SET NOT NULL;
ALTER TABLE public.logs ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.logs ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.logs ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;
ALTER TABLE public.logs ALTER COLUMN metadata SET NOT NULL;
ALTER TABLE public.logs ALTER COLUMN is_sample SET DEFAULT false;
ALTER TABLE public.logs ALTER COLUMN is_sample SET NOT NULL;
ALTER TABLE public.logs ADD CONSTRAINT logs_level_check CHECK (level IN ('debug', 'info', 'warn', 'error', 'critical'));

CREATE INDEX IF NOT EXISTS logs_created_idx  ON public.logs (created_at DESC);
CREATE INDEX IF NOT EXISTS logs_entity_idx   ON public.logs (entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS logs_level_idx    ON public.logs (level, created_at DESC);
CREATE INDEX IF NOT EXISTS logs_action_idx   ON public.logs (action);
CREATE INDEX IF NOT EXISTS logs_sample_idx   ON public.logs (is_sample, created_at DESC);

-- ── 2. mark the seed rows ──────────────────────────────────────────────────
-- Seed scripts set "module" (the app never does) and used these messages.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'logs' AND column_name = 'module') THEN
    EXECUTE 'UPDATE public.logs SET is_sample = true WHERE action IS NULL AND module IS NOT NULL';
  END IF;
END $$;
UPDATE public.logs SET is_sample = true
WHERE action IS NULL AND message IN (
  'Multiple failed login attempts detected', 'Database connection lost', 'Dashboard view rendered',
  'Database connection timeout', 'Failed to connect to external service', 'Failed to assign collector to pickup request',
  'Mobile data synchronization failed', 'Report exported to CSV', 'User login successful', 'New collector registered',
  'Dashboard loaded successfully', 'New notification sent to user', 'Push notifications sent to collectors',
  'Push notification sent', 'Monthly report generated successfully', 'Scheduled backup completed',
  'Low storage space detected', 'Query execution took longer than expected', 'Payment gateway timeout',
  'Slow query detected', 'Multiple failed login attempts');

-- ── 3. the writer ──────────────────────────────────────────────────────────
-- Who is acting: a rule (run_alert_rules sets app.alert_actor), the signed-in
-- user (admin / collector / customer), or the system (cron, SQL editor).
CREATE OR REPLACE FUNCTION public.td_audit_actor()
RETURNS TABLE (actor_id uuid, actor_name text, actor_role text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  rule text := nullif(current_setting('app.alert_actor', true), '');
  uid uuid;
BEGIN
  IF rule IS NOT NULL THEN
    RETURN QUERY SELECT NULL::uuid, rule, 'rule'::text;
    RETURN;
  END IF;
  BEGIN uid := auth.uid(); EXCEPTION WHEN OTHERS THEN uid := NULL; END;
  IF uid IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, 'System'::text, 'system'::text;
    RETURN;
  END IF;
  RETURN QUERY
    SELECT uid,
           coalesce(nullif(btrim(concat_ws(' ', u.raw_user_meta_data ->> 'firstName', u.raw_user_meta_data ->> 'lastName')), ''),
                    u.raw_user_meta_data ->> 'full_name', u.email, uid::text)::text,
           (CASE WHEN lower(u.email) = ANY (public.td_admin_emails()) THEN 'admin'
                 WHEN EXISTS (SELECT 1 FROM public.collector_profiles c WHERE c.user_id = uid) THEN 'collector'
                 ELSE 'customer' END)::text
    FROM auth.users u WHERE u.id = uid;
  IF NOT FOUND THEN
    RETURN QUERY SELECT uid, uid::text, 'customer'::text;
  END IF;
END $$;

-- The one place rows are written. Triggers and log_audit() both call it.
DROP FUNCTION IF EXISTS public.td_write_log(text, text, text, text, text, text, jsonb, jsonb, jsonb, uuid, text, text);
DROP FUNCTION IF EXISTS public.log_audit(text, text, text, text, text, text, jsonb, jsonb, jsonb);
CREATE OR REPLACE FUNCTION public.td_write_log(
  p_level text, p_source text, p_action text, p_entity_type text, p_entity_id text, p_message text,
  p_before jsonb DEFAULT NULL, p_after jsonb DEFAULT NULL, p_metadata jsonb DEFAULT '{}'::jsonb,
  p_actor_id uuid DEFAULT NULL, p_actor_name text DEFAULT NULL, p_actor_role text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  a record;
  new_id text;
  ua text;
BEGIN
  SELECT * INTO a FROM public.td_audit_actor() LIMIT 1;
  -- The browser's user agent, from the API request (NULL for cron / SQL editor)
  BEGIN
    ua := left(nullif(current_setting('request.headers', true), '')::json ->> 'user-agent', 400);
  EXCEPTION WHEN OTHERS THEN ua := NULL;
  END;
  INSERT INTO public.logs (level, source, action, entity_type, entity_id, message, before, after, metadata,
                           actor_id, actor_name, actor_role, user_id, user_agent, created_at, is_sample)
  VALUES (p_level, p_source, p_action, p_entity_type, p_entity_id, left(coalesce(p_message, ''), 2000),
          p_before, p_after, coalesce(p_metadata, '{}'::jsonb),
          coalesce(p_actor_id, a.actor_id), coalesce(p_actor_name, a.actor_name), coalesce(p_actor_role, a.actor_role),
          coalesce(p_actor_id, a.actor_id), ua, now(), false)
  RETURNING id::text INTO new_id;
  RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.td_write_log(text, text, text, text, text, text, jsonb, jsonb, jsonb, uuid, text, text) FROM PUBLIC, anon, authenticated;

-- What the app's logAudit() calls. Admins may log anything; anyone may log
-- their own sign-in / sign-out; a failed sign-in may be logged before
-- signing in (rate-limited).
CREATE OR REPLACE FUNCTION public.log_audit(
  p_level text, p_source text, p_action text, p_message text,
  p_entity_type text DEFAULT NULL, p_entity_id text DEFAULT NULL,
  p_before jsonb DEFAULT NULL, p_after jsonb DEFAULT NULL, p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  email text := lower(left(coalesce(p_metadata ->> 'email', ''), 200));
BEGIN
  IF p_action IS NULL OR p_action !~ '^[a-z_]+\.[a-z_]+$' THEN
    RAISE EXCEPTION 'action must look like "request.assigned"';
  END IF;
  IF length(coalesce(p_metadata, '{}'::jsonb)::text) > 8000 OR length(coalesce(p_before, '{}'::jsonb)::text) > 8000
     OR length(coalesce(p_after, '{}'::jsonb)::text) > 8000 THEN
    RAISE EXCEPTION 'log payload too large';
  END IF;
  IF public.td_is_staff() THEN
    RETURN public.td_write_log(p_level, p_source, p_action, p_entity_type, p_entity_id, p_message, p_before, p_after, p_metadata);
  END IF;
  IF p_action IN ('auth.login', 'auth.logout') AND auth.uid() IS NOT NULL THEN
    RETURN public.td_write_log(p_level, 'auth', p_action, 'user', auth.uid()::text, p_message, NULL, NULL,
                               jsonb_build_object('email', email, 'admin_access', false));
  END IF;
  IF p_action = 'auth.login_failed' THEN
    IF (SELECT count(*) FROM public.logs WHERE action = 'auth.login_failed' AND created_at > now() - interval '10 minutes'
          AND metadata ->> 'email' = email) >= 10
       OR (SELECT count(*) FROM public.logs WHERE action = 'auth.login_failed' AND created_at > now() - interval '1 minute') >= 60 THEN
      RETURN NULL; -- rate limited: drop silently
    END IF;
    RETURN public.td_write_log('warn', 'auth', 'auth.login_failed', 'user', NULL, left(coalesce(p_message, 'Sign-in failed'), 300),
                               NULL, NULL, jsonb_build_object('email', email, 'reason', left(coalesce(p_metadata ->> 'reason', ''), 300)),
                               NULL, coalesce(nullif(email, ''), 'Unknown'), 'anonymous');
  END IF;
  RAISE EXCEPTION 'Not allowed' USING ERRCODE = 'insufficient_privilege';
END $$;
REVOKE ALL ON FUNCTION public.log_audit(text, text, text, text, text, text, jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_audit(text, text, text, text, text, text, jsonb, jsonb, jsonb) TO anon, authenticated;

-- ── 4a. pickup requests: created, status, collector, fee, location ─────────
-- "lat, lng" of a request row, or NULL (uses td_row_point from 20261015)
CREATE OR REPLACE FUNCTION public.td_point_text(r jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public, extensions AS $$
DECLARE g geometry;
BEGIN
  g := public.td_row_point(r);
  IF g IS NULL THEN RETURN NULL; END IF;
  RETURN round(ST_Y(g)::numeric, 5)::text || ', ' || round(ST_X(g)::numeric, 5)::text;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END $$;

-- One row per kind of change. The app relies on this trigger for request
-- changes (it never logs them itself), so nothing is written twice.
CREATE OR REPLACE FUNCTION public.td_audit_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
  n jsonb := to_jsonb(NEW);
  old_col text := coalesce(o ->> 'collector_id', o ->> 'assigned_to');
  new_col text := coalesce(n ->> 'collector_id', n ->> 'assigned_to');
  old_s text := public.td_canon_status(o ->> 'status');
  new_s text := public.td_canon_status(n ->> 'status');
  old_fee text := o ->> 'fee';
  new_fee text := n ->> 'fee';
  old_pt text;
  new_pt text;
  col_name text;
  col_profile text;
  old_name text;
  reason text := n ->> 'cancellation_reason';
  dup_of text;
  act text;
  msg text;
  short text := left(NEW.id::text, 8);
  meta jsonb;
BEGIN
  BEGIN
    SELECT nullif(btrim(concat_ws(' ', c.first_name, c.last_name)), ''), c.id::text INTO col_name, col_profile
    FROM public.collector_profiles c WHERE new_col IS NOT NULL AND (c.user_id::text = new_col OR c.id::text = new_col) LIMIT 1;
    meta := jsonb_strip_nulls(jsonb_build_object('table', TG_TABLE_NAME, 'collector_id', new_col, 'collector_profile_id', col_profile));

    -- created
    IF TG_OP = 'INSERT' THEN
      PERFORM public.td_write_log('info', 'requests', 'request.created', 'pickup_request', NEW.id::text,
        format('Request #%s created%s', short, coalesce(' at ' || left(n ->> 'address', 120), '')),
        NULL,
        jsonb_strip_nulls(jsonb_build_object('status', n ->> 'status', 'fee', new_fee, 'address', n ->> 'address',
          'location', public.td_point_text(n), 'collector', CASE WHEN new_col IS NOT NULL THEN coalesce(col_name, new_col) END)),
        meta);
      RETURN NEW;
    END IF;

    -- status and / or collector
    IF old_s IS DISTINCT FROM new_s OR old_col IS DISTINCT FROM new_col THEN
      SELECT nullif(btrim(concat_ws(' ', c.first_name, c.last_name)), '') INTO old_name
      FROM public.collector_profiles c WHERE old_col IS NOT NULL AND (c.user_id::text = old_col OR c.id::text = old_col) LIMIT 1;

      IF old_col IS DISTINCT FROM new_col AND (old_s IS NOT DISTINCT FROM new_s OR new_s = 'accepted') THEN
        act := CASE WHEN old_col IS NULL THEN 'request.assigned' WHEN new_col IS NULL THEN 'request.unassigned' ELSE 'request.reassigned' END;
        msg := CASE WHEN new_col IS NULL THEN format('Request #%s unassigned', short)
                    ELSE format('Request #%s %s to %s', short, CASE WHEN old_col IS NULL THEN 'assigned' ELSE 'reassigned' END, coalesce(col_name, new_col)) END;
      ELSIF new_s = 'cancelled' AND reason ILIKE 'duplicate%' THEN
        -- "Merge" on the Pickup Requests page cancels the copy with this reason
        act := 'request.merged';
        dup_of := substring(reason FROM '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}');
        msg := format('Request #%s merged: cancelled as a duplicate%s', short, coalesce(' of #' || left(dup_of, 8), ''));
      ELSE
        act := CASE new_s
          WHEN 'accepted' THEN 'request.accepted' WHEN 'en_route' THEN 'request.started' WHEN 'arrived' THEN 'request.arrived'
          WHEN 'collecting' THEN 'request.collecting' WHEN 'disposed' THEN 'request.completed' WHEN 'cancelled' THEN 'request.cancelled'
          WHEN 'expired' THEN 'request.expired' WHEN 'pending' THEN 'request.reopened' ELSE 'request.status_changed' END;
        msg := format('Request #%s: %s → %s', short, coalesce(o ->> 'status', '?'), coalesce(n ->> 'status', '?'))
               || CASE WHEN new_s = 'cancelled' THEN coalesce(' (' || reason || ')', '') ELSE '' END;
      END IF;

      PERFORM public.td_write_log(
        CASE WHEN new_s = 'cancelled' THEN 'warn' ELSE 'info' END, 'requests', act, 'pickup_request', NEW.id::text, msg,
        -- collector shown by name, and only when it changed; ids stay in metadata
        jsonb_strip_nulls(jsonb_build_object('status', CASE WHEN old_s IS DISTINCT FROM new_s THEN o ->> 'status' END,
          'collector', CASE WHEN old_col IS DISTINCT FROM new_col THEN coalesce(old_name, old_col, '(none)') END)),
        jsonb_strip_nulls(jsonb_build_object('status', CASE WHEN old_s IS DISTINCT FROM new_s THEN n ->> 'status' END,
          'collector', CASE WHEN old_col IS DISTINCT FROM new_col THEN coalesce(col_name, new_col, '(none)') END,
          'cancellation_reason', CASE WHEN new_s = 'cancelled' THEN reason END)),
        meta || jsonb_strip_nulls(jsonb_build_object('previous_collector_id', old_col, 'duplicate_of', dup_of)));
    END IF;

    -- fee
    IF old_fee IS DISTINCT FROM new_fee AND (old_fee IS NULL OR new_fee IS NULL OR old_fee::numeric <> new_fee::numeric) THEN
      PERFORM public.td_write_log('info', 'requests', 'request.fee_changed', 'pickup_request', NEW.id::text,
        format('Request #%s fee GHS %s → GHS %s', short, coalesce(old_fee, '—'), coalesce(new_fee, '—')),
        jsonb_build_object('fee', old_fee), jsonb_build_object('fee', new_fee), meta);
    END IF;

    -- location (point or address)
    IF o -> 'location' IS DISTINCT FROM n -> 'location' OR o -> 'coordinates' IS DISTINCT FROM n -> 'coordinates'
       OR o -> 'latitude' IS DISTINCT FROM n -> 'latitude' OR o -> 'longitude' IS DISTINCT FROM n -> 'longitude'
       OR o -> 'location_id' IS DISTINCT FROM n -> 'location_id' OR o -> 'address' IS DISTINCT FROM n -> 'address' THEN
      old_pt := public.td_point_text(o);
      new_pt := public.td_point_text(n);
      IF old_pt IS DISTINCT FROM new_pt OR o -> 'address' IS DISTINCT FROM n -> 'address' OR o -> 'location_id' IS DISTINCT FROM n -> 'location_id' THEN
        PERFORM public.td_write_log('info', 'requests', 'request.location_fixed', 'pickup_request', NEW.id::text,
          format('Request #%s location changed%s', short, coalesce(': ' || new_pt, '')),
          jsonb_strip_nulls(jsonb_build_object('location', CASE WHEN old_pt IS DISTINCT FROM new_pt THEN coalesce(old_pt, '(none)') END,
            'address', CASE WHEN o -> 'address' IS DISTINCT FROM n -> 'address' THEN o ->> 'address' END)),
          jsonb_strip_nulls(jsonb_build_object('location', CASE WHEN old_pt IS DISTINCT FROM new_pt THEN coalesce(new_pt, '(none)') END,
            'address', CASE WHEN o -> 'address' IS DISTINCT FROM n -> 'address' THEN n ->> 'address' END)),
          meta || jsonb_strip_nulls(jsonb_build_object('location_id', CASE WHEN o -> 'location_id' IS DISTINCT FROM n -> 'location_id' THEN n ->> 'location_id' END)));
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- logging never blocks the change
  END;
  RETURN NEW;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pickup_requests', 'digital_bins', 'scheduled_pickups'] LOOP
    CONTINUE WHEN to_regclass('public.' || t) IS NULL;
    EXECUTE format('DROP TRIGGER IF EXISTS log_pickup_status_change ON public.%I', t); -- replaced by this one
    EXECUTE format('DROP TRIGGER IF EXISTS td_audit_request ON public.%I', t);
    EXECUTE format('CREATE TRIGGER td_audit_request AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.td_audit_request()', t);
  END LOOP;
END $$;

-- ── 4b. collectors: created, status, edited fields ─────────────────────────
CREATE OR REPLACE FUNCTION public.td_audit_collector()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  tracked text[] := ARRAY['first_name', 'last_name', 'email', 'phone', 'status', 'assigned_region', 'vehicle_type',
                          'license_plate', 'vehicle_plate', 'vehicle_capacity_bags', 'notes', 'deactivation_reason', 'user_id'];
  o jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
  n jsonb := to_jsonb(NEW);
  b jsonb := '{}'::jsonb;
  a jsonb := '{}'::jsonb;
  k text;
  act text;
  lvl text := 'info';
  nm text := coalesce(nullif(btrim(concat_ws(' ', n ->> 'first_name', n ->> 'last_name')), ''), left(NEW.id::text, 8));
  msg text;
BEGIN
  FOREACH k IN ARRAY tracked LOOP
    IF (o -> k) IS DISTINCT FROM (n -> k) AND (TG_OP = 'UPDATE' OR n ->> k IS NOT NULL) THEN
      IF TG_OP = 'UPDATE' THEN b := b || jsonb_build_object(k, o -> k); END IF;
      a := a || jsonb_build_object(k, n -> k);
    END IF;
  END LOOP;
  IF TG_OP = 'UPDATE' AND a = '{}'::jsonb THEN
    RETURN NEW; -- location / online / timestamps only: not an audit event
  END IF;
  IF TG_OP = 'INSERT' THEN
    act := 'collector.created'; msg := format('Collector %s added', nm);
  ELSIF a ? 'status' AND lower(n ->> 'status') = 'active' THEN
    act := 'collector.reactivated'; msg := format('Collector %s reactivated', nm);
  ELSIF a ? 'status' AND lower(n ->> 'status') IN ('inactive', 'suspended') THEN
    act := 'collector.deactivated'; lvl := 'warn';
    msg := format('Collector %s deactivated%s', nm, coalesce(': ' || (n ->> 'deactivation_reason'), ''));
  ELSIF a ? 'status' THEN
    act := 'collector.status_changed'; msg := format('Collector %s status → %s', nm, n ->> 'status');
  ELSE
    act := 'collector.updated';
    msg := format('Collector %s edited (%s)', nm, (SELECT string_agg(x, ', ') FROM jsonb_object_keys(a) x));
  END IF;
  BEGIN
    PERFORM public.td_write_log(lvl, 'collectors', act, 'collector', NEW.id::text, msg,
                                CASE WHEN TG_OP = 'UPDATE' THEN b END, a, '{}'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END $$;
DO $$
BEGIN
  IF to_regclass('public.collector_profiles') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS log_collector_status_change ON public.collector_profiles; -- replaced by this one
    DROP TRIGGER IF EXISTS td_audit_collector ON public.collector_profiles;
    CREATE TRIGGER td_audit_collector AFTER INSERT OR UPDATE ON public.collector_profiles
      FOR EACH ROW EXECUTE FUNCTION public.td_audit_collector();
  END IF;
END $$;

-- ── 4c. alerts: every timeline entry (created, status, assignment, comment, action) ──
CREATE OR REPLACE FUNCTION public.td_alert_activity_to_logs()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  al record;
  act text;
  lvl text := 'info';
  role text;
  msg text;
BEGIN
  IF NEW.actor_name IS NULL OR NEW.actor_id IS NULL THEN
    SELECT coalesce(NEW.actor_id, x.actor_id), coalesce(NEW.actor_name, x.actor_name) INTO NEW.actor_id, NEW.actor_name
    FROM public.td_alert_actor() x LIMIT 1;
  END IF;
  SELECT title, severity INTO al FROM public.alerts WHERE id = NEW.alert_id;
  role := CASE WHEN NEW.actor_name LIKE 'Rule:%' THEN 'rule'
               WHEN NEW.actor_id IS NULL THEN 'system'
               ELSE (SELECT actor_role FROM public.td_audit_actor() LIMIT 1) END;
  act := CASE NEW.kind
    WHEN 'created' THEN 'alert.created'
    WHEN 'status' THEN CASE NEW.to_value
      WHEN 'acknowledged' THEN 'alert.acknowledged' WHEN 'in_progress' THEN 'alert.started'
      WHEN 'resolved' THEN CASE WHEN role = 'rule' THEN 'alert.auto_resolved' ELSE 'alert.resolved' END
      WHEN 'closed' THEN 'alert.closed' WHEN 'open' THEN 'alert.reopened' ELSE 'alert.status_changed' END
    WHEN 'assigned' THEN 'alert.assigned'
    WHEN 'escalated' THEN 'alert.escalated'
    WHEN 'comment' THEN 'alert.commented'
    WHEN 'action' THEN 'alert.action'
    ELSE 'alert.updated' END;
  IF NEW.kind = 'created' AND al.severity IN ('critical', 'high') THEN lvl := 'warn'; END IF;
  IF NEW.kind = 'action' AND (NEW.data ->> 'ok') = 'false' THEN lvl := 'error'; END IF;
  msg := format('Alert "%s": %s', left(coalesce(al.title, ''), 80), CASE NEW.kind
    WHEN 'created'   THEN 'created'
    WHEN 'status'    THEN coalesce(NEW.from_value, '?') || ' → ' || NEW.to_value || coalesce(' (' || NEW.note || ')', '')
    WHEN 'assigned'  THEN CASE WHEN NEW.to_value IS NULL THEN 'unassigned' ELSE 'assigned' END
    WHEN 'escalated' THEN 'priority ' || coalesce(NEW.from_value, '?') || ' → ' || NEW.to_value
    WHEN 'comment'   THEN 'comment: ' || left(coalesce(NEW.note, ''), 160)
    WHEN 'action'    THEN coalesce(NEW.to_value, 'action') || coalesce(': ' || NEW.note, '')
    ELSE NEW.kind END);
  BEGIN
    PERFORM public.td_write_log(lvl, 'alerts', act, 'alert', NEW.alert_id::text, msg,
      CASE WHEN NEW.from_value IS NOT NULL THEN jsonb_build_object(CASE NEW.kind WHEN 'escalated' THEN 'priority' WHEN 'assigned' THEN 'assigned_to' ELSE 'status' END, NEW.from_value) END,
      CASE WHEN NEW.kind IN ('status', 'assigned', 'escalated', 'created') THEN
        jsonb_strip_nulls(jsonb_build_object(CASE NEW.kind WHEN 'escalated' THEN 'priority' WHEN 'assigned' THEN 'assigned_to' ELSE 'status' END, NEW.to_value,
                                             'note', CASE WHEN NEW.kind = 'status' THEN NEW.note END)) END,
      jsonb_strip_nulls(NEW.data || jsonb_build_object('title', al.title, 'priority', al.severity,
                                                       'comment', CASE WHEN NEW.kind = 'comment' THEN NEW.note END,
                                                       'action', CASE WHEN NEW.kind = 'action' THEN NEW.to_value END)),
      NEW.actor_id, NEW.actor_name, role);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END $$;
-- (trigger td_alert_activity_to_logs on alert_activity already exists from 20261017)
DO $$
BEGIN
  IF to_regclass('public.alert_activity') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS td_alert_activity_to_logs ON public.alert_activity;
    CREATE TRIGGER td_alert_activity_to_logs BEFORE INSERT ON public.alert_activity
      FOR EACH ROW EXECUTE FUNCTION public.td_alert_activity_to_logs();
  END IF;
END $$;

-- ── 5. row level security ──────────────────────────────────────────────────
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'logs' LOOP
    EXECUTE format('DROP POLICY %I ON public.logs', pol.policyname);
  END LOOP;
END $$;
CREATE POLICY "logs: admins read" ON public.logs FOR SELECT TO authenticated USING (public.td_is_staff());
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.logs FROM anon, authenticated;
GRANT SELECT ON public.logs TO authenticated;

-- ── 6. retention: keep 12 months in logs, older rows go to logs_archive ────
CREATE TABLE IF NOT EXISTS public.logs_archive (LIKE public.logs INCLUDING DEFAULTS);
ALTER TABLE public.logs_archive ADD COLUMN IF NOT EXISTS archived_at timestamptz DEFAULT now();
ALTER TABLE public.logs_archive ENABLE ROW LEVEL SECURITY; -- no policies: not readable from the app
REVOKE ALL ON public.logs_archive FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.td_archive_old_logs(p_months integer DEFAULT 12)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE moved integer;
BEGIN
  WITH old AS (
    DELETE FROM public.logs WHERE created_at < now() - make_interval(months => p_months) RETURNING *
  )
  INSERT INTO public.logs_archive SELECT old.*, now() FROM old;
  GET DIAGNOSTICS moved = ROW_COUNT;
  IF moved > 0 THEN
    PERFORM public.td_write_log('info', 'system', 'logs.archived', NULL, NULL,
                                format('%s log rows older than %s months moved to logs_archive', moved, p_months));
  END IF;
  RETURN moved;
END $$;
REVOKE ALL ON FUNCTION public.td_archive_old_logs(integer) FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'trashdrop-log-retention';
    PERFORM cron.schedule('trashdrop-log-retention', '17 3 * * *', 'SELECT public.td_archive_old_logs(12)');
  ELSE
    RAISE NOTICE 'pg_cron is not enabled: enable it, then run this file again to schedule log retention.';
  END IF;
END $$;

-- Check
SELECT is_sample, level, count(*) FROM public.logs GROUP BY 1, 2 ORDER BY 1, 2;
