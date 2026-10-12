-- ONE-OFF: swap latitude/longitude on records stored the wrong way round
-- (stored lat between -3.5 and 1.5 and lng between 4.5 and 11.5, i.e. a Ghana
-- point with the two values reversed). Do not run blindly:
--   1. Run the PREVIEW queries. If they return 0 rows there is nothing to fix.
--      (The "Lat -0.1732, Lng 5.6336" seen on the dashboard came from the admin
--      app reading POINT(lng lat) the wrong way; the stored value is usually right.)
--   2. Run the UPDATE block. It runs in one transaction; check the counts,
--      then COMMIT (or ROLLBACK).
-- PostGIS stores points as (x, y) = (lng, lat): ST_X = longitude, ST_Y = latitude.

-- ── PREVIEW ────────────────────────────────────────────────────────────────
SELECT 'pickup_requests.coordinates' AS field, id::text, ST_Y(coordinates::geometry) AS stored_lat, ST_X(coordinates::geometry) AS stored_lng
FROM public.pickup_requests
WHERE coordinates IS NOT NULL
  AND ST_Y(coordinates::geometry) BETWEEN -3.5 AND 1.5 AND ST_X(coordinates::geometry) BETWEEN 4.5 AND 11.5
UNION ALL
SELECT 'pickup_requests.location', id::text, ST_Y(location::geometry), ST_X(location::geometry)
FROM public.pickup_requests
WHERE location ~* '^\s*(SRID=\d+;)?POINT'
  AND ST_Y(location::geometry) BETWEEN -3.5 AND 1.5 AND ST_X(location::geometry) BETWEEN 4.5 AND 11.5
UNION ALL
SELECT 'bin_locations.coordinates', id::text, ST_Y(coordinates::geometry), ST_X(coordinates::geometry)
FROM public.bin_locations
WHERE coordinates IS NOT NULL
  AND ST_Y(coordinates::geometry) BETWEEN -3.5 AND 1.5 AND ST_X(coordinates::geometry) BETWEEN 4.5 AND 11.5
UNION ALL
SELECT 'locations.latitude/longitude', id::text, latitude::double precision, longitude::double precision
FROM public.locations
WHERE latitude::double precision BETWEEN -3.5 AND 1.5 AND longitude::double precision BETWEEN 4.5 AND 11.5;

-- ── FIX (run after reviewing the preview) ──────────────────────────────────
BEGIN;

UPDATE public.pickup_requests
SET coordinates = ST_SetSRID(ST_MakePoint(ST_Y(coordinates::geometry), ST_X(coordinates::geometry)), 4326)::geography
WHERE coordinates IS NOT NULL
  AND ST_Y(coordinates::geometry) BETWEEN -3.5 AND 1.5 AND ST_X(coordinates::geometry) BETWEEN 4.5 AND 11.5;

UPDATE public.pickup_requests
SET location = format('POINT(%s %s)', ST_Y(location::geometry), ST_X(location::geometry))
WHERE location ~* '^\s*(SRID=\d+;)?POINT'
  AND ST_Y(location::geometry) BETWEEN -3.5 AND 1.5 AND ST_X(location::geometry) BETWEEN 4.5 AND 11.5;

UPDATE public.bin_locations
SET coordinates = ST_SetSRID(ST_MakePoint(ST_Y(coordinates::geometry), ST_X(coordinates::geometry)), 4326)
WHERE coordinates IS NOT NULL
  AND ST_Y(coordinates::geometry) BETWEEN -3.5 AND 1.5 AND ST_X(coordinates::geometry) BETWEEN 4.5 AND 11.5;

UPDATE public.locations
SET latitude = longitude, longitude = latitude
WHERE latitude::double precision BETWEEN -3.5 AND 1.5 AND longitude::double precision BETWEEN 4.5 AND 11.5;

-- Check the UPDATE counts above, then:
COMMIT;
