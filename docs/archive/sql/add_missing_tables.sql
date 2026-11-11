-- TrashDrop Admin Portal - Add Missing Tables and Sample Data
-- Execute this SQL in your Supabase SQL Editor

-- =============================================
-- 1. CREATE ILLEGAL_DUMPING_REPORTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.illegal_dumping_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    location jsonb NOT NULL, -- Contains lat/lng coordinates
    address text,
    description text,
    waste_type varchar(50) CHECK (waste_type IN ('household', 'construction', 'industrial', 'electronic', 'hazardous', 'mixed', 'other')),
    status varchar(50) DEFAULT 'reported' CHECK (status IN ('reported', 'confirmed', 'assigned', 'in_progress', 'cleaned', 'closed', 'rejected')),
    urgency varchar(20) DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
    size varchar(20) CHECK (size IN ('small', 'medium', 'large', 'very_large')),
    assigned_team_id uuid,
    resolution_notes text,
    estimated_cleanup_time integer, -- minutes
    actual_cleanup_time integer, -- minutes
    cleanup_scheduled_at timestamp with time zone,
    cleanup_completed_at timestamp with time zone,
    images jsonb, -- Array of image URLs
    duplicate_of uuid REFERENCES public.illegal_dumping_reports(id) ON DELETE SET NULL,
    verification_count integer DEFAULT 0,
    last_verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_illegal_dumping_reports_status ON public.illegal_dumping_reports(status);
CREATE INDEX IF NOT EXISTS idx_illegal_dumping_reports_urgency ON public.illegal_dumping_reports(urgency);
CREATE INDEX IF NOT EXISTS idx_illegal_dumping_reports_reporter_id ON public.illegal_dumping_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_illegal_dumping_reports_created_at ON public.illegal_dumping_reports(created_at DESC);

-- Add row-level security policy
DROP POLICY IF EXISTS "Anyone authenticated can view illegal dumping reports" ON public.illegal_dumping_reports;
CREATE POLICY "Anyone authenticated can view illegal dumping reports" ON public.illegal_dumping_reports
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Anyone authenticated can insert illegal dumping reports" ON public.illegal_dumping_reports;
CREATE POLICY "Anyone authenticated can insert illegal dumping reports" ON public.illegal_dumping_reports
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Anyone authenticated can update illegal dumping reports" ON public.illegal_dumping_reports;
CREATE POLICY "Anyone authenticated can update illegal dumping reports" ON public.illegal_dumping_reports
    FOR UPDATE USING (auth.role() = 'authenticated');

-- =============================================
-- 2. INSERT SAMPLE DATA INTO EXISTING TABLES
-- =============================================

-- Sample illegal dumping reports
INSERT INTO public.illegal_dumping_reports (
    reporter_id, location, address, description, waste_type, 
    status, urgency, size, resolution_notes, 
    images, verification_count, created_at
) VALUES
    (
        (SELECT id FROM auth.users LIMIT 1), 
        '{"lat": 5.5560, "lng": -0.1969}', 
        'Near Accra Mall, Liberation Rd, Accra', 
        'Large pile of construction waste blocking drainage', 
        'construction', 
        'reported', 
        'high', 
        'large', 
        NULL,
        '["https://example.com/images/dump1.jpg", "https://example.com/images/dump2.jpg"]',
        2,
        NOW() - INTERVAL '3 days'
    ),
    (
        (SELECT id FROM auth.users LIMIT 1), 
        '{"lat": 5.6010, "lng": -0.1870}', 
        'Spintex Road, near Ecobank', 
        'Household waste scattered over vacant lot', 
        'household', 
        'assigned', 
        'medium', 
        'medium', 
        'Team dispatched for cleanup',
        '["https://example.com/images/dump3.jpg"]',
        1,
        NOW() - INTERVAL '5 days'
    ),
    (
        (SELECT id FROM auth.users LIMIT 1), 
        '{"lat": 5.5720, "lng": -0.2050}', 
        'Circle Interchange, Kwame Nkrumah Ave', 
        'Industrial waste possibly containing chemicals', 
        'hazardous', 
        'in_progress', 
        'critical', 
        'medium', 
        'Specialized team handling hazardous waste removal',
        '["https://example.com/images/dump4.jpg", "https://example.com/images/dump5.jpg"]',
        3,
        NOW() - INTERVAL '2 days'
    ),
    (
        (SELECT id FROM auth.users LIMIT 1), 
        '{"lat": 5.5630, "lng": -0.1780}', 
        'Osu, Oxford Street', 
        'Electronic waste including old computers and TVs', 
        'electronic', 
        'cleaned', 
        'low', 
        'small', 
        'Successfully removed and sent for recycling',
        '["https://example.com/images/dump6.jpg"]',
        1,
        NOW() - INTERVAL '10 days'
    ),
    (
        (SELECT id FROM auth.users LIMIT 1), 
        '{"lat": 5.5950, "lng": -0.1750}', 
        'Airport Residential Area', 
        'Mixed household and construction debris', 
        'mixed', 
        'reported', 
        'medium', 
        'large', 
        NULL,
        '["https://example.com/images/dump7.jpg"]',
        0,
        NOW() - INTERVAL '1 day'
    );

