-- Undo the data change in 20261031_https_media_links.sql: puts back every
-- value saved in td_http_links_backup_20261031 (triggers paused, as in the fix).
-- Run the PREVIEW first. Change COMMIT to ROLLBACK to try it safely.

-- PREVIEW
SELECT table_name, column_name, count(*) AS values_to_restore
FROM public.td_http_links_backup_20261031
GROUP BY 1, 2 ORDER BY 1, 2;

-- RESTORE
BEGIN;
DO $$
DECLARE
  target record;
  col_type text;
BEGIN
  FOR target IN SELECT DISTINCT table_name, column_name FROM public.td_http_links_backup_20261031 LOOP
    SELECT format_type(a.atttypid, a.atttypmod) INTO col_type
    FROM pg_attribute a
    WHERE a.attrelid = format('public.%I', target.table_name)::regclass
      AND a.attname = target.column_name AND NOT a.attisdropped;

    EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER USER', target.table_name);
    EXECUTE format(
      'UPDATE public.%I t SET %I = b.old_value::%s
       FROM public.td_http_links_backup_20261031 b
       WHERE b.table_name = %L AND b.column_name = %L AND t.id::text = b.row_id',
      target.table_name, target.column_name, col_type, target.table_name, target.column_name);
    EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER USER', target.table_name);
  END LOOP;
END $$;
COMMIT;

-- When you no longer need the backup:
-- DROP TABLE public.td_http_links_backup_20261031;
