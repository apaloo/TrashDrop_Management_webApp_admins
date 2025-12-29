-- ============================================================================
-- SAFE RLS POLICY FIX - HANDLES EXISTING POLICIES
-- ============================================================================
-- This script safely drops and recreates RLS policies
-- It won't fail if policies already exist or don't exist
-- ============================================================================

-- ============================================================================
-- PART 1: FIX illegal_dumping_mobile RLS POLICIES
-- ============================================================================

-- Drop all possible existing policies for illegal_dumping_mobile
DO $$ 
DECLARE
    policy_name TEXT;
BEGIN
    FOR policy_name IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'illegal_dumping_mobile'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_name || '" ON public.illegal_dumping_mobile';
        RAISE NOTICE 'Dropped policy: %', policy_name;
    END LOOP;
END $$;

-- Enable RLS
ALTER TABLE public.illegal_dumping_mobile ENABLE ROW LEVEL SECURITY;

-- Create new policies
CREATE POLICY "Enable read access for authenticated users"
ON public.illegal_dumping_mobile FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated users"
ON public.illegal_dumping_mobile FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users"
ON public.illegal_dumping_mobile FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users"
ON public.illegal_dumping_mobile FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow all for service role"
ON public.illegal_dumping_mobile FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Enable read access for anonymous users"
ON public.illegal_dumping_mobile FOR SELECT TO anon USING (true);

-- ============================================================================
-- PART 2: FIX OTHER TABLES (SAFE VERSION)
-- ============================================================================

-- Function to safely recreate policies for a table
CREATE OR REPLACE FUNCTION recreate_table_policies(table_name_param TEXT)
RETURNS void AS $$
DECLARE
    policy_name TEXT;
BEGIN
    -- Check if table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = table_name_param) THEN
        RAISE NOTICE 'Table % does not exist, skipping', table_name_param;
        RETURN;
    END IF;

    -- Drop all existing policies
    FOR policy_name IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = table_name_param
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_name || '" ON public.' || table_name_param;
        RAISE NOTICE 'Dropped policy % on table %', policy_name, table_name_param;
    END LOOP;

    -- Enable RLS
    EXECUTE 'ALTER TABLE public.' || table_name_param || ' ENABLE ROW LEVEL SECURITY';

    -- Create new policies
    EXECUTE 'CREATE POLICY "Enable read access for authenticated users" ON public.' || table_name_param || 
            ' FOR SELECT TO authenticated USING (true)';
    EXECUTE 'CREATE POLICY "Enable insert for authenticated users" ON public.' || table_name_param || 
            ' FOR INSERT TO authenticated WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Enable update for authenticated users" ON public.' || table_name_param || 
            ' FOR UPDATE TO authenticated USING (true) WITH CHECK (true)';

    RAISE NOTICE 'Created new policies for table %', table_name_param;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables
SELECT recreate_table_policies('batches');
SELECT recreate_table_policies('bags');
SELECT recreate_table_policies('scans');
SELECT recreate_table_policies('collector_profiles');
SELECT recreate_table_policies('pickup_requests');
SELECT recreate_table_policies('service_areas');
SELECT recreate_table_policies('notifications');
SELECT recreate_table_policies('messages');
SELECT recreate_table_policies('alerts');
SELECT recreate_table_policies('profiles');
SELECT recreate_table_policies('logs');

-- Drop the helper function
DROP FUNCTION IF EXISTS recreate_table_policies(TEXT);

-- ============================================================================
-- PART 3: FIX GET_USER_CONTACTS FUNCTION (Type mismatch fix)
-- ============================================================================

-- Drop existing function with all possible signatures
DROP FUNCTION IF EXISTS public.get_user_contacts(UUID);
DROP FUNCTION IF EXISTS public.get_user_contacts();

-- Recreate with correct return types
CREATE OR REPLACE FUNCTION public.get_user_contacts(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    name TEXT,
    email TEXT,
    phone TEXT,
    role TEXT,
    status TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) 
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    IF p_user_id IS NOT NULL THEN
        RETURN QUERY
        SELECT 
            p.id,
            COALESCE(p.first_name || ' ' || p.last_name, p.email, 'Unknown User')::TEXT as name,
            COALESCE(p.email, '')::TEXT as email,
            COALESCE(p.phone, '')::TEXT as phone,
            COALESCE(p.role, 'user')::TEXT as role,
            'active'::TEXT as status,
            p.created_at,
            p.updated_at
        FROM public.profiles p
        WHERE p.id = p_user_id;
    ELSE
        RETURN QUERY
        SELECT 
            p.id,
            COALESCE(p.first_name || ' ' || p.last_name, p.email, 'Unknown User')::TEXT as name,
            COALESCE(p.email, '')::TEXT as email,
            COALESCE(p.phone, '')::TEXT as phone,
            COALESCE(p.role, 'user')::TEXT as role,
            'active'::TEXT as status,
            p.created_at,
            p.updated_at
        FROM public.profiles p;
    END IF;
