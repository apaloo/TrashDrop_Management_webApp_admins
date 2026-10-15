-- Undo 20261027_request_access_rules.sql: puts back the rules that were in
-- production on 2026-10-15 (as listed by pg_policies; also saved in
-- td_policy_backup_20261027) and removes the new rules, triggers and helpers.
-- Changes no data.
BEGIN;
DROP TRIGGER IF EXISTS aa_td_guard_update ON public.illegal_dumping_mobile;
DROP TRIGGER IF EXISTS aa_td_guard_write ON public.pickup_requests;
DROP POLICY IF EXISTS td_dumping_read ON public.illegal_dumping_mobile;
DROP POLICY IF EXISTS td_dumping_insert ON public.illegal_dumping_mobile;
DROP POLICY IF EXISTS td_dumping_update ON public.illegal_dumping_mobile;
DROP POLICY IF EXISTS td_dumping_delete ON public.illegal_dumping_mobile;
DROP POLICY IF EXISTS td_request_read ON public.pickup_requests;
DROP POLICY IF EXISTS td_request_insert ON public.pickup_requests;
DROP POLICY IF EXISTS td_request_update ON public.pickup_requests;

CREATE POLICY "Enable delete for authenticated users" ON public.illegal_dumping_mobile FOR DELETE TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users" ON public.illegal_dumping_mobile FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable read access for anonymous users" ON public.illegal_dumping_mobile FOR SELECT TO anon USING (true);
CREATE POLICY "Enable read access for authenticated users" ON public.illegal_dumping_mobile FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable update for authenticated users" ON public.illegal_dumping_mobile FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable insert for authenticated users" ON public.pickup_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable read access for authenticated users" ON public.pickup_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable update for authenticated users" ON public.pickup_requests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP FUNCTION IF EXISTS public.td_guard_dumping_update();
DROP FUNCTION IF EXISTS public.td_guard_request_write();
DROP FUNCTION IF EXISTS public.td_changed_columns(jsonb, jsonb);
DROP FUNCTION IF EXISTS public.td_my_collector_profile_ids();
DROP FUNCTION IF EXISTS public.td_is_active_collector(uuid);
DROP FUNCTION IF EXISTS public.td_can_manage_requests();
COMMIT;
NOTIFY pgrst, 'reload schema';
-- td_policy_backup_20261027 is kept; drop it by hand once you no longer need it.
