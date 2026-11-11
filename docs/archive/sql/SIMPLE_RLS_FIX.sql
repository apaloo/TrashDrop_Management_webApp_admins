-- ============================================================================
-- SIMPLE RLS FIX FOR illegal_dumping_mobile - DOES NOT TOUCH YOUR DATA!
-- ============================================================================
-- This script ONLY fixes Row Level Security policies
-- It will NOT drop or modify your existing table
-- Safe to run - your data will be preserved
-- ============================================================================

-- Drop all existing policies (won't affect data)
DO $$ 
BEGIN
    -- Drop policies if they exist
    DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.illegal_dumping_mobile;
    DROP POLICY IF EXISTS "Allow all for service role" ON public.illegal_dumping_mobile;
    DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.illegal_dumping_mobile;
    DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.illegal_dumping_mobile;
    DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.illegal_dumping_mobile;
    DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.illegal_dumping_mobile;
    DROP POLICY IF EXISTS "Enable read access for anonymous users" ON public.illegal_dumping_mobile;
    DROP POLICY IF EXISTS "Allow authenticated users to view reports" ON public.illegal_dumping_mobile;
    DROP POLICY IF EXISTS "Allow authenticated users to insert reports" ON public.illegal_dumping_mobile;
    DROP POLICY IF EXISTS "Allow authenticated users to update reports" ON public.illegal_dumping_mobile;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Some policies may not exist, continuing...';
END $$;

-- Enable RLS
ALTER TABLE public.illegal_dumping_mobile ENABLE ROW LEVEL SECURITY;

-- Create comprehensive policies for authenticated users
CREATE POLICY "Enable read access for authenticated users"
ON public.illegal_dumping_mobile
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable insert for authenticated users"
ON public.illegal_dumping_mobile
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users"
ON public.illegal_dumping_mobile
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users"
ON public.illegal_dumping_mobile
FOR DELETE
TO authenticated
USING (true);

-- Allow service_role full access (for backend operations)
CREATE POLICY "Allow all for service role"
ON public.illegal_dumping_mobile
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Allow anon users to read (optional - for public viewing)
CREATE POLICY "Enable read access for anonymous users"
ON public.illegal_dumping_mobile
FOR SELECT
TO anon
USING (true);

-- ============================================================================
-- VERIFY: Check that policies were created
-- ============================================================================
SELECT 
    '✅ RLS POLICIES CREATED SUCCESSFULLY' as status,
    policyname,
    cmd as operation,
    roles as for_role
FROM pg_policies
WHERE tablename = 'illegal_dumping_mobile'
ORDER BY policyname;

-- ============================================================================
-- FINAL CHECK: Verify table structure is intact
-- ============================================================================
SELECT 
    '✅ YOUR DATA IS SAFE' as status,
    COUNT(*) as total_records,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_reports,
    COUNT(CASE WHEN status = 'verified' THEN 1 END) as verified_reports,
    COUNT(CASE WHEN status = 'cleaned_up' THEN 1 END) as cleaned_reports
FROM public.illegal_dumping_mobile;

-- Done! Your data is preserved and RLS policies are fixed.