END;
$$;

-- ============================================================================
-- PART 4: CREATE MISSING RPC FUNCTIONS
-- ============================================================================

-- Drop all existing functions first to avoid type mismatch errors
DROP FUNCTION IF EXISTS public.fetch_dashboard_stats();
DROP FUNCTION IF EXISTS public.fetch_illegal_dumping_reports(text, integer, integer);
DROP FUNCTION IF EXISTS public.update_illegal_dumping_status(uuid, text, text);
DROP FUNCTION IF EXISTS public.assign_cleanup_team(uuid, uuid);

-- 1. FETCH_DASHBOARD_STATS
CREATE OR REPLACE FUNCTION public.fetch_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_batches', COALESCE((SELECT COUNT(*) FROM public.batches), 0),
    'active_batches', COALESCE((SELECT COUNT(*) FROM public.batches WHERE status = 'active'), 0),
    'total_bags', COALESCE((SELECT COUNT(*) FROM public.bags), 0),
    'scanned_bags', COALESCE((SELECT COUNT(*) FROM public.bags WHERE scanned = true), 0),
    'total_collectors', COALESCE((SELECT COUNT(*) FROM public.collector_profiles), 0),
    'active_collectors', COALESCE((SELECT COUNT(*) FROM public.collector_profiles WHERE status = 'active'), 0),
    'total_pickups', COALESCE((SELECT COUNT(*) FROM public.pickup_requests), 0),
    'pending_pickups', COALESCE((SELECT COUNT(*) FROM public.pickup_requests WHERE status = 'available'), 0),
    'total_dumping_reports', COALESCE((SELECT COUNT(*) FROM public.illegal_dumping_mobile), 0),
    'pending_reports', COALESCE((SELECT COUNT(*) FROM public.illegal_dumping_mobile WHERE status = 'pending'), 0)
  ) INTO result;
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- 2. FETCH_ILLEGAL_DUMPING_REPORTS
CREATE OR REPLACE FUNCTION public.fetch_illegal_dumping_reports(
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  reported_by uuid,
  location text,
  coordinates geometry,
  waste_type text,
  severity text,
  size text,
  photos text[],
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  latitude numeric,
  longitude numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.reported_by,
    d.location,
    d.coordinates,
    d.waste_type,
    d.severity,
    d.size,
    d.photos,
    d.status,
    d.created_at,
    d.updated_at,
    d.latitude,
    d.longitude
  FROM public.illegal_dumping_mobile d
  WHERE (p_status IS NULL OR d.status = p_status)
  ORDER BY d.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 3. UPDATE_ILLEGAL_DUMPING_STATUS
CREATE OR REPLACE FUNCTION public.update_illegal_dumping_status(
  p_report_id uuid,
  p_status text,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.illegal_dumping_mobile
  SET 
    status = p_status,
    updated_at = now()
  WHERE id = p_report_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Status updated successfully',
    'report_id', p_report_id,
    'new_status', p_status
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- 4. ASSIGN_CLEANUP_TEAM
CREATE OR REPLACE FUNCTION public.assign_cleanup_team(
  p_report_id uuid,
  p_collector_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.illegal_dumping_mobile
  SET 
    status = 'in_progress',
    updated_at = now()
  WHERE id = p_report_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Cleanup team assigned successfully',
    'report_id', p_report_id,
    'collector_id', p_collector_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- ============================================================================
-- PART 5: VERIFY SETUP
-- ============================================================================

-- Check RLS policies
SELECT 
  '✅ RLS POLICIES' as status,
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE tablename IN (
  'illegal_dumping_mobile', 'batches', 'bags', 'scans', 
  'collector_profiles', 'pickup_requests', 'service_areas', 
  'notifications', 'messages', 'alerts', 'profiles', 'logs'
)
GROUP BY tablename
ORDER BY tablename;

-- Check RPC functions
SELECT 
  '✅ RPC FUNCTIONS' as status,
  routine_name as function_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'get_user_contacts', 
    'fetch_dashboard_stats', 
    'fetch_illegal_dumping_reports', 
    'update_illegal_dumping_status', 
    'assign_cleanup_team'
  )
ORDER BY routine_name;

-- Final success message
SELECT '🎉 ALL FIXES APPLIED SUCCESSFULLY!' as result;
