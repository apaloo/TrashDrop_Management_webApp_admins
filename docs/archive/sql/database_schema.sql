-- TrashDrop Admin Portal Database Schema
-- Execute this in your Supabase SQL Editor to create all required tables

-- 1. Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(20) DEFAULT 'info' CHECK (type IN ('info', 'warning', 'error', 'success')),
    read BOOLEAN DEFAULT FALSE,
    entity_id TEXT,
    entity_type VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    subject TEXT,
    content TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create service_areas table
CREATE TABLE IF NOT EXISTS service_areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#3B82F6',
    coordinates JSONB, -- Array of lat/lng points for polygon
    active_collectors INTEGER DEFAULT 0,
    total_requests INTEGER DEFAULT 0,
    completion_rate DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create illegal_dumping_reports table
CREATE TABLE IF NOT EXISTS illegal_dumping_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    location TEXT NOT NULL,
    coordinates JSONB, -- {lat: number, lng: number}
    waste_type VARCHAR(50),
    severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status VARCHAR(20) DEFAULT 'reported' CHECK (status IN ('reported', 'investigating', 'cleaning', 'resolved', 'closed')),
    description TEXT,
    photos JSONB, -- Array of photo URLs
    estimated_volume DECIMAL(10,2),
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create illegal_dumping_history table
CREATE TABLE IF NOT EXISTS illegal_dumping_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES illegal_dumping_reports(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    description TEXT,
    performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    previous_status VARCHAR(20),
    new_status VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Create waste_items table
CREATE TABLE IF NOT EXISTS waste_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL,
    weight DECIMAL(10,2),
    pickup_request_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Update batches table schema
DO $$ 
BEGIN
    -- Add bag_count column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batches' AND column_name = 'bag_count') THEN
        ALTER TABLE batches ADD COLUMN bag_count INTEGER DEFAULT 0;
    END IF;
    
    -- Remove quantity column if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batches' AND column_name = 'quantity') THEN
        ALTER TABLE batches DROP COLUMN quantity;
    END IF;
END $$;

-- 8. Update collectors table schema
DO $$ 
BEGIN
    -- Add missing columns to collectors table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'collectors' AND column_name = 'name') THEN
        ALTER TABLE collectors ADD COLUMN name TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'collectors' AND column_name = 'email') THEN
        ALTER TABLE collectors ADD COLUMN email TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'collectors' AND column_name = 'phone') THEN
        ALTER TABLE collectors ADD COLUMN phone TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'collectors' AND column_name = 'status') THEN
        ALTER TABLE collectors ADD COLUMN status VARCHAR(20) DEFAULT 'active';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'collectors' AND column_name = 'rating') THEN
        ALTER TABLE collectors ADD COLUMN rating DECIMAL(3,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'collectors' AND column_name = 'total_collections') THEN
        ALTER TABLE collectors ADD COLUMN total_collections INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'collectors' AND column_name = 'vehicle_type') THEN
        ALTER TABLE collectors ADD COLUMN vehicle_type VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'collectors' AND column_name = 'vehicle_plate') THEN
        ALTER TABLE collectors ADD COLUMN vehicle_plate VARCHAR(20);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'collectors' AND column_name = 'vehicle_capacity') THEN
        ALTER TABLE collectors ADD COLUMN vehicle_capacity INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'collectors' AND column_name = 'current_location') THEN
        ALTER TABLE collectors ADD COLUMN current_location JSONB;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'collectors' AND column_name = 'region') THEN
        ALTER TABLE collectors ADD COLUMN region TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'collectors' AND column_name = 'last_active') THEN
        ALTER TABLE collectors ADD COLUMN last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- 9. Update pickup_requests table schema  
