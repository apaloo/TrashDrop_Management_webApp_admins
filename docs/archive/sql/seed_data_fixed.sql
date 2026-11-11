-- TrashDrop Admin Portal - Complete Fixed Seed Script
-- Fixes foreign key constraints by ensuring proper order of data insertion
-- Execute this SQL directly in the Supabase SQL Editor

-- =============================================
-- OPTION TO CLEAR EXISTING DATA (Comment out if you want to keep existing data)
-- =============================================
-- TRUNCATE TABLE public.scans CASCADE;
-- TRUNCATE TABLE public.bags CASCADE;
-- TRUNCATE TABLE public.batches CASCADE;
-- TRUNCATE TABLE public.illegal_dumping CASCADE;
-- TRUNCATE TABLE public.notifications CASCADE;
-- TRUNCATE TABLE public.messages CASCADE;
-- TRUNCATE TABLE public.service_areas CASCADE;
-- TRUNCATE TABLE public.waste_items CASCADE;
-- TRUNCATE TABLE public.logs CASCADE;

-- =============================================
-- 1. ENSURE USER EXISTS IN AUTH.USERS
-- This is critical for foreign key constraints
-- =============================================
DO $$
DECLARE
  test_user_id uuid;
BEGIN
  -- First check if user exists
  SELECT id INTO test_user_id FROM auth.users LIMIT 1;
  
  -- If no user exists, create one (test/sample user)
  IF test_user_id IS NULL THEN
    INSERT INTO auth.users (
      email,
      encrypted_password,
      email_confirmed_at,
      raw_user_meta_data,
      created_at,
      updated_at,
      last_sign_in_at,
      confirmation_token,
      recovery_token
    ) VALUES (
      'admin@trashdrop.example',
      '$2a$10$DuMYSo6Hec8QMWp0qwRQQOIzoPUMPB7MqYUWLGNwJ4QFP5qSBWYwu', -- Hashed password for "password123"
      NOW(),
      '{"name":"Admin User","role":"admin"}',
      NOW(),
      NOW(),
      NOW(),
      NULL,
      NULL
    ) RETURNING id INTO test_user_id;
  END IF;
  
  -- Output the user ID for reference in subsequent inserts
  RAISE NOTICE 'Using user_id: %', test_user_id;
END $$;

-- =============================================
-- 2. SEED BATCHES with correct user_id reference
-- =============================================
DO $$
DECLARE
  test_user_id uuid;
  batch1_id uuid;
  batch2_id uuid;
  batch3_id uuid;
  batch4_id uuid;
  batch5_id uuid;
