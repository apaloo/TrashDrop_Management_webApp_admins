-- ============================================================================
-- Areas for reports and requests (step 3, part 2 of 2).
-- Needs 20261023_account_roles.sql and 20261025_gh_districts.sql.
--
-- 1. td_area_at(lat, lng): the district and region at a point.
-- 2. New columns region / district on illegal_dumping_mobile and
--    pickup_requests, filled from each row's location by a trigger on every
--    new row and whenever the location changes. People can't set them.
-- 3. Backfill of existing rows. Only the two new columns are written; other
--    triggers are paused for that one update, so updated_at, status rules,
--    history and the audit log are not touched.
-- 4. td_my_area(): which area the signed-in account may work in
--    (national / region / district / none), and td_in_my_area(region, district).
-- 5. admin_set_account_area(): an admin sets or corrects an account's
--    region / district (an Authority sees only its district).
--
-- Existing values are not changed and no existing policy is changed.
-- Undo with supabase/diagnostics/area_scope_rollback.sql.
-- ============================================================================

SET search_path = public, extensions; -- PostGIS lives in one of these

-- ── 1. district at a point ────────────────────────────────────────────────
-- Points up to about 2 km outside every district (coast, simplified edges)
-- go to the nearest one. Points outside Ghana give no row.
CREATE OR REPLACE FUNCTION public.td_area_at(p_lat double precision, p_lng double precision)
RETURNS TABLE (district text, region text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  WITH p AS (
    SELECT ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326) AS g
    WHERE p_lat BETWEEN 4.5 AND 11.5 AND p_lng BETWEEN -3.5 AND 1.5
  )
  SELECT d.name, d.region
  FROM p, LATERAL (
    SELECT x.name, x.region FROM public.gh_districts x
    WHERE ST_DWithin(x.geom, p.g, 0.02)
    ORDER BY ST_Distance(x.geom, p.g), x.name
    LIMIT 1
  ) d
$$;

-- The point of a report or request row: latitude / longitude columns first
-- (stored as numbers or text), then coordinates / location (td_row_point).
-- A Ghana point stored the wrong way round is read the right way round.
CREATE OR REPLACE FUNCTION public.td_report_point(r jsonb)
RETURNS geometry
LANGUAGE plpgsql IMMUTABLE SET search_path = public, extensions AS $$
DECLARE
  num constant text := '^\s*-?[0-9]+(\.[0-9]+)?\s*$';
  lat double precision;
  lng double precision;
  g geometry;
BEGIN
  IF r IS NULL THEN RETURN NULL; END IF;
  IF (r ->> 'latitude') ~ num AND (r ->> 'longitude') ~ num THEN
    lat := btrim(r ->> 'latitude')::double precision;
    lng := btrim(r ->> 'longitude')::double precision;
  ELSE
    g := public.td_row_point(r);
    IF g IS NULL THEN RETURN NULL; END IF;
    lat := ST_Y(g);
    lng := ST_X(g);
  END IF;
  IF lat BETWEEN -3.5 AND 1.5 AND lng BETWEEN 4.5 AND 11.5 THEN
    RETURN ST_SetSRID(ST_MakePoint(lat, lng), 4326);
  END IF;
  RETURN ST_SetSRID(ST_MakePoint(lng, lat), 4326);
END $$;

-- ── 2. columns and trigger ────────────────────────────────────────────────
ALTER TABLE public.illegal_dumping_mobile ADD COLUMN IF NOT EXISTS region text;
ALTER TABLE public.illegal_dumping_mobile ADD COLUMN IF NOT EXISTS district text;
ALTER TABLE public.pickup_requests ADD COLUMN IF NOT EXISTS region text;
ALTER TABLE public.pickup_requests ADD COLUMN IF NOT EXISTS district text;
CREATE INDEX IF NOT EXISTS illegal_dumping_mobile_district_idx ON public.illegal_dumping_mobile (district);
CREATE INDEX IF NOT EXISTS illegal_dumping_mobile_region_idx ON public.illegal_dumping_mobile (region);
CREATE INDEX IF NOT EXISTS pickup_requests_district_idx ON public.pickup_requests (district);
CREATE INDEX IF NOT EXISTS pickup_requests_region_idx ON public.pickup_requests (region);
COMMENT ON COLUMN public.illegal_dumping_mobile.district IS 'Set from the location by td_tag_area (gh_districts); not editable';
COMMENT ON COLUMN public.pickup_requests.district IS 'Set from the location by td_tag_area (gh_districts); not editable';

