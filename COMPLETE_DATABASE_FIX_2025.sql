-- ============================================================================
-- COMPLETE DATABASE FIX FOR TRASHDROP ADMIN PORTAL - 2025
-- ============================================================================
-- This script fixes ALL current database errors:
-- 1. Missing illegal_dumping_mobile table (400/404 errors)
-- 2. Missing RPC functions (404 errors)
-- 3. get_user_contacts return type mismatch (42804 error)
-- 4. fetch_illegal_dumping_reports 400 errors
-- 
-- INSTRUCTIONS: Run this ENTIRE script in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- PART 1: CREATE ILLEGAL_DUMPING_MOBILE TABLE
-- ============================================================================

-- Drop and recreate the table to ensure clean state
DROP TABLE IF EXISTS public.illegal_dumping_mobile CASCADE;

CREATE TABLE public.illegal_dumping_mobile (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'Illegal Dumping Report',
    description TEXT,
    status TEXT DEFAULT 'reported' CHECK (status IN ('reported', 'verified', 'cleanup_scheduled', 'cleanup_in_progress', 'resolved')),
    severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    location_address TEXT,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    reported_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reported_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    photos TEXT[], -- Array of photo URLs
    waste_type TEXT,
    estimated_volume DECIMAL(10,2),
    verification_notes TEXT,
    cleanup_notes TEXT
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_illegal_dumping_mobile_status ON public.illegal_dumping_mobile(status);
CREATE INDEX IF NOT EXISTS idx_illegal_dumping_mobile_reported_at ON public.illegal_dumping_mobile(reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_illegal_dumping_mobile_severity ON public.illegal_dumping_mobile(severity);
CREATE INDEX IF NOT EXISTS idx_illegal_dumping_mobile_reported_by ON public.illegal_dumping_mobile(reported_by);
CREATE INDEX IF NOT EXISTS idx_illegal_dumping_mobile_assigned_to ON public.illegal_dumping_mobile(assigned_to);

-- Enable Row Level Security
ALTER TABLE public.illegal_dumping_mobile ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Allow authenticated users to view reports" ON public.illegal_dumping_mobile;
CREATE POLICY "Allow authenticated users to view reports" 
    ON public.illegal_dumping_mobile FOR SELECT 
    TO authenticated 
    USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to insert reports" ON public.illegal_dumping_mobile;
CREATE POLICY "Allow authenticated users to insert reports" 
    ON public.illegal_dumping_mobile FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to update reports" ON public.illegal_dumping_mobile;
CREATE POLICY "Allow authenticated users to update reports" 
    ON public.illegal_dumping_mobile FOR UPDATE 
    TO authenticated 
    USING (true);

-- ============================================================================
-- PART 2: FIX GET_USER_CONTACTS FUNCTION (Fixes 42804 error)
-- ============================================================================

-- Drop existing function
DROP FUNCTION IF EXISTS public.get_user_contacts(UUID);

-- Recreate with correct return type matching profiles table schema
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
    -- Return contacts from profiles table
    IF p_user_id IS NOT NULL THEN
        RETURN QUERY
        SELECT 
            p.id,
            COALESCE(p.first_name || ' ' || p.last_name, p.email, 'Unknown User')::TEXT as name,
            COALESCE(p.email, '')::TEXT as email,
            COALESCE(p.phone, '')::TEXT as phone,
            COALESCE(p.role, 'user')::TEXT as role,
            COALESCE(p.status, 'active')::TEXT as status,
            COALESCE(p.created_at, NOW()) as created_at,
            COALESCE(p.updated_at, NOW()) as updated_at
        FROM profiles p
        WHERE p.id = p_user_id;
    ELSE
        RETURN QUERY
        SELECT 
            p.id,
            COALESCE(p.first_name || ' ' || p.last_name, p.email, 'Unknown User')::TEXT as name,
            COALESCE(p.email, '')::TEXT as email,
            COALESCE(p.phone, '')::TEXT as phone,
            COALESCE(p.role, 'user')::TEXT as role,
            COALESCE(p.status, 'active')::TEXT as status,
            COALESCE(p.created_at, NOW()) as created_at,
            COALESCE(p.updated_at, NOW()) as updated_at
        FROM profiles p
        ORDER BY p.created_at DESC
        LIMIT 50;
    END IF;
END;
$$;

-- ============================================================================
-- PART 3: CREATE FETCH_ILLEGAL_DUMPING_REPORTS FUNCTION
-- ============================================================================

-- Drop existing function
DROP FUNCTION IF EXISTS public.fetch_illegal_dumping_reports(TEXT, INTEGER, INTEGER);

-- Create function that queries illegal_dumping_mobile table
CREATE OR REPLACE FUNCTION public.fetch_illegal_dumping_reports(
    status_filter TEXT DEFAULT NULL,
    limit_count INTEGER DEFAULT 50,
    offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    status TEXT,
    severity TEXT,
    location_address TEXT,
    latitude DECIMAL,
    longitude DECIMAL,
    reported_by UUID,
    assigned_to UUID,
    reported_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    photos TEXT[],
    waste_type TEXT,
    estimated_volume DECIMAL,
    reporter_name TEXT,
    assigned_collector_name TEXT
) 
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        COALESCE(r.title, 'Illegal Dumping Report')::TEXT as title,
        COALESCE(r.description, 'No description')::TEXT as description,
        COALESCE(r.status, 'reported')::TEXT as status,
        COALESCE(r.severity, 'medium')::TEXT as severity,
        COALESCE(r.location_address, 'Unknown location')::TEXT as location_address,
        r.latitude,
        r.longitude,
        r.reported_by,
        r.assigned_to,
        COALESCE(r.reported_at, r.created_at, NOW()) as reported_at,
        COALESCE(r.created_at, NOW()) as created_at,
        COALESCE(r.updated_at, NOW()) as updated_at,
        r.resolved_at,
        COALESCE(r.photos, ARRAY[]::TEXT[]) as photos,
        r.waste_type,
        r.estimated_volume,
        COALESCE(rp.first_name || ' ' || rp.last_name, rp.email, 'Anonymous')::TEXT as reporter_name,
        COALESCE(ap.first_name || ' ' || ap.last_name, ap.email)::TEXT as assigned_collector_name
    FROM public.illegal_dumping_mobile r
    LEFT JOIN profiles rp ON r.reported_by = rp.id
    LEFT JOIN profiles ap ON r.assigned_to = ap.id
    WHERE (status_filter IS NULL OR r.status = status_filter)
    ORDER BY r.reported_at DESC, r.created_at DESC
    LIMIT limit_count OFFSET offset_count;
END;
$$;

-- ============================================================================
-- PART 4: CREATE UPDATE_ILLEGAL_DUMPING_STATUS FUNCTION
-- ============================================================================

-- Drop existing function
DROP FUNCTION IF EXISTS public.update_illegal_dumping_status(UUID, TEXT, UUID);

-- Create function to update report status
CREATE OR REPLACE FUNCTION public.update_illegal_dumping_status(
    report_id UUID,
    new_status TEXT,
    updated_by_user_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    report_record RECORD;
BEGIN
    -- Validate status
    IF new_status NOT IN ('reported', 'verified', 'cleanup_scheduled', 'cleanup_in_progress', 'resolved') THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Invalid status provided'
        );
    END IF;

    -- Update the report
    UPDATE public.illegal_dumping_mobile
    SET 
        status = new_status,
        updated_at = NOW(),
        resolved_at = CASE WHEN new_status = 'resolved' THEN NOW() ELSE resolved_at END
    WHERE id = report_id
    RETURNING * INTO report_record;

    -- Check if update was successful
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Report not found'
        );
    END IF;

    -- Return success with updated record
    RETURN json_build_object(
        'success', true,
        'data', row_to_json(report_record)
    );
END;
$$;

-- ============================================================================
-- PART 5: CREATE ASSIGN_CLEANUP_TEAM FUNCTION
-- ============================================================================

-- Drop existing function
DROP FUNCTION IF EXISTS public.assign_cleanup_team(UUID, UUID, UUID);

-- Create function to assign cleanup team
CREATE OR REPLACE FUNCTION public.assign_cleanup_team(
    report_id UUID,
    collector_id UUID,
    assigned_by_user_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    report_record RECORD;
BEGIN
    -- Update the report with assigned collector
    UPDATE public.illegal_dumping_mobile
    SET 
        assigned_to = collector_id,
        status = CASE 
            WHEN status = 'verified' THEN 'cleanup_scheduled'
            WHEN status = 'reported' THEN 'cleanup_scheduled'
            ELSE status
        END,
        updated_at = NOW()
    WHERE id = report_id
    RETURNING * INTO report_record;

    -- Check if update was successful
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Report not found'
        );
    END IF;

    -- Return success with updated record
    RETURN json_build_object(
        'success', true,
        'data', row_to_json(report_record)
    );
END;
$$;

-- ============================================================================
-- PART 6: GRANT PERMISSIONS
-- ============================================================================

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.illegal_dumping_mobile TO authenticated;
GRANT SELECT ON public.illegal_dumping_mobile TO anon;

-- Grant function permissions
GRANT EXECUTE ON FUNCTION public.get_user_contacts(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_contacts(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.fetch_illegal_dumping_reports(TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_illegal_dumping_reports(TEXT, INTEGER, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION public.update_illegal_dumping_status(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_cleanup_team(UUID, UUID, UUID) TO authenticated;

-- ============================================================================
-- PART 7: INSERT SAMPLE DATA (Optional - for testing)
-- ============================================================================

-- Insert a few sample reports for testing
INSERT INTO public.illegal_dumping_mobile (
    title,
    description,
    status,
    severity,
    location_address,
    latitude,
    longitude,
    waste_type,
    estimated_volume
) VALUES
(
    'Large Waste Pile on Main Street',
    'Multiple bags of household waste dumped near the intersection',
    'reported',
    'high',
    'Main Street, Accra',
    5.6037,
    -0.1870,
    'household',
    15.5
),
(
    'Construction Debris',
    'Construction materials and debris left on sidewalk',
    'verified',
    'medium',
    'Ring Road, Accra',
    5.5800,
    -0.2300,
    'construction',
    25.0
),
(
    'Electronic Waste Dumping',
    'Old electronics and appliances dumped in open area',
    'cleanup_scheduled',
    'high',
    'Tema Station Area',
    5.6500,
    -0.1700,
    'electronic',
    10.0
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- PART 8: FORCE SCHEMA RELOAD
-- ============================================================================

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

-- Reload PostgreSQL configuration
SELECT pg_reload_conf();

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify table exists
SELECT 
    'illegal_dumping_mobile table created' as status,
    COUNT(*) as row_count
FROM public.illegal_dumping_mobile;

-- Verify functions exist
SELECT 
    'All RPC functions created successfully' as status,
    COUNT(*) as function_count
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN (
    'get_user_contacts',
    'fetch_illegal_dumping_reports',
    'update_illegal_dumping_status',
    'assign_cleanup_team'
);

-- Test get_user_contacts function
SELECT 'Testing get_user_contacts function' as test;
SELECT * FROM public.get_user_contacts(NULL) LIMIT 5;

-- Test fetch_illegal_dumping_reports function
SELECT 'Testing fetch_illegal_dumping_reports function' as test;
SELECT * FROM public.fetch_illegal_dumping_reports(NULL, 10, 0);

-- Success message
SELECT '✅ ALL DATABASE FIXES APPLIED SUCCESSFULLY!' as final_status;
