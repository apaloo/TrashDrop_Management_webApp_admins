-- FINAL CONSOLIDATED DATABASE FIX for TrashDrop Admin Portal
-- THIS FILE MUST BE EXECUTED IN SUPABASE SQL EDITOR TO RESOLVE ALL RUNTIME ERRORS
-- Run this ENTIRE script in your Supabase project SQL Editor

-- ============================================================================
-- 1. VERIFY AND STANDARDIZE TABLE NAMES
-- ============================================================================

-- First check which table actually exists - illegal_dumping or illegal_dumping_reports
DO $$
DECLARE
    illegal_dumping_exists BOOLEAN;
    illegal_dumping_reports_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'illegal_dumping'
    ) INTO illegal_dumping_exists;
    
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'illegal_dumping_reports'
    ) INTO illegal_dumping_reports_exists;
    
    -- Create the illegal_dumping table if neither table exists
    IF NOT illegal_dumping_exists AND NOT illegal_dumping_reports_exists THEN
        CREATE TABLE public.illegal_dumping (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            title TEXT,
            description TEXT,
            status TEXT DEFAULT 'reported',
            severity TEXT DEFAULT 'medium',
            location_address TEXT,
            latitude DECIMAL(10,8),
            longitude DECIMAL(11,8),
            reported_by UUID,
            assigned_to UUID,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            resolved_at TIMESTAMPTZ,
            photos TEXT[],
            waste_type TEXT,
            estimated_volume DECIMAL(10,2)
        );
        
        RAISE NOTICE 'Created illegal_dumping table';
    
    -- If illegal_dumping_reports exists but illegal_dumping doesn't, create illegal_dumping as a view to illegal_dumping_reports
    ELSIF NOT illegal_dumping_exists AND illegal_dumping_reports_exists THEN
        EXECUTE 'CREATE OR REPLACE VIEW public.illegal_dumping AS SELECT * FROM public.illegal_dumping_reports';
        RAISE NOTICE 'Created view illegal_dumping pointing to illegal_dumping_reports';
    
    -- If illegal_dumping exists but illegal_dumping_reports doesn't, create illegal_dumping_reports as a view to illegal_dumping
    ELSIF illegal_dumping_exists AND NOT illegal_dumping_reports_exists THEN
        EXECUTE 'CREATE OR REPLACE VIEW public.illegal_dumping_reports AS SELECT * FROM public.illegal_dumping';
        RAISE NOTICE 'Created view illegal_dumping_reports pointing to illegal_dumping';
    
    -- If both exist, do nothing
    ELSE
        RAISE NOTICE 'Both illegal_dumping and illegal_dumping_reports already exist';
    END IF;
END $$;

-- ============================================================================
-- 2. ENSURE PROFILES TABLE EXISTS
-- ============================================================================

-- Create profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'user',
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. FIX FOREIGN KEY RELATIONSHIPS (Resolves PGRST200 errors)
-- ============================================================================

