-- ============================================================================
-- Let TrashDrop staff edit, deactivate and reactivate collectors again.
--
-- The collector app's 20261013_require_collector_profile.sql (in
-- TrashDrop-Mobile-Collector-Driver) closed a real hole: anyone signed in
-- could change any collector's row. It replaced the open policies with
-- "a collector may only change their own row", but nothing let staff in, so
-- every edit, deactivation or reactivation from Collectors Management now
-- changes 0 rows ("Collector not found, or you do not have permission to
-- change it"). Its protect_collector_admin_fields() trigger also lets only
-- the backend change the deactivation fields, so staff couldn't deactivate
-- or reactivate even with a policy.
--
-- This adds, for the two TrashDrop admin accounts (td_is_staff()) only:
--   1. an UPDATE policy and an INSERT policy (Add collector) on
--      collector_profiles. Policies add up, so collectors keep exactly their
--      own-row access and everyone else still can't write.
--   2. staff to the exceptions of protect_collector_admin_fields(); the rest
--      of the function is unchanged, so collectors still can't lift a
--      suspension or change their balances or rating.
--
-- Reads, other tables and data are untouched. Additive; safe to re-run.
-- One transaction. Needs 20261018 (td_is_staff).
-- Undo: supabase/diagnostics/staff_edit_collectors_rollback.sql
-- ============================================================================

BEGIN;
SET LOCAL search_path = public;

-- ── 1. staff may update and add collector profiles ────────────────────────
DROP POLICY IF EXISTS collector_profiles_staff_update ON public.collector_profiles;
CREATE POLICY collector_profiles_staff_update
  ON public.collector_profiles
  FOR UPDATE
  TO authenticated
  USING (public.td_is_staff())
  WITH CHECK (public.td_is_staff());

DROP POLICY IF EXISTS collector_profiles_staff_insert ON public.collector_profiles;
CREATE POLICY collector_profiles_staff_insert
  ON public.collector_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.td_is_staff());

-- ── 2. staff may change the account fields a collector can't ──────────────
-- Same as 20261013_require_collector_profile.sql except for "OR td_is_staff()"
CREATE OR REPLACE FUNCTION public.protect_collector_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.td_is_staff() THEN
    RETURN NEW; -- service role / backend, or TrashDrop staff
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
