-- TrashDrop Admin Portal - Database Seeding Script
-- Execute this SQL directly in the Supabase SQL Editor to populate all required tables with data

-- =============================================
-- CLEAR EXISTING DATA (Optional - comment out if you want to keep existing data)
-- =============================================
TRUNCATE TABLE public.illegal_dumping_reports CASCADE;
TRUNCATE TABLE public.notifications CASCADE;
TRUNCATE TABLE public.messages CASCADE;
TRUNCATE TABLE public.service_areas CASCADE;
TRUNCATE TABLE public.waste_items CASCADE;
TRUNCATE TABLE public.logs CASCADE;
TRUNCATE TABLE public.batches CASCADE;

-- =============================================
-- 1. SEED ILLEGAL_DUMPING_REPORTS
-- =============================================
INSERT INTO public.illegal_dumping_reports (
    location, address, description, waste_type, 
    status, urgency, size, resolution_notes, 
    images, verification_count, created_at, updated_at
) VALUES
    (
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
        NOW() - INTERVAL '3 days',
        NOW() - INTERVAL '3 days'
    ),
    (
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
        NOW() - INTERVAL '5 days',
        NOW() - INTERVAL '4 days'
    ),
    (
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
        NOW() - INTERVAL '2 days',
        NOW() - INTERVAL '1 day'
    ),
    (
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
        NOW() - INTERVAL '10 days',
        NOW() - INTERVAL '8 days'
    ),
    (
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
        NOW() - INTERVAL '1 day',
        NOW() - INTERVAL '1 day'
    );