-- Fix illegal_dumping table foreign key relationships
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'illegal_dumping' AND table_schema = 'public') THEN
        -- Drop existing constraints if they exist
        ALTER TABLE public.illegal_dumping 
        DROP CONSTRAINT IF EXISTS illegal_dumping_reported_by_fkey;
        
        ALTER TABLE public.illegal_dumping 
        DROP CONSTRAINT IF EXISTS illegal_dumping_assigned_to_fkey;
        
        -- Add constraints with profiles table
        ALTER TABLE public.illegal_dumping 
        ADD CONSTRAINT illegal_dumping_reported_by_profiles_fkey 
        FOREIGN KEY (reported_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
        
        ALTER TABLE public.illegal_dumping 
        ADD CONSTRAINT illegal_dumping_assigned_to_profiles_fkey 
        FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;
        
        RAISE NOTICE 'Foreign key constraints added to illegal_dumping table';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'illegal_dumping_reports' AND table_schema = 'public') THEN
        -- Drop existing constraints if they exist
        ALTER TABLE public.illegal_dumping_reports 
        DROP CONSTRAINT IF EXISTS illegal_dumping_reports_reported_by_fkey;
        
        ALTER TABLE public.illegal_dumping_reports 
        DROP CONSTRAINT IF EXISTS illegal_dumping_reports_assigned_to_fkey;
        
        -- Add constraints with profiles table
        ALTER TABLE public.illegal_dumping_reports 
        ADD CONSTRAINT illegal_dumping_reports_reported_by_profiles_fkey 
        FOREIGN KEY (reported_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
        
        ALTER TABLE public.illegal_dumping_reports 
        ADD CONSTRAINT illegal_dumping_reports_assigned_to_profiles_fkey 
        FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;
        
        RAISE NOTICE 'Foreign key constraints added to illegal_dumping_reports table';
    END IF;
END $$;

-- Fix alerts table foreign keys
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'alerts' AND table_schema = 'public') THEN
        -- Drop existing constraint if it exists
        ALTER TABLE public.alerts 
        DROP CONSTRAINT IF EXISTS alerts_created_by_fkey;
        
        -- Add constraint with profiles table
        ALTER TABLE public.alerts 
        ADD CONSTRAINT alerts_created_by_profiles_fkey 
        FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
        
        RAISE NOTICE 'Foreign key constraints added to alerts table';
    END IF;
END $$;

-- Fix pickup_requests table foreign keys  
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pickup_requests' AND table_schema = 'public') THEN
        -- Drop existing constraint if it exists
        ALTER TABLE public.pickup_requests 
        DROP CONSTRAINT IF EXISTS pickup_requests_assigned_to_fkey;
        
        -- Add constraint with profiles table
        ALTER TABLE public.pickup_requests 
        ADD CONSTRAINT pickup_requests_assigned_to_profiles_fkey 
        FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;
        
        RAISE NOTICE 'Foreign key constraints added to pickup_requests table';
    END IF;
END $$;

-- ============================================================================
-- 4. ADD MISSING COLUMNS
-- ============================================================================

-- Add estimated_volume to illegal_dumping if missing
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'illegal_dumping' AND table_schema = 'public') 
       AND NOT EXISTS (
           SELECT 1 FROM information_schema.columns 
           WHERE table_name = 'illegal_dumping' AND column_name = 'estimated_volume' AND table_schema = 'public'
       ) THEN
        ALTER TABLE public.illegal_dumping 
        ADD COLUMN estimated_volume DECIMAL(10,2);
        
        RAISE NOTICE 'Added estimated_volume column to illegal_dumping table';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'illegal_dumping_reports' AND table_schema = 'public') 
       AND NOT EXISTS (
           SELECT 1 FROM information_schema.columns 
           WHERE table_name = 'illegal_dumping_reports' AND column_name = 'estimated_volume' AND table_schema = 'public'
       ) THEN
        ALTER TABLE public.illegal_dumping_reports 
        ADD COLUMN estimated_volume DECIMAL(10,2);
        
        RAISE NOTICE 'Added estimated_volume column to illegal_dumping_reports table';
    END IF;
END $$;

-- Add assigned_to to pickup_requests if missing
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pickup_requests' AND table_schema = 'public') 
       AND NOT EXISTS (
           SELECT 1 FROM information_schema.columns 
           WHERE table_name = 'pickup_requests' AND column_name = 'assigned_to' AND table_schema = 'public'
       ) THEN
        ALTER TABLE public.pickup_requests 
        ADD COLUMN assigned_to UUID;
        
        RAISE NOTICE 'Added assigned_to column to pickup_requests table';
    END IF;
END $$;

-- ============================================================================
-- 5. CREATE MISSING RPC FUNCTIONS (Resolves 404 errors)
-- ============================================================================

