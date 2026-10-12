-- Illegal dumping QA fixes (C1, R9/R10). Review, then run once in the
-- Supabase SQL editor. Safe to re-run. Does not change any existing rows.
--
-- 1. Photos: reject device-only photo links. The household app used to save
--    camera photos as blob: URLs, which only exist on the reporter's phone, so
--    the dashboard could never show them. The app now uploads every photo to
--    the dumping-photos bucket; this blocks blob:/data: values from any client.
--    It only checks rows whose photos are being written, so status updates on
--    older reports that still hold blob: links keep working.
--
-- 2. Status flow: pending → verified → in_progress → completed → disposed,
--    plus cancel from pending, verified or in_progress. Matches the dashboard
--    (src/utils/illegalDumpingReportUtils.js, STATUS_TRANSITIONS) and the
--    collector app (accept: verified → in_progress, complete, dispose).
--    For a deliberate data fix, run in the same transaction:
--      SET LOCAL app.skip_status_flow = 'on';

-- 1. Photos ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reject_local_dumping_photos()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM unnest(coalesce(NEW.photos, '{}'::text[])) AS p
    WHERE p ~* '^\s*(blob|data):'
  ) THEN
    RAISE EXCEPTION 'Photos must be uploaded to storage first (blob:/data: URLs are not allowed)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reject_local_dumping_photos ON public.illegal_dumping_mobile;
CREATE TRIGGER reject_local_dumping_photos
  BEFORE INSERT OR UPDATE OF photos ON public.illegal_dumping_mobile
  FOR EACH ROW EXECUTE FUNCTION public.reject_local_dumping_photos();

-- 2. Status flow ----------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_illegal_dumping_status_flow()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  old_s text := lower(trim(coalesce(OLD.status, 'pending')));
  new_s text := lower(trim(coalesce(NEW.status, 'pending')));
BEGIN
  IF old_s = new_s OR coalesce(current_setting('app.skip_status_flow', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  IF (old_s, new_s) IN (
    ('pending', 'verified'), ('pending', 'cancelled'),
    ('verified', 'in_progress'), ('verified', 'cancelled'),
    ('in_progress', 'completed'), ('in_progress', 'cancelled'),
    ('completed', 'disposed')
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Status cannot change from % to %', old_s, new_s
    USING ERRCODE = 'check_violation',
          HINT = 'Allowed: pending → verified → in_progress → completed → disposed; cancel from pending, verified or in_progress.';
END;
$$;

DROP TRIGGER IF EXISTS enforce_illegal_dumping_status_flow ON public.illegal_dumping_mobile;
CREATE TRIGGER enforce_illegal_dumping_status_flow
  BEFORE UPDATE OF status ON public.illegal_dumping_mobile
  FOR EACH ROW EXECUTE FUNCTION public.enforce_illegal_dumping_status_flow();
