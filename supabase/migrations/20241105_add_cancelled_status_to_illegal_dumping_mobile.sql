-- Add 'cancelled' to the illegal_dumping_mobile status check constraint
-- The original constraint only allowed: 'pending', 'verified', 'in_progress', 'completed'
-- This extends it to also allow: 'cancelled'

DO $$
BEGIN
  ALTER TABLE public.illegal_dumping_mobile
    DROP CONSTRAINT IF EXISTS illegal_dumping_mobile_status_check;

  ALTER TABLE public.illegal_dumping_mobile
    ADD CONSTRAINT illegal_dumping_mobile_status_check
    CHECK (status IN ('pending', 'verified', 'in_progress', 'completed', 'cancelled'));
END;
$$;