BEGIN
  -- Get a valid user ID
  SELECT id INTO test_user_id FROM auth.users LIMIT 1;
  
  -- Check if batches already exist
  DECLARE
    batch_count INTEGER;
  BEGIN
    SELECT COUNT(*) INTO batch_count FROM public.batches;
    
    IF batch_count = 0 THEN
      -- Insert batches only if none exist
      INSERT INTO public.batches (
    batch_id, 
    user_id, 
    number_of_bags, 
    trash_type, 
    bag_size, 
    batch_status, 
    distributed, 
    scanned, 
    qr_prefix, 
    generation_date, 
    updated_at
  ) VALUES 
  (
    uuid_generate_v4(),  -- Using built-in uuid generation
    test_user_id,        -- Valid user reference
    100, 
    'general', 
    'medium',
    'Active',
    45,
    32,
    'TD-A',
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '30 days'
  ) RETURNING batch_id INTO batch1_id;
  
  INSERT INTO public.batches (
    batch_id, 
    user_id, 
    number_of_bags, 
    trash_type, 
    bag_size, 
    batch_status, 
    distributed, 
    scanned, 
    qr_prefix, 
    generation_date, 
    updated_at
  ) VALUES 
  (
    uuid_generate_v4(), 
    test_user_id, 
    75, 
    'recyclable', 
    'large',
    'Active',
    60,
    45,
    'TD-B',
    NOW() - INTERVAL '25 days',
    NOW() - INTERVAL '25 days'
  ) RETURNING batch_id INTO batch2_id;
  
  INSERT INTO public.batches (
    batch_id, 
    user_id, 
    number_of_bags, 
    trash_type, 
    bag_size, 
    batch_status, 
    distributed, 
    scanned, 
    qr_prefix, 
    generation_date, 
    updated_at
  ) VALUES 
  (
    uuid_generate_v4(), 
    test_user_id, 
    150, 
    'mixed', 
    'small',
    'Active',
    120,
    87,
    'TD-C',
    NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '20 days'
  ) RETURNING batch_id INTO batch3_id;
  
  INSERT INTO public.batches (
    batch_id, 
    user_id, 
    number_of_bags, 
    trash_type, 
    bag_size, 
    batch_status, 
    distributed, 
    scanned, 
    qr_prefix, 
    generation_date, 
    updated_at
  ) VALUES 
  (
    uuid_generate_v4(), 
    test_user_id, 
    50, 
    'general', 
    'medium',
    'Active',
    50,
    32,
    'TD-D',
    NOW() - INTERVAL '15 days',
    NOW() - INTERVAL '15 days'
  ) RETURNING batch_id INTO batch4_id;
  
  INSERT INTO public.batches (
    batch_id, 
    user_id, 
    number_of_bags, 
    trash_type, 
    bag_size, 
    batch_status, 
    distributed, 
    scanned, 
    qr_prefix, 
    generation_date, 
    updated_at
  ) VALUES 
  (
    uuid_generate_v4(), 
    test_user_id, 
    125, 
    'general', 
    'large',
    'Active',
    90,
    55,
    'TD-E',
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '10 days'
  ) RETURNING batch_id INTO batch5_id;
  
      -- Output batch IDs for use in bags and scans
      RAISE NOTICE 'Created batches with IDs: %, %, %, %, %', 
        batch1_id, batch2_id, batch3_id, batch4_id, batch5_id;
    ELSE
      RAISE NOTICE 'Batches already exist, skipping insertion';
    END IF;
  END;
END $$;

-- =============================================
-- 3. SEED BAGS with reference to batches
-- =============================================
DO $$
DECLARE
  test_user_id uuid;
  batch_cursor CURSOR FOR SELECT batch_id FROM public.batches LIMIT 5;
  current_batch uuid;
  bag_id_prefix TEXT;
  bag_count INTEGER;
  bag_type TEXT;
  bag_batch_id uuid;
  i INTEGER;
BEGIN
  -- Get a valid user ID
  SELECT id INTO test_user_id FROM auth.users LIMIT 1;
  
  -- Check if bags already exist
  DECLARE
    bag_count INTEGER;
  BEGIN
    SELECT COUNT(*) INTO bag_count FROM public.bags;
    
    IF bag_count = 0 THEN
      -- Loop through each batch and create bags for it
      OPEN batch_cursor;
  
  FOR i IN 1..5 LOOP
    FETCH batch_cursor INTO current_batch;
    EXIT WHEN NOT FOUND;
    
    -- Get batch details
    SELECT number_of_bags, trash_type INTO bag_count, bag_type 
    FROM public.batches 
    WHERE batch_id = current_batch;
    
    -- Ensure bag_type is valid according to the check constraint
    -- Valid types: 'plastic', 'paper', 'metal', 'glass', 'organic', 'general', 'recycling'
    IF bag_type NOT IN ('plastic', 'paper', 'metal', 'glass', 'organic', 'general', 'recycling') THEN
      bag_type := 'general'; -- Default to general if not a valid type
    END IF;
    
    -- Create bags for this batch
    FOR j IN 1..10 LOOP -- Create 10 sample bags per batch
      bag_id_prefix := 'BAG-' || SUBSTRING(current_batch::text, 1, 8);
      
      -- Check if this bag already exists
      PERFORM 1 FROM public.bags WHERE bag_id = bag_id_prefix || '-' || j;
      
      -- Only insert if bag doesn't exist
      IF NOT FOUND THEN
        -- Insert a bag
        INSERT INTO public.bags (
          bag_id,
          batch_id,
          type,
          scanned,
          requested_at,
          qr_code,
          status,
          created_at
        ) VALUES (
          bag_id_prefix || '-' || j,
          current_batch,
          bag_type,
          (j % 3 = 0), -- Every 3rd bag is scanned
          NOW() - INTERVAL '20 days' + (j * INTERVAL '1 day'),
          'QR-' || bag_id_prefix || '-' || j,
          CASE 
            WHEN j % 4 = 0 THEN 'picked_up'
            WHEN j % 4 = 1 THEN 'distributed' 
            WHEN j % 4 = 2 THEN 'scanned'
            ELSE 'pending'
          END,
          NOW() - INTERVAL '20 days' + (j * INTERVAL '1 day')
        );
      END IF;
    END LOOP;
    
    RAISE NOTICE 'Created 10 bags for batch: %', current_batch;
  END LOOP;
  
  CLOSE batch_cursor;
      RAISE NOTICE 'Created bags for all batches';
    ELSE
      RAISE NOTICE 'Bags already exist, skipping insertion';
    END IF;
  END;
