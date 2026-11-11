-- Fix for missing RPC functions in the TrashDrop Admin Portal

-- Function to update illegal dumping status
CREATE OR REPLACE FUNCTION public.update_illegal_dumping_status(
    p_dumping_id UUID,
    p_status TEXT,
    p_updated_by UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_history_id UUID;
BEGIN
    -- Update the status in the illegal_dumping table
    UPDATE public.illegal_dumping
    SET status = p_status, updated_at = NOW()
    WHERE id = p_dumping_id;
    
    -- Create a history record
    INSERT INTO public.illegal_dumping_history(
        dumping_id,
        status,
        updated_by,
        notes,
        created_at
    )
    VALUES (
        p_dumping_id,
        p_status,
        p_updated_by,
        'Status updated to ' || p_status,
        NOW()
    )
    RETURNING id INTO v_history_id;
    
    RETURN v_history_id;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.update_illegal_dumping_status(UUID, TEXT, UUID) TO authenticated;

-- Function to assign cleanup team to illegal dumping
CREATE OR REPLACE FUNCTION public.assign_cleanup_team(
    p_dumping_id UUID,
    p_team_id UUID,
    p_updated_by UUID,
    p_scheduled_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_history_id UUID;
    v_new_status TEXT;
BEGIN
    -- Determine the new status based on whether a date is provided
    v_new_status := CASE 
        WHEN p_scheduled_date IS NOT NULL THEN 'cleanup_scheduled'
        ELSE 'team_assigned'
    END;
    
    -- Update the illegal_dumping record
    UPDATE public.illegal_dumping
    SET 
        assigned_to = p_team_id,
        status = v_new_status,
        cleanup_scheduled = p_scheduled_date,
        updated_at = NOW()
    WHERE id = p_dumping_id;
    
    -- Create a history record
    INSERT INTO public.illegal_dumping_history(
        dumping_id,
        status,
        updated_by,
        notes,
        created_at
    )
    VALUES (
        p_dumping_id,
        v_new_status,
        p_updated_by,
        'Assigned to cleanup team ' || p_team_id::TEXT || COALESCE(' scheduled for ' || p_scheduled_date::TEXT, ''),
        NOW()
    )
    RETURNING id INTO v_history_id;
    
    RETURN v_history_id;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.assign_cleanup_team(UUID, UUID, UUID, TIMESTAMP WITH TIME ZONE) TO authenticated;

-- Fix for the get_user_contacts function
-- First drop the existing function
DROP FUNCTION IF EXISTS public.get_user_contacts(UUID);

-- Then recreate it with the proper definition
CREATE OR REPLACE FUNCTION public.get_user_contacts(user_id UUID)
RETURNS TABLE(
    contact_id UUID,
    name TEXT,
    email TEXT,
    phone TEXT,
    contact_type TEXT,
    relationship TEXT,
    primary_contact BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id as contact_id,
        c.name,
        c.email,
        c.phone,
        c.contact_type,
        c.relationship,
        c.primary_contact,
        c.created_at
    FROM
        public.contacts c
    WHERE
        c.user_id = get_user_contacts.user_id
    ORDER BY
        c.primary_contact DESC,
        c.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_contacts(UUID) TO authenticated;