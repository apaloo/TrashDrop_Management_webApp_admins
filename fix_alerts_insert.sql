-- ============================================================================
-- 5. CREATE SAMPLE ALERTS DATA (CORRECTED)
-- ============================================================================

-- First, let's check the actual structure of the alerts table
DO $$
DECLARE
    column_exists BOOLEAN;
BEGIN
    -- Check if 'type' column exists
    SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'alerts' AND column_name = 'type'
    ) INTO column_exists;
    
    -- If type column doesn't exist, we'll need to use severity or priority instead
    IF column_exists THEN
        -- Type column exists, use the original insert
        EXECUTE 'INSERT INTO alerts (title, description, type, created_by, entity_type)
                SELECT 
                    ''System Alert'',
                    ''Sample alert for dashboard display'',
                    ''info'',
                    auth.uid(),
                    ''system''
                WHERE NOT EXISTS (SELECT 1 FROM alerts)
                ON CONFLICT DO NOTHING;';
    ELSE
        -- Attempt different column names that might exist
        -- First check if severity column exists
        SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'alerts' AND column_name = 'severity'
        ) INTO column_exists;
        
        IF column_exists THEN
            -- Use severity column instead
            EXECUTE 'INSERT INTO alerts (title, description, severity, created_by, entity_type)
                    SELECT 
                        ''System Alert'',
                        ''Sample alert for dashboard display'',
                        ''info'',
                        auth.uid(),
                        ''system''
                    WHERE NOT EXISTS (SELECT 1 FROM alerts)
                    ON CONFLICT DO NOTHING;';
        ELSE
            -- Try without the type/severity column
            EXECUTE 'INSERT INTO alerts (title, description, created_by, entity_type)
                    SELECT 
                        ''System Alert'',
                        ''Sample alert for dashboard display'',
                        auth.uid(),
                        ''system''
                    WHERE NOT EXISTS (SELECT 1 FROM alerts)
                    ON CONFLICT DO NOTHING;';
        END IF;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Fall back to basic insert with only required columns
    BEGIN
        EXECUTE 'INSERT INTO alerts (title, description)
                SELECT 
                    ''System Alert'',
                    ''Sample alert for dashboard display''
                WHERE NOT EXISTS (SELECT 1 FROM alerts)
                ON CONFLICT DO NOTHING;';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not insert sample alerts data. Please check alerts table structure.';
    END;
END $$;
