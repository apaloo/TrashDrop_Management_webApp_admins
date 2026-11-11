-- CORRECTED RPC FUNCTIONS - Fix Column Reference Errors
-- Run this in Supabase SQL Editor to fix the column reference errors

-- 1. Fix get_user_contacts function (remove non-existent columns)
DROP FUNCTION IF EXISTS get_user_contacts(uuid);
DROP FUNCTION IF EXISTS get_user_contacts();

CREATE OR REPLACE FUNCTION get_user_contacts(user_id uuid DEFAULT null)
RETURNS TABLE (
    id uuid,
    name text,
    email text,
    phone text,
    role text,
    status text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
) 
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        COALESCE(
            CASE 
                WHEN p.first_name IS NOT NULL OR p.last_name IS NOT NULL 
                THEN TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, ''))
                ELSE COALESCE(p.email, 'Unknown User')
            END, 'Unknown User'
        ) as name,
        COALESCE(p.email, '') as email,
        COALESCE(p.phone, '') as phone,
        'user' as role, -- Default role since column doesn't exist
        'active' as status, -- Default status since column doesn't exist
        COALESCE(p.created_at, NOW()) as created_at,
        COALESCE(p.updated_at, NOW()) as updated_at
    FROM profiles p
    WHERE (user_id IS NULL OR p.id = user_id)
    ORDER BY p.created_at DESC
    LIMIT 50;
END;
$$;

-- 2. Fix update_illegal_dumping_status function
DROP FUNCTION IF EXISTS update_illegal_dumping_status(uuid, text, uuid);

CREATE OR REPLACE FUNCTION update_illegal_dumping_status(
    report_id uuid,
    new_status text,
    assigned_team_id uuid DEFAULT null
)
RETURNS json
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    result json;
    updated_report record;
BEGIN
    -- Update the illegal dumping report
    UPDATE illegal_dumping 
    SET 
        status = new_status,
        assigned_to = COALESCE(assigned_team_id, assigned_to),
        updated_at = NOW()
    WHERE id = report_id
    RETURNING * INTO updated_report;
    
    -- Check if update was successful
    IF updated_report.id IS NULL THEN
        result := json_build_object(
            'success', false,
            'error', 'Report not found'
        );
    ELSE
        result := json_build_object(
            'success', true,
            'data', row_to_json(updated_report)
        );
    END IF;
    
    RETURN result;
END;
$$;

-- 3. Fix assign_cleanup_team function
DROP FUNCTION IF EXISTS assign_cleanup_team(uuid, uuid);
DROP FUNCTION IF EXISTS assign_cleanup_team(uuid, uuid, text);

CREATE OR REPLACE FUNCTION assign_cleanup_team(
    report_id uuid,
    team_id uuid,
    notes text DEFAULT null
)
RETURNS json
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    result json;
    updated_report record;
BEGIN
    -- Update the illegal dumping report with team assignment
    UPDATE illegal_dumping 
    SET 
        assigned_to = team_id,
        status = CASE 
            WHEN status = 'reported' THEN 'investigating'
            ELSE status
        END,
        updated_at = NOW()
    WHERE id = report_id
    RETURNING * INTO updated_report;
    
    -- Check if update was successful
    IF updated_report.id IS NULL THEN
        result := json_build_object(
            'success', false,
            'error', 'Report not found'
        );
    ELSE
        result := json_build_object(
            'success', true,
            'data', row_to_json(updated_report),
            'message', 'Cleanup team assigned successfully'
        );
    END IF;
    
    RETURN result;
END;
$$;

-- 4. Fix fetch_illegal_dumping_reports function
DROP FUNCTION IF EXISTS fetch_illegal_dumping_reports(text, integer, integer);

CREATE OR REPLACE FUNCTION fetch_illegal_dumping_reports(
    status_filter text DEFAULT null,
    limit_count integer DEFAULT 50,
    offset_count integer DEFAULT 0
)
RETURNS TABLE (
    id uuid,
    location jsonb,
    reporter jsonb,
    status text,
    severity text,
    waste_type text,
    estimated_volume integer,
    description text,
    images text[],
    reported_at timestamp with time zone,
    resolved_at timestamp with time zone,
    assigned_to uuid,
    team_name text
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        jsonb_build_object(
            'address', COALESCE(r.address, 'Address not provided'),
            'coordinates', jsonb_build_object(
                'lat', COALESCE(r.latitude, 0),
                'lng', COALESCE(r.longitude, 0)
            )
        ) as location,
        jsonb_build_object(
            'name', COALESCE(
                CASE 
                    WHEN rp.first_name IS NOT NULL OR rp.last_name IS NOT NULL 
                    THEN TRIM(COALESCE(rp.first_name, '') || ' ' || COALESCE(rp.last_name, ''))
                    ELSE COALESCE(rp.email, 'Anonymous Reporter')
                END, 'Anonymous Reporter'
            ),
            'phone', COALESCE(rp.phone, ''),
            'anonymous', CASE WHEN rp.id IS NULL THEN true ELSE false END
        ) as reporter,
        COALESCE(r.status, 'reported') as status,
        COALESCE(r.severity, 'medium') as severity,
        COALESCE(r.waste_type, 'mixed') as waste_type,
        COALESCE(r.estimated_volume, 1) as estimated_volume,
        COALESCE(r.description, 'No description provided') as description,
        COALESCE(r.photos, ARRAY[]::text[]) as images,
        COALESCE(r.created_at, NOW()) as reported_at,
        r.resolved_at,
        r.assigned_to,
        CASE 
            WHEN ap.first_name IS NOT NULL OR ap.last_name IS NOT NULL 
            THEN TRIM(COALESCE(ap.first_name, '') || ' ' || COALESCE(ap.last_name, ''))
            ELSE COALESCE(ap.email, NULL)
        END as team_name
    FROM illegal_dumping r
    LEFT JOIN profiles rp ON r.reported_by = rp.id
    LEFT JOIN profiles ap ON r.assigned_to = ap.id
    WHERE (status_filter IS NULL OR r.status = status_filter)
    ORDER BY r.created_at DESC
    LIMIT limit_count
    OFFSET offset_count;
END;
$$;

-- Grant execute permissions to all roles
GRANT EXECUTE ON FUNCTION get_user_contacts(uuid) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION update_illegal_dumping_status(uuid, text, uuid) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION assign_cleanup_team(uuid, uuid, text) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fetch_illegal_dumping_reports(text, integer, integer) TO PUBLIC, anon, authenticated;

-- Force PostgREST schema reload
NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst', 'reload schema');

-- Test the corrected functions
SELECT 'Functions updated successfully! Testing...' as status;