DO $$ 
BEGIN
    -- Add missing columns to pickup_requests table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pickup_requests' AND column_name = 'waste_type') THEN
        ALTER TABLE pickup_requests ADD COLUMN waste_type VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pickup_requests' AND column_name = 'estimated_volume') THEN
        ALTER TABLE pickup_requests ADD COLUMN estimated_volume DECIMAL(10,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pickup_requests' AND column_name = 'assigned_to') THEN
        ALTER TABLE pickup_requests ADD COLUMN assigned_to UUID REFERENCES collectors(id) ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pickup_requests' AND column_name = 'location') THEN
        ALTER TABLE pickup_requests ADD COLUMN location TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pickup_requests' AND column_name = 'coordinates') THEN
        ALTER TABLE pickup_requests ADD COLUMN coordinates JSONB;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pickup_requests' AND column_name = 'status') THEN
        ALTER TABLE pickup_requests ADD COLUMN status VARCHAR(20) DEFAULT 'pending';
    END IF;
END $$;

-- 10. Create logs table
CREATE TABLE IF NOT EXISTS logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level VARCHAR(20) DEFAULT 'info' CHECK (level IN ('debug', 'info', 'warn', 'error')),
    source VARCHAR(50),
    message TEXT NOT NULL,
    data JSONB,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Create RPC function for getting user contacts
CREATE OR REPLACE FUNCTION get_user_contacts()
RETURNS TABLE (
    id UUID,
    name TEXT,
    email TEXT,
    phone TEXT,
    last_active TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        c.email,
        c.phone,
        c.last_active
    FROM collectors c
    WHERE c.status = 'active'
    ORDER BY c.name;
END;
$$;

-- 12. Insert sample data for testing

-- Sample service areas
INSERT INTO service_areas (name, description, color, coordinates, active_collectors, total_requests, completion_rate) VALUES
('Downtown Accra', 'Central business district', '#3B82F6', '[{"lat": 5.5560, "lng": -0.1969}, {"lat": 5.5600, "lng": -0.1900}, {"lat": 5.5500, "lng": -0.1800}, {"lat": 5.5460, "lng": -0.1900}]', 8, 45, 87.5),
('East Legon', 'Residential area', '#10B981', '[{"lat": 5.6300, "lng": -0.1500}, {"lat": 5.6400, "lng": -0.1400}, {"lat": 5.6200, "lng": -0.1300}, {"lat": 5.6100, "lng": -0.1400}]', 6, 32, 92.3),
('Tema Industrial', 'Industrial zone', '#F59E0B', '[{"lat": 5.6200, "lng": 0.0167}, {"lat": 5.6300, "lng": 0.0200}, {"lat": 5.6100, "lng": 0.0300}, {"lat": 5.6000, "lng": 0.0200}]', 4, 28, 78.9),
('Kumasi Central', 'Central Kumasi', '#EF4444', '[{"lat": 6.6885, "lng": -1.6244}, {"lat": 6.6900, "lng": -1.6200}, {"lat": 6.6800, "lng": -1.6100}, {"lat": 6.6785, "lng": -1.6200}]', 5, 38, 85.2)
ON CONFLICT DO NOTHING;

-- Sample collectors
INSERT INTO collectors (name, email, phone, status, rating, total_collections, vehicle_type, vehicle_plate, vehicle_capacity, current_location, region) VALUES
('Kwame Asante', 'kwame.asante@trashdrop.com', '+233244123456', 'active', 4.8, 247, 'Truck', 'GR-1234-20', 500, '{"lat": 5.5560, "lng": -0.1969}', 'Greater Accra'),
('Akosua Mensah', 'akosua.mensah@trashdrop.com', '+233244234567', 'active', 4.6, 189, 'Van', 'GR-2345-20', 300, '{"lat": 5.6300, "lng": -0.1500}', 'Greater Accra'),
('Kofi Boateng', 'kofi.boateng@trashdrop.com', '+233244345678', 'active', 4.9, 312, 'Truck', 'GR-3456-20', 800, '{"lat": 6.6885, "lng": -1.6244}', 'Ashanti'),
('Ama Owusu', 'ama.owusu@trashdrop.com', '+233244456789', 'active', 4.7, 156, 'Motorcycle', 'GR-4567-20', 100, '{"lat": 5.6200, "lng": 0.0167}', 'Greater Accra'),
('Yaw Opoku', 'yaw.opoku@trashdrop.com', '+233244567890', 'inactive', 4.4, 98, 'Van', 'GR-5678-20', 250, '{"lat": 5.5500, "lng": -0.1800}', 'Greater Accra')
ON CONFLICT DO NOTHING;

-- Sample pickup requests
INSERT INTO pickup_requests (location, coordinates, waste_type, estimated_volume, status, assigned_to) VALUES
('Osu, Accra', '{"lat": 5.5560, "lng": -0.1969}', 'Mixed', 15.5, 'pending', NULL),
('East Legon, Accra', '{"lat": 5.6300, "lng": -0.1500}', 'Recyclable', 8.2, 'assigned', (SELECT id FROM collectors WHERE name = 'Kwame Asante' LIMIT 1)),
('Tema', '{"lat": 5.6200, "lng": 0.0167}', 'Organic', 12.0, 'in_progress', (SELECT id FROM collectors WHERE name = 'Akosua Mensah' LIMIT 1)),
('Kumasi', '{"lat": 6.6885, "lng": -1.6244}', 'Electronic', 5.5, 'completed', (SELECT id FROM collectors WHERE name = 'Kofi Boateng' LIMIT 1))
ON CONFLICT DO NOTHING;

-- Sample batches
INSERT INTO batches (batch_number, bag_count, status) VALUES
('BATCH-001', 150, 'active'),
('BATCH-002', 200, 'active'),  
('BATCH-003', 175, 'completed'),
('BATCH-004', 125, 'active')
ON CONFLICT DO NOTHING;

-- Sample waste items
INSERT INTO waste_items (type, weight) VALUES
('Plastic', 2.5),
('Paper', 1.8),
('Glass', 3.2),
('Metal', 0.9),
('Organic', 4.1),
('Electronic', 2.3)
ON CONFLICT DO NOTHING;

-- Sample notifications
INSERT INTO notifications (user_id, title, message, type) VALUES
((SELECT id FROM auth.users LIMIT 1), 'New Pickup Request', 'A new pickup request has been submitted in Osu area', 'info'),
((SELECT id FROM auth.users LIMIT 1), 'Collection Completed', 'Kofi Boateng has completed a collection in Kumasi', 'success'),
((SELECT id FROM auth.users LIMIT 1), 'System Alert', 'High volume of requests in East Legon area', 'warning')
ON CONFLICT DO NOTHING;

-- Enable Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE illegal_dumping_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE illegal_dumping_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE waste_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE collectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE pickup_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for admin access
CREATE POLICY "Enable all access for authenticated users" ON notifications FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON messages FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON service_areas FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON illegal_dumping_reports FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON illegal_dumping_history FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON waste_items FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON logs FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON collectors FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON pickup_requests FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON batches FOR ALL USING (auth.role() = 'authenticated');