CREATE OR REPLACE FUNCTION public.td_tag_area()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  n jsonb := to_jsonb(NEW);
  o jsonb;
  g geometry;
  a record;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    o := to_jsonb(OLD);
    IF (o -> 'latitude', o -> 'longitude', o -> 'coordinates', o -> 'location')
       IS NOT DISTINCT FROM (n -> 'latitude', n -> 'longitude', n -> 'coordinates', n -> 'location') THEN
      NEW.region := OLD.region;
      NEW.district := OLD.district;
      RETURN NEW;
    END IF;
  END IF;
  NEW.region := NULL;
  NEW.district := NULL;
  BEGIN
    g := public.td_report_point(n);
    IF g IS NOT NULL THEN
      SELECT * INTO a FROM public.td_area_at(ST_Y(g), ST_X(g));
      NEW.region := a.region;
      NEW.district := a.district;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- never block a report or a request over its area
  END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS td_tag_area ON public.illegal_dumping_mobile;
CREATE TRIGGER td_tag_area BEFORE INSERT OR UPDATE ON public.illegal_dumping_mobile
  FOR EACH ROW EXECUTE FUNCTION public.td_tag_area();
DROP TRIGGER IF EXISTS td_tag_area ON public.pickup_requests;
CREATE TRIGGER td_tag_area BEFORE INSERT OR UPDATE ON public.pickup_requests
  FOR EACH ROW EXECUTE FUNCTION public.td_tag_area();

-- ── 3. backfill (one transaction; other triggers paused only inside it) ──
BEGIN;
ALTER TABLE public.illegal_dumping_mobile DISABLE TRIGGER USER;
UPDATE public.illegal_dumping_mobile t SET region = a.region, district = a.district
FROM (
  SELECT x.id, d.region, d.district
  FROM public.illegal_dumping_mobile x
  CROSS JOIN LATERAL (SELECT public.td_report_point(to_jsonb(x)) AS g) p
  CROSS JOIN LATERAL public.td_area_at(ST_Y(p.g), ST_X(p.g)) d
  WHERE p.g IS NOT NULL
) a
WHERE t.id = a.id AND (t.region IS DISTINCT FROM a.region OR t.district IS DISTINCT FROM a.district);
ALTER TABLE public.illegal_dumping_mobile ENABLE TRIGGER USER;

ALTER TABLE public.pickup_requests DISABLE TRIGGER USER;
UPDATE public.pickup_requests t SET region = a.region, district = a.district
FROM (
  SELECT x.id, d.region, d.district
  FROM public.pickup_requests x
  CROSS JOIN LATERAL (SELECT public.td_report_point(to_jsonb(x)) AS g) p
  CROSS JOIN LATERAL public.td_area_at(ST_Y(p.g), ST_X(p.g)) d
  WHERE p.g IS NOT NULL
) a
WHERE t.id = a.id AND (t.region IS DISTINCT FROM a.region OR t.district IS DISTINCT FROM a.district);
ALTER TABLE public.pickup_requests ENABLE TRIGGER USER;
COMMIT;

-- ── 4. the signed-in account's area ──────────────────────────────────────
-- Admin, Manager, Media: national. Authority: its district. Volunteer: its
-- region. Anyone else, or an Authority / Volunteer without a known
-- district / region: none.
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

CREATE OR REPLACE FUNCTION public.td_in_my_area(p_region text, p_district text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE a ->> 'level'
    WHEN 'national' THEN true
    WHEN 'region' THEN p_region IS NOT NULL AND p_region = a ->> 'region'
    WHEN 'district' THEN p_district IS NOT NULL AND p_district = a ->> 'district'
    ELSE false
  END
  FROM (SELECT public.td_my_area() AS a) x
$$;

REVOKE ALL ON FUNCTION public.td_area_at(double precision, double precision) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.td_my_area() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.td_in_my_area(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.td_area_at(double precision, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.td_my_area() TO authenticated;
GRANT EXECUTE ON FUNCTION public.td_in_my_area(text, text) TO authenticated;

-- ── 5. admin sets an account's area ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_account_area(p_user_id uuid, p_region text, p_district text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  reg text := nullif(btrim(coalesce(p_region, '')), '');
  dis text := nullif(btrim(coalesce(p_district, '')), '');
  old public.account_roles;
  me text := auth.jwt() ->> 'email';
BEGIN
  IF NOT public.td_is_staff() THEN RAISE EXCEPTION 'Only TrashDrop admins can change an account''s area'; END IF;
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
END $$;

REVOKE ALL ON FUNCTION public.admin_set_account_area(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_account_area(uuid, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- How many rows got an area (rows without a usable location stay empty)
SELECT 'illegal_dumping_mobile' AS rows_in, count(*) AS total, count(district) AS with_district, count(*) - count(district) AS without_area
FROM public.illegal_dumping_mobile
UNION ALL
SELECT 'pickup_requests', count(*), count(district), count(*) - count(district)
FROM public.pickup_requests;
