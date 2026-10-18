-- ============================================================================
-- https-only photo and avatar links ("Not Secure" fix)
--
-- An http:// image on the https site makes Chrome mark the page "Not Secure"
-- (mixed content). The website now upgrades such links before showing them;
-- this rewrites them in the database too, so every app gets https links.
--
-- NOT RUN YET. Run step 1 on its own first and review the result. Steps 2–3
-- change data: they save every value they change to
-- td_http_links_backup_20261031 first, and
-- supabase/diagnostics/https_media_links_rollback.sql puts them back.
--
-- What changes: values that START with http:// (any case, after spaces) in
--   illegal_dumping_mobile.photos, illegal_dumping_mobile.cleanup_photos (text[])
--   collector_profiles.profile_image_url, profiles.avatar_url, users.avatar_url
--   (text; skipped when the table or column doesn't exist)
-- The http:// is replaced with https://; nothing else in the value changes.
-- Other triggers on those tables are paused during the update (as in
-- 20261028), so updated_at, status history and the audit log stay as they are.
-- ============================================================================

-- ── 1. REPORT (read-only) ──────────────────────────────────────────────────
-- Every text / text[] / json column in public that still holds an http://
-- link (XML namespaces like http://www.w3.org/… are ignored). Columns not in
-- the list above are left for review: fix them by hand if they hold links.
CREATE TEMP TABLE IF NOT EXISTS td_http_link_report (
  table_name text, column_name text, data_type text, rows_with_http bigint
);
TRUNCATE td_http_link_report;
DO $$
DECLARE
  c record;
  n bigint;
BEGIN
  FOR c IN
    SELECT col.table_name, col.column_name, col.data_type
    FROM information_schema.columns col
    JOIN information_schema.tables t
      ON t.table_schema = col.table_schema AND t.table_name = col.table_name
    WHERE col.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND col.table_name NOT LIKE '%backup%'
      AND (col.data_type IN ('text', 'character varying', 'json', 'jsonb')
           OR col.udt_name IN ('_text', '_varchar'))
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE %I::text ~* %L',
                   c.table_name, c.column_name, 'http://(?!www\.w3\.org/)')
      INTO n;
    IF n > 0 THEN
      INSERT INTO td_http_link_report VALUES (c.table_name, c.column_name, c.data_type, n);
    END IF;
  END LOOP;
END $$;
SELECT * FROM td_http_link_report ORDER BY rows_with_http DESC, table_name, column_name;

-- Report photos by host: links on *.supabase.co work over https; any other
-- host is worth opening once with https:// to check the photo still loads.
SELECT 'photos' AS column_name, substring(p FROM '(?i)^\s*http://([^/]+)') AS host, count(*) AS links
FROM public.illegal_dumping_mobile, unnest(photos) AS p
WHERE p ~* '^\s*http://'
GROUP BY 1, 2
UNION ALL
SELECT 'cleanup_photos', substring(p FROM '(?i)^\s*http://([^/]+)'), count(*)
FROM public.illegal_dumping_mobile, unnest(cleanup_photos) AS p
WHERE p ~* '^\s*http://'
GROUP BY 1, 2
ORDER BY links DESC;

-- ── 2. BACKUP (admins only) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.td_http_links_backup_20261031 (
  table_name  text NOT NULL,
  column_name text NOT NULL,
  row_id      text NOT NULL,
  old_value   text,
  saved_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.td_http_links_backup_20261031 ENABLE ROW LEVEL SECURITY; -- no policies: only the database owner reads it
REVOKE ALL ON public.td_http_links_backup_20261031 FROM anon, authenticated;

-- ── 3. FIX ─────────────────────────────────────────────────────────────────
BEGIN;
DO $$
DECLARE
  target record;
  is_array boolean;
  has_http text;
  new_value text;
  n bigint;
BEGIN
  FOR target IN
    SELECT * FROM (VALUES
      ('illegal_dumping_mobile', 'photos'),
      ('illegal_dumping_mobile', 'cleanup_photos'),
      ('collector_profiles',     'profile_image_url'),
      ('profiles',               'avatar_url'),
      ('users',                  'avatar_url')
    ) AS v(table_name, column_name)
  LOOP
    SELECT col.udt_name LIKE '\_%' INTO is_array
    FROM information_schema.columns col
    WHERE col.table_schema = 'public' AND col.table_name = target.table_name
      AND col.column_name = target.column_name
      AND EXISTS (SELECT 1 FROM information_schema.columns k
                  WHERE k.table_schema = 'public' AND k.table_name = target.table_name AND k.column_name = 'id');
    IF NOT FOUND THEN
      RAISE NOTICE 'skip %.% (no such column, or the table has no id column)', target.table_name, target.column_name;
      CONTINUE;
    END IF;

    IF is_array THEN
      has_http  := format('EXISTS (SELECT 1 FROM unnest(%I) p WHERE p ~* ''^\s*http://'')', target.column_name);
      new_value := format('ARRAY(SELECT regexp_replace(p, ''^\s*http://'', ''https://'', ''i'') FROM unnest(%I) WITH ORDINALITY AS u(p, o) ORDER BY o)', target.column_name);
    ELSE
      has_http  := format('%I ~* ''^\s*http://''', target.column_name);
      new_value := format('regexp_replace(%I, ''^\s*http://'', ''https://'', ''i'')', target.column_name);
    END IF;

    EXECUTE format(
      'INSERT INTO public.td_http_links_backup_20261031 (table_name, column_name, row_id, old_value)
       SELECT %L, %L, id::text, %I::text FROM public.%I WHERE %s',
      target.table_name, target.column_name, target.column_name, target.table_name, has_http);

    EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER USER', target.table_name);
    EXECUTE format('UPDATE public.%I SET %I = %s WHERE %s',
                   target.table_name, target.column_name, new_value, has_http);
    GET DIAGNOSTICS n = ROW_COUNT;
    EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER USER', target.table_name);
    RAISE NOTICE '%.%: % rows now use https', target.table_name, target.column_name, n;
  END LOOP;
END $$;
COMMIT;

-- Check: run step 1 again; the columns above should no longer be listed.
