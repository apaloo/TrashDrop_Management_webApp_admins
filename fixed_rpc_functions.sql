-- Create missing RPC functions for TrashDrop Admin Portal

-- Drop existing functions first to avoid return type conflicts
DROP FUNCTION IF EXISTS public.get_user_contacts(UUID);
DROP FUNCTION IF EXISTS public.update_illegal_dumping_status(UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS public.assign_cleanup_team(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS public.fetch_illegal_dumping_reports(TEXT, INTEGER, INTEGER);

-- Function to get user contacts
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
    -- If user_id is provided, return contacts for that specific user
    -- Otherwise return all contacts
    IF user_id IS NOT NULL THEN
        RETURN QUERY
        SELECT 
            p.id,
            COALESCE(p.first_name || ' ' || p.last_name, p.email) as name,
            p.email,
            p.phone,
            COALESCE(p.role, 'user') as role,
            COALESCE(p.status, 'active') as status,
            p.created_at,
            p.updated_at
        FROM profiles p
        WHERE p.id = get_user_contacts.user_id;
    ELSE
        RETURN QUERY
        SELECT 
            p.id,
            COALESCE(p.first_name || ' ' || p.last_name, p.email) as name,
            p.email,
            p.phone,
            COALESCE(p.role, 'user') as role,
            COALESCE(p.status, 'active') as status,
            p.created_at,
            p.updated_at
        FROM profiles p
        ORDER BY p.created_at DESC;
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
    UPDATE illegal_dumping_reports
    SET 
        status = new_status,
        updated_at = NOW(),
        updated_by = COALESCE(updated_by_user_id, updated_by)
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
    UPDATE illegal_dumping_reports
    SET 
        assigned_to = collector_id,
        status = CASE 
            WHEN status = 'verified' THEN 'cleanup_scheduled'
            ELSE status
        END,
        updated_at = NOW(),
        updated_by = COALESCE(assigned_by_user_id, updated_by)
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
        r.title,
        r.description,
        r.status,
        COALESCE(r.severity, 'medium') as severity,
        r.location_address,
        r.latitude,
        r.longitude,
        r.reported_by,
        r.assigned_to,
        r.created_at,
        r.updated_at,
        COALESCE(rp.first_name || ' ' || rp.last_name, rp.email, 'Anonymous') as reporter_name,
        COALESCE(ap.first_name || ' ' || ap.last_name, ap.email) as assigned_collector_name
    FROM illegal_dumping_reports r
    LEFT JOIN profiles rp ON r.reported_by = rp.id
    LEFT JOIN profiles ap ON r.assigned_to = ap.id
    WHERE (status_filter IS NULL OR r.status = status_filter)
    ORDER BY r.created_at DESC
    LIMIT limit_count OFFSET offset_count;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_contacts(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_illegal_dumping_status(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_cleanup_team(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_illegal_dumping_reports(TEXT, INTEGER, INTEGER) TO authenticated;

-- Grant execute permissions to anon users for read-only functions
GRANT EXECUTE ON FUNCTION public.get_user_contacts(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.fetch_illegal_dumping_reports(TEXT, INTEGER, INTEGER) TO anon;

-- Force schema cache reload
NOTIFY pgrst, 'reload schema';
