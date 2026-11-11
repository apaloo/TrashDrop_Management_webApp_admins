-- FINAL COMPREHENSIVE FIX for TrashDrop Admin Portal
-- This addresses ALL remaining database schema issues

-- ============================================================================
-- 1. ADD MISSING FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- Fix illegal_dumping table foreign keys
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'illegal_dumping_reported_by_fkey' 
        AND table_name = 'illegal_dumping'
    ) THEN
        ALTER TABLE public.illegal_dumping 
        ADD CONSTRAINT illegal_dumping_reported_by_fkey 
        FOREIGN KEY (reported_by) REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'illegal_dumping_assigned_to_fkey' 
        AND table_name = 'illegal_dumping'
    ) THEN
        ALTER TABLE public.illegal_dumping 
        ADD CONSTRAINT illegal_dumping_assigned_to_fkey 
        FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Fix alerts table foreign keys (ensure they exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'alerts_created_by_fkey' 
        AND table_name = 'alerts'
    ) THEN
        ALTER TABLE public.alerts 
        ADD CONSTRAINT alerts_created_by_fkey 
        FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================================
-- 2. ADD MISSING COLUMNS TO TABLES
-- ============================================================================

-- Add missing columns to batches table
DO $$
BEGIN
    -- Add batch_name column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'batches' 
        AND column_name = 'batch_name'
    ) THEN
        ALTER TABLE public.batches ADD COLUMN batch_name TEXT;
        
        -- Set default values for existing records
        UPDATE public.batches 
        SET batch_name = 'Batch-' || batch_number 
        WHERE batch_name IS NULL;
    END IF;
END $$;

-- Add missing columns to collectors table  
DO $$
BEGIN
    -- Add vehicle_type column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'collectors' 
        AND column_name = 'vehicle_type'
    ) THEN
        ALTER TABLE public.collectors ADD COLUMN vehicle_type TEXT DEFAULT 'car';
    END IF;

    -- Add vehicle_plate column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'collectors' 
        AND column_name = 'vehicle_plate'
    ) THEN
        ALTER TABLE public.collectors ADD COLUMN vehicle_plate TEXT;
    END IF;

    -- Add vehicle_capacity column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'collectors' 
        AND column_name = 'vehicle_capacity'
    ) THEN
        ALTER TABLE public.collectors ADD COLUMN vehicle_capacity INTEGER DEFAULT 100;
    END IF;

    -- Add current_location column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'collectors' 
        AND column_name = 'current_location'
    ) THEN
        ALTER TABLE public.collectors ADD COLUMN current_location JSONB;
    END IF;

    -- Add profile_image_url column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'collectors' 
        AND column_name = 'profile_image_url'
    ) THEN
        ALTER TABLE public.collectors ADD COLUMN profile_image_url TEXT;
    END IF;
END $$;

-- Add missing columns to pickup_requests table
DO $$
BEGIN
    -- Add service_area_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'pickup_requests' 
        AND column_name = 'service_area_id'
    ) THEN
        ALTER TABLE public.pickup_requests ADD COLUMN service_area_id UUID;
    END IF;
END $$;

-- ============================================================================
-- 3. CLEAN UP AND RECREATE ALL RPC FUNCTIONS
-- ============================================================================

-- Drop existing functions completely
DROP FUNCTION IF EXISTS public.update_illegal_dumping_status CASCADE;
DROP FUNCTION IF EXISTS public.assign_cleanup_team CASCADE;
DROP FUNCTION IF EXISTS public.get_user_contacts CASCADE;
DROP FUNCTION IF EXISTS public.fetch_illegal_dumping_reports CASCADE;

-- Recreate update_illegal_dumping_status function
CREATE OR REPLACE FUNCTION public.update_illegal_dumping_status(
    p_dumping_id UUID,
    p_status TEXT,
    p_updated_by UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated_id UUID;
BEGIN
    -- Update the illegal_dumping record
    UPDATE public.illegal_dumping
    SET 
        status = p_status,
        updated_at = NOW()
    WHERE id = p_dumping_id
    RETURNING id INTO v_updated_id;
    
    -- Create history record if table exists and update was successful
    IF v_updated_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'illegal_dumping_history'
    ) THEN
        INSERT INTO public.illegal_dumping_history(
            report_id,
            new_status,
            changed_by,
            notes,
            created_at
        )
        VALUES (
            p_dumping_id,
            p_status,
            p_updated_by,
            'Status updated to ' || p_status,
            NOW()
        );
    END IF;
    
    RETURN v_updated_id;
