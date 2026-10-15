-- Undo 20261030_media_access.sql: Media reads the reports table again (as in
-- 20261027) and the Media functions go. Changes no data.
BEGIN;
DROP POLICY IF EXISTS td_dumping_read ON public.illegal_dumping_mobile;
CREATE POLICY td_dumping_read ON public.illegal_dumping_mobile FOR SELECT TO authenticated USING (
  reported_by = auth.uid()
  OR public.td_can_manage_requests()
  OR assigned_to IN (SELECT public.td_my_collector_profile_ids())
  OR public.td_in_my_area(region, district)
);
DROP FUNCTION IF EXISTS public.log_media_export(jsonb, integer);
DROP FUNCTION IF EXISTS public.media_dumping_reports(date, date, text, text, text);
DROP FUNCTION IF EXISTS public.td_can_read_media_data();
DROP FUNCTION IF EXISTS public.td_https_links(jsonb);
COMMIT;
NOTIFY pgrst, 'reload schema';
