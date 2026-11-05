-- ============================================================================
-- Public Trash Map: show Liberia reports too.
--
-- public_illegal_dumping_reports only passed reports inside Ghana's box, so the
-- real reports from Monrovia and Margibi never reached trashdrops.com. The view
-- now also passes points in Liberia, using td_supported_country() from
-- 20261112_supported_countries.sql. Ghana's box is unchanged (lng up to 1.3),
-- so no Ghana report drops off. Columns, owner rights and grants are unchanged
-- (CREATE OR REPLACE keeps the grants). Changes no data. Safe to re-run.
-- Needs: 20261112_supported_countries.sql
-- Undo: supabase/diagnostics/public_map_liberia_rollback.sql
-- ============================================================================
BEGIN;

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
  AND (
    -- Ghana: same box as before
    (n.latitude BETWEEN 4.5 AND 11.2 AND n.longitude BETWEEN -3.3 AND 1.3)
    -- Liberia (td_supported_country, 20261112_supported_countries.sql)
    OR public.td_supported_country(n.latitude, n.longitude) = 'LR'
  );

COMMENT ON VIEW public.public_illegal_dumping_reports IS
  'Read-only public map data for illegal dumping reports. No reporter, assignee or note fields. Excludes cancelled reports and reports outside Ghana and Liberia.';

NOTIFY pgrst, 'reload schema';
COMMIT;
