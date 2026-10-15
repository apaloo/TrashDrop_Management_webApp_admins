-- Undo 20261026_area_scope.sql and 20261025_gh_districts.sql.
-- Removes the area triggers, functions and the region / district columns on
-- illegal_dumping_mobile and pickup_requests (no other data is touched),
-- then the district boundaries table. account_roles keeps its region /
-- district (they came from sign-up, step 2).
BEGIN;
DROP TRIGGER IF EXISTS td_tag_area ON public.illegal_dumping_mobile;
DROP TRIGGER IF EXISTS td_tag_area ON public.pickup_requests;
DROP FUNCTION IF EXISTS public.td_tag_area();
DROP FUNCTION IF EXISTS public.admin_set_account_area(uuid, text, text);
DROP FUNCTION IF EXISTS public.td_in_my_area(text, text);
DROP FUNCTION IF EXISTS public.td_my_area();
DROP FUNCTION IF EXISTS public.td_report_point(jsonb);
DROP FUNCTION IF EXISTS public.td_area_at(double precision, double precision);
ALTER TABLE public.illegal_dumping_mobile DROP COLUMN IF EXISTS region, DROP COLUMN IF EXISTS district;
ALTER TABLE public.pickup_requests DROP COLUMN IF EXISTS region, DROP COLUMN IF EXISTS district;
DROP TABLE IF EXISTS public.gh_districts;
COMMIT;
NOTIFY pgrst, 'reload schema';
