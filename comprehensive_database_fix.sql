-- Comprehensive Database Fix for TrashDrop Admin Portal
-- This fixes all the remaining database schema issues

-- ============================================================================
-- 1. FIX ALERTS FOREIGN KEY CONSTRAINT
-- ============================================================================

-- Add foreign key constraint for alerts.created_by to reference auth.users(id)
ALTER TABLE public.alerts 
ADD CONSTRAINT alerts_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Also add constraint for the creator column if it should reference users
ALTER TABLE public.alerts 
ADD CONSTRAINT alerts_creator_fkey 
FOREIGN KEY (creator) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================================================
-- 2. ADD MISSING COLUMNS TO PICKUP_REQUESTS (if they don't exist)
-- ============================================================================

-- Add estimated_volume column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'pickup_requests' 
        AND column_name = 'estimated_volume'
    ) THEN
        ALTER TABLE public.pickup_requests 
        ADD COLUMN estimated_volume DECIMAL(10,2);
    END IF;
END $$;

-- Add assigned_to column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'pickup_requests' 
        AND column_name = 'assigned_to'
    ) THEN
        ALTER TABLE public.pickup_requests 
        ADD COLUMN assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================================
-- 3. CLEAN UP DUPLICATE RPC FUNCTIONS
-- ============================================================================

-- Drop any existing versions to avoid confusion
DROP FUNCTION IF EXISTS public.update_illegal_dumping_status(UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS public.assign_cleanup_team(UUID, UUID, UUID, TIMESTAMP WITH TIME ZONE);
DROP FUNCTION IF EXISTS public.get_user_contacts(UUID);

-- ============================================================================
-- 4. RECREATE RPC FUNCTIONS WITH CLEAR SIGNATURES
-- ============================================================================

-- Function to update illegal dumping status
CREATE OR REPLACE FUNCTION public.update_illegal_dumping_status(
    p_dumping_id UUID,
    p_status TEXT,
    p_updated_by UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_history_id UUID;
BEGIN
    -- Update the status in the illegal_dumping table
    UPDATE public.illegal_dumping
    SET status = p_status, updated_at = NOW()
    WHERE id = p_dumping_id;
    
    -- Create a history record if the history table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'illegal_dumping_history') THEN
        INSERT INTO public.illegal_dumping_history(
            report_id,
            status,
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
        )
        RETURNING id INTO v_history_id;
    END IF;
    
    RETURN COALESCE(v_history_id, p_dumping_id);
END;
$$;

-- Function to assign cleanup team
CREATE OR REPLACE FUNCTION public.assign_cleanup_team(
    p_dumping_id UUID,
    p_team_id UUID,
    p_updated_by UUID,
    p_scheduled_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_history_id UUID;
    v_new_status TEXT;
BEGIN
    -- Determine the new status
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
    WHERE id = p_dumping_id;
    
    -- Create a history record if the history table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'illegal_dumping_history') THEN
        INSERT INTO public.illegal_dumping_history(
            report_id,
            status,
            changed_by,
            notes,
            created_at
        )
        VALUES (
            p_dumping_id,
            v_new_status,
            p_updated_by,
            'Assigned to cleanup team',
            NOW()
        )
        RETURNING id INTO v_history_id;
    END IF;
    
    RETURN COALESCE(v_history_id, p_dumping_id);
END;
$$;

-- Function to get user contacts
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
AS $$
BEGIN
    -- Try to get from auth.users table first
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
        RETURN QUERY
        SELECT 
            au.id,
            COALESCE(au.raw_user_meta_data->>'first_name', 'User') as first_name,
            COALESCE(au.raw_user_meta_data->>'last_name', '') as last_name,
            au.email,
            au.raw_user_meta_data->>'avatar_url' as avatar_url,
            COALESCE(au.raw_user_meta_data->>'role', 'user') as role,
            CASE 
                WHEN au.last_sign_in_at > NOW() - INTERVAL '5 minutes' THEN 'online'
                WHEN au.last_sign_in_at > NOW() - INTERVAL '1 hour' THEN 'away'
                ELSE 'offline'
            END as status
        FROM auth.users au
        WHERE au.id != p_user_id
        AND au.email_confirmed_at IS NOT NULL
        ORDER BY au.last_sign_in_at DESC NULLS LAST
        LIMIT 20;
    -- Fallback to contacts table if available
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contacts') THEN
        RETURN QUERY
        SELECT 
            c.id,
            c.name as first_name,
            ''::TEXT as last_name,
            c.email,
            ''::TEXT as avatar_url,
            'contact'::TEXT as role,
            'offline'::TEXT as status
        FROM public.contacts c
        WHERE c.user_id = p_user_id
        ORDER BY c.created_at DESC
        LIMIT 20;
    END IF;
END;
$$;

-- ============================================================================
-- 5. GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.update_illegal_dumping_status(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_cleanup_team(UUID, UUID, UUID, TIMESTAMP WITH TIME ZONE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_contacts(UUID) TO authenticated;

-- ============================================================================
-- 6. REFRESH SCHEMA CACHE
-- ============================================================================

NOTIFY pgrst, 'reload schema';