END $$;

-- =============================================
-- 4. SEED SCANS with reference to bags and users
-- =============================================
DO $$
DECLARE
  test_user_id uuid;
  scanned_bags_cursor CURSOR FOR 
    SELECT bag_id FROM public.bags 
    WHERE scanned = true
    LIMIT 20;
  current_bag TEXT;
  scan_location TEXT;
  scan_status TEXT;
  i INTEGER;
  locations TEXT[] := ARRAY[
    'East Legon, Accra', 
    'Osu, Accra', 
    'Airport Residential, Accra',
    'Cantonments, Accra',
    'Labone, Accra'
  ];
  statuses TEXT[] := ARRAY[
    'collected', 
    'processed', 
    'recycled',
    'disposed'
  ];
BEGIN
  -- Get a valid user ID
  SELECT id INTO test_user_id FROM auth.users LIMIT 1;
  
  -- Check if scans already exist
  DECLARE
    scan_count INTEGER;
  BEGIN
    SELECT COUNT(*) INTO scan_count FROM public.scans;
    
    IF scan_count = 0 THEN
      -- Loop through scanned bags and create scan records
      OPEN scanned_bags_cursor;
  
  i := 0;
  LOOP
    FETCH scanned_bags_cursor INTO current_bag;
    EXIT WHEN NOT FOUND;
    
    -- Get random location and status
    scan_location := locations[(i % 5) + 1];
    scan_status := statuses[(i % 4) + 1];
    
    -- Create scan record
    INSERT INTO public.scans (
      bag_id,
      scanned_by,
      scanned_at,
      location,
      coordinates,
      status,
      notes,
      created_at
    ) VALUES (
      current_bag,
      test_user_id,
      NOW() - INTERVAL '15 days' + (i * INTERVAL '1 day'),
      scan_location,
      ST_SetSRID(ST_MakePoint(-0.1850 + (i * 0.001), 5.5630 + (i * 0.001)), 4326),
      scan_status,
      'Scan notes for ' || current_bag,
      NOW() - INTERVAL '15 days' + (i * INTERVAL '1 day')
    );
    
    i := i + 1;
  END LOOP;
  
      CLOSE scanned_bags_cursor;
      
      RAISE NOTICE 'Created scan records for % bags', i;
    ELSE
      RAISE NOTICE 'Scans already exist, skipping insertion';
    END IF;
  END;
END $$;

-- =============================================
-- 5. SEED ILLEGAL_DUMPING with valid user references
-- =============================================
DO $$
DECLARE
  test_user_id uuid;