-- Sample batches data
INSERT INTO public.batches (
    id, bag_count, status, created_at, updated_at
) VALUES
    ('b0001', 100, 'active', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'),
    ('b0002', 150, 'active', NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days'),
    ('b0003', 200, 'active', NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days'),
    ('b0004', 175, 'active', NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days'),
    ('b0005', 125, 'active', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days');

-- Sample notifications
INSERT INTO public.notifications (
    user_id, title, message, type, read, priority, created_at
) VALUES
    (
        (SELECT id FROM auth.users LIMIT 1), 
        'New Illegal Dumping Report', 
        'A new high-priority illegal dumping report has been submitted near Accra Mall.', 
        'alert', 
        false, 
        'high',
        NOW() - INTERVAL '1 day'
    ),
    (
        (SELECT id FROM auth.users LIMIT 1), 
        'Cleanup Team Assignment', 
        'Team Alpha has been assigned to cleanup task IDR-2023-003.', 
        'info', 
        false, 
        'medium',
        NOW() - INTERVAL '2 days'
    ),
    (
        (SELECT id FROM auth.users LIMIT 1), 
        'Batch Distribution Complete', 
        'Batch B0003 has been fully distributed to collectors.', 
        'success', 
        true, 
        'low',
        NOW() - INTERVAL '5 days'
    ),
    (
        (SELECT id FROM auth.users LIMIT 1), 
        'System Update', 
        'TrashDrop Admin Portal will be updated tonight at 2 AM GMT.', 
        'info', 
        false, 
        'medium',
        NOW() - INTERVAL '3 days'
    ),
    (
        (SELECT id FROM auth.users LIMIT 1), 
        'Critical Alert', 
        'Hazardous waste reported at Circle Interchange requires immediate attention.', 
        'warning', 
        false, 
        'critical',
        NOW() - INTERVAL '1 day'
    );

-- Sample messages
INSERT INTO public.messages (
    sender_id, recipient_id, subject, content, read, message_type, priority, created_at
) VALUES
    (
        (SELECT id FROM auth.users LIMIT 1), 
        (SELECT id FROM auth.users LIMIT 1), 
        'Waste Collection Schedule Update', 
        'We need to adjust the collection schedule for East Legon next week due to road construction.',
        false,
        'direct',
        'normal',
        NOW() - INTERVAL '2 days'
    ),
    (
        (SELECT id FROM auth.users LIMIT 1), 
        (SELECT id FROM auth.users LIMIT 1), 
        'New Collector Training', 
        'Please schedule training for the 5 new collectors joining next Monday.',
        true,
        'direct',
        'high',
        NOW() - INTERVAL '5 days'
    ),
    (
        (SELECT id FROM auth.users LIMIT 1), 
        (SELECT id FROM auth.users LIMIT 1), 
        'Monthly Report Ready', 
        'The July waste collection report is ready for your review.',
        false,
        'system',
        'normal',
        NOW() - INTERVAL '1 day'
    ),
    (
        (SELECT id FROM auth.users LIMIT 1), 
        (SELECT id FROM auth.users LIMIT 1), 
        'Equipment Request Approval', 
        'The request for additional waste bins has been approved.',
        false,
        'direct',
        'normal',
        NOW() - INTERVAL '3 days'
    ),
    (
        (SELECT id FROM auth.users LIMIT 1), 
        (SELECT id FROM auth.users LIMIT 1), 
        'Urgent: Vehicle Maintenance', 
        'Collection truck GH-456-20 requires immediate maintenance.',
        false,
        'direct',
        'urgent',
        NOW() - INTERVAL '12 hours'
    );

-- Sample logs
INSERT INTO public.logs (
    level, source, message, module, context, created_at
) VALUES
    ('info', 'auth', 'User login successful', 'Authentication', '{"user_id": "system", "ip": "192.168.1.1"}', NOW() - INTERVAL '1 day'),
    ('warning', 'database', 'Slow query detected', 'Database', '{"query_id": "q123", "execution_time": 2.5}', NOW() - INTERVAL '2 days'),
    ('error', 'api', 'Failed to connect to external service', 'Integration', '{"service": "SMS Gateway", "error": "Connection timeout"}', NOW() - INTERVAL '3 days'),
    ('info', 'system', 'Scheduled backup completed', 'Maintenance', '{"backup_size": "1.2GB", "duration": 45}', NOW() - INTERVAL '4 days'),
    ('info', 'app', 'Report exported to CSV', 'Reports', '{"report_id": "rep123", "rows": 1250}', NOW() - INTERVAL '5 days');

-- Sample service areas
INSERT INTO public.service_areas (
    name, description, color, coordinates, bounds, 
    active_collectors, total_collectors, total_requests, 
    pending_requests, completion_rate, region
) VALUES
    ('Ga North Municipal', 'Northern district of Greater Accra', '#3B82F6', 
     '[{"lat": 5.6500, "lng": -0.2800}, {"lat": 5.6700, "lng": -0.2600}, {"lat": 5.6300, "lng": -0.2400}, {"lat": 5.6100, "lng": -0.2600}]',
     '{"north": 5.6700, "south": 5.6100, "east": -0.2400, "west": -0.2800}',
     5, 8, 120, 15, 87.5, 'Greater Accra'),
    
    ('Ga South Municipal', 'Southern district of Greater Accra', '#F59E0B',
     '[{"lat": 5.5200, "lng": -0.2700}, {"lat": 5.5400, "lng": -0.2500}, {"lat": 5.5000, "lng": -0.2300}, {"lat": 5.4800, "lng": -0.2500}]',
     '{"north": 5.5400, "south": 5.4800, "east": -0.2300, "west": -0.2700}',
     6, 10, 145, 20, 86.2, 'Greater Accra'),
    
    ('Ga East Municipal', 'Eastern district of Greater Accra', '#10B981',
     '[{"lat": 5.6300, "lng": -0.1500}, {"lat": 5.6500, "lng": -0.1300}, {"lat": 5.6100, "lng": -0.1100}, {"lat": 5.5900, "lng": -0.1300}]',
     '{"north": 5.6500, "south": 5.5900, "east": -0.1100, "west": -0.1500}',
     4, 7, 95, 12, 87.3, 'Greater Accra'),
    
    ('Ga West Municipal', 'Western district of Greater Accra', '#8B5CF6',
     '[{"lat": 5.6000, "lng": -0.3200}, {"lat": 5.6200, "lng": -0.3000}, {"lat": 5.5800, "lng": -0.2800}, {"lat": 5.5600, "lng": -0.3000}]',
     '{"north": 5.6200, "south": 5.5600, "east": -0.2800, "west": -0.3200}',
     3, 6, 80, 18, 77.5, 'Greater Accra'),
    
    ('Accra Metropolitan', 'Central district of Greater Accra', '#EC4899',
     '[{"lat": 5.5600, "lng": -0.2200}, {"lat": 5.5800, "lng": -0.2000}, {"lat": 5.5400, "lng": -0.1800}, {"lat": 5.5200, "lng": -0.2000}]',
     '{"north": 5.5800, "south": 5.5200, "east": -0.1800, "west": -0.2200}',
     8, 12, 175, 22, 87.4, 'Greater Accra');

-- Sample waste items
INSERT INTO public.waste_items (
    type, weight, volume, unit, status, recycle_percentage
) VALUES
    ('plastic', 2.5, 8.0, 'kg', 'processed', 80),
    ('paper', 1.8, 4.0, 'kg', 'collected', 85),
    ('glass', 3.2, 6.0, 'kg', 'processed', 90),
    ('metal', 0.9, 0.5, 'kg', 'recycled', 95),
    ('organic', 4.1, 12.0, 'kg', 'processed', 60),
    ('electronic', 2.3, 5.0, 'kg', 'disposed', 40),
    ('mixed', 6.7, 20.0, 'kg', 'sorted', 75),
    ('hazardous', 0.5, 1.0, 'kg', 'disposed', 30);

-- =============================================
-- VERIFY TABLES
-- =============================================
SELECT 'Verifying tables...' as status;

SELECT 
    table_name, 
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count,
    (
        CASE 
            WHEN table_name = 'notifications' THEN (SELECT COUNT(*) FROM public.notifications)
            WHEN table_name = 'messages' THEN (SELECT COUNT(*) FROM public.messages)
            WHEN table_name = 'service_areas' THEN (SELECT COUNT(*) FROM public.service_areas)
            WHEN table_name = 'waste_items' THEN (SELECT COUNT(*) FROM public.waste_items)
            WHEN table_name = 'logs' THEN (SELECT COUNT(*) FROM public.logs)
            WHEN table_name = 'batches' THEN (SELECT COUNT(*) FROM public.batches)
            WHEN table_name = 'illegal_dumping_reports' THEN (SELECT COUNT(*) FROM public.illegal_dumping_reports)
            ELSE 0
        END
    ) as row_count
FROM (
    VALUES 
        ('notifications'), 
        ('messages'), 
        ('service_areas'),
        ('waste_items'),
        ('logs'),
        ('batches'),
        ('illegal_dumping_reports')
) AS t(table_name);

SELECT 'All tables successfully created and populated with sample data!' as status;
