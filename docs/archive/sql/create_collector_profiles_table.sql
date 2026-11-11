-- =====================================================
-- Create collector_profiles table
-- Replacement for the deleted collectors table
-- =====================================================

-- Drop the table if it exists (use with caution in production)
DROP TABLE IF EXISTS public.collector_profiles CASCADE;

-- Create the collector_profiles table
CREATE TABLE public.collector_profiles (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- User reference (links to auth.users or profiles table)
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Basic Information
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    
    -- Collector Status
    status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'suspended', 'on_break')),
    
    -- Vehicle Information
    vehicle_type TEXT CHECK (vehicle_type IN ('truck', 'van', 'motorcycle', 'bicycle', 'cart', 'other')),
    vehicle_plate TEXT,
    vehicle_capacity INTEGER, -- in kg or number of bags
    
    -- Location & Assignment
    current_latitude NUMERIC(10, 8),
    current_longitude NUMERIC(11, 8),
    assigned_region TEXT,
    service_area_id UUID REFERENCES public.service_areas(id) ON DELETE SET NULL,
    
    -- Performance Metrics
    rating NUMERIC(3, 2) DEFAULT 0.00 CHECK (rating >= 0 AND rating <= 5),
    total_collections INTEGER DEFAULT 0,
    completed_today INTEGER DEFAULT 0,
    active_requests INTEGER DEFAULT 0,
    
    -- Session Information
    is_online BOOLEAN DEFAULT false,
    last_active_at TIMESTAMPTZ,
    session_start_at TIMESTAMPTZ,
    
    -- Additional Details
    profile_image_url TEXT,
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Create Indexes for Performance
-- =====================================================

-- Index on user_id for quick lookups
CREATE INDEX idx_collector_profiles_user_id ON public.collector_profiles(user_id);

-- Index on status for filtering active collectors
CREATE INDEX idx_collector_profiles_status ON public.collector_profiles(status);

-- Index on email for authentication lookups
CREATE INDEX idx_collector_profiles_email ON public.collector_profiles(email);

-- Index on assigned_region for regional queries
CREATE INDEX idx_collector_profiles_region ON public.collector_profiles(assigned_region);

-- Index on service_area_id for area-based queries
CREATE INDEX idx_collector_profiles_service_area ON public.collector_profiles(service_area_id);

-- Composite index for online status and location queries
CREATE INDEX idx_collector_profiles_online_location ON public.collector_profiles(is_online, current_latitude, current_longitude) WHERE is_online = true;

-- Index on last_active_at for session management
CREATE INDEX idx_collector_profiles_last_active ON public.collector_profiles(last_active_at);

-- =====================================================
-- Create Updated At Trigger
-- =====================================================

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION update_collector_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER trigger_update_collector_profiles_updated_at
    BEFORE UPDATE ON public.collector_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_collector_profiles_updated_at();

-- =====================================================
-- Enable Row Level Security (RLS)
-- =====================================================

ALTER TABLE public.collector_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Collectors can view their own profile
CREATE POLICY "Collectors can view own profile"
    ON public.collector_profiles
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Collectors can update their own profile
CREATE POLICY "Collectors can update own profile"
    ON public.collector_profiles
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Policy: Admins can view all collector profiles
CREATE POLICY "Admins can view all collector profiles"
    ON public.collector_profiles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Policy: Admins can insert collector profiles
CREATE POLICY "Admins can insert collector profiles"
    ON public.collector_profiles
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Policy: Admins can update all collector profiles
CREATE POLICY "Admins can update all collector profiles"
    ON public.collector_profiles
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Policy: Admins can delete collector profiles
CREATE POLICY "Admins can delete collector profiles"
    ON public.collector_profiles
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- =====================================================
-- Update Foreign Key References in Related Tables
-- =====================================================

-- Update pickup_requests table if it references collectors
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pickup_requests' 
        AND column_name = 'assigned_to'
    ) THEN
        -- Drop old foreign key if it exists
        ALTER TABLE public.pickup_requests 
        DROP CONSTRAINT IF EXISTS pickup_requests_assigned_to_fkey;
        
        -- Add new foreign key to collector_profiles
        ALTER TABLE public.pickup_requests
        ADD CONSTRAINT pickup_requests_assigned_to_fkey
        FOREIGN KEY (assigned_to) REFERENCES public.collector_profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Update scans table if it references collectors
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'scans' 
        AND column_name = 'collector_id'
    ) THEN
        -- Drop old foreign key if it exists
        ALTER TABLE public.scans 
        DROP CONSTRAINT IF EXISTS scans_collector_id_fkey;
        
        -- Add new foreign key to collector_profiles
        ALTER TABLE public.scans
        ADD CONSTRAINT scans_collector_id_fkey
        FOREIGN KEY (collector_id) REFERENCES public.collector_profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Update collector_sessions table if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'collector_sessions'
    ) THEN
        -- Drop old foreign key if it exists
        ALTER TABLE public.collector_sessions 
        DROP CONSTRAINT IF EXISTS collector_sessions_collector_id_fkey;
        
        -- Add new foreign key to collector_profiles
        ALTER TABLE public.collector_sessions
        ADD CONSTRAINT collector_sessions_collector_id_fkey
        FOREIGN KEY (collector_id) REFERENCES public.collector_profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

-- =====================================================
-- Insert Sample Data (Optional - for testing)
-- =====================================================

-- Uncomment the following to insert sample collector profiles
/*
INSERT INTO public.collector_profiles (
    first_name, last_name, email, phone, status, 
    vehicle_type, vehicle_plate, vehicle_capacity,
    assigned_region, rating, total_collections
) VALUES
    ('Kwame', 'Asante', 'kwame.asante@trashdrop.com', '+233244123456', 'active', 'truck', 'GR-1234-20', 500, 'Ga North Municipal', 4.5, 150),
    ('Akosua', 'Mensah', 'akosua.mensah@trashdrop.com', '+233244234567', 'active', 'van', 'GR-2345-20', 300, 'Ga South Municipal', 4.8, 200),
    ('Kofi', 'Boateng', 'kofi.boateng@trashdrop.com', '+233244345678', 'active', 'truck', 'GR-3456-20', 500, 'Ga East Municipal', 4.3, 120),
    ('Ama', 'Owusu', 'ama.owusu@trashdrop.com', '+233244456789', 'inactive', 'van', 'GR-4567-20', 300, 'Ga West Municipal', 4.6, 180),
    ('Emmanuel', 'Adjei', 'emmanuel.adjei@trashdrop.com', '+233244567890', 'active', 'motorcycle', 'GR-5678-20', 100, 'Accra Metropolitan', 4.7, 95);
*/

-- =====================================================
-- Grant Permissions
-- =====================================================

-- Grant necessary permissions to authenticated users
GRANT SELECT ON public.collector_profiles TO authenticated;
GRANT INSERT, UPDATE ON public.collector_profiles TO authenticated;

-- Grant all permissions to service role
GRANT ALL ON public.collector_profiles TO service_role;

-- =====================================================
-- Verification Query
-- =====================================================

-- Run this to verify the table was created successfully
-- SELECT * FROM public.collector_profiles LIMIT 5;

-- Check indexes
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'collector_profiles';

-- Check foreign keys
-- SELECT conname, conrelid::regclass, confrelid::regclass 
-- FROM pg_constraint 
-- WHERE conrelid = 'public.collector_profiles'::regclass;

COMMENT ON TABLE public.collector_profiles IS 'Stores collector profile information, replacing the deleted collectors table';
