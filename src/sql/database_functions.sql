-- TrashDrop Management System - Database Functions
-- These functions should be executed in your Supabase database
-- Run these via the Supabase SQL editor with appropriate permissions

-- ============================================================================
-- PICKUP REQUEST MANAGEMENT FUNCTIONS
-- ============================================================================

-- Function to reserve a pickup request with timeout and conflict resolution
CREATE OR REPLACE FUNCTION reserve_pickup_request(
  p_request_id TEXT,
  p_collector_id UUID,
  p_reservation_duration_minutes INTEGER DEFAULT 15
) RETURNS JSON AS $$
DECLARE
  result JSON;
  current_status TEXT;
  current_reserved_by UUID;
  current_reserved_until TIMESTAMPTZ;
  new_reserved_until TIMESTAMPTZ;
BEGIN
  -- Calculate new reservation expiry
  new_reserved_until := NOW() + (p_reservation_duration_minutes || ' minutes')::INTERVAL;
  
  -- Lock the row and check current state
  SELECT status, reserved_by, reserved_until
  INTO current_status, current_reserved_by, current_reserved_until
  FROM pickup_requests 
  WHERE id = p_request_id
  FOR UPDATE;
  
  -- Check if request exists
  IF NOT FOUND THEN
    result := json_build_object(
      'success', false,
      'error', 'PICKUP_REQUEST_NOT_FOUND',
      'message', 'Pickup request not found'
    );
    RETURN result;
  END IF;
  
  -- Check if request is in valid state for reservation
  IF current_status NOT IN ('pending', 'assigned') THEN
    result := json_build_object(
      'success', false,
      'error', 'INVALID_STATUS',
      'message', 'Pickup request cannot be reserved in current status: ' || current_status,
      'current_status', current_status
    );
    RETURN result;
  END IF;
  
  -- Check if already reserved by another collector
  IF current_reserved_by IS NOT NULL 
     AND current_reserved_by != p_collector_id 
     AND current_reserved_until > NOW() THEN
    result := json_build_object(
      'success', false,
      'error', 'ALREADY_RESERVED',
      'message', 'Pickup request is already reserved by another collector',
      'reserved_by', current_reserved_by,
      'reserved_until', current_reserved_until
    );
    RETURN result;
  END IF;
  
  -- Update the reservation
  UPDATE pickup_requests 
  SET 
    reserved_by = p_collector_id,
    reserved_at = NOW(),
    reserved_until = new_reserved_until,
    status = CASE 
      WHEN status = 'pending' THEN 'assigned'
      ELSE status
    END,
    updated_at = NOW()
  WHERE id = p_request_id;
  
  -- Log the reservation in collector_sessions
  INSERT INTO collector_sessions (collector_id, reserved_requests, last_activity)
  VALUES (p_collector_id, ARRAY[p_request_id::UUID], NOW())
  ON CONFLICT (collector_id) 
  DO UPDATE SET
    reserved_requests = CASE
      WHEN p_request_id::UUID = ANY(collector_sessions.reserved_requests) THEN collector_sessions.reserved_requests
      ELSE array_append(collector_sessions.reserved_requests, p_request_id::UUID)
    END,
    last_activity = NOW();
  
  result := json_build_object(
    'success', true,
    'message', 'Pickup request reserved successfully',
    'request_id', p_request_id,
    'collector_id', p_collector_id,
    'reserved_until', new_reserved_until
  );
  
  RETURN result;
  
EXCEPTION
  WHEN OTHERS THEN
    result := json_build_object(
      'success', false,
      'error', 'SYSTEM_ERROR',
      'message', 'An error occurred while reserving pickup request: ' || SQLERRM
    );
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to release expired reservations (call periodically)
CREATE OR REPLACE FUNCTION release_expired_reservations() 
RETURNS JSON AS $$
DECLARE
  affected_count INTEGER;
  result JSON;
BEGIN
  -- Update expired reservations
  WITH expired_reservations AS (
    UPDATE pickup_requests 
    SET 
      reserved_by = NULL,
      reserved_at = NULL,
      reserved_until = NULL,
      status = CASE 
        WHEN status = 'assigned' THEN 'pending'
        ELSE status
      END,
      updated_at = NOW()
    WHERE reserved_until < NOW() 
      AND reserved_by IS NOT NULL
    RETURNING id, reserved_by
  )
  SELECT COUNT(*) INTO affected_count FROM expired_reservations;
  
  -- Clean up collector sessions
  UPDATE collector_sessions 
  SET reserved_requests = array_remove(reserved_requests, request_id)
  FROM (
    SELECT UNNEST(reserved_requests) as request_id, collector_id as session_collector_id
    FROM collector_sessions
  ) sub
  JOIN pickup_requests pr ON pr.id::TEXT = sub.request_id::TEXT
  WHERE pr.reserved_until < NOW() OR pr.reserved_by IS NULL;
  
  result := json_build_object(
    'success', true,
    'released_count', affected_count,
    'timestamp', NOW()
  );
  
  RETURN result;
  