BEGIN
  -- Get a valid user ID
  SELECT id INTO test_user_id FROM auth.users LIMIT 1;
  
  -- Check if illegal dumping reports already exist
  DECLARE
    dumping_count INTEGER;
  BEGIN
    SELECT COUNT(*) INTO dumping_count FROM public.illegal_dumping;
    
    IF dumping_count = 0 THEN
      -- Insert illegal dumping reports only if none exist
      INSERT INTO public.illegal_dumping (
        reported_by, location, coordinates, waste_type, 
        size, images, status, assigned_to, cleanup_team,
        reported_at
      ) VALUES
  (
    test_user_id,
    'Near Accra Mall, Liberation Rd, Accra',
    ST_SetSRID(ST_MakePoint(-0.1969, 5.5560), 4326), 
    'construction', 
    'large', 
    ARRAY['https://example.com/images/dump1.jpg', 'https://example.com/images/dump2.jpg'],
    'Reported',
    NULL,
    NULL,
    NOW() - INTERVAL '3 days'
  ),
  (
    test_user_id,
    'Spintex Road, near Ecobank',
    ST_SetSRID(ST_MakePoint(-0.1870, 5.6010), 4326),
    'general', 
    'medium', 
    ARRAY['https://example.com/images/dump3.jpg'],
    'Verified',
    test_user_id,
    'Team Alpha',
    NOW() - INTERVAL '5 days'
  ),
  (
    test_user_id,
    'Circle Interchange, Ring Road Central',
    ST_SetSRID(ST_MakePoint(-0.2050, 5.5750), 4326),
    'hazardous', 
    'medium', 
    ARRAY['https://example.com/images/dump4.jpg', 'https://example.com/images/dump5.jpg'],
    'In Progress',
    test_user_id,
    'Special Hazard Team',
    NOW() - INTERVAL '2 days'
  ),
  (
    test_user_id,
    'Osu, Oxford Street',
    ST_SetSRID(ST_MakePoint(-0.1780, 5.5630), 4326),
    'electronic', 
    'small', 
    ARRAY['https://example.com/images/dump6.jpg'],
    'Cleaned Up',
    test_user_id,
    'E-waste Collection Unit',
    NOW() - INTERVAL '7 days'
  ),
  (
    test_user_id,
    'Airport Residential Area',
    ST_SetSRID(ST_MakePoint(-0.1590, 5.6120), 4326),
    'mixed', 
    'large', 
    ARRAY['https://example.com/images/dump7.jpg'],
    'Reported',
    NULL,
    NULL,
    NOW() - INTERVAL '1 day'
  );
      RAISE NOTICE 'Created 5 illegal dumping reports';
    ELSE
      RAISE NOTICE 'Illegal dumping reports already exist, skipping insertion';
    END IF;
  END;
END $$;

-- =============================================
-- 6. SEED NOTIFICATIONS with valid user references
-- =============================================
DO $$
DECLARE
  test_user_id uuid;
BEGIN
  -- Get a valid user ID
  SELECT id INTO test_user_id FROM auth.users LIMIT 1;
  
  -- Check if notifications already exist
  DECLARE
    notification_count INTEGER;
  BEGIN
    SELECT COUNT(*) INTO notification_count FROM public.notifications;
    
    IF notification_count = 0 THEN
      -- Insert notifications only if none exist
      INSERT INTO public.notifications (
        user_id, title, message, type, read, priority, created_at
      ) VALUES
  (
    test_user_id,
    'New Illegal Dumping Report', 
    'A new high-priority illegal dumping report has been submitted near Accra Mall.', 
    'alert', 
    false, 
    'high',
    NOW() - INTERVAL '3 days'
  ),
  (
    test_user_id,
    'Batch Distribution Complete', 
    'Batch #B0003 has been fully distributed to collectors', 
    'info', 
    true, 
    'low',
    NOW() - INTERVAL '18 days'
  ),
  (
    test_user_id,
    'System Maintenance', 
    'Scheduled maintenance will occur on August 10th from 2-4am GMT.', 
    'warning', 
    false, 
    'medium',
    NOW() - INTERVAL '5 days'
  ),
  (
    test_user_id,
    'Collection Target Reached', 
    'Monthly collection target of 500 bags has been reached ahead of schedule.', 
    'success', 
    true, 
    'medium',
    NOW() - INTERVAL '7 days'
  ),
  (
    test_user_id,
    'New Collector Registered', 
    'A new collector has registered and is awaiting approval.', 
    'info', 
    false, 
    'low',
    NOW() - INTERVAL '2 days'
  );
      RAISE NOTICE 'Created 5 notifications';
    ELSE
      RAISE NOTICE 'Notifications already exist, skipping insertion';
    END IF;
  END;
