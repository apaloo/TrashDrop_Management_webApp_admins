-- Diagnostics for illegal dumping report photos. Read-only except the clearly
-- marked, commented-out step 3, which you run only after reviewing step 2.
--
-- The household app uploads photos to the 'dumping-photos' bucket at
-- '{reported_by}/{timestamp}_{random}.jpg' and then inserts the report with the
-- public URLs in illegal_dumping_mobile.photos. If the insert kept a blob: URL
-- or an empty list, the uploaded file exists but is not linked.

-- 1. How many public reports have no photo
SELECT count(*)                                           AS public_reports,
       count(*) FILTER (WHERE cardinality(photo_urls) = 0) AS without_photo
FROM public.public_illegal_dumping_reports;

-- 2. Uploaded photos that no report links to, matched to the report the same
--    user submitted within 15 minutes after (or 5 minutes before) the upload
WITH linked AS (
  SELECT DISTINCT p AS url
  FROM public.illegal_dumping_mobile r, unnest(r.photos) AS p
),
unlinked AS (
  SELECT o.name,
         o.created_at AS uploaded_at,
         split_part(o.name, '/', 1) AS folder,
         'https://tfdedlqdsajjdjkerkli.supabase.co/storage/v1/object/public/dumping-photos/' || o.name AS url
  FROM storage.objects o
  WHERE o.bucket_id = 'dumping-photos'
    AND NOT EXISTS (
      SELECT 1 FROM linked l
      WHERE l.url = 'https://tfdedlqdsajjdjkerkli.supabase.co/storage/v1/object/public/dumping-photos/' || o.name
    )
)
SELECT r.id AS report_id,
       r.created_at AS reported_at,
       u.uploaded_at,
       u.url,
       r.photos AS current_photos
FROM unlinked u
JOIN public.illegal_dumping_mobile r
  ON r.reported_by::text = u.folder
 AND u.uploaded_at BETWEEN r.created_at - interval '15 minutes' AND r.created_at + interval '5 minutes'
WHERE NOT EXISTS (SELECT 1 FROM unnest(r.photos) p WHERE p ILIKE 'https://%')
ORDER BY r.created_at, u.uploaded_at;

-- 3. (Run only after checking step 2.) Link those photos to their reports.
--    A file that matches more than one report is skipped, so nothing is linked to the wrong report.
-- WITH linked AS (
--   SELECT DISTINCT p AS url FROM public.illegal_dumping_mobile r, unnest(r.photos) AS p
-- ),
-- unlinked AS (
--   SELECT o.name, o.created_at AS uploaded_at, split_part(o.name, '/', 1) AS folder,
--          'https://tfdedlqdsajjdjkerkli.supabase.co/storage/v1/object/public/dumping-photos/' || o.name AS url
--   FROM storage.objects o
--   WHERE o.bucket_id = 'dumping-photos'
--     AND NOT EXISTS (SELECT 1 FROM linked l WHERE l.url = 'https://tfdedlqdsajjdjkerkli.supabase.co/storage/v1/object/public/dumping-photos/' || o.name)
-- ),
-- matches AS (
--   SELECT r.id AS report_id, u.url, u.uploaded_at,
--          count(*) OVER (PARTITION BY u.url) AS reports_for_file
--   FROM unlinked u
--   JOIN public.illegal_dumping_mobile r
--     ON r.reported_by::text = u.folder
--    AND u.uploaded_at BETWEEN r.created_at - interval '15 minutes' AND r.created_at + interval '5 minutes'
--   WHERE NOT EXISTS (SELECT 1 FROM unnest(r.photos) p WHERE p ILIKE 'https://%')
-- )
-- UPDATE public.illegal_dumping_mobile r
-- SET photos = m.urls   -- needs the 20261012 migration first: cleanup time now lives in completed_at, not updated_at
-- FROM (
--   SELECT report_id, array_agg(url ORDER BY uploaded_at) AS urls
--   FROM matches WHERE reports_for_file = 1
--   GROUP BY report_id
-- ) m
-- WHERE r.id = m.report_id;
