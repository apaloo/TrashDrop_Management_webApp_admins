-- ============================================================================
-- FIX RLS POLICIES FOR illegal_dumping_mobile
-- ============================================================================
-- This script fixes the 400 Bad Request errors by setting proper RLS policies
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.illegal_dumping_mobile;
DROP POLICY IF EXISTS "Allow all for service role" ON public.illegal_dumping_mobile;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.illegal_dumping_mobile;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.illegal_dumping_mobile;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.illegal_dumping_mobile;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.illegal_dumping_mobile;

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

-- Also allow service_role full access (for backend operations)
CREATE POLICY "Allow all for service role"
ON public.illegal_dumping_mobile
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Allow anon users to read (optional - remove if you don't want public access)
CREATE POLICY "Enable read access for anonymous users"
ON public.illegal_dumping_mobile
FOR SELECT
TO anon
USING (true);

-- Verify the policies were created
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename = 'illegal_dumping_mobile'
ORDER BY policyname;