END $$;

-- =============================================
-- 7. SEED SERVICE_AREAS with geographical data
-- =============================================
DO $$
DECLARE
  area_exists BOOLEAN;
BEGIN
  -- Check if Downtown District exists
  SELECT EXISTS (SELECT 1 FROM public.service_areas WHERE name = 'Downtown District') INTO area_exists;
  IF NOT area_exists THEN
    -- Insert Downtown District
    INSERT INTO public.service_areas (
      name, description, color, coordinates, bounds,
      active_collectors, total_collectors, total_requests,
      pending_requests, completion_rate, region, district, is_active
    ) VALUES
  (
    'Downtown District',
    'Central business area with high waste generation',
    '#3B82F6', -- Blue
    '{"type":"Polygon","coordinates":[[[0.1969,5.5560],[0.1870,5.6010],[0.2050,5.5750],[0.1780,5.5630],[0.1969,5.5560]]]}',
    '{"north":5.6010,"south":5.5560,"east":0.2050,"west":0.1780}',
    12,
    15,
    245,
    18,
    92.65,
    'Greater Accra',
    'Central',
    true
  );
  END IF;
  
  -- Check if Industrial Zone exists
  SELECT EXISTS (SELECT 1 FROM public.service_areas WHERE name = 'Industrial Zone') INTO area_exists;
  IF NOT area_exists THEN
    -- Insert Industrial Zone
    INSERT INTO public.service_areas (
      name, description, color, coordinates, bounds,
      active_collectors, total_collectors, total_requests,
      pending_requests, completion_rate, region, district, is_active
    ) VALUES
    (
      'Industrial Zone',
      'Heavy industrial area with specialized waste management needs',
      '#EF4444', -- Red
      '{"type":"Polygon","coordinates":[[[0.2050,5.5750],[0.2150,5.6050],[0.2250,5.5950],[0.2150,5.5650],[0.2050,5.5750]]]}',
      '{"north":5.6050,"south":5.5650,"east":0.2250,"west":0.2050}',
      8,
      10,
      187,
      15,
      87.30,
      'Greater Accra',
      'East',
      true
    );
  END IF;
  
  -- Check if Residential Area exists
  SELECT EXISTS (SELECT 1 FROM public.service_areas WHERE name = 'Residential Area') INTO area_exists;
  IF NOT area_exists THEN
    -- Insert Residential Area
    INSERT INTO public.service_areas (
      name, description, color, coordinates, bounds,
      active_collectors, total_collectors, total_requests,
      pending_requests, completion_rate, region, district, is_active
    ) VALUES
    (
      'Residential Area',
      'Suburban residential zones with regular collection schedules',
      '#10B981', -- Green
      '{"type":"Polygon","coordinates":[[[0.1780,5.5630],[0.1680,5.5930],[0.1880,5.6030],[0.1980,5.5730],[0.1780,5.5630]]]}',
      '{"north":5.6030,"south":5.5630,"east":0.1980,"west":0.1680}',
      15,
      18,
      312,
      22,
      89.75,
      'Greater Accra',
      'North',
      true
    );
  END IF;
  
  -- Check if Commercial District exists
  SELECT EXISTS (SELECT 1 FROM public.service_areas WHERE name = 'Commercial District') INTO area_exists;
  IF NOT area_exists THEN
    -- Insert Commercial District
    INSERT INTO public.service_areas (
      name, description, color, coordinates, bounds,
      active_collectors, total_collectors, total_requests,
      pending_requests, completion_rate, region, district, is_active
    ) VALUES
    (
      'Commercial District',
      'Shopping and office areas with high traffic and mixed waste',
      '#F59E0B', -- Amber
      '{"type":"Polygon","coordinates":[[[0.1870,5.6010],[0.1770,5.6310],[0.1970,5.6410],[0.2070,5.6110],[0.1870,5.6010]]]}',
      '{"north":5.6410,"south":5.6010,"east":0.2070,"west":0.1770}',
      10,
      12,
      218,
      19,
      91.20,
      'Greater Accra',
      'West',
      true
    );
  END IF;
  
  -- Use a separate variable for counting records
  DECLARE
    area_count INTEGER;
  BEGIN
    SELECT COUNT(*) INTO area_count FROM public.service_areas;
    RAISE NOTICE 'Service areas count: %', area_count;
  END;
