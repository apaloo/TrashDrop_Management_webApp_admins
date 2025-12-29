-- Create function to extract coordinates from PostGIS geometry
-- This allows the admin portal to work with coordinate data

-- =============================================
-- Function: Extract Coordinates from Geometry
-- =============================================
-- Drop existing function if it exists (needed when changing return types)
DROP FUNCTION IF EXISTS extract_coordinates_from_geometry(uuid);

CREATE OR REPLACE FUNCTION extract_coordinates_from_geometry(report_id uuid)
RETURNS TABLE (
    id uuid,
    latitude double precision,
    longitude double precision
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        ST_Y(d.coordinates::geometry) as latitude,
        ST_X(d.coordinates::geometry) as longitude
    FROM public.illegal_dumping_mobile d
    WHERE d.id = report_id
    AND d.coordinates IS NOT NULL;
END;
$$;

-- =============================================
-- Function: Get All Reports with Extracted Coordinates
-- =============================================
-- Drop existing function if it exists (needed when changing return types)
DROP FUNCTION IF EXISTS get_illegal_dumping_with_coordinates();

CREATE OR REPLACE FUNCTION get_illegal_dumping_with_coordinates()
RETURNS TABLE (
    id uuid,
    reported_by uuid,
    location text,
    latitude double precision,
    longitude double precision,
    waste_type text,
    severity text,
    size text,
    photos text[],
    status text,
    created_at timestamptz,
    updated_at timestamptz
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
        COALESCE(d.latitude::double precision, ST_Y(d.coordinates::geometry)) as latitude,
        COALESCE(d.longitude::double precision, ST_X(d.coordinates::geometry)) as longitude,
        d.waste_type,
        d.severity,
        d.size,
        COALESCE(d.photos, '{}'::text[]) as photos,
        d.status,
        d.created_at,
        d.updated_at
    FROM public.illegal_dumping_mobile d
    ORDER BY d.created_at DESC;
END;
$$;

-- =============================================
-- Function: Clean Blob URLs from Photos
-- =============================================
-- Drop existing function if it exists (needed when changing return types)
DROP FUNCTION IF EXISTS clean_blob_urls_from_photos();

CREATE OR REPLACE FUNCTION clean_blob_urls_from_photos()
RETURNS TABLE (
    id uuid,
    old_photo_count integer,
    new_photo_count integer,
    removed_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    report_record RECORD;
    cleaned_photos text[];
    old_count integer;
    new_count integer;
BEGIN
    FOR report_record IN 
        SELECT id, photos 
        FROM public.illegal_dumping_mobile 
        WHERE photos IS NOT NULL 
        AND ARRAY_TO_STRING(photos, ',') LIKE '%blob:%'
    LOOP
        -- Get original count
        old_count := COALESCE(ARRAY_LENGTH(report_record.photos, 1), 0);
        
        -- Filter out blob URLs
        SELECT ARRAY_AGG(photo)
        INTO cleaned_photos
        FROM UNNEST(report_record.photos) AS photo
        WHERE photo NOT LIKE 'blob:%';
        
        -- Handle case where all photos were blob URLs
        IF cleaned_photos IS NULL THEN
            cleaned_photos := '{}'::text[];
        END IF;
        
        -- Get new count
        new_count := COALESCE(ARRAY_LENGTH(cleaned_photos, 1), 0);
        
        -- Update the record
        UPDATE public.illegal_dumping_mobile
        SET photos = cleaned_photos
        WHERE id = report_record.id;
        
        -- Return the result
        id := report_record.id;
        old_photo_count := old_count;
        new_photo_count := new_count;
        removed_count := old_count - new_count;
        
        RETURN NEXT;
    END LOOP;
    
    RETURN;
END;
$$;

-- =============================================
-- Function: Validate Photo URLs
-- =============================================
-- Drop existing function if it exists (needed when changing return types)
DROP FUNCTION IF EXISTS validate_photo_urls();

CREATE OR REPLACE FUNCTION validate_photo_urls()
RETURNS TABLE (
    id uuid,
    has_blob_urls boolean,
    has_data_urls boolean,
    has_valid_urls boolean,
    photo_count integer,
    invalid_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        ARRAY_TO_STRING(d.photos, ',') LIKE '%blob:%' as has_blob_urls,
        ARRAY_TO_STRING(d.photos, ',') LIKE '%data:%' as has_data_urls,
        ARRAY_TO_STRING(d.photos, ',') LIKE '%http%' as has_valid_urls,
        COALESCE(ARRAY_LENGTH(d.photos, 1), 0) as photo_count,
        (
            SELECT COUNT(*)::integer
            FROM UNNEST(COALESCE(d.photos, '{}'::text[])) AS photo
            WHERE photo LIKE 'blob:%' OR photo LIKE 'data:%'
        ) as invalid_count
    FROM public.illegal_dumping_mobile d;
END;
$$;

-- =============================================
-- Grant Permissions
-- =============================================
GRANT EXECUTE ON FUNCTION extract_coordinates_from_geometry(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_illegal_dumping_with_coordinates() TO authenticated;
GRANT EXECUTE ON FUNCTION clean_blob_urls_from_photos() TO authenticated;
GRANT EXECUTE ON FUNCTION validate_photo_urls() TO authenticated;

-- =============================================
-- Test the Functions
-- =============================================

-- Test coordinate extraction
SELECT 'Testing coordinate extraction...' as status;
SELECT * FROM extract_coordinates_from_geometry('01d4ae93-b452-4a33-90d3-a51da93b2ad8');

-- Test getting all reports with coordinates
SELECT 'Testing get all reports with coordinates...' as status;
SELECT id, latitude, longitude, location FROM get_illegal_dumping_with_coordinates() LIMIT 5;

-- Test photo URL validation
SELECT 'Testing photo URL validation...' as status;
SELECT * FROM validate_photo_urls();

-- Test cleaning blob URLs (run this to actually clean the data)
-- SELECT 'Cleaning blob URLs...' as status;
-- SELECT * FROM clean_blob_urls_from_photos();

SELECT 'Functions created successfully!' as status;
