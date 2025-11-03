-- =============================================================================
-- REVERSE: Remove Foreign Key Relationship from illegal_dumping_mobile Table
-- =============================================================================
-- 
-- This SQL REVERSES the FIX_FOREIGN_KEY.sql changes
-- Use this if you need to undo the foreign key constraint and index
--
-- Run this in your Supabase SQL Editor to reverse the changes
-- =============================================================================

-- Step 1: Remove the foreign key constraint
ALTER TABLE IF EXISTS illegal_dumping_mobile 
DROP CONSTRAINT IF EXISTS illegal_dumping_mobile_reported_by_fkey;

-- Step 2: Remove the index
DROP INDEX IF EXISTS idx_illegal_dumping_mobile_reported_by;

-- Step 3: Verify the constraint was removed
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name='illegal_dumping_mobile' 
  AND tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name = 'reported_by';
-- Should return 0 rows if successfully removed

-- Step 4: Verify the index was removed
SELECT 
    schemaname,
    tablename,
    indexname
FROM pg_indexes
WHERE tablename = 'illegal_dumping_mobile'
  AND indexname = 'idx_illegal_dumping_mobile_reported_by';
-- Should return 0 rows if successfully removed

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Foreign key constraint removed';
    RAISE NOTICE '✅ Index removed';
    RAISE NOTICE '⚠️  Schema reverted to original state';
    RAISE NOTICE '⚠️  Note: Your app error will return until schema is fixed';
END $$;