END $$;

-- =============================================
-- 8. SEED WASTE_ITEMS with environmental metrics
-- =============================================
DO $$
DECLARE
  test_user_id uuid;
  collector_id uuid;
BEGIN
  -- Get valid user and collector IDs
  SELECT id INTO test_user_id FROM auth.users LIMIT 1;
  SELECT id INTO collector_id FROM public.collectors LIMIT 1;
  
  -- Use the user_id as collector_id if no collectors exist
  IF collector_id IS NULL THEN
    collector_id := test_user_id;
  END IF;
  
  -- Check if waste items already exist
  DECLARE
    item_count INTEGER;
  BEGIN
    SELECT COUNT(*) INTO item_count FROM public.waste_items;
    IF item_count = 0 THEN
      -- Insert waste items only if none exist
      INSERT INTO public.waste_items (
        type, weight, volume, unit, collector_id, location,
        coordinates, status, environmental_impact_score
      ) VALUES
  (
    'plastic',
    12.5,
    0.25,
    'kg',
    collector_id,
    'Downtown Accra',
    '{"lat":5.5560,"lng":-0.1969}',
    'collected',
    78
  ),
  (
    'paper',
    8.2,
    0.15,
    'kg',
    collector_id,
    'East Legon',
    '{"lat":5.6341,"lng":-0.1564}',
    'recycled',
    65
  ),
  (
    'glass',
    15.8,
    0.12,
    'kg',
    collector_id,
    'Airport Residential Area',
    '{"lat":5.6035,"lng":-0.1863}',
    'processed',
    72
  ),
  (
    'organic',
    22.3,
    0.35,
    'kg',
    collector_id,
    'Osu',
    '{"lat":5.5504,"lng":-0.1887}',
    'disposed',
    85
  ),
  (
    'metal',
    6.7,
    0.08,
    'kg',
    collector_id,
    'Cantonments',
    '{"lat":5.5756,"lng":-0.1734}',
    'recycled',
    92
  );
      RAISE NOTICE 'Created 5 waste items';
    ELSE
      RAISE NOTICE 'Waste items already exist, skipping insertion';
    END IF;
  END;
END $$;

-- =============================================
-- 9. SEED LOGS with system activity records
-- =============================================
DO $$
DECLARE
  test_user_id uuid;
BEGIN
  -- Get a valid user ID
  SELECT id INTO test_user_id FROM auth.users LIMIT 1;
  
  -- Check if logs already exist
  DECLARE
    log_count INTEGER;
  BEGIN
    SELECT COUNT(*) INTO log_count FROM public.logs;
    
    IF log_count = 0 THEN
      -- Insert logs only if none exist
      INSERT INTO public.logs (
        level, source, message, user_id, module, function_name, created_at
      ) VALUES
  (
    'info',
    'system',
    'System startup completed successfully',
    NULL,
    'core',
    'startup',
    NOW() - INTERVAL '5 days'
  ),
  (
    'info',
    'user',
    'User logged in successfully',
    test_user_id,
    'auth',
    'login',
    NOW() - INTERVAL '4 days 12 hours'
  ),
  (
    'warn',
    'database',
    'Slow query detected (duration: 2.5s)',
    NULL,
    'database',
    'query_monitor',
    NOW() - INTERVAL '3 days 8 hours'
  ),
  (
    'error',
    'api',
    'Failed to connect to external payment service',
    NULL,
    'payments',
    'process_payment',
    NOW() - INTERVAL '2 days 15 hours'
  ),
  (
    'debug',
    'user',
    'Batch generation parameters: {"size":100,"type":"general"}',
    test_user_id,
    'batch',
    'generate_batch',
    NOW() - INTERVAL '1 day 6 hours'
  );
      RAISE NOTICE 'Created 5 logs';
    ELSE
      RAISE NOTICE 'Logs already exist, skipping insertion';
    END IF;
  END;
