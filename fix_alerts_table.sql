-- Fix for the alerts table specifically
-- This script addresses the "column 'created_by' does not exist" error

-- ============================================================================
-- FIX ALERTS TABLE
-- ============================================================================
-- First check if alerts table exists and drop it if it does
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'alerts') THEN
        DROP TABLE IF EXISTS alerts CASCADE;
    END IF;
END $$;

-- Create alerts table with proper structure
CREATE TABLE alerts (
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

-- Enable RLS
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Now create the policies in a separate transaction
DO $$
BEGIN
    -- First drop existing policies if any
    DROP POLICY IF EXISTS "Alerts are viewable by authenticated users" ON alerts;
    DROP POLICY IF EXISTS "Alerts are insertable by authenticated users" ON alerts;
    
    -- Create the select policy
    EXECUTE 'CREATE POLICY "Alerts are viewable by authenticated users" ON alerts
        FOR SELECT
        TO authenticated
        USING (true)';
END $$;

-- Create the insert policy separately to ensure table is fully created
DO $$
BEGIN
    -- Create the insert policy with safer syntax
    EXECUTE 'CREATE POLICY "Alerts are insertable by authenticated users" ON alerts
        FOR INSERT
        TO authenticated
        WITH CHECK (auth.uid() IS NOT DISTINCT FROM created_by)';
END $$;

-- Apply updated_at trigger
DROP TRIGGER IF EXISTS update_alerts_updated_at ON alerts;
CREATE TRIGGER update_alerts_updated_at 
BEFORE UPDATE ON alerts 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- Insert sample alert if none exists
DO $$
DECLARE
    current_user_id UUID;
BEGIN
    -- Try to get a valid user ID
    SELECT id INTO current_user_id FROM auth.users LIMIT 1;
    
    IF current_user_id IS NOT NULL THEN
        INSERT INTO alerts (title, description, type, created_by, entity_type)
        SELECT 
            'System Alert',
            'Sample alert for dashboard display',
            'info',
            current_user_id,
            'system'
        WHERE NOT EXISTS (SELECT 1 FROM alerts)
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Alerts table fixed successfully!';
END $$;
