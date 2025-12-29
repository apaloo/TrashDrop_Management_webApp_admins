-- Seed sample data for the alerts table
-- This script assumes the alerts schema created by fix_alerts_table.sql
-- Columns: id (uuid default), title, description, type, severity, entity_type, entity_id,
--          created_by (public.profiles.id), creator (auth.users.id), created_at, updated_at

DO $$
DECLARE
  current_user_id UUID;
  current_profile_id UUID;
  any_rows INTEGER;
BEGIN
  -- Ensure alerts table exists
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'alerts'
  ) THEN
    RAISE NOTICE 'Table public.alerts does not exist. Aborting seed.';
    RETURN;
  END IF;

  -- Check if table already has rows
  SELECT COUNT(*) INTO any_rows FROM public.alerts;
  IF any_rows > 0 THEN
    RAISE NOTICE 'public.alerts already has % row(s). Skipping seed.', any_rows;
    RETURN;
  END IF;

  -- Find IDs for created_by (profiles.id) and creator (auth.users.id)
  SELECT id INTO current_profile_id FROM public.profiles ORDER BY created_at ASC LIMIT 1;
  SELECT id INTO current_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;

  IF current_profile_id IS NULL THEN
    RAISE NOTICE 'No profiles found in public.profiles. Inserting alerts with NULL created_by.';
  END IF;
  IF current_user_id IS NULL THEN
    RAISE NOTICE 'No users found in auth.users. Inserting alerts with NULL creator.';
  END IF;

  -- Insert sample alerts
  INSERT INTO public.alerts (title, description, type, severity, entity_type, entity_id, created_by, creator)
  VALUES
    (
      'Pickup Request Delayed',
      'Pickup request PR-10023 is 45 minutes behind schedule in Ga West Municipal.',
      'pickup_delayed',
      'high',
      'pickup_requests',
      gen_random_uuid(),
      current_profile_id,
      current_user_id
    ),
    (
      'Illegal Dumping Report Verified',
      'An illegal dumping site has been verified near Pokuase Market. Cleanup scheduling required.',
      'illegal_dumping_urgent',
      'high',
      'illegal_dumping',
      gen_random_uuid(),
      current_profile_id,
      current_user_id
    ),
    (
      'Collector Offline',
      'Collector device for Kofi Boateng went offline 25 minutes ago in Ga North Municipal.',
      'collector_offline',
      'medium',
      'collector_sessions',
      gen_random_uuid(),
      current_profile_id,
      current_user_id
    ),
    (
      'Digital Bin Full Warning',
      'Digital bin DB-ACR-044 is reported at 92% capacity in Accra Metropolitan.',
      'bin_full',
      'medium',
      'digital_bins',
      gen_random_uuid(),
      current_profile_id,
      current_user_id
    ),
    (
      'System Performance Degradation',
      'Increased response time detected for Supabase RPC calls over the last 15 minutes.',
      'performance_degradation',
      'low',
      'system',
      gen_random_uuid(),
      current_profile_id,
      current_user_id
    );

  RAISE NOTICE 'Seeded sample alerts successfully.';
END $$;
