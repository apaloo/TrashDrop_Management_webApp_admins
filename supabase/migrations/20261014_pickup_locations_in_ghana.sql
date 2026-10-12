-- Block saving pickup / bin locations at 0,0 or outside Ghana.
-- Review, then run once in the Supabase SQL editor. Safe to re-run.
-- Does not change existing rows.
--
-- Ghana box: lat 4.5–11.2, lng -3.3–1.2 (same as the Live Map check in
-- src/utils/mapCoordinates.js). A trigger is added only for the columns below
-- that exist in your database; the NOTICE lines list what was guarded.
-- Points are read with PostGIS as (x, y) = (lng, lat), so a point saved with
-- lat/lng swapped is rejected too. A value that can't be read, or is NULL,
-- is let through, so this can never block a save it doesn't understand.
-- Triggers fire only when a location column is written: status updates on
-- older rows that already hold bad coordinates keep working.

CREATE OR REPLACE FUNCTION public.reject_location_outside_ghana()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  kind text := TG_ARGV[0];   -- 'point' (geometry/geography/WKT column) or 'latlng'
  lat double precision;
  lng double precision;
BEGIN
  BEGIN
    IF kind = 'point' THEN
      EXECUTE format('SELECT ST_Y(($1).%1$I::geometry), ST_X(($1).%1$I::geometry)', TG_ARGV[1])
        INTO lat, lng USING NEW;
    ELSE
      EXECUTE format('SELECT ($1).%I::double precision, ($1).%I::double precision', TG_ARGV[1], TG_ARGV[2])
        INTO lat, lng USING NEW;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW; -- unreadable value: don't block
  END;

  IF lat IS NULL OR lng IS NULL THEN
    RETURN NEW;
  END IF;

  IF abs(lat) < 0.01 AND abs(lng) < 0.01 THEN
    RAISE EXCEPTION 'Location is 0,0. Pick the pickup point on the map.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NOT (lat BETWEEN 4.5 AND 11.2 AND lng BETWEEN -3.3 AND 1.2) THEN
    RAISE EXCEPTION 'Location (%, %) is outside Ghana%.', round(lat::numeric, 5), round(lng::numeric, 5),
      CASE WHEN lng BETWEEN 4.5 AND 11.2 AND lat BETWEEN -3.3 AND 1.2
           THEN '; latitude and longitude look swapped' ELSE '' END
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  r record;
  trig text;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('pickup_requests',   'point',  'location',    NULL),
      ('pickup_requests',   'point',  'coordinates', NULL),
      ('pickup_requests',   'latlng', 'latitude',    'longitude'),
      ('bin_locations',     'point',  'coordinates', NULL),
      ('locations',         'point',  'coordinates', NULL),
      ('locations',         'latlng', 'latitude',    'longitude'),
      ('scheduled_pickups', 'latlng', 'latitude',    'longitude'),
      ('digital_bins',      'latlng', 'latitude',    'longitude')
    ) AS t(tbl, kind, col1, col2)
  LOOP
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = r.tbl AND column_name = r.col1
        AND (r.kind = 'latlng' OR data_type IN ('USER-DEFINED', 'text', 'character varying')));
    CONTINUE WHEN r.col2 IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = r.tbl AND column_name = r.col2);

    trig := format('ghana_location_%s', r.col1);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', trig, r.tbl);
    IF r.kind = 'point' THEN
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF %I ON public.%I FOR EACH ROW EXECUTE FUNCTION public.reject_location_outside_ghana(%L, %L)',
        trig, r.col1, r.tbl, r.kind, r.col1);
    ELSE
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF %I, %I ON public.%I FOR EACH ROW EXECUTE FUNCTION public.reject_location_outside_ghana(%L, %L, %L)',
        trig, r.col1, r.col2, r.tbl, r.kind, r.col1, r.col2);
    END IF;
    RAISE NOTICE 'Guarding %.%', r.tbl, coalesce(r.col1 || ', ' || r.col2, r.col1);
  END LOOP;
END;
$$;

-- Check: lists the triggers that were created
SELECT event_object_table AS table_name, trigger_name
FROM information_schema.triggers
WHERE trigger_name LIKE 'ghana_location_%'
GROUP BY 1, 2
ORDER BY 1, 2;