EXCEPTION
  WHEN OTHERS THEN
    result := json_build_object(
      'success', false,
      'error', 'SYSTEM_ERROR',
      'message', 'Error releasing expired reservations: ' || SQLERRM
    );
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- QR CODE SCANNING FUNCTIONS
-- ============================================================================

-- Function for atomic bag scanning with validation
CREATE OR REPLACE FUNCTION atomic_bag_scan(
  p_bag_id TEXT,
  p_collector_id UUID,
  p_scan_location POINT,
  p_scan_timestamp TIMESTAMPTZ
) RETURNS JSON AS $$
DECLARE
  result JSON;
  bag_status TEXT;
  bag_batch_id UUID;
  current_scanned BOOLEAN;
  scan_id UUID;
BEGIN
  -- Lock and validate the bag
  SELECT status, batch_id, scanned
  INTO bag_status, bag_batch_id, current_scanned
  FROM bags 
  WHERE bag_id = p_bag_id
  FOR UPDATE;
  
  -- Check if bag exists
  IF NOT FOUND THEN
    result := json_build_object(
      'success', false,
      'error', 'BAG_NOT_FOUND',
      'message', 'Bag not found: ' || p_bag_id
    );
    RETURN result;
  END IF;
  
  -- Check if already scanned
  IF current_scanned = true THEN
    result := json_build_object(
      'success', false,
      'error', 'ALREADY_SCANNED',
      'message', 'Bag has already been scanned',
      'bag_id', p_bag_id
    );
    RETURN result;
  END IF;
  
  -- Check bag status
  IF bag_status NOT IN ('active', 'distributed') THEN
    result := json_build_object(
      'success', false,
      'error', 'INVALID_BAG_STATUS',
      'message', 'Bag cannot be scanned in current status: ' || bag_status
    );
    RETURN result;
  END IF;
  
  -- Generate scan ID
  scan_id := gen_random_uuid();
  
  -- Create scan record
  INSERT INTO scans (
    id,
    bag_id,
    scanned_by,
    scanned_at,
    location,
    created_at
  ) VALUES (
    scan_id,
    p_bag_id,
    p_collector_id,
    p_scan_timestamp,
    p_scan_location,
    NOW()
  );
  
  -- Update bag status
  UPDATE bags 
  SET 
    scanned = true,
    picked_up_at = p_scan_timestamp,
    picked_up_by = p_collector_id,
    status = 'collected',
    updated_at = NOW()
  WHERE bag_id = p_bag_id;
  
  -- Update batch statistics if batch_id exists
  IF bag_batch_id IS NOT NULL THEN
    UPDATE batches 
    SET 
      scanned = scanned + 1,
      updated_at = NOW()
    WHERE batch_id = bag_batch_id;
  END IF;
  
  result := json_build_object(
    'success', true,
    'message', 'Bag scanned successfully',
    'scan_id', scan_id,
    'bag_id', p_bag_id,
    'collector_id', p_collector_id,
    'scanned_at', p_scan_timestamp
  );
  
  RETURN result;
  
EXCEPTION
  WHEN OTHERS THEN
    result := json_build_object(
      'success', false,
      'error', 'SYSTEM_ERROR',
      'message', 'Error scanning bag: ' || SQLERRM
    );
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- DIGITAL BIN MANAGEMENT FUNCTIONS
-- ============================================================================

