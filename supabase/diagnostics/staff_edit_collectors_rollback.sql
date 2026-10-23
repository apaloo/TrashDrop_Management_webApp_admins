-- Undo supabase/migrations/20261106_staff_edit_collectors.sql:
-- removes the staff policies and restores protect_collector_admin_fields()
-- exactly as 20261013_require_collector_profile.sql (collector app) left it.
-- Staff can then no longer edit collectors from the admin site.
BEGIN;
SET LOCAL search_path = public;

DROP POLICY IF EXISTS collector_profiles_staff_update ON public.collector_profiles;
DROP POLICY IF EXISTS collector_profiles_staff_insert ON public.collector_profiles;

CREATE OR REPLACE FUNCTION public.protect_collector_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW; -- service role / backend
  END IF;

  IF (OLD.status = 'suspended') <> (NEW.status = 'suspended')
     OR NEW.deactivated_at IS DISTINCT FROM OLD.deactivated_at
     OR NEW.deactivated_by IS DISTINCT FROM OLD.deactivated_by
     OR NEW.deactivation_reason IS DISTINCT FROM OLD.deactivation_reason
     OR NEW.pending_balance IS DISTINCT FROM OLD.pending_balance
     OR NEW.withdrawable_balance IS DISTINCT FROM OLD.withdrawable_balance
     OR NEW.rating IS DISTINCT FROM OLD.rating THEN
    RAISE EXCEPTION 'These account fields can only be changed by TrashDrop staff'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
