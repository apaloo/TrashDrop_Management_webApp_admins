-- Area names and completion times for illegal dumping reports.
--
-- 0. Adds illegal_dumping_mobile.completed_at. Until now the cleanup time was
--    read from updated_at, but a BEFORE UPDATE trigger resets updated_at on
--    every edit, so filling area names (or any other edit) would have changed
--    every completed report's cleanup time. Existing completed reports take
--    their current updated_at once; from now on a trigger stamps completed_at
--    when the status changes to completed/disposed.
--
-- 1. Adds illegal_dumping_mobile.area_name. It is filled by
--    scripts/backfill-area-names.mjs (OpenStreetMap Nominatim reverse geocoding,
--    run hourly by .github/workflows/backfill-area-names.yml) and by the
--    household app when a report is submitted.
-- 2. Updates the public view so area_name prefers that column, then the
--    trailing parts of the address text, and never exposes placeholders such as
--    "Ghana (Coordinates: 6.7230, -1.4439)" or "Unknown location".
--    The view keeps the same columns, so existing grants stay in place.

ALTER TABLE public.illegal_dumping_mobile
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- One-time: keep today's best value for reports that are already cleaned up.
-- Must run before anything else updates these rows.
UPDATE public.illegal_dumping_mobile
SET completed_at = updated_at
WHERE completed_at IS NULL
  AND lower(trim(coalesce(status, ''))) IN ('completed', 'disposed');

CREATE OR REPLACE FUNCTION public.set_illegal_dumping_completed_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF lower(trim(coalesce(NEW.status, ''))) IN ('completed', 'disposed') THEN
    -- Stamp only on the transition into a cleaned-up status
    IF TG_OP = 'INSERT' OR lower(trim(coalesce(OLD.status, ''))) NOT IN ('completed', 'disposed') THEN
      NEW.completed_at := coalesce(NEW.completed_at, now());
    END IF;
  ELSE
    -- Reopened or not yet cleaned up
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_illegal_dumping_completed_at ON public.illegal_dumping_mobile;
CREATE TRIGGER set_illegal_dumping_completed_at
  BEFORE INSERT OR UPDATE OF status ON public.illegal_dumping_mobile
  FOR EACH ROW EXECUTE FUNCTION public.set_illegal_dumping_completed_at();

COMMENT ON COLUMN public.illegal_dumping_mobile.completed_at IS
  'When the report moved to completed/disposed. Set by trigger; existing rows were backfilled from updated_at.';

ALTER TABLE public.illegal_dumping_mobile
  ADD COLUMN IF NOT EXISTS area_name text;

COMMENT ON COLUMN public.illegal_dumping_mobile.area_name IS
  'General area of the report as "Town, Region" from reverse geocoding. Shown on the public map.';

CREATE OR REPLACE VIEW public.public_illegal_dumping_reports
WITH (security_invoker = false)
AS
WITH base AS (
  SELECT
    r.id,
    -- latitude/longitude may be stored as numeric or text; only cast well-formed numbers
    CASE WHEN r.latitude::text  ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$' THEN trim(r.latitude::text)::double precision  END AS latitude,
    CASE WHEN r.longitude::text ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$' THEN trim(r.longitude::text)::double precision END AS longitude,
    lower(trim(coalesce(r.severity, 'medium')))  AS severity,
    lower(trim(coalesce(r.waste_type, 'mixed'))) AS waste_type,
    lower(trim(coalesce(r.status, 'pending')))   AS status,
    r.created_at,
    r.updated_at,
    r.completed_at AS stored_completed_at,
    nullif(btrim(r.area_name), '') AS stored_area,
    -- Address text without the country; placeholder addresses become empty
    CASE
      WHEN coalesce(r.location, '') ~* '(coordinates|unknown location|location not specified)' THEN ''
      ELSE regexp_replace(coalesce(r.location, ''), ',\s*Ghana\s*$', '', 'i')
    END AS address,
    r.photos
  FROM public.illegal_dumping_mobile r
),
named AS (
  SELECT
    b.*,
    coalesce(
      b.stored_area,
      -- Last two address parts (e.g. "Osu, Accra"), so house numbers and street lines are not shown
      NULLIF(
        btrim(regexp_replace(array_to_string(
          (string_to_array(b.address, ','))[
            greatest(1, coalesce(array_length(string_to_array(b.address, ','), 1), 1) - 1)
            : coalesce(array_length(string_to_array(b.address, ','), 1), 1)
          ],
          ','
        ), '\s*,\s*', ', ', 'g')),
        ''
      )
    ) AS candidate_area
  FROM base b
)
SELECT
  n.id,
  n.latitude,
  n.longitude,
  n.severity,
  n.waste_type,
  n.status,
  n.created_at,
  CASE WHEN n.status IN ('completed', 'disposed') THEN coalesce(n.stored_completed_at, n.updated_at) END AS completed_at,
  -- Never pass raw coordinates through as a name
  CASE WHEN n.candidate_area ~ '-?[0-9]+\.[0-9]{3,}' THEN NULL ELSE n.candidate_area END AS area_name,
  -- Only real (uploaded) photo URLs
  coalesce(
    ARRAY(SELECT p FROM unnest(n.photos) AS p WHERE p ILIKE 'https://%'),
    ARRAY[]::text[]
  ) AS photo_urls
FROM named n
WHERE n.status <> 'cancelled'
  AND n.latitude  BETWEEN 4.5  AND 11.2
  AND n.longitude BETWEEN -3.3 AND 1.3;

COMMENT ON VIEW public.public_illegal_dumping_reports IS
  'Read-only public map data for illegal dumping reports. No reporter, assignee or note fields. Excludes cancelled reports and reports outside Ghana.';