-- Function to create digital bin with validation
CREATE OR REPLACE FUNCTION create_digital_bin(
  p_user_id UUID,
  p_location_id UUID,
  p_frequency VARCHAR,
  p_waste_type VARCHAR,
  p_bag_count INTEGER,
  p_special_instructions TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  result JSON;
  bin_id UUID;
  qr_code_url TEXT;
  expires_at TIMESTAMPTZ;
BEGIN
  -- Validate inputs
  IF p_bag_count < 1 OR p_bag_count > 10 THEN
    result := json_build_object(
      'success', false,
      'error', 'INVALID_BAG_COUNT',
      'message', 'Bag count must be between 1 and 10'
    );
    RETURN result;
  END IF;
  
  -- Calculate expiry based on frequency
  expires_at := CASE p_frequency
    WHEN 'weekly' THEN NOW() + INTERVAL '7 days'
    WHEN 'biweekly' THEN NOW() + INTERVAL '14 days'
    WHEN 'monthly' THEN NOW() + INTERVAL '30 days'
    ELSE NOW() + INTERVAL '7 days'
  END;
  
  -- Generate unique ID and QR code
  bin_id := gen_random_uuid();
  qr_code_url := 'https://trashdrop.com/bin/' || bin_id::TEXT;
  
  -- Insert digital bin
  INSERT INTO digital_bins (
    id,
    user_id,
    location_id,
    qr_code_url,
    frequency,
    waste_type,
    bag_count,
    special_instructions,
    expires_at,
    created_at
  ) VALUES (
    bin_id,
    p_user_id,
    p_location_id,
    qr_code_url,
    p_frequency,
    p_waste_type,
    p_bag_count,
    p_special_instructions,
    expires_at,
    NOW()
  );
  
  result := json_build_object(
    'success', true,
    'message', 'Digital bin created successfully',
    'bin_id', bin_id,
    'qr_code_url', qr_code_url,
    'expires_at', expires_at
  );
  
  RETURN result;
  
EXCEPTION
  WHEN OTHERS THEN
    result := json_build_object(
      'success', false,
      'error', 'SYSTEM_ERROR',
      'message', 'Error creating digital bin: ' || SQLERRM
    );
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ILLEGAL DUMPING MANAGEMENT FUNCTIONS
-- ============================================================================

-- Function to verify dumping report and create admin workflow entry
CREATE OR REPLACE FUNCTION verify_dumping_report(
  p_report_id UUID,
  p_admin_id UUID,
  p_notes TEXT DEFAULT ''
) RETURNS JSON AS $$
DECLARE
  result JSON;
  report_data RECORD;
  dumping_id UUID;
BEGIN
  -- Get original report data
  SELECT * INTO report_data
  FROM dumping_reports
  WHERE id = p_report_id;
  
  IF NOT FOUND THEN
    result := json_build_object(
      'success', false,
      'error', 'REPORT_NOT_FOUND',
      'message', 'Dumping report not found'
    );
    RETURN result;
  END IF;
  
  -- Generate new dumping ID
  dumping_id := gen_random_uuid();
  
  -- Create illegal_dumping record
  INSERT INTO illegal_dumping (
    id,
    report_id,
    location,
    coordinates,
    waste_type,
    severity,
    size_estimate,
    photos,
    status,
    reported_by,
    verified_by,
    created_at,
    original_report_id
  ) VALUES (
    dumping_id,
    p_report_id,
    report_data.location,
    report_data.coordinates,
    report_data.waste_type,
    report_data.severity,
    report_data.estimated_volume,
    report_data.photos,
    'verified',
    report_data.user_id,
    p_admin_id,
    NOW(),
    p_report_id
  );
  
  -- Create history record
  INSERT INTO illegal_dumping_history (
    report_id,
    previous_status,
    new_status,
    changed_by,
    notes,
    created_at
  ) VALUES (
    dumping_id,
    'reported',
    'verified',
    p_admin_id,
    COALESCE(p_notes, 'Report verified by admin'),
    NOW()
  );
  
  result := json_build_object(
    'success', true,
    'message', 'Dumping report verified successfully',
    'dumping_id', dumping_id,
    'status', 'verified'
  );
  
  RETURN result;
  
EXCEPTION
  WHEN OTHERS THEN
    result := json_build_object(
      'success', false,
      'error', 'SYSTEM_ERROR',
      'message', 'Error verifying dumping report: ' || SQLERRM
    );
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- Function to get system health metrics
CREATE OR REPLACE FUNCTION get_system_health()
RETURNS JSON AS $$
DECLARE
  result JSON;
  active_collectors INTEGER;
  pending_requests INTEGER;
  expired_reservations INTEGER;
  active_bins INTEGER;
BEGIN
  -- Count active collectors
  SELECT COUNT(*) INTO active_collectors
  FROM collectors 
  WHERE status = 'active';
  
  -- Count pending pickup requests
  SELECT COUNT(*) INTO pending_requests
  FROM pickup_requests 
  WHERE status = 'pending';
  
  -- Count expired reservations that need cleanup
  SELECT COUNT(*) INTO expired_reservations
  FROM pickup_requests 
  WHERE reserved_until < NOW() AND reserved_by IS NOT NULL;
  
  -- Count active digital bins
  SELECT COUNT(*) INTO active_bins
  FROM digital_bins 
  WHERE is_active = true AND expires_at > NOW();
  
  result := json_build_object(
    'timestamp', NOW(),
    'active_collectors', active_collectors,
    'pending_requests', pending_requests,
    'expired_reservations', expired_reservations,
    'active_digital_bins', active_bins,
    'status', 'healthy'
  );
  
  RETURN result;
  
EXCEPTION
  WHEN OTHERS THEN
    result := json_build_object(
      'timestamp', NOW(),
      'status', 'error',
      'error', SQLERRM
    );
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_pickup_requests_status ON pickup_requests(status);
CREATE INDEX IF NOT EXISTS idx_pickup_requests_reserved ON pickup_requests(reserved_by, reserved_until);
CREATE INDEX IF NOT EXISTS idx_bags_batch_id ON bags(batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scans_bag_id ON scans(bag_id);
CREATE INDEX IF NOT EXISTS idx_digital_bins_active ON digital_bins(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_illegal_dumping_status ON illegal_dumping(status);
CREATE INDEX IF NOT EXISTS idx_collector_sessions_active ON collector_sessions(collector_id, is_active);

-- Create triggers for automatic cleanup (run periodically)
-- You can set these up as cron jobs in Supabase or call manually
-- SELECT release_expired_reservations();
-- SELECT get_system_health();
