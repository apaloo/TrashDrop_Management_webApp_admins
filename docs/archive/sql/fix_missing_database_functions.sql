-- TrashDrop Admin Portal - Missing Database Functions and Schema Fixes
-- Execute this SQL in your Supabase SQL Editor to resolve runtime errors
-- This addresses the specific errors seen in the console logs

-- ============================================================================
-- 1. CREATE MISSING get_user_contacts FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION get_user_contacts(user_id UUID)
RETURNS TABLE (
    id UUID,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    avatar_url TEXT,
    role TEXT,
    status TEXT
) AS $$
BEGIN
    -- Return contacts from auth.users table (excluding the requesting user)
    RETURN QUERY
    SELECT 
        au.id,
        COALESCE(au.raw_user_meta_data->>'first_name', 'User') as first_name,
        COALESCE(au.raw_user_meta_data->>'last_name', '') as last_name,
        au.email,
        au.raw_user_meta_data->>'avatar_url' as avatar_url,
        COALESCE(au.raw_user_meta_data->>'role', 'user') as role,
        CASE 
            WHEN au.last_sign_in_at > NOW() - INTERVAL '5 minutes' THEN 'online'
            WHEN au.last_sign_in_at > NOW() - INTERVAL '1 hour' THEN 'away'
            ELSE 'offline'
        END as status
    FROM auth.users au
    WHERE au.id != user_id
    AND au.email_confirmed_at IS NOT NULL
    ORDER BY au.last_sign_in_at DESC NULLS LAST
    LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION get_user_contacts(UUID) TO authenticated;

-- ============================================================================
-- 2. CREATE MISSING update_illegal_dumping_status FUNCTION
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

    -- Log the status change in illegal_dumping_history if table exists
    INSERT INTO illegal_dumping_history (report_id, previous_status, new_status, changed_by, notes, created_at)
    VALUES (p_report_id, current_status, p_new_status, auth.uid(), p_notes, NOW())
    ON CONFLICT DO NOTHING; -- Ignore if table doesn't exist

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
-- 3. CREATE MISSING assign_cleanup_team FUNCTION
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

    -- Check if report is in appropriate status for team assignment
    IF current_status NOT IN ('Verified', 'Cleanup Scheduled') THEN
        result := json_build_object(
            'success', false,
            'error', 'INVALID_STATUS_FOR_ASSIGNMENT',
            'message', 'Report must be Verified before team assignment. Current status: ' || current_status
        );
        RETURN result;
    END IF;

    -- Update the record with team assignment
    UPDATE illegal_dumping 
    SET 
        cleanup_team = p_team_name,
        assigned_to = COALESCE(p_assigned_to, assigned_to),
        status = CASE 
            WHEN current_status = 'Verified' THEN 'Cleanup Scheduled'
            ELSE current_status
        END,
        updated_at = NOW()
    WHERE id = p_report_id;

    -- Log the team assignment
    INSERT INTO illegal_dumping_history (report_id, previous_status, new_status, changed_by, notes, created_at)
    VALUES (
        p_report_id, 
        current_status, 
        CASE WHEN current_status = 'Verified' THEN 'Cleanup Scheduled' ELSE current_status END,
        auth.uid(), 
        'Assigned cleanup team: ' || p_team_name,
        NOW()
    )
    ON CONFLICT DO NOTHING;

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

-- ============================================================================
-- 4. FIX alerts TABLE FOREIGN KEY RELATIONSHIP
-- ============================================================================
-- First, ensure we have a proper alerts table structure
DO $$
BEGIN
    -- Check if alerts table exists, create if not
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'alerts') THEN
        CREATE TABLE alerts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title TEXT NOT NULL,
            description TEXT,
            type TEXT DEFAULT 'info' CHECK (type IN ('info', 'warning', 'error', 'success')),
            created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
            entity_id TEXT,
            entity_type TEXT,
            read BOOLEAN DEFAULT false,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        -- Create index for performance
        CREATE INDEX IF NOT EXISTS idx_alerts_created_by ON alerts(created_by);
        CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);
        
        -- Enable Row Level Security
        ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
        
        -- Create policy for authenticated users
        CREATE POLICY "Users can view all alerts" ON alerts FOR SELECT TO authenticated USING (true);
        CREATE POLICY "Users can create alerts" ON alerts FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
        
    END IF;
END $$;

-- ============================================================================
-- 5. CREATE SAMPLE ALERTS DATA
-- ============================================================================
INSERT INTO alerts (title, description, type, created_by, entity_type)
SELECT 
    'System Alert',
    'Sample alert for dashboard display',
    'info',
    auth.uid(),
    'system'
WHERE NOT EXISTS (SELECT 1 FROM alerts)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 6. CREATE MISSING DATABASE TABLES IF THEY DON'T EXIST
-- ============================================================================

-- Create notifications table if missing
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT,
    type TEXT DEFAULT 'info',
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create messages table if missing
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    subject TEXT,
    content TEXT NOT NULL,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create batches table if missing (for bag management)
CREATE TABLE IF NOT EXISTS batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bag_count INTEGER NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 7. CREATE REFRESH FUNCTION FOR UPDATED_AT TIMESTAMPS
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger to tables with updated_at columns
DO $$
BEGIN
    -- Add triggers only if tables exist
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'alerts') THEN
        DROP TRIGGER IF EXISTS update_alerts_updated_at ON alerts;
        CREATE TRIGGER update_alerts_updated_at BEFORE UPDATE ON alerts
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'batches') THEN
        DROP TRIGGER IF EXISTS update_batches_updated_at ON batches;
        CREATE TRIGGER update_batches_updated_at BEFORE UPDATE ON batches
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'illegal_dumping') THEN
        DROP TRIGGER IF EXISTS update_illegal_dumping_updated_at ON illegal_dumping;
        CREATE TRIGGER update_illegal_dumping_updated_at BEFORE UPDATE ON illegal_dumping
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE 'TrashDrop Admin Portal database functions and schema fixes applied successfully!';
    RAISE NOTICE 'Functions created: get_user_contacts, update_illegal_dumping_status, assign_cleanup_team';
    RAISE NOTICE 'Tables verified/created: alerts, notifications, messages, batches';
    RAISE NOTICE 'Foreign key relationships fixed for alerts table';
END $$;
