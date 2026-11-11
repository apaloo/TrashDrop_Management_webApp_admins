-- TrashDrop Admin Portal - Seed Data for Existing Tables
-- Execute this SQL directly in the Supabase SQL Editor

-- =============================================
-- OPTION TO CLEAR EXISTING DATA (Comment out if you want to keep existing data)
-- =============================================
-- TRUNCATE TABLE public.illegal_dumping CASCADE;
-- TRUNCATE TABLE public.notifications CASCADE;
-- TRUNCATE TABLE public.messages CASCADE;
-- TRUNCATE TABLE public.service_areas CASCADE;
-- TRUNCATE TABLE public.waste_items CASCADE;
-- TRUNCATE TABLE public.logs CASCADE;
-- TRUNCATE TABLE public.batches CASCADE;

-- =============================================
-- 1. SEED ILLEGAL_DUMPING (Using PostGIS for geometry)
-- =============================================
INSERT INTO public.illegal_dumping (
    reported_by, location, coordinates, waste_type, 
    size, images, status, assigned_to, cleanup_team,
    cleanup_assigned, estimated_cleanup_date
) VALUES
    (
        (SELECT id FROM auth.users LIMIT 1), 
        'Near Accra Mall, Liberation Rd, Accra',
        ST_SetSRID(ST_MakePoint(-0.1969, 5.5560), 4326), 
        'construction', 
        'large', 
        ARRAY['https://example.com/images/dump1.jpg', 'https://example.com/images/dump2.jpg'],
        'Reported',
        NULL,
        NULL,
        false,
        NULL
    ),
    (
        (SELECT id FROM auth.users LIMIT 1), 
        'Spintex Road, near Ecobank',
        ST_SetSRID(ST_MakePoint(-0.1870, 5.6010), 4326),
        'household', 
        'medium', 
        ARRAY['https://example.com/images/dump3.jpg'],
        'Verified',
        (SELECT id FROM auth.users LIMIT 1),
        'Team Alpha',
        true,
        NOW() + INTERVAL '2 days'
    ),
    (
        (SELECT id FROM auth.users LIMIT 1), 
        'Circle Interchange, Ring Road Central',
        ST_SetSRID(ST_MakePoint(-0.2050, 5.5750), 4326),
        'hazardous', 
        'medium', 
        ARRAY['https://example.com/images/dump4.jpg', 'https://example.com/images/dump5.jpg'],
        'In Progress',
        (SELECT id FROM auth.users LIMIT 1),
        'Special Hazard Team',
        true,
        NOW() + INTERVAL '1 day'
    ),
    (
        (SELECT id FROM auth.users LIMIT 1), 
        'Osu, Oxford Street',
        ST_SetSRID(ST_MakePoint(-0.1780, 5.5630), 4326),
        'electronic', 
        'small', 
        ARRAY['https://example.com/images/dump6.jpg'],
        'Cleaned Up',
        (SELECT id FROM auth.users LIMIT 1),
        'E-waste Collection Unit',
        true,
        NOW() - INTERVAL '1 day'
    ),
    (
        (SELECT id FROM auth.users LIMIT 1), 
        'Airport Residential Area',
        ST_SetSRID(ST_MakePoint(-0.1590, 5.6120), 4326),
        'mixed', 
        'large', 
        ARRAY['https://example.com/images/dump7.jpg'],
        'Reported',
        NULL,
        NULL,
        false,
        NULL
    );

