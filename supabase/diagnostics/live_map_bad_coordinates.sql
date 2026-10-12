-- Live Map: records whose location can't be drawn (missing, 0,0, outside
-- Ghana, or lat/lng swapped). Read-only; run each query on its own in the
-- Supabase SQL editor. Ghana box: lat 4.5–11.2, lng -3.3–1.2.
-- If a query errors because a column doesn't exist, skip it.

-- 1. pickup_requests (location is a PostGIS point: x = lng, y = lat)
SELECT id, status, created_at, address,
       ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng,
       CASE
         WHEN location IS NULL THEN 'missing'
         WHEN abs(ST_Y(location::geometry)) < 0.01 AND abs(ST_X(location::geometry)) < 0.01 THEN '0,0'
         WHEN ST_X(location::geometry) BETWEEN 4.5 AND 11.2 AND ST_Y(location::geometry) BETWEEN -3.3 AND 1.2 THEN 'swapped'
         ELSE 'outside Ghana'
       END AS problem
FROM public.pickup_requests
WHERE location IS NULL
   OR NOT (ST_Y(location::geometry) BETWEEN 4.5 AND 11.2 AND ST_X(location::geometry) BETWEEN -3.3 AND 1.2)
ORDER BY created_at DESC;

-- 2. digital_bins → bin_locations.coordinates
SELECT b.id AS bin_id, b.status, b.created_at, l.id AS location_id, l.address,
       ST_Y(l.coordinates::geometry) AS lat, ST_X(l.coordinates::geometry) AS lng
FROM public.digital_bins b
LEFT JOIN public.bin_locations l ON l.id = b.location_id
WHERE l.coordinates IS NULL
   OR NOT (ST_Y(l.coordinates::geometry) BETWEEN 4.5 AND 11.2 AND ST_X(l.coordinates::geometry) BETWEEN -3.3 AND 1.2)
ORDER BY b.created_at DESC;

-- 3. scheduled_pickups → locations (latitude / longitude columns)
SELECT s.id, s.status, s.created_at, l.id AS location_id, l.address, l.latitude, l.longitude
FROM public.scheduled_pickups s
LEFT JOIN public.locations l ON l.id = s.location_id
WHERE l.latitude IS NULL OR l.longitude IS NULL
   OR NOT (l.latitude::double precision BETWEEN 4.5 AND 11.2 AND l.longitude::double precision BETWEEN -3.3 AND 1.2)
ORDER BY s.created_at DESC;

-- 4. Collectors: lat/lng columns vs the PostGIS point, and when they last reported.
--    The Live Map uses current_latitude/current_longitude, falling back to
--    current_location. "online" = reported in the last 10 minutes.
SELECT id, first_name, last_name, status,
       current_latitude, current_longitude,
       ST_Y(current_location::geometry) AS point_lat, ST_X(current_location::geometry) AS point_lng,
       location_updated_at,
       location_updated_at > now() - interval '10 minutes' AS online
FROM public.collector_profiles
ORDER BY status, first_name;

-- ── Fixes (review first; not run here) ─────────────────────────────────────
-- Swapped pickup_requests points can be flipped back:
--   UPDATE public.pickup_requests
--   SET location = ST_SetSRID(ST_MakePoint(ST_Y(location::geometry), ST_X(location::geometry)), 4326)::geography
--   WHERE id IN (...ids from query 1 marked 'swapped'...);
-- Rows that are missing, 0,0 or outside Ghana need the real address from the
-- customer; there is no way to recover the point from the data.
