-- Fix Blob URLs and Extract Coordinates from PostGIS Geometry
-- This script addresses the issues with the illegal dumping data:
-- 1. Removes invalid blob URLs from photos array
-- 2. Extracts lat/lng from PostGIS geometry into separate columns
-- 3. Attempts to add location description

-- =============================================
-- Step 1: Add latitude and longitude columns if they don't exist
-- =============================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'illegal_dumping_mobile' 
                   AND column_name = 'latitude') THEN
        ALTER TABLE public.illegal_dumping_mobile 
        ADD COLUMN latitude numeric(10, 8);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'illegal_dumping_mobile' 
                   AND column_name = 'longitude') THEN
        ALTER TABLE public.illegal_dumping_mobile 
        ADD COLUMN longitude numeric(11, 8);
    END IF;
END $$;

-- =============================================
-- Step 2: Extract coordinates from PostGIS geometry
-- =============================================
UPDATE public.illegal_dumping_mobile
SET 
    latitude = ST_Y(coordinates::geometry),
    longitude = ST_X(coordinates::geometry)
WHERE coordinates IS NOT NULL;

-- =============================================
-- Step 3: Clean up blob URLs from photos array
-- =============================================
UPDATE public.illegal_dumping_mobile
SET photos = (
    SELECT ARRAY_AGG(photo)
    FROM UNNEST(photos) AS photo
    WHERE photo NOT LIKE 'blob:%'
)
WHERE photos IS NOT NULL 
  AND ARRAY_TO_STRING(photos, ',') LIKE '%blob:%';

-- =============================================
-- Step 4: Set photos to empty array if all were blob URLs
-- =============================================
UPDATE public.illegal_dumping_mobile
SET photos = '{}'::text[]
WHERE photos IS NULL OR ARRAY_LENGTH(photos, 1) IS NULL OR ARRAY_LENGTH(photos, 1) = 0;

-- =============================================
-- Step 5: Update location field to include extracted coordinates
-- =============================================
UPDATE public.illegal_dumping_mobile
SET location = CASE 
    WHEN location = 'Unknown location' OR location IS NULL THEN
        'Accra, Ghana (Coordinates: ' || 
        ROUND(latitude::numeric, 4)::text || ', ' || 
        ROUND(longitude::numeric, 4)::text || ')'
    ELSE location
END
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- =============================================
-- Step 6: Create index on new coordinate columns
-- =============================================
CREATE INDEX IF NOT EXISTS idx_illegal_dumping_mobile_coordinates 
ON public.illegal_dumping_mobile(latitude, longitude);

-- =============================================
-- Step 7: Verify the fixes
-- =============================================
SELECT 
    id,
    location,
    latitude,
    longitude,
    photos,
    COALESCE(ARRAY_LENGTH(photos, 1), 0) as photo_count,
    CASE 
        WHEN ARRAY_TO_STRING(photos, ',') LIKE '%blob:%' THEN 'HAS BLOB URLs ❌'
        ELSE 'Clean ✅'
    END as photo_status,
    status,
    created_at
FROM public.illegal_dumping_mobile
ORDER BY created_at DESC;

-- =============================================
-- Summary Report
-- =============================================
SELECT 
    'Total Reports' as metric,
    COUNT(*) as value
FROM public.illegal_dumping_mobile
UNION ALL
SELECT 
    'Reports with Coordinates',
    COUNT(*) 
FROM public.illegal_dumping_mobile 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL
UNION ALL
SELECT 
    'Reports with Photos',
    COUNT(*) 
FROM public.illegal_dumping_mobile 
WHERE ARRAY_LENGTH(photos, 1) > 0
UNION ALL
SELECT 
    'Reports with Blob URLs (Need Fix)',
    COUNT(*) 
FROM public.illegal_dumping_mobile 
WHERE ARRAY_TO_STRING(photos, ',') LIKE '%blob:%';
