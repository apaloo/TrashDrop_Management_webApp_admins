-- Illegal dumping data-quality checks from the QA audit (12 Oct 2026).
-- Every query here is a read-only SELECT. Review the results with operations
-- before changing any data; fixes are described at the end, not run here.

-- 1. Stale open work: in progress for more than 30 days
SELECT id, created_at, updated_at, assigned_to, area_name, location
FROM public.illegal_dumping_mobile
WHERE status = 'in_progress' AND updated_at < now() - interval '30 days'
ORDER BY updated_at;

-- 2. Possible duplicates: same day, within ~50 m (0.0005° ≈ 55 m)
SELECT a.id AS report_a, a.status AS status_a, b.id AS report_b, b.status AS status_b,
       a.created_at::date AS day, a.reported_by = b.reported_by AS same_reporter
FROM public.illegal_dumping_mobile a
JOIN public.illegal_dumping_mobile b
  ON a.id < b.id
 AND a.created_at::date = b.created_at::date
 AND abs(a.latitude::double precision - b.latitude::double precision) < 0.0005
 AND abs(a.longitude::double precision - b.longitude::double precision) < 0.0005
ORDER BY day, report_a;

-- 3. Rows needing a place name (the hourly area-name workflow fills area_name;
--    these are the ones it hasn't reached or couldn't name)
SELECT id, latitude, longitude, location, area_name
FROM public.illegal_dumping_mobile
WHERE area_name IS NULL
  AND (location IS NULL OR location ILIKE '%Coordinates:%' OR location ILIKE 'Unknown location%' OR location ILIKE 'Location not specified%')
ORDER BY created_at;

-- 4. Address says Accra but the pin is far from Accra (> ~60 km, e.g. Kumasi)
SELECT id, location, latitude, longitude, area_name
FROM public.illegal_dumping_mobile
WHERE location ILIKE '%Accra%'
  AND (abs(latitude::double precision - 5.6037) > 0.55 OR abs(longitude::double precision + 0.1870) > 0.55)
ORDER BY created_at;

-- 5. Photo links that can't be shown
--    blob:  only existed on the reporter's phone; lost for good
--    data:  inline base64 image stored in the row; viewable but bloats the table
SELECT id, created_at,
       count(*) FILTER (WHERE p ~* '^\s*blob:') AS blob_photos,
       count(*) FILTER (WHERE p ~* '^\s*data:') AS inline_photos,
       sum(length(p)) FILTER (WHERE p ~* '^\s*data:') AS inline_bytes
FROM public.illegal_dumping_mobile, unnest(photos) AS p
GROUP BY id, created_at
HAVING count(*) FILTER (WHERE p ~* '^\s*(blob|data):') > 0
ORDER BY created_at;

-- 6. Bulk-edited resolutions: several reports completed at the same minute
SELECT date_trunc('minute', coalesce(completed_at, updated_at)) AS completed_minute,
       count(*) AS reports, array_agg(id) AS ids
FROM public.illegal_dumping_mobile
WHERE status IN ('completed', 'disposed')
GROUP BY 1
HAVING count(*) > 1
ORDER BY 1;

-- 7. Reports outside Ghana (e.g. the 5 Liberia test reports)
SELECT id, created_at, status, location, latitude, longitude
FROM public.illegal_dumping_mobile
WHERE NOT (latitude::double precision BETWEEN 4.5 AND 11.2 AND longitude::double precision BETWEEN -3.3 AND 1.3)
ORDER BY created_at;

-- ── Suggested fixes (do not run until reviewed) ─────────────────────────────
-- * Stale and duplicate reports: decide per row with operations, then cancel
--   duplicates from the dashboard so the change is logged in the history table.
-- * Wrong-city addresses: set area_name = NULL on those rows; the hourly
--   "Backfill dumping report area names" workflow re-geocodes them from the pin.
-- * Inline base64 photos: upload each data: image to the dumping-photos bucket
--   at {reported_by}/{timestamp}_{random}.jpg, then replace that element of
--   photos with the public URL. Note the BEFORE UPDATE trigger resets
--   updated_at, which History uses as the date for cancelled reports.
-- * blob: photos: nothing to recover; the dashboard labels them as lost.
-- * Liberia reports: cancel them, or keep them if a Liberia pilot is planned.
