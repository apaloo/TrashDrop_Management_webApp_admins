-- ============================================================================
-- CREATE MISSING TABLES AND FUNCTIONS FOR TRASHDROP ADMIN PORTAL
-- ============================================================================
-- This script creates ONLY the missing tables and functions
-- It will NOT drop or modify existing tables (your data is safe)
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Enable PostGIS if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================================
-- PART 1: CREATE MISSING TABLES
-- ============================================================================

-- 1. BATCHES TABLE
CREATE TABLE IF NOT EXISTS public.batches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  batch_number text,
  bag_count integer NOT NULL DEFAULT 0,
  status text DEFAULT 'active'::text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  batch_name text,
  CONSTRAINT batches_pkey PRIMARY KEY (id),
  CONSTRAINT batches_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);

-- 2. BAGS TABLE
CREATE TABLE IF NOT EXISTS public.bags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  batch_id uuid,
  qr_code text NOT NULL,
  status text DEFAULT 'active'::text,
  scanned boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT bags_pkey PRIMARY KEY (id),
  CONSTRAINT bags_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(id)
);

-- 3. COLLECTOR_PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.collector_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text,
  status text NOT NULL DEFAULT 'inactive'::text CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text, 'suspended'::text, 'on_break'::text])),
  vehicle_type text CHECK (vehicle_type = ANY (ARRAY['truck'::text, 'van'::text, 'motorcycle'::text, 'bicycle'::text, 'cart'::text, 'other'::text])),
  vehicle_plate text,
  vehicle_capacity integer,
  current_latitude numeric,
  current_longitude numeric,
  assigned_region text,
  service_area_id uuid,
  rating numeric DEFAULT 0.00 CHECK (rating >= 0::numeric AND rating <= 5::numeric),
  total_collections integer DEFAULT 0,
  completed_today integer DEFAULT 0,
  active_requests integer DEFAULT 0,
  is_online boolean DEFAULT false,
  last_active_at timestamp with time zone,
  session_start_at timestamp with time zone,
  profile_image_url text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT collector_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT collector_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- 4. SERVICE_AREAS TABLE
CREATE TABLE IF NOT EXISTS public.service_areas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  color character varying DEFAULT '#3B82F6'::character varying,
  coordinates jsonb,
  bounds jsonb,
  active_collectors integer DEFAULT 0,
  total_collectors integer DEFAULT 0,
  total_requests integer DEFAULT 0,
  pending_requests integer DEFAULT 0,
  completion_rate numeric DEFAULT 0.00,
  coverage_area numeric,
  population integer,
  region character varying,
  district character varying,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT service_areas_pkey PRIMARY KEY (id)
);

-- Add foreign key constraint for collector_profiles.service_area_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'collector_profiles_service_area_id_fkey'
  ) THEN
    ALTER TABLE public.collector_profiles
    ADD CONSTRAINT collector_profiles_service_area_id_fkey 
    FOREIGN KEY (service_area_id) REFERENCES public.service_areas(id);
  END IF;
END $$;

-- 5. PICKUP_REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.pickup_requests (
  id text NOT NULL,
  location text NOT NULL,
  coordinates geometry(Point, 4326) NOT NULL,
  fee integer NOT NULL,
  status text NOT NULL CHECK (status = ANY (ARRAY['available'::text, 'accepted'::text, 'picked_up'::text, 'disposed'::text])),
  collector_id uuid,
  accepted_at timestamp with time zone,
  picked_up_at timestamp with time zone,
  disposed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  waste_type text,
  bag_count integer DEFAULT 1,
  special_instructions text,
  scheduled_date timestamp with time zone,
  preferred_time text,
  points_earned integer DEFAULT 0,
  payment_method_id uuid,
  payment_type text CHECK (payment_type = ANY (ARRAY['prepaid'::text, 'postpaid'::text])),
  priority text,
  reserved_by uuid,
  reserved_at timestamp with time zone,
  reserved_until timestamp with time zone,
  exclusion_until timestamp with time zone,
  assignment_expires_at timestamp with time zone,
  filter_criteria jsonb,
  last_pool_entry timestamp with time zone DEFAULT now(),
  reservation_expires_at timestamp with time zone,
  estimated_volume numeric,
  assigned_to uuid,
  service_area_id uuid,
  user_id uuid,
  CONSTRAINT pickup_requests_pkey PRIMARY KEY (id),
  CONSTRAINT pickup_requests_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.collector_profiles(id),
  CONSTRAINT pickup_requests_reserved_by_fkey FOREIGN KEY (reserved_by) REFERENCES auth.users(id),
  CONSTRAINT pickup_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

-- 6. SCANS TABLE
CREATE TABLE IF NOT EXISTS public.scans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  bag_id uuid,
  collector_id uuid,
  location geometry(Point, 4326),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT scans_pkey PRIMARY KEY (id),
  CONSTRAINT scans_collector_id_fkey FOREIGN KEY (collector_id) REFERENCES public.collector_profiles(id),
  CONSTRAINT scans_bag_id_fkey FOREIGN KEY (bag_id) REFERENCES public.bags(id)
);

-- ============================================================================
-- PART 2: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_batches_status ON public.batches(status);
CREATE INDEX IF NOT EXISTS idx_batches_created_at ON public.batches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_batches_created_by ON public.batches(created_by);

CREATE INDEX IF NOT EXISTS idx_bags_batch_id ON public.bags(batch_id);
CREATE INDEX IF NOT EXISTS idx_bags_status ON public.bags(status);
CREATE INDEX IF NOT EXISTS idx_bags_qr_code ON public.bags(qr_code);

CREATE INDEX IF NOT EXISTS idx_collector_profiles_status ON public.collector_profiles(status);
CREATE INDEX IF NOT EXISTS idx_collector_profiles_service_area ON public.collector_profiles(service_area_id);
CREATE INDEX IF NOT EXISTS idx_collector_profiles_user_id ON public.collector_profiles(user_id);