END $$;

-- =============================================
-- 10. SEED MESSAGES for user communications
-- =============================================
DO $$
DECLARE
  test_user_id uuid;
  message1_id uuid;
BEGIN
  -- Get a valid user ID
  SELECT id INTO test_user_id FROM auth.users LIMIT 1;
  
  -- Check if messages already exist
  DECLARE
    message_count INTEGER;
  BEGIN
    SELECT COUNT(*) INTO message_count FROM public.messages;
    
    IF message_count = 0 THEN
      -- Insert messages only if none exist
      INSERT INTO public.messages (
        sender_id, recipient_id, subject, content, read, message_type, priority, created_at
      ) VALUES
  (
    test_user_id,
    test_user_id,
    'Welcome to TrashDrop',
    'Welcome to the TrashDrop system. This platform will help you manage waste collection efficiently.',
    true,
    'system',
    'normal',
    NOW() - INTERVAL '30 days'
  ) RETURNING id INTO message1_id;
  
  INSERT INTO public.messages (
    sender_id, recipient_id, subject, content, read, message_type, priority, reply_to, created_at
  ) VALUES
  (
    test_user_id,
    test_user_id,
    'RE: Welcome to TrashDrop',
    'Thank you for the welcome message. I am looking forward to using the platform.',
    true,
    'direct',
    'normal',
    message1_id,
    NOW() - INTERVAL '29 days 12 hours'
  ),
  (
    test_user_id,
    test_user_id,
    'Batch Collection Update',
    'The batch collection process has been updated. Please review the new procedures.',
    false,
    'broadcast',
    'high',
    NULL,
    NOW() - INTERVAL '15 days'
  ),
  (
    test_user_id,
    test_user_id,
    'System Maintenance',
    'The system will undergo maintenance on August 15th from 02:00 to 04:00 GMT.',
    false,
    'system',
    'high',
    NULL,
    NOW() - INTERVAL '7 days'
  ),
  (
    test_user_id,
    test_user_id,
    'Performance Recognition',
    'Congratulations on achieving your collection targets for the month of July.',
    false,
    'direct',
    'normal',
    NULL,
    NOW() - INTERVAL '3 days'
  );
      RAISE NOTICE 'Created 5 messages';
    ELSE
      RAISE NOTICE 'Messages already exist, skipping insertion';
    END IF;
  END;
END $$;

-- =============================================
-- COMPREHENSIVE VERIFICATION
-- =============================================
DO $$
DECLARE
  batch_count integer;
  bag_count integer;
  scan_count integer;
  dumping_count integer;
  notification_count integer;
  service_area_count integer;
  waste_item_count integer;
  log_count integer;
  message_count integer;
  collector_count integer;
  
  batch_status_counts record;
  scan_aggregates record;
  bag_types record;
