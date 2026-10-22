-- Undo 20261104_area_dumping_access.sql: Authority back to read-only in its
-- district, Media back to Reports Data only, Volunteers and Users back to no
-- Illegal Dumping access in the admin app; the functions go back to their
-- 20261028 / 20261030 / 20261101 versions. No data changes.
BEGIN;
SET LOCAL search_path = public;

CREATE OR REPLACE FUNCTION public.media_dumping_reports(p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date, p_region text DEFAULT NULL::text, p_district text DEFAULT NULL::text, p_status text DEFAULT NULL::text)
 RETURNS SETOF jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
END $function$
;

CREATE OR REPLACE FUNCTION public.td_can_read_media_data()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL AND public.td_my_role() IN ('media', 'manager', 'admin')
$function$
;

CREATE OR REPLACE FUNCTION public.td_capability_roles(p_capability text)
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE p_capability
    WHEN 'dashboard.stats' THEN ARRAY['admin', 'manager']
    WHEN 'dashboard.liveQueue' THEN ARRAY['admin', 'manager']
    WHEN 'requests.view' THEN ARRAY['admin', 'manager']
    WHEN 'requests.assign' THEN ARRAY['admin', 'manager']
    WHEN 'requests.cancel' THEN ARRAY['admin', 'manager']
    WHEN 'requests.locate' THEN ARRAY['admin']
    WHEN 'collectors.view' THEN ARRAY['admin']
    WHEN 'alerts.view' THEN ARRAY['admin']
    WHEN 'logs.view' THEN ARRAY['admin']
    WHEN 'bags.view' THEN ARRAY['admin']
    WHEN 'bags.manage' THEN ARRAY['admin']
    WHEN 'dumping.view' THEN ARRAY['admin', 'manager', 'authority']
    WHEN 'dumping.manage' THEN ARRAY['admin', 'manager']
    WHEN 'reports.view' THEN ARRAY['admin', 'manager', 'media']
    WHEN 'reports.export' THEN ARRAY['admin', 'manager', 'media']
    WHEN 'users.manage' THEN ARRAY['admin']
    WHEN 'settings.manage' THEN ARRAY['admin']
    ELSE ARRAY[]::text[] END
$function$
;

CREATE OR REPLACE FUNCTION public.td_guard_dumping_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  changed text[];
  allowed text[];
  bad text[];
BEGIN
  IF auth.uid() IS NULL OR public.td_can_manage_requests()
     OR coalesce(current_setting('app.td_claim', true), '') = 'on' THEN
    RETURN NEW;
  END IF;
  changed := public.td_changed_columns(to_jsonb(OLD), to_jsonb(NEW));
  IF OLD.assigned_to IS NOT NULL AND OLD.assigned_to IN (SELECT public.td_my_collector_profile_ids()) THEN
    allowed := ARRAY['status', 'disposed_at', 'disposal_site_id', 'disposal_site_name', 'completed_at',
                     'cleanup_completed_date', 'notes', 'photos', 'cleanup_photos'];
  ELSIF OLD.reported_by = auth.uid() THEN
    allowed := ARRAY['status', 'description', 'photos'];
  ELSE
    allowed := '{}';
  END IF;
  bad := ARRAY(SELECT c FROM unnest(changed) c
               WHERE c <> ALL (allowed || ARRAY['updated_at', 'region', 'district']));
  IF cardinality(bad) > 0 THEN
    RAISE EXCEPTION 'Not allowed to change % on this report', array_to_string(bad, ', ')
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $function$
;


DROP FUNCTION IF EXISTS public.area_dumping_assign(uuid, uuid, numeric);
DROP FUNCTION IF EXISTS public.area_dumping_mark_cleaned(uuid);
DROP FUNCTION IF EXISTS public.area_dumping_verify(uuid);
DROP FUNCTION IF EXISTS public.area_assignable_teams();
DROP FUNCTION IF EXISTS public.td_area_report_for(uuid, text);
DROP FUNCTION IF EXISTS public.area_dumping_reports(text, text, text);
DROP FUNCTION IF EXISTS public.td_in_scope(jsonb, text, text);
DROP FUNCTION IF EXISTS public.td_report_scope();
DROP FUNCTION IF EXISTS public.td_user_home_district();

NOTIFY pgrst, 'reload schema';
COMMIT;
