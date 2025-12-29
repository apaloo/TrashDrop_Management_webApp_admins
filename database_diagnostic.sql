-- Database Diagnostic Script
-- Run this in Supabase SQL Editor to check current database state

-- 1. Check if RPC functions exist
SELECT 
    routine_name as function_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
    'update_illegal_dumping_status', 
    'assign_cleanup_team', 
    'get_user_contacts'
)
ORDER BY routine_name;

-- 2. Check if required tables exist
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'illegal_dumping',
    'illegal_dumping_history', 
    'alerts',
    'pickup_requests',
    'contacts'
)
ORDER BY table_name;

-- 3. Check alerts table structure and constraints
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'alerts'
ORDER BY ordinal_position;

-- 4. Check alerts foreign key constraints
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name = 'alerts'
AND tc.table_schema = 'public';

-- 5. Check pickup_requests table structure
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'pickup_requests'
AND column_name IN ('waste_type', 'estimated_volume', 'assigned_to')
ORDER BY ordinal_position;