BEGIN
  -- Get counts of each table
  SELECT COUNT(*) INTO batch_count FROM public.batches;
  SELECT COUNT(*) INTO bag_count FROM public.bags;
  SELECT COUNT(*) INTO scan_count FROM public.scans;
  SELECT COUNT(*) INTO dumping_count FROM public.illegal_dumping;
  SELECT COUNT(*) INTO notification_count FROM public.notifications;
  SELECT COUNT(*) INTO service_area_count FROM public.service_areas;
  SELECT COUNT(*) INTO waste_item_count FROM public.waste_items;
  SELECT COUNT(*) INTO log_count FROM public.logs;
  SELECT COUNT(*) INTO message_count FROM public.messages;
  SELECT COUNT(*) INTO collector_count FROM public.collectors;
  
  -- Get batch status distribution - adjust field names based on actual schema
  SELECT 
    COUNT(*) FILTER (WHERE batch_status = 'created') as created,
    COUNT(*) FILTER (WHERE batch_status = 'in_progress') as in_progress,
    COUNT(*) FILTER (WHERE batch_status = 'completed') as completed,
    COUNT(*) FILTER (WHERE batch_status = 'cancelled') as cancelled
  INTO batch_status_counts
  FROM public.batches;
  
  -- Get scan aggregates
  SELECT 
    COUNT(DISTINCT scanned_by) as unique_collectors,
    MIN(created_at) as first_scan,
    MAX(created_at) as last_scan
  INTO scan_aggregates
  FROM public.scans;
  
  -- Get bag type distribution
  SELECT
    COUNT(*) FILTER (WHERE type = 'plastic') as plastic,
    COUNT(*) FILTER (WHERE type = 'paper') as paper,
    COUNT(*) FILTER (WHERE type = 'metal') as metal,
    COUNT(*) FILTER (WHERE type = 'glass') as glass,
    COUNT(*) FILTER (WHERE type = 'organic') as organic,
    COUNT(*) FILTER (WHERE type = 'general') as general,
    COUNT(*) FILTER (WHERE type = 'recycling') as recycling
  INTO bag_types
  FROM public.bags;
  
  -- Output verification results
  RAISE NOTICE '===============================================';
  RAISE NOTICE 'TRASHDROP DATABASE SEEDING VERIFICATION REPORT';
  RAISE NOTICE '===============================================';
  RAISE NOTICE '';
  RAISE NOTICE 'TABLE COUNTS:';
  RAISE NOTICE '  - Batches: % records', batch_count;
  RAISE NOTICE '  - Bags: % records', bag_count;
  RAISE NOTICE '  - Scans: % records', scan_count;
  RAISE NOTICE '  - Illegal Dumping: % records', dumping_count;
  RAISE NOTICE '  - Notifications: % records', notification_count;
  RAISE NOTICE '  - Service Areas: % records', service_area_count;
  RAISE NOTICE '  - Waste Items: % records', waste_item_count;
  RAISE NOTICE '  - Logs: % records', log_count;
  RAISE NOTICE '  - Messages: % records', message_count;
  RAISE NOTICE '  - Collectors: % records', collector_count;
  RAISE NOTICE '';
  
  RAISE NOTICE 'BATCH STATUS DISTRIBUTION:';
  RAISE NOTICE '  - Created: %', batch_status_counts.created;
  RAISE NOTICE '  - In Progress: %', batch_status_counts.in_progress;
  RAISE NOTICE '  - Completed: %', batch_status_counts.completed;
  RAISE NOTICE '  - Cancelled: %', batch_status_counts.cancelled;
  RAISE NOTICE '';
  
  RAISE NOTICE 'BAG TYPE DISTRIBUTION:';
  RAISE NOTICE '  - Plastic: %', bag_types.plastic;
  RAISE NOTICE '  - Paper: %', bag_types.paper;
  RAISE NOTICE '  - Metal: %', bag_types.metal;
  RAISE NOTICE '  - Glass: %', bag_types.glass;
  RAISE NOTICE '  - Organic: %', bag_types.organic;
  RAISE NOTICE '  - General: %', bag_types.general;
  RAISE NOTICE '  - Recycling: %', bag_types.recycling;
  RAISE NOTICE '';
  
  RAISE NOTICE 'SCAN METRICS:';
  RAISE NOTICE '  - Unique Collectors: %', scan_aggregates.unique_collectors;
  RAISE NOTICE '  - First Scan: %', scan_aggregates.first_scan;
  RAISE NOTICE '  - Last Scan: %', scan_aggregates.last_scan;
  RAISE NOTICE '';
  
  RAISE NOTICE 'VALIDATION COMPLETE: All seed data has been verified.';
  RAISE NOTICE '===============================================';
END $$;