END;
$$;

-- Recreate assign_cleanup_team function
CREATE OR REPLACE FUNCTION public.assign_cleanup_team(
    p_dumping_id UUID,
    p_team_id UUID,
    p_updated_by UUID DEFAULT NULL,
    p_scheduled_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated_id UUID;
    v_new_status TEXT;
BEGIN
    v_new_status := CASE 
        WHEN p_scheduled_date IS NOT NULL THEN 'cleanup_scheduled'
        ELSE 'team_assigned'
    END;
    
    -- Update the illegal_dumping record
    UPDATE public.illegal_dumping
    SET 
        assigned_to = p_team_id,
        status = v_new_status,
        updated_at = NOW()
    WHERE id = p_dumping_id
    RETURNING id INTO v_updated_id;
    
    -- Create history record if successful
    IF v_updated_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'illegal_dumping_history'
    ) THEN
        INSERT INTO public.illegal_dumping_history(
            report_id,
            new_status,
            changed_by,
            notes,
            created_at
        )
        VALUES (
            p_dumping_id,
            v_new_status,
            p_updated_by,
            'Assigned cleanup team',
            NOW()
        );
    END IF;
    
    RETURN v_updated_id;
END;
$$;

-- Recreate get_user_contacts function
CREATE OR REPLACE FUNCTION public.get_user_contacts(p_user_id UUID)
RETURNS TABLE(
    id UUID,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    avatar_url TEXT,
    role TEXT,
    status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    -- Return sample contacts from auth.users if possible
    RETURN QUERY
    SELECT 
        au.id,
        COALESCE(au.raw_user_meta_data->>'first_name', split_part(au.email, '@', 1)) as first_name,
        COALESCE(au.raw_user_meta_data->>'last_name', '') as last_name,
        au.email,
        COALESCE(au.raw_user_meta_data->>'avatar_url', '') as avatar_url,
        COALESCE(au.raw_user_meta_data->>'role', 'user') as role,
        CASE 
            WHEN au.last_sign_in_at > NOW() - INTERVAL '5 minutes' THEN 'online'
            WHEN au.last_sign_in_at > NOW() - INTERVAL '1 hour' THEN 'away'
            ELSE 'offline'
        END as status
    FROM auth.users au
    WHERE au.id != p_user_id
    AND au.email_confirmed_at IS NOT NULL
    ORDER BY au.created_at DESC
    LIMIT 10;
    
    -- If no results, return empty
    IF NOT FOUND THEN
        RETURN;
    END IF;
END;
$$;

-- Create fetch_illegal_dumping_reports function (missing RPC)
CREATE OR REPLACE FUNCTION public.fetch_illegal_dumping_reports(
    p_limit INTEGER DEFAULT 10,
    p_offset INTEGER DEFAULT 0,
    p_status TEXT DEFAULT NULL
)
RETURNS TABLE(
    id UUID,
    location TEXT,
    coordinates JSONB,
    waste_type TEXT,
    severity TEXT,
    status TEXT,
    description TEXT,
    images TEXT[],
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    reported_by UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        il.id,
        il.address as location,
        il.location as coordinates,
        il.waste_type,
        il.severity,
        il.status,
        il.description,
        il.images,
        il.created_at,
        il.updated_at,
        il.reported_by
    FROM public.illegal_dumping il
    WHERE (p_status IS NULL OR il.status = p_status)
    ORDER BY il.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- ============================================================================
-- 4. GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.update_illegal_dumping_status(UUID, TEXT, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.assign_cleanup_team(UUID, UUID, UUID, TIMESTAMP WITH TIME ZONE) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_user_contacts(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.fetch_illegal_dumping_reports(INTEGER, INTEGER, TEXT) TO authenticated, anon;

-- ============================================================================
-- 5. FORCE COMPLETE SCHEMA RELOAD
-- ============================================================================

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

-- Also refresh the connection
SELECT pg_reload_conf();