-- Drop existing functions first to avoid return type conflicts
DROP FUNCTION IF EXISTS public.get_user_contacts(UUID);
DROP FUNCTION IF EXISTS public.update_illegal_dumping_status(UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS public.assign_cleanup_team(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS public.fetch_illegal_dumping_reports(TEXT, INTEGER, INTEGER);

-- Function to get user contacts (CRITICAL - fixes 404 errors)
CREATE OR REPLACE FUNCTION public.get_user_contacts(user_id UUID DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    name TEXT,
    email TEXT,
    phone TEXT,
    role TEXT,
    status TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) 
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    -- Return contacts from profiles table
    IF user_id IS NOT NULL THEN
        RETURN QUERY
        SELECT 
            p.id,
            COALESCE(p.first_name || ' ' || p.last_name, p.email, 'Unknown User') as name,
            COALESCE(p.email, '') as email,
            COALESCE(p.phone, '') as phone,
            COALESCE(p.role, 'user') as role,
            COALESCE(p.status, 'active') as status,
            COALESCE(p.created_at, NOW()) as created_at,
            COALESCE(p.updated_at, NOW()) as updated_at
        FROM profiles p
        WHERE p.id = get_user_contacts.user_id;
    ELSE
        RETURN QUERY
        SELECT 
            p.id,
            COALESCE(p.first_name || ' ' || p.last_name, p.email, 'Unknown User') as name,
            COALESCE(p.email, '') as email,
            COALESCE(p.phone, '') as phone,
            COALESCE(p.role, 'user') as role,
            COALESCE(p.status, 'active') as status,
            COALESCE(p.created_at, NOW()) as created_at,
            COALESCE(p.updated_at, NOW()) as updated_at
        FROM profiles p
        ORDER BY p.created_at DESC
        LIMIT 50;
    END IF;
END;
$$;

-- Create functions that work with both table names
DO $$
DECLARE
    illegal_dumping_exists BOOLEAN;
    illegal_dumping_reports_exists BOOLEAN;
    target_table TEXT;
BEGIN
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'illegal_dumping'
    ) INTO illegal_dumping_exists;
    
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'illegal_dumping_reports'
    ) INTO illegal_dumping_reports_exists;
    
    -- Determine which table to use in functions
    IF illegal_dumping_exists THEN
        target_table := 'illegal_dumping';
    ELSIF illegal_dumping_reports_exists THEN
        target_table := 'illegal_dumping_reports';
    ELSE
        target_table := 'illegal_dumping'; -- Default if neither exists
    END IF;
    
    -- Function to update illegal dumping status
    EXECUTE format('
    CREATE OR REPLACE FUNCTION public.update_illegal_dumping_status(
        report_id UUID,
        new_status TEXT,
        updated_by_user_id UUID DEFAULT NULL
    )
    RETURNS JSON
    LANGUAGE plpgsql SECURITY DEFINER
    AS $func$
    DECLARE
        result JSON;
        report_record RECORD;
    BEGIN
        -- Validate status
        IF new_status NOT IN (''reported'', ''verified'', ''cleanup_scheduled'', ''cleanup_in_progress'', ''resolved'') THEN
            RETURN json_build_object(
                ''success'', false,
                ''error'', ''Invalid status provided''
            );
        END IF;

        -- Update the report
        UPDATE public.%I
        SET 
            status = new_status,
            updated_at = NOW()
        WHERE id = report_id
        RETURNING * INTO report_record;

        -- Check if update was successful
        IF NOT FOUND THEN
            RETURN json_build_object(
                ''success'', false,
                ''error'', ''Report not found''
            );
        END IF;

        -- Return success with updated record
        RETURN json_build_object(
            ''success'', true,
            ''data'', row_to_json(report_record)
        );
    END;
    $func$;
    ', target_table);
    
    -- Function to assign cleanup team
    EXECUTE format('
    CREATE OR REPLACE FUNCTION public.assign_cleanup_team(
        report_id UUID,
        collector_id UUID,
        assigned_by_user_id UUID DEFAULT NULL
    )
    RETURNS JSON
    LANGUAGE plpgsql SECURITY DEFINER
    AS $func$
    DECLARE
        result JSON;
        report_record RECORD;
    BEGIN
        -- Update the report with assigned collector
        UPDATE public.%I
        SET 
            assigned_to = collector_id,
            status = CASE 
                WHEN status = ''verified'' THEN ''cleanup_scheduled''
                ELSE status
            END,
            updated_at = NOW()
        WHERE id = report_id
        RETURNING * INTO report_record;

        -- Check if update was successful
        IF NOT FOUND THEN
            RETURN json_build_object(
                ''success'', false,
                ''error'', ''Report not found''
            );
        END IF;

        -- Return success with updated record
        RETURN json_build_object(
            ''success'', true,
            ''data'', row_to_json(report_record)
        );
    END;
    $func$;
    ', target_table);
    
    -- Function to fetch illegal dumping reports with filtering
    EXECUTE format('
    CREATE OR REPLACE FUNCTION public.fetch_illegal_dumping_reports(
        status_filter TEXT DEFAULT NULL,
        limit_count INTEGER DEFAULT 50,
        offset_count INTEGER DEFAULT 0
    )
    RETURNS TABLE (
        id UUID,
        title TEXT,
        description TEXT,
        status TEXT,
        severity TEXT,
        location_address TEXT,
        latitude DECIMAL,
        longitude DECIMAL,
        reported_by UUID,
        assigned_to UUID,
        created_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ,
        reporter_name TEXT,
        assigned_collector_name TEXT
    ) 
    LANGUAGE plpgsql SECURITY DEFINER
    AS $func$
    BEGIN
        RETURN QUERY
        SELECT 
            r.id,
            COALESCE(r.title, ''Illegal Dumping Report'') as title,
            COALESCE(r.description, ''No description'') as description,
            COALESCE(r.status, ''reported'') as status,
            COALESCE(r.severity, ''medium'') as severity,
            COALESCE(r.location_address, ''Unknown location'') as location_address,
            r.latitude,
            r.longitude,
            r.reported_by,
            r.assigned_to,
            COALESCE(r.created_at, NOW()) as created_at,
            COALESCE(r.updated_at, NOW()) as updated_at,
            COALESCE(rp.first_name || '' '' || rp.last_name, rp.email, ''Anonymous'') as reporter_name,
            COALESCE(ap.first_name || '' '' || ap.last_name, ap.email) as assigned_collector_name
        FROM public.%I r
        LEFT JOIN profiles rp ON r.reported_by = rp.id
        LEFT JOIN profiles ap ON r.assigned_to = ap.id
        WHERE (status_filter IS NULL OR r.status = status_filter)
        ORDER BY r.created_at DESC
        LIMIT limit_count OFFSET offset_count;
    END;
    $func$;
    ', target_table);
    
    RAISE NOTICE 'Created RPC functions using target table: %', target_table;
END $$;

-- ============================================================================
-- 6. GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_contacts(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_illegal_dumping_status(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_cleanup_team(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_illegal_dumping_reports(TEXT, INTEGER, INTEGER) TO authenticated;

-- Grant execute permissions to anon users for read-only functions
GRANT EXECUTE ON FUNCTION public.get_user_contacts(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.fetch_illegal_dumping_reports(TEXT, INTEGER, INTEGER) TO anon;

-- Grant table permissions - only grant if the tables exist
DO $$
BEGIN
    -- profiles table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles' AND table_schema = 'public') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
        GRANT SELECT ON public.profiles TO anon;
    END IF;
    
    -- illegal_dumping table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'illegal_dumping' AND table_schema = 'public') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON public.illegal_dumping TO authenticated;
        GRANT SELECT ON public.illegal_dumping TO anon;
    END IF;
    
    -- illegal_dumping_reports table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'illegal_dumping_reports' AND table_schema = 'public') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON public.illegal_dumping_reports TO authenticated;
        GRANT SELECT ON public.illegal_dumping_reports TO anon;
    END IF;
    
    -- alerts table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'alerts' AND table_schema = 'public') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerts TO authenticated;
        GRANT SELECT ON public.alerts TO anon;
    END IF;
    
    -- pickup_requests table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pickup_requests' AND table_schema = 'public') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON public.pickup_requests TO authenticated;
        GRANT SELECT ON public.pickup_requests TO anon;
    END IF;
END $$;

-- ============================================================================
-- 7. FORCE SCHEMA RELOAD
-- ============================================================================

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

-- Also refresh the connection
SELECT pg_reload_conf();

-- Success message
SELECT 'TrashDrop Admin Portal database fix applied successfully!' as status;
