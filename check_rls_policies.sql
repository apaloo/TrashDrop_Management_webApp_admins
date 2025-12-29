-- Check RLS status and policies for illegal_dumping_mobile table

-- 1. Check if RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'illegal_dumping_mobile';

-- 2. Check existing policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'illegal_dumping_mobile';

-- 3. Disable RLS temporarily for testing (ONLY FOR TESTING!)
-- Uncomment the line below to disable RLS:
-- ALTER TABLE public.illegal_dumping_mobile DISABLE ROW LEVEL SECURITY;

-- 4. Or create permissive policies for authenticated users:
-- Uncomment these lines to enable full access for authenticated users:
/*
-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.illegal_dumping_mobile;

-- Enable RLS
ALTER TABLE public.illegal_dumping_mobile ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for authenticated users
CREATE POLICY "Allow all for authenticated users"
ON public.illegal_dumping_mobile
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Also allow for service role (backend operations)
CREATE POLICY "Allow all for service role"
ON public.illegal_dumping_mobile
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
*/
