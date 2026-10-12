-- Pickup Requests page: data checks. Read-only except the clearly marked fix.
-- Run each query on its own in the Supabase SQL editor.

-- 1. Every status and priority value actually in use
SELECT 'pickup_requests' AS tbl, status, count(*) FROM public.pickup_requests GROUP BY status
UNION ALL SELECT 'digital_bins', status, count(*) FROM public.digital_bins GROUP BY status
UNION ALL SELECT 'scheduled_pickups', status, count(*) FROM public.scheduled_pickups GROUP BY status
ORDER BY 1, 2;

SELECT 'pickup_requests.priority' AS field, coalesce(to_jsonb(p) ->> 'priority', '(null)') AS value, count(*)
FROM public.pickup_requests p GROUP BY 2
UNION ALL
SELECT 'digital_bins.is_urgent', coalesce(to_jsonb(b) ->> 'is_urgent', '(null)'), count(*)
FROM public.digital_bins b GROUP BY 2
ORDER BY 1, 2;

-- 2. In progress with no collector (accepted / en_route / arrived / collecting)
SELECT 'pickup_requests' AS tbl, id::text, status, created_at, updated_at
FROM public.pickup_requests
WHERE collector_id IS NULL
  AND lower(status) IN ('accepted', 'assigned', 'en_route', 'in_transit', 'in_progress', 'arrived', 'collecting', 'picked_up')
UNION ALL
SELECT 'digital_bins', id::text, status, created_at, updated_at
FROM public.digital_bins
WHERE collector_id IS NULL
  AND lower(status) IN ('accepted', 'assigned', 'en_route', 'in_transit', 'in_progress', 'arrived', 'collecting', 'picked_up')
ORDER BY created_at;

-- FIX for query 2 (review first): put them back to pending so they can be
-- assigned. Runs past the status rules with the escape hatch, and is logged.
-- BEGIN;
-- SET LOCAL app.skip_status_flow = 'on';
-- UPDATE public.pickup_requests SET status = 'pending', updated_at = now()
-- WHERE collector_id IS NULL
--   AND lower(status) IN ('accepted', 'assigned', 'en_route', 'in_transit', 'in_progress', 'arrived', 'collecting', 'picked_up');
-- UPDATE public.digital_bins SET status = 'pending', updated_at = now()
-- WHERE collector_id IS NULL
--   AND lower(status) IN ('accepted', 'assigned', 'en_route', 'in_transit', 'in_progress', 'arrived', 'collecting', 'picked_up');
-- COMMIT;

-- 3. Requests with coordinates but no address (the page looks these up)
SELECT source, id, lat, lng FROM public.admin_pickup_requests
WHERE (address IS NULL OR address = '') AND lat IS NOT NULL
ORDER BY created_at DESC;

-- 4. Possible duplicates: same customer, open, within 50 m and 48 h
SELECT a.source, a.id AS request_a, b.id AS request_b, a.user_id, a.created_at, b.created_at
FROM public.admin_pickup_requests a
JOIN public.admin_pickup_requests b
  ON a.user_id = b.user_id AND a.id < b.id
 AND abs(extract(epoch FROM a.created_at - b.created_at)) <= 48 * 3600
 AND a.lat IS NOT NULL AND b.lat IS NOT NULL
 AND ST_DWithin(ST_MakePoint(a.lng, a.lat)::geography, ST_MakePoint(b.lng, b.lat)::geography, 50)
WHERE a.status IN ('pending', 'available', 'accepted', 'en_route', 'arrived')
  AND b.status IN ('pending', 'available', 'accepted', 'en_route', 'arrived');
