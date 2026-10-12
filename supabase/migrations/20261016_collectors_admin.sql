-- ============================================================================
-- Collectors page (/request-pickup/collectors)
--
-- 1. service_zones: the zones collectors are assigned to (replaces the
--    hardcoded North/South/East/West/Central list). Read by the admin app;
--    edit rows in the Supabase table editor, no deploy needed.
-- 2. collector_profiles: vehicle capacity in bags, deactivation reason/time/by,
--    email made optional (collectors sign in by phone).
-- 3. vehicle_type check that matches both apps (adds tricycle), NOT VALID so
--    existing rows are not re-checked.
-- 4. td_gh_phone(): Ghana phone → +233XXXXXXXXX. A trigger normalises phone,
--    clears non-emails from email (the collector app copies the phone number
--    there) and blocks duplicate phone/email for admin-added collectors.
-- 5. Deactivate / reactivate is logged to public.logs with the reason.
--
-- Safe to run more than once. Changes no existing data: the cleanup of
-- existing rows is in supabase/diagnostics/collectors_data_cleanup.sql.
-- ============================================================================

-- ── 1. service zones ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.service_zones (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  city       text,
  sort_order integer NOT NULL DEFAULT 100,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_zones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_zones readable by signed-in users" ON public.service_zones;
CREATE POLICY "service_zones readable by signed-in users" ON public.service_zones
  FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.service_zones TO authenticated;

INSERT INTO public.service_zones (name, city, sort_order) VALUES
  ('Accra – Ga North', 'Accra', 10),
  ('Accra – Ga South', 'Accra', 11),
  ('Accra – Ga East', 'Accra', 12),
  ('Accra – Ga West', 'Accra', 13),
  ('Accra – Ga Central', 'Accra', 14),
  ('Accra – Ayawaso West', 'Accra', 15),
  ('Accra – Ayawaso East', 'Accra', 16),
  ('Accra – Okaikwei North', 'Accra', 17),
  ('Accra – Ablekuma', 'Accra', 18),
  ('Accra – Accra Metro', 'Accra', 19),
  ('Accra – La Dade-Kotopon', 'Accra', 20),
  ('Accra – Ledzokuku', 'Accra', 21),
  ('Accra – Adentan', 'Accra', 22),
  ('Accra – La Nkwantanang-Madina', 'Accra', 23),
  ('Tema', 'Tema', 30),
  ('Kasoa', 'Kasoa', 31),
  ('Kumasi', 'Kumasi', 40),
  ('Tamale', 'Tamale', 50),
  ('Takoradi', 'Takoradi', 60),
  ('Cape Coast', 'Cape Coast', 61)
ON CONFLICT (name) DO NOTHING;

-- ── 2. collector_profiles columns ──────────────────────────────────────────
ALTER TABLE public.collector_profiles ADD COLUMN IF NOT EXISTS assigned_region       text;
ALTER TABLE public.collector_profiles ADD COLUMN IF NOT EXISTS vehicle_type          text;
ALTER TABLE public.collector_profiles ADD COLUMN IF NOT EXISTS license_plate         text;
ALTER TABLE public.collector_profiles ADD COLUMN IF NOT EXISTS vehicle_plate         text;
ALTER TABLE public.collector_profiles ADD COLUMN IF NOT EXISTS vehicle_capacity_bags integer;
ALTER TABLE public.collector_profiles ADD COLUMN IF NOT EXISTS deactivation_reason   text;
ALTER TABLE public.collector_profiles ADD COLUMN IF NOT EXISTS deactivated_at        timestamptz;
ALTER TABLE public.collector_profiles ADD COLUMN IF NOT EXISTS deactivated_by        uuid;

ALTER TABLE public.collector_profiles DROP CONSTRAINT IF EXISTS collector_profiles_capacity_bags_check;
ALTER TABLE public.collector_profiles ADD CONSTRAINT collector_profiles_capacity_bags_check
  CHECK (vehicle_capacity_bags IS NULL OR vehicle_capacity_bags BETWEEN 1 AND 500) NOT VALID;

-- Collectors sign in with their phone; email is optional
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'collector_profiles'
               AND column_name = 'email' AND is_nullable = 'NO') THEN
    ALTER TABLE public.collector_profiles ALTER COLUMN email DROP NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_collector_profiles_assigned_region ON public.collector_profiles (assigned_region);

