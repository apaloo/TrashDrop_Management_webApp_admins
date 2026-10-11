-- Public, read-only view of illegal dumping reports for the landing page live map.
--
-- Logged-out visitors (anon role) may read this view but NOT the base table.
-- The view runs with its owner's rights (security_invoker = false), so it can
-- read illegal_dumping_mobile without granting anon any access to that table.
--
-- Exposed: id, exact latitude/longitude, severity, waste_type, status,
-- created_at, completed_at, a general area name and photo URLs.
-- NOT exposed: reported_by, reporter details, assigned_to/assignee, notes,
-- the full street address, or any other column.
--
-- Rows: everything except cancelled reports and reports outside Ghana
-- (lat 4.5..11.2, lng -3.3..1.3).

DROP VIEW IF EXISTS public.public_illegal_dumping_reports;

CREATE VIEW public.public_illegal_dumping_reports
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
    -- Drop the country, then keep the last two address parts (e.g. "Osu, Accra"),
    -- so house numbers and street lines at the start are not shown.
    regexp_replace(coalesce(r.location, ''), ',\s*Ghana\s*$', '', 'i') AS address,
    r.photos
  FROM public.illegal_dumping_mobile r
)
SELECT
  b.id,
  b.latitude,
  b.longitude,
  b.severity,
  b.waste_type,
  b.status,
  b.created_at,
  -- No completion timestamp column is written; the collector app sets updated_at
  -- when it marks a report completed.
  CASE WHEN b.status IN ('completed', 'disposed') THEN b.updated_at END AS completed_at,
  NULLIF(
    btrim(regexp_replace(array_to_string(
      (string_to_array(b.address, ','))[
        greatest(1, coalesce(array_length(string_to_array(b.address, ','), 1), 1) - 1)
        : coalesce(array_length(string_to_array(b.address, ','), 1), 1)
      ],
      ','
    ), '\s*,\s*', ', ', 'g')),
    ''
  ) AS area_name,
  -- Only real (uploaded) photo URLs
  coalesce(
    ARRAY(SELECT p FROM unnest(b.photos) AS p WHERE p ILIKE 'https://%'),
    ARRAY[]::text[]
  ) AS photo_urls
FROM base b
WHERE b.status <> 'cancelled'
  AND b.latitude  BETWEEN 4.5  AND 11.2
  AND b.longitude BETWEEN -3.3 AND 1.3;

COMMENT ON VIEW public.public_illegal_dumping_reports IS
  'Read-only public map data for illegal dumping reports. No reporter, assignee or note fields. Excludes cancelled reports and reports outside Ghana.';

-- Read-only access for logged-out and logged-in visitors; nothing else.
REVOKE ALL ON public.public_illegal_dumping_reports FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.public_illegal_dumping_reports TO anon, authenticated;
