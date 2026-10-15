-- Undo 20261028_volunteer_claims.sql. Reports claimed by volunteer groups
-- keep their assignment; the claim columns, functions and triggers go.
BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('td-release-expired-claims');
  END IF;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DROP TRIGGER IF EXISTS td_stamp_assignment ON public.illegal_dumping_mobile;
DROP FUNCTION IF EXISTS public.td_stamp_assignment();
DROP FUNCTION IF EXISTS public.claim_dumping_report(uuid);
DROP FUNCTION IF EXISTS public.release_dumping_claim(uuid);
DROP FUNCTION IF EXISTS public.volunteer_claimable_reports();
DROP FUNCTION IF EXISTS public.td_release_expired_claims();
DROP FUNCTION IF EXISTS public.td_my_volunteer_profile();

-- 20261027 versions of these two
CREATE OR REPLACE FUNCTION public.td_is_active_collector(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.collector_profiles cp
    WHERE cp.user_id = p_user_id AND coalesce(cp.status, '') <> 'suspended' AND (to_jsonb(cp) ->> 'deactivated_at') IS NULL)
$$;
CREATE OR REPLACE FUNCTION public.td_guard_dumping_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE changed text[]; allowed text[]; bad text[];
BEGIN
  IF auth.uid() IS NULL OR public.td_can_manage_requests() THEN RETURN NEW; END IF;
  changed := public.td_changed_columns(to_jsonb(OLD), to_jsonb(NEW));
  IF OLD.assigned_to IS NOT NULL AND OLD.assigned_to IN (SELECT public.td_my_collector_profile_ids()) THEN
    allowed := ARRAY['status', 'disposed_at', 'disposal_site_id', 'disposal_site_name', 'completed_at',
                     'cleanup_completed_date', 'notes', 'photos'];
  ELSIF OLD.reported_by = auth.uid() THEN
    allowed := ARRAY['status', 'description', 'photos'];
  ELSE
    allowed := '{}';
  END IF;
  bad := ARRAY(SELECT c FROM unnest(changed) c WHERE c <> ALL (allowed || ARRAY['updated_at', 'region', 'district']));
  IF cardinality(bad) > 0 THEN
    RAISE EXCEPTION 'Not allowed to change % on this report', array_to_string(bad, ', ') USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

DROP INDEX IF EXISTS public.illegal_dumping_mobile_claimable_idx;
ALTER TABLE public.illegal_dumping_mobile DROP CONSTRAINT IF EXISTS illegal_dumping_mobile_assigned_via_check;
ALTER TABLE public.illegal_dumping_mobile DROP COLUMN IF EXISTS assigned_at, DROP COLUMN IF EXISTS assigned_via;
-- cleanup_photos is kept: it holds photos people took. Drop it by hand if you are sure.
ALTER TABLE public.collector_profiles DROP CONSTRAINT IF EXISTS collector_profiles_collector_type_check;
ALTER TABLE public.collector_profiles DROP COLUMN IF EXISTS collector_type;
COMMIT;
NOTIFY pgrst, 'reload schema';
