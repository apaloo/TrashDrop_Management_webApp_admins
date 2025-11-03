-- Fix for the updated_at trigger function
-- This script addresses the "column reference "table_name" is ambiguous" error

-- ============================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all relevant tables
-- Fixed to avoid ambiguous column reference issue
DO $$
DECLARE
    t_name text;
BEGIN
    FOR t_name IN 
        SELECT DISTINCT c.table_name 
        FROM information_schema.columns c
        WHERE c.column_name = 'updated_at' 
        AND c.table_schema = 'public'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS update_%s_updated_at ON %s', t_name, t_name);
        EXECUTE format('CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t_name, t_name);
    END LOOP;
END $$;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Updated_at triggers applied successfully to all relevant tables!';
END $$;
