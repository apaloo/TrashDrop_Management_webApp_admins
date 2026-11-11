-- TrashDrop Admin Portal - Comprehensive Database Schema Fix
-- Execute this SQL in your Supabase SQL Editor to resolve all runtime errors
-- This addresses the specific errors seen in the console logs

-- ============================================================================
-- 1. FIX BATCHES TABLE
-- ============================================================================
-- First check if batches table exists and drop it if it does
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'batches') THEN
        DROP TABLE IF EXISTS batches CASCADE;
    END IF;
END $$;

-- Create batches table with proper structure
CREATE TABLE batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_number TEXT,
    bag_count INTEGER NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Add RLS policies for batches
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Batches are viewable by authenticated users" ON batches
    FOR SELECT
    TO authenticated
    USING (true);
    
CREATE POLICY "Batches are insertable by authenticated users" ON batches
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- ============================================================================
-- 2. CREATE BAGS TABLE
-- ============================================================================
-- Create bags table if it doesn't exist
CREATE TABLE IF NOT EXISTS bags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
    qr_code TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    scanned BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies for bags
ALTER TABLE bags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bags are viewable by authenticated users" ON bags
    FOR SELECT
    TO authenticated
    USING (true);
    
CREATE POLICY "Bags are insertable by authenticated users" ON bags
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- ============================================================================
-- 3. CREATE SCANS TABLE
-- ============================================================================
-- Create scans table if it doesn't exist
CREATE TABLE IF NOT EXISTS scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bag_id UUID REFERENCES bags(id) ON DELETE CASCADE,
    collector_id UUID REFERENCES auth.users(id),
    location GEOMETRY(Point, 4326),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies for scans
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scans are viewable by authenticated users" ON scans
    FOR SELECT
    TO authenticated
    USING (true);

-- ============================================================================
-- 4. CREATE MISSING get_user_contacts FUNCTION
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
-- 5. CREATE ILLEGAL_DUMPING TABLE AND RELATED FUNCTIONS IF NOT EXISTS
-- ============================================================================
-- Create illegal_dumping table if it doesn't exist
CREATE TABLE IF NOT EXISTS illegal_dumping (
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

-- Add RLS policies for illegal_dumping
ALTER TABLE illegal_dumping ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Illegal dumping reports are viewable by authenticated users" ON illegal_dumping
    FOR SELECT
    TO authenticated
    USING (true);

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

-- Add RLS policies for illegal_dumping_history
ALTER TABLE illegal_dumping_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Illegal dumping history is viewable by authenticated users" ON illegal_dumping_history
    FOR SELECT
    TO authenticated
    USING (true);

-- Create update_illegal_dumping_status function
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

-- Create assign_cleanup_team function
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

-- ============================================================================
-- 6. CREATE ALERTS, NOTIFICATIONS AND MESSAGES TABLES
-- ============================================================================
-- Create alerts table if it doesn't exist
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'info',
    severity TEXT DEFAULT 'medium',
    entity_type TEXT,
    entity_id UUID,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies for alerts
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Alerts are viewable by authenticated users" ON alerts
    FOR SELECT
    TO authenticated
    USING (true);
CREATE POLICY "Alerts are insertable by authenticated users" ON alerts
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

-- Create notifications table if it doesn't exist
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT,
    type TEXT DEFAULT 'info',
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies for notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own notifications" ON notifications
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Create messages table if it doesn't exist
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    subject TEXT,
    content TEXT NOT NULL,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies for messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view messages they sent or received" ON messages
    FOR SELECT
    TO authenticated
    USING (sender_id = auth.uid() OR recipient_id = auth.uid());

-- ============================================================================
-- 7. FETCH ILLEGAL DUMPING REPORTS FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION fetch_illegal_dumping_reports()
RETURNS SETOF illegal_dumping AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM illegal_dumping
    ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION fetch_illegal_dumping_reports() TO authenticated;

-- ============================================================================
-- 8. UPDATED_AT TRIGGER FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all relevant tables
DO $$
DECLARE
    table_name text;
BEGIN
    FOR table_name IN 
        SELECT DISTINCT table_name 
        FROM information_schema.columns 
        WHERE column_name = 'updated_at' 
        AND table_schema = 'public'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS update_%s_updated_at ON %s', table_name, table_name);
        EXECUTE format('CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', table_name, table_name);
    END LOOP;
END $$;

-- ============================================================================
-- 9. INSERT SAMPLE DATA
-- ============================================================================
-- Insert sample alert if none exists
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
-- COMPLETION MESSAGE
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE 'TrashDrop Admin Portal database schema fix applied successfully!';
    RAISE NOTICE 'Tables created/fixed: batches, bags, scans, illegal_dumping, alerts, notifications, messages';
    RAISE NOTICE 'Functions created: get_user_contacts, update_illegal_dumping_status, assign_cleanup_team, fetch_illegal_dumping_reports';
    RAISE NOTICE 'Relationships established: bags->batches, scans->bags';
    RAISE NOTICE 'Updated_at triggers applied to all relevant tables';
END $$;
