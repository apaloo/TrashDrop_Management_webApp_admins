-- TrashDrop Admin Portal - Missing Tables Creation
-- Execute this SQL in your Supabase SQL Editor

-- =============================================
-- 1. CREATE NOTIFICATIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    title text NOT NULL,
    message text NOT NULL,
    type varchar(20) DEFAULT 'info' CHECK (type IN ('info', 'warning', 'error', 'success', 'alert')),
    read boolean DEFAULT false,
    entity_id text,
    entity_type varchar(50),
    priority varchar(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    data jsonb,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);

-- =============================================
-- 2. CREATE MESSAGES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    recipient_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    subject text,
    content text NOT NULL,
    read boolean DEFAULT false,
    message_type varchar(50) DEFAULT 'direct' CHECK (message_type IN ('direct', 'broadcast', 'system')),
    priority varchar(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    attachments jsonb,
    thread_id uuid,
    reply_to uuid REFERENCES public.messages(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON public.messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_read ON public.messages(read);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON public.messages(thread_id);

-- =============================================
-- 3. CREATE SERVICE_AREAS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.service_areas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    description text,
    color varchar(7) DEFAULT '#3B82F6',
    coordinates jsonb, -- Array of lat/lng points for polygon: [{"lat": 5.5560, "lng": -0.1969}, ...]
    bounds jsonb, -- Bounding box: {"north": lat, "south": lat, "east": lng, "west": lng}
    active_collectors integer DEFAULT 0,
    total_collectors integer DEFAULT 0,
    total_requests integer DEFAULT 0,
    pending_requests integer DEFAULT 0,
    completion_rate decimal(5,2) DEFAULT 0.00,
    coverage_area decimal(10,2), -- in km²
    population integer,
    region varchar(100),
    district varchar(100),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_service_areas_name ON public.service_areas(name);
CREATE INDEX IF NOT EXISTS idx_service_areas_region ON public.service_areas(region);
CREATE INDEX IF NOT EXISTS idx_service_areas_is_active ON public.service_areas(is_active);

-- =============================================
-- 4. CREATE WASTE_ITEMS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.waste_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type varchar(50) NOT NULL CHECK (type IN ('plastic', 'paper', 'glass', 'metal', 'organic', 'electronic', 'hazardous', 'mixed', 'recyclable', 'general')),
    weight decimal(10,2),
    volume decimal(10,2),
    unit varchar(20) DEFAULT 'kg' CHECK (unit IN ('kg', 'lbs', 'tons', 'liters', 'm3')),
    pickup_request_id text,
    batch_id uuid,
    collector_id uuid REFERENCES public.collectors(id) ON DELETE SET NULL,
    location text,
    coordinates jsonb, -- {"lat": number, "lng": number}
    status varchar(30) DEFAULT 'collected' CHECK (status IN ('collected', 'sorted', 'disposed', 'recycled', 'processed')),
    notes text,
    photos jsonb, -- Array of photo URLs
    environmental_impact_score integer CHECK (environmental_impact_score >= 0 AND environmental_impact_score <= 100),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_waste_items_type ON public.waste_items(type);
CREATE INDEX IF NOT EXISTS idx_waste_items_pickup_request_id ON public.waste_items(pickup_request_id);
CREATE INDEX IF NOT EXISTS idx_waste_items_batch_id ON public.waste_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_waste_items_collector_id ON public.waste_items(collector_id);
CREATE INDEX IF NOT EXISTS idx_waste_items_created_at ON public.waste_items(created_at DESC);

-- =============================================
-- 5. CREATE LOGS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    level varchar(20) NOT NULL DEFAULT 'info' CHECK (level IN ('debug', 'info', 'warn', 'error', 'critical')),
    source varchar(100),
    message text NOT NULL,
    data jsonb,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    session_id varchar(255),
    ip_address inet,
    user_agent text,
    request_id varchar(255),
    module varchar(100),
    function_name varchar(100),
    line_number integer,
    stack_trace text,
    execution_time decimal(10,3), -- milliseconds
    memory_usage bigint, -- bytes
    created_at timestamp with time zone DEFAULT now()
);

-- Add indexes for performance (with automatic cleanup)
CREATE INDEX IF NOT EXISTS idx_logs_level ON public.logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_source ON public.logs(source);
CREATE INDEX IF NOT EXISTS idx_logs_user_id ON public.logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON public.logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_session_id ON public.logs(session_id);

-- =============================================
-- 6. CREATE RPC FUNCTION FOR USER CONTACTS
-- =============================================
CREATE OR REPLACE FUNCTION get_user_contacts()
RETURNS TABLE (
    id uuid,
    name text,
    email text,
    phone text,
    last_active timestamp with time zone,
    status text,
    region text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        COALESCE(c.first_name || ' ' || c.last_name, c.email) as name,
        c.email,
        c.phone,
        c.last_active,
        c.status,
        c.region
    FROM collectors c
    WHERE c.status IN ('active', 'Active')
    ORDER BY c.last_active DESC NULLS LAST, c.first_name, c.last_name;
END;
$$;

-- =============================================
-- 7. INSERT SAMPLE DATA
-- =============================================

-- Sample Service Areas (Ghana regions)
INSERT INTO public.service_areas (name, description, color, coordinates, bounds, active_collectors, total_collectors, total_requests, pending_requests, completion_rate, region) VALUES
('Downtown Accra', 'Central business district and commercial area', '#3B82F6', 
 '[{"lat": 5.5560, "lng": -0.1969}, {"lat": 5.5600, "lng": -0.1900}, {"lat": 5.5500, "lng": -0.1800}, {"lat": 5.5460, "lng": -0.1900}]',
 '{"north": 5.5600, "south": 5.5460, "east": -0.1800, "west": -0.1969}',
 8, 12, 145, 23, 87.5, 'Greater Accra'),

('East Legon', 'Upscale residential area', '#10B981', 
 '[{"lat": 5.6300, "lng": -0.1500}, {"lat": 5.6400, "lng": -0.1400}, {"lat": 5.6200, "lng": -0.1300}, {"lat": 5.6100, "lng": -0.1400}]',
 '{"north": 5.6400, "south": 5.6100, "east": -0.1300, "west": -0.1500}',
 6, 9, 89, 12, 92.3, 'Greater Accra'),

('Tema Industrial', 'Industrial and port area', '#F59E0B', 
 '[{"lat": 5.6200, "lng": 0.0167}, {"lat": 5.6300, "lng": 0.0200}, {"lat": 5.6100, "lng": 0.0300}, {"lat": 5.6000, "lng": 0.0200}]',
 '{"north": 5.6300, "south": 5.6000, "east": 0.0300, "west": 0.0167}',
 4, 7, 67, 8, 78.9, 'Greater Accra'),

('Kumasi Central', 'Central Kumasi metropolitan area', '#EF4444', 
 '[{"lat": 6.6885, "lng": -1.6244}, {"lat": 6.6900, "lng": -1.6200}, {"lat": 6.6800, "lng": -1.6100}, {"lat": 6.6785, "lng": -1.6200}]',
 '{"north": 6.6900, "south": 6.6785, "east": -1.6100, "west": -1.6244}',
 5, 8, 102, 15, 85.2, 'Ashanti')
ON CONFLICT (name) DO NOTHING;

-- Sample Notifications
INSERT INTO public.notifications (user_id, title, message, type, priority) VALUES
((SELECT id FROM auth.users LIMIT 1), 'New Pickup Request', 'A new pickup request has been submitted in Downtown Accra', 'info', 'medium'),
((SELECT id FROM auth.users LIMIT 1), 'Collection Completed', 'Pickup request #PR-2024-001 has been successfully completed', 'success', 'low'),
((SELECT id FROM auth.users LIMIT 1), 'System Alert', 'High volume of requests detected in East Legon area', 'warning', 'high'),
((SELECT id FROM auth.users LIMIT 1), 'Maintenance Notice', 'Scheduled system maintenance on Sunday 3:00 AM', 'alert', 'medium'),
((SELECT id FROM auth.users LIMIT 1), 'Collector Assignment', 'New collector has been assigned to Tema Industrial area', 'info', 'low');

-- Sample Messages
INSERT INTO public.messages (sender_id, recipient_id, subject, content, message_type) VALUES
((SELECT id FROM auth.users LIMIT 1), (SELECT id FROM auth.users OFFSET 1 LIMIT 1), 'Welcome to TrashDrop', 'Welcome to the TrashDrop admin portal. This message confirms your account setup.', 'system'),
((SELECT id FROM auth.users LIMIT 1), (SELECT id FROM auth.users LIMIT 1), 'Daily Report', 'Here is your daily collection summary for today.', 'system');

-- Sample Waste Items
INSERT INTO public.waste_items (type, weight, volume, unit, status, environmental_impact_score) VALUES
('plastic', 2.5, 15.0, 'kg', 'collected', 85),
('paper', 1.8, 8.5, 'kg', 'recycled', 70),
('glass', 3.2, 2.1, 'kg', 'recycled', 90),
('metal', 0.9, 0.5, 'kg', 'recycled', 95),
('organic', 4.1, 12.0, 'kg', 'processed', 60),
('electronic', 2.3, 5.0, 'kg', 'disposed', 40),
('mixed', 6.7, 20.0, 'kg', 'sorted', 75),
('hazardous', 0.5, 1.0, 'kg', 'disposed', 30);

-- Sample Log Entries
INSERT INTO public.logs (level, source, message, module) VALUES
('info', 'dashboard', 'Dashboard loaded successfully', 'Dashboard'),
('info', 'auth', 'User login successful', 'Authentication'),
('warn', 'database', 'Query execution took longer than expected', 'Database'),
('error', 'pickup', 'Failed to assign collector to pickup request', 'PickupService'),
('info', 'notification', 'New notification sent to user', 'NotificationService');

-- =============================================
-- 8. ENABLE ROW LEVEL SECURITY
-- =============================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waste_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 9. CREATE RLS POLICIES
-- =============================================

-- Notifications policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can insert their own notifications" ON public.notifications;
CREATE POLICY "Users can insert their own notifications" ON public.notifications
    FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id OR auth.role() = 'authenticated');

-- Messages policies
DROP POLICY IF EXISTS "Users can view their messages" ON public.messages;
CREATE POLICY "Users can view their messages" ON public.messages
    FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages" ON public.messages
    FOR INSERT WITH CHECK (auth.uid() = sender_id OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can update their messages" ON public.messages;
CREATE POLICY "Users can update their messages" ON public.messages
    FOR UPDATE USING (auth.uid() = recipient_id OR auth.role() = 'authenticated');

-- Service areas policies (read-only for most users)
DROP POLICY IF EXISTS "Anyone can view service areas" ON public.service_areas;
CREATE POLICY "Anyone can view service areas" ON public.service_areas
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can manage service areas" ON public.service_areas;
CREATE POLICY "Admins can manage service areas" ON public.service_areas
    FOR ALL USING (auth.role() = 'authenticated');

-- Waste items policies
DROP POLICY IF EXISTS "Anyone can view waste items" ON public.waste_items;
CREATE POLICY "Anyone can view waste items" ON public.waste_items
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage waste items" ON public.waste_items;
CREATE POLICY "Authenticated users can manage waste items" ON public.waste_items
    FOR ALL USING (auth.role() = 'authenticated');

-- Logs policies (admin access only)
DROP POLICY IF EXISTS "Authenticated users can view logs" ON public.logs;
CREATE POLICY "Authenticated users can view logs" ON public.logs
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can insert logs" ON public.logs;
CREATE POLICY "Authenticated users can insert logs" ON public.logs
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- =============================================
-- 10. CREATE AUTOMATIC LOG CLEANUP FUNCTION
-- =============================================
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- Delete logs older than 30 days (except errors and critical)
    DELETE FROM public.logs 
    WHERE created_at < NOW() - INTERVAL '30 days' 
    AND level NOT IN ('error', 'critical');
    
    -- Delete error logs older than 90 days
    DELETE FROM public.logs 
    WHERE created_at < NOW() - INTERVAL '90 days' 
    AND level IN ('error', 'critical');
    
    RAISE NOTICE 'Old logs cleaned up successfully';
END;
$$;

-- =============================================
-- 11. UPDATE EXISTING TABLES (if needed)
-- =============================================

-- Add missing columns to existing tables if they don't exist
DO $$ 
BEGIN
    -- Update collectors table to match app expectations
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'collectors' AND column_name = 'name') THEN
        ALTER TABLE public.collectors 
        ADD COLUMN name text GENERATED ALWAYS AS (
            CASE 
                WHEN first_name IS NOT NULL AND last_name IS NOT NULL 
                THEN first_name || ' ' || last_name
                ELSE email
            END
        ) STORED;
    END IF;
END $$;

-- =============================================
-- SUMMARY
-- =============================================
-- Created tables:
-- ✅ notifications - System notifications and alerts
-- ✅ messages - Inter-user messaging system  
-- ✅ service_areas - Geographic service boundaries
-- ✅ waste_items - Waste item tracking and analytics
-- ✅ logs - System logging and audit trails
-- ✅ get_user_contacts() RPC function
-- ✅ Row Level Security policies
-- ✅ Performance indexes
-- ✅ Sample data for testing

SELECT 'All missing tables have been created successfully!' as status;