-- =============================================
-- 2. SEED BATCHES TABLE
-- =============================================
INSERT INTO public.batches (
    id, bag_count, status, created_at, updated_at
) VALUES
    ('b0001', 100, 'active', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'),
    ('b0002', 150, 'active', NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days'),
    ('b0003', 200, 'active', NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days'),
    ('b0004', 175, 'active', NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days'),
    ('b0005', 125, 'active', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days');

-- =============================================
-- 3. SEED NOTIFICATIONS TABLE
-- =============================================
DO $$
DECLARE
    user_id uuid;
BEGIN
    -- Get a user ID from auth.users table if it exists
    SELECT id INTO user_id FROM auth.users LIMIT 1;
    
    -- If no user ID found, use a random UUID
    IF user_id IS NULL THEN
        user_id := gen_random_uuid();
    END IF;
    
    -- Insert notifications using the user_id
    INSERT INTO public.notifications (
        user_id, title, message, type, read, priority, created_at, updated_at
    ) VALUES
        (
            user_id, 
            'New Illegal Dumping Report', 
            'A new high-priority illegal dumping report has been submitted near Accra Mall.', 
            'alert', 
            false, 
            'high',
            NOW() - INTERVAL '1 day',
            NOW() - INTERVAL '1 day'
        ),
        (
            user_id, 
            'Cleanup Team Assignment', 
            'Team Alpha has been assigned to cleanup task IDR-2023-003.', 
            'info', 
            false, 
            'medium',
            NOW() - INTERVAL '2 days',
            NOW() - INTERVAL '2 days'
        ),
        (
            user_id, 
            'Batch Distribution Complete', 
            'Batch B0003 has been fully distributed to collectors.', 
            'success', 
            true, 
            'low',
            NOW() - INTERVAL '5 days',
            NOW() - INTERVAL '5 days'
        ),
        (
            user_id, 
            'System Update', 
            'TrashDrop Admin Portal will be updated tonight at 2 AM GMT.', 
            'info', 
            false, 
            'medium',
            NOW() - INTERVAL '3 days',
            NOW() - INTERVAL '3 days'
        ),
        (
            user_id, 
            'Critical Alert', 
            'Hazardous waste reported at Circle Interchange requires immediate attention.', 
            'warning', 
            false, 
            'critical',
            NOW() - INTERVAL '1 day',
            NOW() - INTERVAL '1 day'
        ),
        (
            user_id, 
            'Batch Generation Successful', 
            'New batch of 200 bags has been successfully generated.', 
            'success', 
            false, 
            'medium',
            NOW() - INTERVAL '6 hours',
            NOW() - INTERVAL '6 hours'
        ),
        (
            user_id, 
            'Service Area Update', 
            'Coverage for Ga East Municipal has been expanded.', 
            'info', 
            false, 
            'low',
            NOW() - INTERVAL '4 days',
            NOW() - INTERVAL '4 days'
        );
END $$;

-- =============================================
-- 4. SEED MESSAGES TABLE
-- =============================================
DO $$
DECLARE
    sender_id uuid;
    recipient_id uuid;
BEGIN
    -- Get user IDs from auth.users table
    SELECT id INTO sender_id FROM auth.users ORDER BY RANDOM() LIMIT 1;
    SELECT id INTO recipient_id FROM auth.users WHERE id != sender_id LIMIT 1;
    
    -- If no user IDs found, use random UUIDs
    IF sender_id IS NULL THEN
        sender_id := gen_random_uuid();
    END IF;
    
    IF recipient_id IS NULL THEN
        recipient_id := gen_random_uuid();
    END IF;
    
    -- Insert messages using the user IDs
    INSERT INTO public.messages (
        sender_id, recipient_id, subject, content, read, message_type, priority, created_at, updated_at
    ) VALUES
        (
            sender_id, 
            recipient_id, 
            'Waste Collection Schedule Update', 
            'We need to adjust the collection schedule for East Legon next week due to road construction.',
            false,
            'direct',
            'normal',
            NOW() - INTERVAL '2 days',
            NOW() - INTERVAL '2 days'
        ),
        (
            sender_id, 
            recipient_id, 
            'New Collector Training', 
            'Please schedule training for the 5 new collectors joining next Monday.',
            true,
            'direct',
            'high',
            NOW() - INTERVAL '5 days',
            NOW() - INTERVAL '5 days'
        ),
        (
            sender_id, 
            recipient_id, 
            'Monthly Report Ready', 
            'The July waste collection report is ready for your review.',
            false,
            'system',
            'normal',
            NOW() - INTERVAL '1 day',
            NOW() - INTERVAL '1 day'
        ),
        (
            sender_id, 
            recipient_id, 
            'Equipment Request Approval', 
            'The request for additional waste bins has been approved.',
            false,
            'direct',
            'normal',
            NOW() - INTERVAL '3 days',
            NOW() - INTERVAL '3 days'
        ),
        (
            sender_id, 
            recipient_id, 
            'Urgent: Vehicle Maintenance', 
            'Collection truck GH-456-20 requires immediate maintenance.',
            false,
            'direct',
            'urgent',
            NOW() - INTERVAL '12 hours',
            NOW() - INTERVAL '12 hours'
        );
END $$;

-- =============================================
-- 5. SEED LOGS TABLE
-- =============================================
INSERT INTO public.logs (
    level, source, message, module, context, created_at
) VALUES
    ('info', 'auth', 'User login successful', 'Authentication', '{"user_id": "system", "ip": "192.168.1.1"}', NOW() - INTERVAL '1 day'),
    ('warning', 'database', 'Slow query detected', 'Database', '{"query_id": "q123", "execution_time": 2.5}', NOW() - INTERVAL '2 days'),
    ('error', 'api', 'Failed to connect to external service', 'Integration', '{"service": "SMS Gateway", "error": "Connection timeout"}', NOW() - INTERVAL '3 days'),
    ('info', 'system', 'Scheduled backup completed', 'Maintenance', '{"backup_size": "1.2GB", "duration": 45}', NOW() - INTERVAL '4 days'),
    ('info', 'app', 'Report exported to CSV', 'Reports', '{"report_id": "rep123", "rows": 1250}', NOW() - INTERVAL '5 days'),
    ('warning', 'security', 'Multiple failed login attempts', 'Authentication', '{"attempts": 5, "ip": "192.168.1.100"}', NOW() - INTERVAL '2 days'),
    ('info', 'notifications', 'Push notification sent', 'Messaging', '{"recipients": 25, "type": "alert"}', NOW() - INTERVAL '8 hours'),
    ('critical', 'server', 'Database connection lost', 'System', '{"duration": 45, "affected_services": ["api", "dashboard"]}', NOW() - INTERVAL '7 days'),
    ('info', 'collector', 'New collector registered', 'Management', '{"name": "Kwame Asante", "region": "Ga North Municipal"}', NOW() - INTERVAL '10 days'),
    ('debug', 'app', 'Dashboard view rendered', 'Frontend', '{"render_time": 0.89, "components": 12}', NOW() - INTERVAL '6 hours');

-- =============================================
-- 6. SEED SERVICE_AREAS TABLE
-- =============================================
INSERT INTO public.service_areas (
    name, description, color, coordinates, bounds, 
    active_collectors, total_collectors, total_requests, 
    pending_requests, completion_rate, region, created_at, updated_at
) VALUES
    ('Ga North Municipal', 'Northern district of Greater Accra', '#3B82F6', 
     '[{"lat": 5.6500, "lng": -0.2800}, {"lat": 5.6700, "lng": -0.2600}, {"lat": 5.6300, "lng": -0.2400}, {"lat": 5.6100, "lng": -0.2600}]',
     '{"north": 5.6700, "south": 5.6100, "east": -0.2400, "west": -0.2800}',
     5, 8, 120, 15, 87.5, 'Greater Accra',
     NOW() - INTERVAL '60 days', NOW() - INTERVAL '5 days'),
    
    ('Ga South Municipal', 'Southern district of Greater Accra', '#F59E0B',
     '[{"lat": 5.5200, "lng": -0.2700}, {"lat": 5.5400, "lng": -0.2500}, {"lat": 5.5000, "lng": -0.2300}, {"lat": 5.4800, "lng": -0.2500}]',
     '{"north": 5.5400, "south": 5.4800, "east": -0.2300, "west": -0.2700}',
     6, 10, 145, 20, 86.2, 'Greater Accra',
     NOW() - INTERVAL '60 days', NOW() - INTERVAL '7 days'),
    
    ('Ga East Municipal', 'Eastern district of Greater Accra', '#10B981',
     '[{"lat": 5.6300, "lng": -0.1500}, {"lat": 5.6500, "lng": -0.1300}, {"lat": 5.6100, "lng": -0.1100}, {"lat": 5.5900, "lng": -0.1300}]',
     '{"north": 5.6500, "south": 5.5900, "east": -0.1100, "west": -0.1500}',
     4, 7, 95, 12, 87.3, 'Greater Accra',
     NOW() - INTERVAL '60 days', NOW() - INTERVAL '10 days'),
    
    ('Ga West Municipal', 'Western district of Greater Accra', '#8B5CF6',
     '[{"lat": 5.6000, "lng": -0.3200}, {"lat": 5.6200, "lng": -0.3000}, {"lat": 5.5800, "lng": -0.2800}, {"lat": 5.5600, "lng": -0.3000}]',
     '{"north": 5.6200, "south": 5.5600, "east": -0.2800, "west": -0.3200}',
     3, 6, 80, 18, 77.5, 'Greater Accra',
     NOW() - INTERVAL '60 days', NOW() - INTERVAL '8 days'),
    
    ('Accra Metropolitan', 'Central district of Greater Accra', '#EC4899',
     '[{"lat": 5.5600, "lng": -0.2200}, {"lat": 5.5800, "lng": -0.2000}, {"lat": 5.5400, "lng": -0.1800}, {"lat": 5.5200, "lng": -0.2000}]',
     '{"north": 5.5800, "south": 5.5200, "east": -0.1800, "west": -0.2200}',
     8, 12, 175, 22, 87.4, 'Greater Accra',
     NOW() - INTERVAL '60 days', NOW() - INTERVAL '3 days');

-- =============================================
-- 7. SEED WASTE_ITEMS TABLE
-- =============================================
INSERT INTO public.waste_items (
    type, weight, volume, unit, status, recycle_percentage, created_at, updated_at
) VALUES
    ('plastic', 2.5, 8.0, 'kg', 'processed', 80, NOW() - INTERVAL '15 days', NOW() - INTERVAL '14 days'),
    ('paper', 1.8, 4.0, 'kg', 'collected', 85, NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days'),
    ('glass', 3.2, 6.0, 'kg', 'processed', 90, NOW() - INTERVAL '13 days', NOW() - INTERVAL '12 days'),
    ('metal', 0.9, 0.5, 'kg', 'recycled', 95, NOW() - INTERVAL '12 days', NOW() - INTERVAL '11 days'),
    ('organic', 4.1, 12.0, 'kg', 'processed', 60, NOW() - INTERVAL '11 days', NOW() - INTERVAL '10 days'),
    ('electronic', 2.3, 5.0, 'kg', 'disposed', 40, NOW() - INTERVAL '10 days', NOW() - INTERVAL '9 days'),
    ('mixed', 6.7, 20.0, 'kg', 'sorted', 75, NOW() - INTERVAL '9 days', NOW() - INTERVAL '8 days'),
    ('hazardous', 0.5, 1.0, 'kg', 'disposed', 30, NOW() - INTERVAL '8 days', NOW() - INTERVAL '7 days'),
    ('plastic', 3.7, 10.0, 'kg', 'collected', 80, NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days'),
    ('glass', 2.8, 5.5, 'kg', 'processed', 90, NOW() - INTERVAL '6 days', NOW() - INTERVAL '5 days'),
    ('paper', 2.2, 6.0, 'kg', 'recycled', 85, NOW() - INTERVAL '5 days', NOW() - INTERVAL '4 days'),
    ('organic', 5.3, 15.0, 'kg', 'processed', 60, NOW() - INTERVAL '4 days', NOW() - INTERVAL '3 days'),
    ('mixed', 4.9, 16.0, 'kg', 'sorted', 70, NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days'),
    ('electronic', 1.7, 4.0, 'kg', 'disposed', 35, NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day'),
    ('metal', 1.2, 0.8, 'kg', 'recycled', 95, NOW() - INTERVAL '1 day', NOW() - INTERVAL '12 hours');

-- =============================================
-- 8. VERIFY DATA
-- =============================================
DO $$
BEGIN
    RAISE NOTICE 'Data seeding verification:';
    
    RAISE NOTICE 'illegal_dumping_reports: % rows', (SELECT COUNT(*) FROM public.illegal_dumping_reports);
    RAISE NOTICE 'batches: % rows', (SELECT COUNT(*) FROM public.batches);
    RAISE NOTICE 'notifications: % rows', (SELECT COUNT(*) FROM public.notifications);
    RAISE NOTICE 'messages: % rows', (SELECT COUNT(*) FROM public.messages);
    RAISE NOTICE 'logs: % rows', (SELECT COUNT(*) FROM public.logs);
    RAISE NOTICE 'service_areas: % rows', (SELECT COUNT(*) FROM public.service_areas);
    RAISE NOTICE 'waste_items: % rows', (SELECT COUNT(*) FROM public.waste_items);
END $$;

-- Final success message
SELECT 'All tables successfully seeded with realistic data!' as status;
