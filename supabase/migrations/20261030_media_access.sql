-- ============================================================================
-- Media access (step 5): journalists get a national, read-only view of
-- illegal dumping reports with nothing that identifies who reported them.
--
-- 1. Media accounts no longer read the illegal_dumping_mobile table directly
--    (it holds the reporter's account id and free-text descriptions, which
--    can contain names and phone numbers). Everyone else is unchanged.
-- 2. media_dumping_reports(from, to, region, district, status): the same
--    fields the public map shows (location, photos, area, status, dates) plus
--    region / district, size, cleanup timing, who cleaned it up (TrashDrop
--    or a volunteer group) and the cleanup photos. Up to 5000 rows a call.
--    For approved Media accounts, and Admins / Managers to preview.
-- 3. log_media_export(filters, rows): records each CSV download in Logs.
--
-- Needs 20261026 (areas) and 20261027 (access rules). One transaction.
-- Undo with supabase/diagnostics/media_access_rollback.sql.
-- ============================================================================

BEGIN;
SET LOCAL search_path = public;

-- ── 1. Media reads through the function, not the table ───────────────────
DROP POLICY IF EXISTS td_dumping_read ON public.illegal_dumping_mobile;
CREATE POLICY td_dumping_read ON public.illegal_dumping_mobile FOR SELECT TO authenticated USING (
  reported_by = auth.uid()
  OR public.td_can_manage_requests()
  OR assigned_to IN (SELECT public.td_my_collector_profile_ids())
  OR (public.td_my_role() <> 'media' AND public.td_in_my_area(region, district))
);

-- ── 2. the Media data ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.td_can_read_media_data()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND public.td_my_role() IN ('media', 'manager', 'admin')
$$;

-- Web links from a photo list (anything else, e.g. lost local photos, is left out)
CREATE OR REPLACE FUNCTION public.td_https_links(v jsonb)
RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN jsonb_typeof(v) = 'array' THEN
    coalesce((SELECT jsonb_agg(x) FROM jsonb_array_elements_text(v) x WHERE x ILIKE 'https://%'), '[]'::jsonb)
  ELSE '[]'::jsonb END
$$;

CREATE OR REPLACE FUNCTION public.media_dumping_reports(
  p_from date DEFAULT NULL, p_to date DEFAULT NULL,
  p_region text DEFAULT NULL, p_district text DEFAULT NULL, p_status text DEFAULT NULL)
RETURNS SETOF jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF NOT public.td_can_read_media_data() THEN
    RAISE EXCEPTION 'Only approved Media accounts can read this data' USING ERRCODE = '42501';
  END IF;
  IF p_from IS NOT NULL AND p_to IS NOT NULL AND p_to < p_from THEN
    RAISE EXCEPTION 'The end date is before the start date' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT jsonb_build_object(
    'id', r.id,
    'reported_at', r.created_at,
    'status', lower(coalesce(r.status, 'pending')),
    'severity', lower(coalesce(j ->> 'severity', 'medium')),
    'waste_type', lower(coalesce(j ->> 'waste_type', 'mixed')),
    'size', j ->> 'size',
    'region', r.region,
    'district', r.district,
    'area_name', nullif(btrim(j ->> 'area_name'), ''),
    'latitude', ST_Y(p.g),
    'longitude', ST_X(p.g),
    'cleaned_at', CASE WHEN r.status IN ('completed', 'disposed')
                    THEN coalesce((j ->> 'completed_at')::timestamptz, r.updated_at) END,
    'disposed_at', (j ->> 'disposed_at')::timestamptz,
    'cleanup_by', CASE j ->> 'assigned_via' WHEN 'claim' THEN 'volunteer group'
                    WHEN 'admin' THEN 'TrashDrop collector' END,
    'photos', public.td_https_links(j -> 'photos'),
    'cleanup_photos', public.td_https_links(j -> 'cleanup_photos'))
  FROM public.illegal_dumping_mobile r
  CROSS JOIN LATERAL (SELECT to_jsonb(r) AS j) jr
  CROSS JOIN LATERAL (SELECT public.td_report_point(jr.j) AS g) p
  WHERE (p_from IS NULL OR r.created_at >= p_from)
    AND (p_to IS NULL OR r.created_at < p_to + 1)
    AND (p_region IS NULL OR r.region = p_region)
    AND (p_district IS NULL OR r.district = p_district)
    AND (p_status IS NULL OR lower(r.status) = lower(p_status))
  ORDER BY r.created_at DESC
  LIMIT 5000;
END $$;

-- ── 3. record downloads ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_media_export(p_filters jsonb, p_rows integer)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  who text := coalesce(auth.jwt() ->> 'email', 'A Media account');
  org text := (SELECT org_name FROM public.account_roles WHERE user_id = auth.uid());
BEGIN
  IF NOT public.td_can_read_media_data() THEN
    RAISE EXCEPTION 'Only approved Media accounts can export this data' USING ERRCODE = '42501';
  END IF;
  PERFORM public.td_write_log('info', 'admin', 'media.export', 'illegal_dumping', NULL,
    format('%s%s downloaded %s report(s)', who, CASE WHEN org IS NOT NULL THEN ' (' || org || ')' ELSE '' END, coalesce(p_rows, 0)),
    NULL, NULL, jsonb_build_object('filters', coalesce(p_filters, '{}'::jsonb), 'rows', p_rows),
    auth.uid(), who, public.td_my_role());
END $$;

REVOKE ALL ON FUNCTION public.td_can_read_media_data() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.media_dumping_reports(date, date, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.log_media_export(jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.td_can_read_media_data() TO authenticated;
GRANT EXECUTE ON FUNCTION public.media_dumping_reports(date, date, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_media_export(jsonb, integer) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

SELECT
  (SELECT count(*) FROM public.account_roles WHERE role = 'media' AND status = 'approved') AS media_accounts,
  (SELECT count(*) FROM public.illegal_dumping_mobile) AS reports_in_scope;