-- ── 3. vehicle types used by both apps ─────────────────────────────────────
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.collector_profiles'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%vehicle_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.collector_profiles DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.collector_profiles ADD CONSTRAINT collector_profiles_vehicle_type_check
  CHECK (vehicle_type IS NULL OR lower(vehicle_type) IN ('cart', 'motorcycle', 'tricycle', 'truck', 'van', 'bicycle', 'other')) NOT VALID;

-- ── 4. phone / email normalisation and duplicates ──────────────────────────
-- '0241234567', '233241234567', '+233 24 123 4567' → '+233241234567'; NULL when not a Ghana number
CREATE OR REPLACE FUNCTION public.td_gh_phone(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p IS NULL OR p ~* '[a-z@]' THEN NULL
    ELSE (
      SELECT CASE WHEN core ~ '^[2-5][0-9]{8}$' THEN '+233' || core END
      FROM (
        SELECT CASE
          WHEN d LIKE '00233%' THEN substr(d, 6)
          WHEN d LIKE '233%'   THEN substr(d, 4)
          WHEN d LIKE '0%'     THEN substr(d, 2)
          WHEN btrim(p) LIKE '+%' THEN NULL
          ELSE d
        END AS core
        FROM (SELECT regexp_replace(p, '\D', '', 'g') AS d) digits
      ) n
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.collector_profiles_clean_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clash record;
BEGIN
  IF public.td_gh_phone(NEW.phone) IS NOT NULL THEN
    NEW.phone := public.td_gh_phone(NEW.phone);
  END IF;
  IF NEW.email IS NOT NULL AND NEW.email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[a-z]{2,}$' THEN
    NEW.email := NULL; -- e.g. the phone number the collector app copies into email
  END IF;
  NEW.email := lower(nullif(btrim(NEW.email), ''));

  -- Duplicates: block admin-added collectors (no app account yet) that reuse
  -- the phone or email of another collector. App sign-ups are never blocked.
  -- The cleanup script sets app.collector_cleanup = on to fix existing rows.
  IF coalesce(current_setting('app.collector_cleanup', true), '') <> 'on'
     AND NEW.user_id IS NULL AND (TG_OP = 'INSERT'
      OR NEW.phone IS DISTINCT FROM OLD.phone OR NEW.email IS DISTINCT FROM OLD.email) THEN
    SELECT id, first_name, last_name INTO clash
    FROM public.collector_profiles c
    WHERE c.id IS DISTINCT FROM NEW.id
      AND ((NEW.phone IS NOT NULL AND public.td_gh_phone(c.phone) = public.td_gh_phone(NEW.phone))
        OR (NEW.email IS NOT NULL AND lower(c.email) = NEW.email))
    LIMIT 1;
    IF FOUND THEN
      RAISE EXCEPTION 'duplicate collector: % % already uses this phone number or email', clash.first_name, clash.last_name
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS collector_profiles_clean_contact ON public.collector_profiles;
CREATE TRIGGER collector_profiles_clean_contact
  BEFORE INSERT OR UPDATE OF phone, email ON public.collector_profiles
  FOR EACH ROW EXECUTE FUNCTION public.collector_profiles_clean_contact();

-- ── 5. log deactivate / reactivate ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_collector_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  who uuid;
  name text := nullif(btrim(concat_ws(' ', NEW.first_name, NEW.last_name)), '');
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  BEGIN
    who := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    who := NULL;
  END;
  BEGIN
    INSERT INTO public.logs (level, source, message, data, user_id, created_at)
    VALUES (
      CASE WHEN lower(NEW.status) = 'active' THEN 'info' ELSE 'warning' END,
      'collectors',
      CASE
        WHEN lower(NEW.status) = 'active' THEN format('Collector %s reactivated', coalesce(name, left(NEW.id::text, 8)))
        ELSE format('Collector %s deactivated%s', coalesce(name, left(NEW.id::text, 8)),
                    coalesce(': ' || NEW.deactivation_reason, ''))
      END,
      jsonb_build_object('collector_id', NEW.id, 'collector_user_id', NEW.user_id,
                         'from', OLD.status, 'to', NEW.status, 'reason', NEW.deactivation_reason),
      who,
      now()
    );
  EXCEPTION WHEN OTHERS THEN
    NULL; -- never block a status change because logging failed
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS log_collector_status_change ON public.collector_profiles;
CREATE TRIGGER log_collector_status_change
  AFTER UPDATE OF status ON public.collector_profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_collector_status_change();

-- Check
SELECT (SELECT count(*) FROM public.service_zones) AS zones,
       (SELECT count(*) FROM public.collector_profiles) AS collectors;