-- =============================================
-- 2. SEED BATCHES (Make sure to use bag_count, not quantity)
-- =============================================
INSERT INTO public.batches (
    id, bag_count, status, created_at, updated_at
) VALUES
    ('b0001', 100, 'active', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'),
    ('b0002', 75, 'active', NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days'),
    ('b0003', 150, 'active', NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days'),
    ('b0004', 50, 'inactive', NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days'),
    ('b0005', 125, 'active', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days');

-- =============================================
-- 3. SEED NOTIFICATIONS
-- =============================================
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
        NOW() - INTERVAL '3 days'
    ),
    (
        (SELECT id FROM auth.users LIMIT 1), 
        'Batch Distribution Complete', 
        'Batch #B0003 has been fully distributed to collectors', 
        'info', 
        true, 
        'low',
        NOW() - INTERVAL '18 days'
    ),
    (
        (SELECT id FROM auth.users LIMIT 1), 
        'System Maintenance', 
        'Scheduled maintenance will occur on August 10th from 2-4am GMT.', 
        'warning', 
        false, 
        'medium',
        NOW() - INTERVAL '5 days'
    ),
    (
        (SELECT id FROM auth.users LIMIT 1), 
        'Collection Target Reached', 
        'Monthly collection target of 500 bags has been reached ahead of schedule.', 
        'success', 
        true, 
        'medium',
        NOW() - INTERVAL '7 days'
    ),
    (
        (SELECT id FROM auth.users LIMIT 1), 
        'New Collector Registered', 
        'A new collector has registered and is awaiting approval.', 
        'info', 
        false, 
        'low',
        NOW() - INTERVAL '2 days'
    ),
    (
        (SELECT id FROM auth.users LIMIT 1), 
        'Account Settings Updated', 
        'Your account settings have been updated successfully.', 
        'success', 
        true, 
        'low',
        NOW() - INTERVAL '10 days'
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

-- =============================================
-- 4. SEED MESSAGES
-- =============================================
INSERT INTO public.messages (
    sender_id, recipient_id, subject, content, read, message_type, priority, created_at
) VALUES
    (
        (SELECT id FROM auth.users LIMIT 1), 
        (SELECT id FROM auth.users LIMIT 1), 
        'Waste Collection Schedule Update', 
        'We need to adjust the collection schedule for East Legon next week due to road construction.',
        true,
        'direct',
        'normal',
        NOW() - INTERVAL '5 days'
    ),
    (
        (SELECT id FROM auth.users LIMIT 1), 
        (SELECT id FROM auth.users LIMIT 1), 
        'System Notification: New Reports', 
        'There has been a 25% increase in illegal dumping reports in the Ga South region this week.',
        false,
        'system',
        'high',
        NOW() - INTERVAL '4 days'
    ),
    (
        (SELECT id FROM auth.users LIMIT 1), 
        (SELECT id FROM auth.users LIMIT 1), 
        'Monthly Performance Report', 
        'The performance report for July 2025 is now available for review.',
        true,
        'broadcast',
        'normal',
        NOW() - INTERVAL '6 days'
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

-- =============================================
-- 5. SEED LOGS
-- =============================================
INSERT INTO public.logs (
    level, source, message, module, context, created_at
) VALUES
    ('info', 'auth', 'User login successful', 'Authentication', '{"user_id": "system", "ip": "192.168.1.1"}', NOW() - INTERVAL '1 day'),
    ('error', 'api', 'Database connection timeout', 'Data Access', '{"endpoint": "/api/reports", "duration": 5000}', NOW() - INTERVAL '2 days'),
    ('warning', 'app', 'Low storage space detected', 'System', '{"available": "1.2GB", "threshold": "2GB"}', NOW() - INTERVAL '12 hours'),
    ('info', 'reports', 'Monthly report generated successfully', 'Reporting', '{"report_id": "MR-2025-08", "pages": 12}', NOW() - INTERVAL '3 days'),
    ('critical', 'security', 'Multiple failed login attempts detected', 'Authentication', '{"attempts": 5, "ip": "192.168.1.100"}', NOW() - INTERVAL '6 hours'),
    ('info', 'notification', 'Push notifications sent to collectors', 'Messaging', '{"sent": 24, "failed": 0}', NOW() - INTERVAL '2 days'),
    ('warning', 'payment', 'Payment gateway timeout', 'Finance', '{"transaction_id": "TX123456", "amount": 500}', NOW() - INTERVAL '5 days'),
    ('error', 'sync', 'Mobile data synchronization failed', 'Integration', '{"device_id": "M12345", "records": 32}', NOW() - INTERVAL '4 days'),
    ('info', 'system', 'Scheduled backup completed', 'Maintenance', '{"backup_size": "1.2GB", "duration": 45}', NOW() - INTERVAL '4 days'),
    ('info', 'app', 'Report exported to CSV', 'Reports', '{"report_id": "rep123", "rows": 1250}', NOW() - INTERVAL '5 days');

-- =============================================
-- 6. SEED SERVICE_AREAS
-- =============================================
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

-- =============================================
-- 7. SEED WASTE_ITEMS
-- =============================================
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
    ('hazardous', 0.5, 1.0, 'kg', 'disposed', 30),
    ('plastic', 3.7, 10.0, 'kg', 'collected', 80),
    ('paper', 2.2, 6.0, 'kg', 'recycled', 85),
    ('glass', 1.5, 2.0, 'kg', 'collected', 90),
    ('metal', 1.2, 0.8, 'kg', 'processed', 95),
    ('organic', 5.5, 15.0, 'kg', 'composted', 60),
    ('electronic', 3.1, 7.0, 'kg', 'recycled', 40),
    ('recyclable', 4.3, 9.0, 'kg', 'sorted', 85);

-- =============================================
-- VERIFICATION
-- =============================================
DO $$
BEGIN
    RAISE NOTICE 'Verifying data insertion...';
    
    RAISE NOTICE 'Table: illegal_dumping - % rows', (SELECT COUNT(*) FROM public.illegal_dumping);
    RAISE NOTICE 'Table: batches - % rows', (SELECT COUNT(*) FROM public.batches);
    RAISE NOTICE 'Table: notifications - % rows', (SELECT COUNT(*) FROM public.notifications);
    RAISE NOTICE 'Table: messages - % rows', (SELECT COUNT(*) FROM public.messages);
    RAISE NOTICE 'Table: logs - % rows', (SELECT COUNT(*) FROM public.logs);
    RAISE NOTICE 'Table: service_areas - % rows', (SELECT COUNT(*) FROM public.service_areas);
    RAISE NOTICE 'Table: waste_items - % rows', (SELECT COUNT(*) FROM public.waste_items);
    
    RAISE NOTICE 'Data seeding completed successfully!';
END $$;
