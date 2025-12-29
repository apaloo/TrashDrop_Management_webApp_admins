-- CRITICAL DATABASE FIX for TrashDrop Admin Portal
-- THIS FILE MUST BE EXECUTED IN SUPABASE SQL EDITOR TO RESOLVE ALL RUNTIME ERRORS
-- Run this ENTIRE script in your Supabase project SQL Editor

-- ============================================================================
-- 1. FIX FOREIGN KEY RELATIONSHIPS (Resolves PGRST200 errors)
-- ============================================================================

-- Fix illegal_dumping table foreign key relationships
DO $$
BEGIN
    -- Add foreign key to profiles table instead of auth.users
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'illegal_dumping_reported_by_profiles_fkey' 
        AND table_name = 'illegal_dumping'
    ) THEN
        -- First ensure profiles table exists
        CREATE TABLE IF NOT EXISTS public.profiles (
            id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
            first_name TEXT,
            last_name TEXT,
            email TEXT,
            phone TEXT,
            avatar_url TEXT,
            role TEXT DEFAULT 'user',
            status TEXT DEFAULT 'active',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        -- Add the foreign key constraint
        ALTER TABLE public.illegal_dumping 
        ADD CONSTRAINT illegal_dumping_reported_by_profiles_fkey 
        FOREIGN KEY (reported_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'illegal_dumping_assigned_to_profiles_fkey' 
        AND table_name = 'illegal_dumping'
    ) THEN
        ALTER TABLE public.illegal_dumping 
        ADD CONSTRAINT illegal_dumping_assigned_to_profiles_fkey 
        FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Fix alerts table foreign keys
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'alerts_created_by_profiles_fkey' 
        AND table_name = 'alerts'
    ) THEN
        ALTER TABLE public.alerts 
        ADD CONSTRAINT alerts_created_by_profiles_fkey 
        FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Fix pickup_requests table foreign keys  
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'pickup_requests_assigned_to_profiles_fkey' 
        AND table_name = 'pickup_requests'
    ) THEN
        ALTER TABLE public.pickup_requests 
        ADD CONSTRAINT pickup_requests_assigned_to_profiles_fkey 
        FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================================
-- 2. ADD MISSING COLUMNS
-- ============================================================================

-- Add estimated_volume to illegal_dumping if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'illegal_dumping' 
        AND column_name = 'estimated_volume'
    ) THEN
        ALTER TABLE public.illegal_dumping 
        ADD COLUMN estimated_volume DECIMAL(10,2);
    END IF;
END $$;

-- Add assigned_to to pickup_requests if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pickup_requests' 
        AND column_name = 'assigned_to'
    ) THEN
        ALTER TABLE public.pickup_requests 
        ADD COLUMN assigned_to UUID;
    END IF;
END $$;

-- ============================================================================
-- 3. CREATE MISSING RPC FUNCTIONS (Resolves 404 errors)
-- ============================================================================

-- Function to get user contacts (CRITICAL - fixes 404 errors)
CREATE OR REPLACE FUNCTION public.get_user_contacts(user_id UUID DEFAULT NULL)
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
    IF user_id IS NOT NULL THEN
        RETURN QUERY
        SELECT 
            p.id,
            COALESCE(p.first_name || ' ' || p.last_name, p.email, 'Unknown User') as name,
            COALESCE(p.email, '') as email,
            COALESCE(p.phone, '') as phone,
            COALESCE(p.role, 'user') as role,
            COALESCE(p.status, 'active') as status,
            COALESCE(p.created_at, NOW()) as created_at,
            COALESCE(p.updated_at, NOW()) as updated_at
        FROM profiles p
        WHERE p.id = get_user_contacts.user_id;
    ELSE
        RETURN QUERY
        SELECT 
            p.id,
            COALESCE(p.first_name || ' ' || p.last_name, p.email, 'Unknown User') as name,
            COALESCE(p.email, '') as email,
            COALESCE(p.phone, '') as phone,
            COALESCE(p.role, 'user') as role,
            COALESCE(p.status, 'active') as status,
            COALESCE(p.created_at, NOW()) as created_at,
            COALESCE(p.updated_at, NOW()) as updated_at
        FROM profiles p
        ORDER BY p.created_at DESC
        LIMIT 50;
    END IF;
END;
$$;

-- Function to update illegal dumping status
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
    UPDATE illegal_dumping
    SET 
        status = new_status,
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

-- Function to assign cleanup team
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
    UPDATE illegal_dumping
    SET 
        assigned_to = collector_id,
        status = CASE 
            WHEN status = 'verified' THEN 'cleanup_scheduled'
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

-- Function to fetch illegal dumping reports with filtering
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
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    reporter_name TEXT,
    assigned_collector_name TEXT
) 
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        COALESCE(r.title, 'Illegal Dumping Report') as title,
        COALESCE(r.description, 'No description') as description,
        COALESCE(r.status, 'reported') as status,
        COALESCE(r.severity, 'medium') as severity,
        COALESCE(r.location_address, 'Unknown location') as location_address,
        r.latitude,
        r.longitude,
        r.reported_by,
        r.assigned_to,
        COALESCE(r.created_at, NOW()) as created_at,
        COALESCE(r.updated_at, NOW()) as updated_at,
        COALESCE(rp.first_name || ' ' || rp.last_name, rp.email, 'Anonymous') as reporter_name,
        COALESCE(ap.first_name || ' ' || ap.last_name, ap.email) as assigned_collector_name
    FROM illegal_dumping r
    LEFT JOIN profiles rp ON r.reported_by = rp.id
    LEFT JOIN profiles ap ON r.assigned_to = ap.id
    WHERE (status_filter IS NULL OR r.status = status_filter)
    ORDER BY r.created_at DESC
    LIMIT limit_count OFFSET offset_count;
END;
$$;

-- ============================================================================
-- 4. GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_contacts(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_illegal_dumping_status(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_cleanup_team(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_illegal_dumping_reports(TEXT, INTEGER, INTEGER) TO authenticated;

-- Grant execute permissions to anon users for read-only functions
GRANT EXECUTE ON FUNCTION public.get_user_contacts(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.fetch_illegal_dumping_reports(TEXT, INTEGER, INTEGER) TO anon;

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.illegal_dumping TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pickup_requests TO authenticated;

-- ============================================================================
-- 5. FORCE SCHEMA RELOAD
-- ============================================================================

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

-- Also refresh the connection
SELECT pg_reload_conf();

-- Success message
SELECT 'TrashDrop Admin Portal database fix applied successfully!' as status;
