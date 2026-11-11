-- IMMEDIATE RPC FUNCTION FIX for TrashDrop Admin Portal
-- This addresses the 404/400 errors for RPC functions that exist but aren't accessible

-- ============================================================================
-- 1. DROP AND RECREATE FUNCTIONS WITH PROPER PERMISSIONS
-- ============================================================================

-- Drop existing functions to ensure clean recreation
DROP FUNCTION IF EXISTS public.get_user_contacts(UUID);
DROP FUNCTION IF EXISTS public.update_illegal_dumping_status(UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS public.assign_cleanup_team(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS public.fetch_illegal_dumping_reports(TEXT, INTEGER, INTEGER);

-- ============================================================================
-- 2. RECREATE get_user_contacts FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_contacts(user_id UUID DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    -- Return contacts from profiles table as JSON
    IF user_id IS NOT NULL THEN
        RETURN (
            SELECT COALESCE(json_agg(contacts), '[]'::json)
            FROM (
                SELECT 
                    p.id,
                    COALESCE(p.first_name || ' ' || p.last_name, p.email, 'Unknown') as name,
                    COALESCE(p.email, '') as email,
                    COALESCE(p.phone, '') as phone,
                    COALESCE(p.role, 'user') as role,
                    COALESCE(p.status, 'active') as status,
                    COALESCE(p.created_at, NOW()) as created_at,
                    COALESCE(p.updated_at, NOW()) as updated_at
                FROM profiles p
                WHERE p.id = user_id
                LIMIT 1
            ) contacts
        );
    ELSE
        RETURN (
            SELECT COALESCE(json_agg(contacts), '[]'::json)
            FROM (
                SELECT 
                    p.id,
                    COALESCE(p.first_name || ' ' || p.last_name, p.email, 'Unknown') as name,
                    COALESCE(p.email, '') as email,
                    COALESCE(p.phone, '') as phone,
                    COALESCE(p.role, 'user') as role,
                    COALESCE(p.status, 'active') as status,
                    COALESCE(p.created_at, NOW()) as created_at,
                    COALESCE(p.updated_at, NOW()) as updated_at
                FROM profiles p
                ORDER BY p.created_at DESC
                LIMIT 50
            ) contacts
        );
    END IF;
END;
$$;

-- ============================================================================
-- 3. RECREATE update_illegal_dumping_status FUNCTION
-- ============================================================================

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
    target_table TEXT;
BEGIN
    -- Determine which table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'illegal_dumping' AND table_schema = 'public') THEN
        target_table := 'illegal_dumping';
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'illegal_dumping_reports' AND table_schema = 'public') THEN
        target_table := 'illegal_dumping_reports';
    ELSE
        RETURN json_build_object(
            'success', false,
            'message', 'No illegal dumping table found'
        );
    END IF;

    -- Validate status
    IF new_status NOT IN ('reported', 'verified', 'cleanup_scheduled', 'cleanup_in_progress', 'resolved') THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Invalid status'
        );
    END IF;
    
    -- Update status using dynamic SQL
    IF target_table = 'illegal_dumping' THEN
        UPDATE public.illegal_dumping
        SET 
            status = new_status,
            updated_at = NOW(),
            resolved_at = CASE WHEN new_status = 'resolved' THEN NOW() ELSE resolved_at END
        WHERE id = report_id;
    ELSE
        UPDATE public.illegal_dumping_reports
        SET 
            status = new_status,
            updated_at = NOW(),
            resolved_at = CASE WHEN new_status = 'resolved' THEN NOW() ELSE resolved_at END
        WHERE id = report_id;
    END IF;
    
    -- Check if update was successful
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Report not found'
        );
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Status updated successfully'
    );
END;
$$;

-- ============================================================================
-- 4. RECREATE assign_cleanup_team FUNCTION
-- ============================================================================

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
    target_table TEXT;
BEGIN
    -- Determine which table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'illegal_dumping' AND table_schema = 'public') THEN
        target_table := 'illegal_dumping';
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'illegal_dumping_reports' AND table_schema = 'public') THEN
        target_table := 'illegal_dumping_reports';
    ELSE
        RETURN json_build_object(
            'success', false,
            'message', 'No illegal dumping table found'
        );
    END IF;
    
    -- Update assignment using direct SQL
    IF target_table = 'illegal_dumping' THEN
        UPDATE public.illegal_dumping
        SET 
            assigned_to = collector_id,
            updated_at = NOW()
        WHERE id = report_id;
    ELSE
        UPDATE public.illegal_dumping_reports
        SET 
            assigned_to = collector_id,
            updated_at = NOW()
        WHERE id = report_id;
    END IF;
    
    -- Check if update was successful
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Report not found'
        );
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Cleanup team assigned successfully'
    );
END;
$$;

-- ============================================================================
-- 5. RECREATE fetch_illegal_dumping_reports FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fetch_illegal_dumping_reports(
    status_filter TEXT DEFAULT NULL,
    limit_count INTEGER DEFAULT 50,
    offset_count INTEGER DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    target_table TEXT;
BEGIN
    -- Determine which table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'illegal_dumping' AND table_schema = 'public') THEN
        target_table := 'illegal_dumping';
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'illegal_dumping_reports' AND table_schema = 'public') THEN
        target_table := 'illegal_dumping_reports';
    ELSE
        -- Return empty result if no table exists
        RETURN '[]'::json;
    END IF;
    
    -- Fetch data using direct SQL based on target table
    IF target_table = 'illegal_dumping' THEN
        RETURN (
            SELECT COALESCE(json_agg(reports), '[]'::json)
            FROM (
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
                FROM public.illegal_dumping r
                LEFT JOIN profiles rp ON r.reported_by = rp.id
                LEFT JOIN profiles ap ON r.assigned_to = ap.id
                WHERE (status_filter IS NULL OR r.status = status_filter)
                ORDER BY r.created_at DESC
                LIMIT limit_count OFFSET offset_count
            ) reports
        );
    ELSE
        RETURN (
            SELECT COALESCE(json_agg(reports), '[]'::json)
            FROM (
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
                FROM public.illegal_dumping_reports r
                LEFT JOIN profiles rp ON r.reported_by = rp.id
                LEFT JOIN profiles ap ON r.assigned_to = ap.id
                WHERE (status_filter IS NULL OR r.status = status_filter)
                ORDER BY r.created_at DESC
                LIMIT limit_count OFFSET offset_count
            ) reports
        );
    END IF;
END;
$$;

-- ============================================================================
-- 6. GRANT COMPREHENSIVE PERMISSIONS
-- ============================================================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_contacts(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_illegal_dumping_status(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_cleanup_team(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_illegal_dumping_reports(TEXT, INTEGER, INTEGER) TO authenticated;

-- Grant execute permissions to anon users for read-only functions
GRANT EXECUTE ON FUNCTION public.get_user_contacts(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.fetch_illegal_dumping_reports(TEXT, INTEGER, INTEGER) TO anon;

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- ============================================================================
-- 7. VERIFY FUNCTION CREATION
-- ============================================================================

SELECT 'All RPC functions recreated successfully!' as status;

-- List the recreated functions
SELECT 
    routine_name, 
    routine_type,
    data_type as return_type
FROM 
    information_schema.routines 
WHERE 
    routine_schema = 'public' 
    AND routine_type = 'FUNCTION'
    AND routine_name IN (
        'get_user_contacts',
        'update_illegal_dumping_status',
        'assign_cleanup_team',
        'fetch_illegal_dumping_reports'
    )
ORDER BY routine_name;
