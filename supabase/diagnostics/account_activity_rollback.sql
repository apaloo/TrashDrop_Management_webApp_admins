-- Undo supabase/migrations/20261108_account_activity.sql
--
-- Stops recording (removes the triggers and their functions). The recorded rows
-- are kept in public.account_activity so nothing is lost; to remove them too,
-- export the table first, then run the DROP TABLE at the end by hand.
-- One transaction.

BEGIN;
SET LOCAL search_path = public;

DROP TRIGGER IF EXISTS td_dumping_activity_insert ON public.illegal_dumping_mobile;
DROP TRIGGER IF EXISTS td_dumping_activity_update ON public.illegal_dumping_mobile;
DROP FUNCTION IF EXISTS public.td_dumping_activity();
DROP FUNCTION IF EXISTS public.td_record_activity(uuid, text, text, text, text, numeric, jsonb, boolean);
DROP FUNCTION IF EXISTS public.td_team_user(uuid);
DROP FUNCTION IF EXISTS public.td_activity_role(uuid);

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Optional, after exporting: DROP TABLE public.account_activity;
