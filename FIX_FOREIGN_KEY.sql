-- =============================================================================
-- FIX: Foreign Key Relationship for illegal_dumping_mobile Table
-- =============================================================================
-- 
-- Issue: "Could not find a relationship between 'illegal_dumping_mobile' 
--         and 'reported_by' in the schema cache"
--
-- This SQL adds the missing foreign key constraint so the app can properly
-- join illegal_dumping_mobile with the profiles table.
--
-- Run this in your Supabase SQL Editor
-- =============================================================================

-- Step 1: Check if the profiles table exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles'
    ) THEN
        RAISE EXCEPTION 'profiles table does not exist. Create it first.';
    END IF;
END $$;

-- Step 2: Check if illegal_dumping_mobile table exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'illegal_dumping_mobile'
    ) THEN
        RAISE EXCEPTION 'illegal_dumping_mobile table does not exist';
    END IF;
END $$;

-- Step 3: Check if reported_by column exists in illegal_dumping_mobile
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'illegal_dumping_mobile'
        AND column_name = 'reported_by'
    ) THEN
        RAISE EXCEPTION 'reported_by column does not exist in illegal_dumping_mobile';
    END IF;
END $$;

-- Step 4: Drop existing constraint if it exists (cleanup)
ALTER TABLE IF EXISTS illegal_dumping_mobile 
DROP CONSTRAINT IF EXISTS illegal_dumping_mobile_reported_by_fkey;

-- Step 5: Add the foreign key constraint
ALTER TABLE illegal_dumping_mobile 
ADD CONSTRAINT illegal_dumping_mobile_reported_by_fkey 
FOREIGN KEY (reported_by) 
REFERENCES profiles(id) 
ON DELETE SET NULL  -- If profile deleted, set reported_by to NULL
ON UPDATE CASCADE;  -- If profile ID changes, update reference

-- Step 6: Create index for performance (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_illegal_dumping_mobile_reported_by 
ON illegal_dumping_mobile(reported_by);

-- Step 7: Verify the constraint was created
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

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Foreign key constraint successfully created!';
    RAISE NOTICE '✅ illegal_dumping_mobile.reported_by now references profiles.id';
    RAISE NOTICE '✅ You can now query with joins: profiles:reported_by(...)';
END $$;