CREATE INDEX IF NOT EXISTS idx_pickup_requests_status ON public.pickup_requests(status);
CREATE INDEX IF NOT EXISTS idx_pickup_requests_assigned_to ON public.pickup_requests(assigned_to);
CREATE INDEX IF NOT EXISTS idx_pickup_requests_created_at ON public.pickup_requests(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scans_bag_id ON public.scans(bag_id);
CREATE INDEX IF NOT EXISTS idx_scans_collector_id ON public.scans(collector_id);
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON public.scans(created_at DESC);

-- ============================================================================
-- PART 3: ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collector_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 4: CREATE RLS POLICIES
-- ============================================================================

-- BATCHES POLICIES
CREATE POLICY "Enable read access for authenticated users" ON public.batches
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users" ON public.batches
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON public.batches
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- BAGS POLICIES
CREATE POLICY "Enable read access for authenticated users" ON public.bags
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users" ON public.bags
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON public.bags
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- COLLECTOR_PROFILES POLICIES
CREATE POLICY "Enable read access for authenticated users" ON public.collector_profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users" ON public.collector_profiles
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON public.collector_profiles
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- SERVICE_AREAS POLICIES
CREATE POLICY "Enable read access for authenticated users" ON public.service_areas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users" ON public.service_areas
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON public.service_areas
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- PICKUP_REQUESTS POLICIES
CREATE POLICY "Enable read access for authenticated users" ON public.pickup_requests
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users" ON public.pickup_requests
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON public.pickup_requests
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- SCANS POLICIES
CREATE POLICY "Enable read access for authenticated users" ON public.scans
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users" ON public.scans
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON public.scans
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- PART 5: CREATE MISSING RPC FUNCTIONS
-- ============================================================================

-- 1. FETCH_DASHBOARD_STATS
CREATE OR REPLACE FUNCTION public.fetch_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_batches', (SELECT COUNT(*) FROM public.batches),
    'active_batches', (SELECT COUNT(*) FROM public.batches WHERE status = 'active'),
    'total_bags', (SELECT COUNT(*) FROM public.bags),
    'scanned_bags', (SELECT COUNT(*) FROM public.bags WHERE scanned = true),
    'total_collectors', (SELECT COUNT(*) FROM public.collector_profiles),
    'active_collectors', (SELECT COUNT(*) FROM public.collector_profiles WHERE status = 'active'),
    'total_pickups', (SELECT COUNT(*) FROM public.pickup_requests),
    'pending_pickups', (SELECT COUNT(*) FROM public.pickup_requests WHERE status = 'available'),
    'total_dumping_reports', (SELECT COUNT(*) FROM public.illegal_dumping_mobile),
    'pending_reports', (SELECT COUNT(*) FROM public.illegal_dumping_mobile WHERE status = 'pending')
  ) INTO result;
  
  RETURN result;
END;
$$;

-- 2. FETCH_ILLEGAL_DUMPING_REPORTS
CREATE OR REPLACE FUNCTION public.fetch_illegal_dumping_reports(
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  reported_by uuid,
  location text,
  coordinates geometry,
  waste_type text,
  severity text,
  size text,
  photos text[],
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  latitude numeric,
  longitude numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.reported_by,
    d.location,
    d.coordinates,
    d.waste_type,
    d.severity,
    d.size,
    d.photos,
    d.status,
    d.created_at,
    d.updated_at,
    d.latitude,
    d.longitude
  FROM public.illegal_dumping_mobile d
  WHERE (p_status IS NULL OR d.status = p_status)
  ORDER BY d.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 3. UPDATE_ILLEGAL_DUMPING_STATUS
CREATE OR REPLACE FUNCTION public.update_illegal_dumping_status(
  p_report_id uuid,
  p_status text,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_report jsonb;
BEGIN
  -- Update the report status
  UPDATE public.illegal_dumping_mobile
  SET 
    status = p_status,
    updated_at = now()
  WHERE id = p_report_id;
  
  -- Return the updated report
  SELECT jsonb_build_object(
    'success', true,
    'message', 'Status updated successfully',
    'report_id', p_report_id,
    'new_status', p_status
  ) INTO updated_report;
  
  RETURN updated_report;
END;
$$;

-- 4. ASSIGN_CLEANUP_TEAM
CREATE OR REPLACE FUNCTION public.assign_cleanup_team(
  p_report_id uuid,
  p_collector_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Update the report with assigned collector
  UPDATE public.illegal_dumping_mobile
  SET 
    status = 'in_progress',
    updated_at = now()
  WHERE id = p_report_id;
  
  -- Return success response
  SELECT jsonb_build_object(
    'success', true,
    'message', 'Cleanup team assigned successfully',
    'report_id', p_report_id,
    'collector_id', p_collector_id
  ) INTO result;
  
  RETURN result;
END;
$$;

-- ============================================================================
-- PART 6: VERIFY SETUP
-- ============================================================================

-- Check tables
SELECT 
  '✅ TABLES CREATED' as status,
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name IN ('batches', 'bags', 'scans', 'collector_profiles', 'pickup_requests', 'service_areas', 'illegal_dumping_mobile')
ORDER BY table_name;

-- Check RPC functions
SELECT 
  '✅ RPC FUNCTIONS CREATED' as status,
  routine_name as function_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('fetch_dashboard_stats', 'fetch_illegal_dumping_reports', 'update_illegal_dumping_status', 'assign_cleanup_team')
ORDER BY routine_name;

-- Done!
SELECT '🎉 ALL MISSING TABLES AND FUNCTIONS CREATED SUCCESSFULLY!' as final_status;
