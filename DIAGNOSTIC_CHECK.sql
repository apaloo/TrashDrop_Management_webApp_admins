-- DIAGNOSTIC CHECK - Run this to see what exists in your database
-- Copy results and share them for analysis

-- 1. Check if RPC functions exist
SELECT 
    routine_name,
    routine_type,
    data_type as return_type,
    is_deterministic,
    security_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
    'get_user_contacts',
    'update_illegal_dumping_status', 
    'assign_cleanup_team',
    'fetch_illegal_dumping_reports'
)
ORDER BY routine_name;

-- 2. Check table relationships and foreign keys
SELECT 
    tc.table_name, 
    tc.constraint_name, 
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name IN ('illegal_dumping', 'pickup_requests', 'alerts', 'profiles');

-- 3. Check if tables exist and their type (table vs view)
SELECT 
    table_name,
    table_type,
    is_insertable_into
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'illegal_dumping',
    'illegal_dumping_reports', 
    'profiles',
    'pickup_requests',
    'alerts'
)
ORDER BY table_name;

-- 4. Check columns in critical tables
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN ('illegal_dumping', 'profiles')
AND column_name IN ('id', 'reported_by', 'assigned_to', 'first_name', 'last_name', 'email', 'estimated_volume')
ORDER BY table_name, column_name;

-- 5. Test if we can call the functions (this will show specific error if they exist but have issues)
-- Comment out any that cause errors and run the rest

-- SELECT * FROM get_user_contacts() LIMIT 1;
-- SELECT update_illegal_dumping_status('00000000-0000-0000-0000-000000000000'::uuid, 'test', null);
-- SELECT * FROM fetch_illegal_dumping_reports(null, 1, 0) LIMIT 1;

-- Success message
SELECT 'Diagnostic check completed' as status;
