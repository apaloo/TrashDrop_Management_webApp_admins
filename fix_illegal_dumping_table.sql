-- Fix for the illegal_dumping table and related functions
-- This script addresses the "policy already exists" error

-- ============================================================================
-- FIX ILLEGAL_DUMPING TABLE
-- ============================================================================
-- First check if illegal_dumping table exists and drop it if it does
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'illegal_dumping') THEN
        DROP TABLE IF EXISTS illegal_dumping CASCADE;
    END IF;
END $$;

-- Create illegal_dumping table with proper structure
CREATE TABLE illegal_dumping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reported_by UUID REFERENCES auth.users(id),
    assigned_to UUID REFERENCES auth.users(id),
    location GEOMETRY(Point, 4326),
    address TEXT,
    description TEXT,
    waste_type TEXT,
    severity TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'Reported',
    images TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE illegal_dumping ENABLE ROW LEVEL SECURITY;

-- Add policy in a separate transaction
DO $$
BEGIN
    -- Create policy
    EXECUTE 'CREATE POLICY "Illegal dumping reports are viewable by authenticated users" ON illegal_dumping
        FOR SELECT
        TO authenticated
        USING (true)';
END $$;

-- ============================================================================
-- FIX ILLEGAL_DUMPING_HISTORY TABLE
-- ============================================================================
-- Create illegal_dumping_history table if it doesn't exist
CREATE TABLE IF NOT EXISTS illegal_dumping_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES illegal_dumping(id) ON DELETE CASCADE,
    previous_status TEXT,
    new_status TEXT,
    changed_by UUID REFERENCES auth.users(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE illegal_dumping_history ENABLE ROW LEVEL SECURITY;

-- Add policy in a separate transaction
DO $$
BEGIN
    -- Create policy
    EXECUTE 'CREATE POLICY "Illegal dumping history is viewable by authenticated users" ON illegal_dumping_history
        FOR SELECT
        TO authenticated
        USING (true)';
END $$;

-- ============================================================================
-- UPDATE_ILLEGAL_DUMPING_STATUS FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION update_illegal_dumping_status(
    p_report_id UUID,
    p_new_status TEXT,
    p_assigned_to UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    result JSON;
    current_status TEXT;
BEGIN
    -- Validate status values
    IF p_new_status NOT IN ('Reported', 'Verified', 'Cleanup Scheduled', 'In Progress', 'Cleaned Up', 'Rejected') THEN
        result := json_build_object(
            'success', false,
            'error', 'INVALID_STATUS',
            'message', 'Invalid status value: ' || p_new_status
        );
        RETURN result;
    END IF;

    -- Get current status
    SELECT status INTO current_status 
    FROM illegal_dumping 
    WHERE id = p_report_id;

    -- Check if record exists
    IF NOT FOUND THEN
        result := json_build_object(
            'success', false,
            'error', 'REPORT_NOT_FOUND',
            'message', 'Illegal dumping report not found'
        );
        RETURN result;
    END IF;

    -- Update the record
    UPDATE illegal_dumping 
    SET 
        status = p_new_status,
        assigned_to = p_assigned_to,
        updated_at = NOW()
    WHERE id = p_report_id;

    -- Log the status change in illegal_dumping_history
    INSERT INTO illegal_dumping_history (report_id, previous_status, new_status, changed_by, notes, created_at)
    VALUES (p_report_id, current_status, p_new_status, auth.uid(), p_notes, NOW());

    result := json_build_object(
        'success', true,
        'message', 'Status updated successfully',
        'previous_status', current_status,
        'new_status', p_new_status
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION update_illegal_dumping_status(UUID, TEXT, UUID, TEXT) TO authenticated;

-- ============================================================================
-- ASSIGN_CLEANUP_TEAM FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION assign_cleanup_team(
    p_report_id UUID,
    p_team_name TEXT,
    p_assigned_to UUID DEFAULT NULL,
    p_scheduled_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    result JSON;
    current_status TEXT;
BEGIN
    -- Get current status and check if record exists
    SELECT status INTO current_status 
    FROM illegal_dumping 
    WHERE id = p_report_id;

    IF NOT FOUND THEN
        result := json_build_object(
            'success', false,
            'error', 'REPORT_NOT_FOUND',
            'message', 'Illegal dumping report not found'
        );
        RETURN result;
    END IF;

    -- Update the record
    UPDATE illegal_dumping 
    SET 
        assigned_to = p_assigned_to,
        status = CASE 
            WHEN current_status = 'Verified' THEN 'Cleanup Scheduled' 
            ELSE current_status
        END,
        updated_at = NOW()
    WHERE id = p_report_id;

    -- Log the team assignment
    INSERT INTO illegal_dumping_history (
        report_id, 
        previous_status, 
        new_status, 
        changed_by, 
        notes, 
        created_at
    )
    VALUES (
        p_report_id, 
        current_status, 
        CASE WHEN current_status = 'Verified' THEN 'Cleanup Scheduled' ELSE current_status END,
        auth.uid(), 
        'Assigned cleanup team: ' || p_team_name,
        NOW()
    );

    result := json_build_object(
        'success', true,
        'message', 'Cleanup team assigned successfully',
        'team_name', p_team_name,
        'scheduled_date', p_scheduled_date
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION assign_cleanup_team(UUID, TEXT, UUID, TIMESTAMPTZ) TO authenticated;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Illegal dumping table and functions fixed successfully!';
END $$;
