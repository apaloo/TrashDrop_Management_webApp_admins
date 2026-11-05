-- Illegal dumping: a cleanup team can only be assigned to a verified report.
--
-- The admin portal already checks this (assignmentBlockReason) and its update
-- only matches verified, unassigned reports, and claim_dumping_report() only
-- takes verified reports. The database did not: an admin account (or the SQL
-- editor) could still set assigned_to on a pending report. This adds the rule
-- to td_stamp_assignment(), which already runs on every insert/update.
--
-- Rule, whenever assigned_to is set or changed to a team:
--   * UPDATE: the report must already be verified (or in progress) BEFORE
--     this change, so "verify and assign in one update" is refused too.
--   * INSERT: the new report must be verified or in progress.
-- Removing a team (assigned_to -> NULL) is always allowed; expired claims
-- are released that way. Applies to every caller, staff and service role
-- included.
--
-- Same function as 20261028_volunteer_claims.sql plus the check. Safe to re-run.

CREATE OR REPLACE FUNCTION public.td_stamp_assignment()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  current_status text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to THEN RETURN NEW; END IF;
  IF NEW.assigned_to IS NULL THEN
    NEW.assigned_at := NULL;
    NEW.assigned_via := NULL;
  ELSE
    current_status := lower(trim(coalesce(
      CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NEW.status END, 'pending')));
    IF current_status = 'pending' THEN
      RAISE EXCEPTION 'Verify this report before assigning a cleanup team'
        USING ERRCODE = 'P0001',
              HINT = 'Set status to verified first, then assign the team in a separate step.';
    ELSIF current_status NOT IN ('verified', 'in_progress') THEN
      RAISE EXCEPTION 'Only verified reports can be assigned a cleanup team (this one is %)', current_status
        USING ERRCODE = 'P0001';
    END IF;
    NEW.assigned_at := now();
    NEW.assigned_via := CASE WHEN coalesce(current_setting('app.td_claim', true), '') = 'on' THEN 'claim' ELSE 'admin' END;
  END IF;
  RETURN NEW;
END $$;
