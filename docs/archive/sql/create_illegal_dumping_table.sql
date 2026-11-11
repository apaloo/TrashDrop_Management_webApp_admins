-- TrashDrop Admin Portal - Create Illegal Dumping Table
-- Execute this SQL in your Supabase SQL Editor

-- =============================================
-- CREATE ILLEGAL_DUMPING TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.illegal_dumping (
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
    duplicate_of uuid REFERENCES public.illegal_dumping(id) ON DELETE SET NULL,
    verification_count integer DEFAULT 0,
    last_verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_illegal_dumping_status ON public.illegal_dumping(status);
CREATE INDEX IF NOT EXISTS idx_illegal_dumping_urgency ON public.illegal_dumping(urgency);
CREATE INDEX IF NOT EXISTS idx_illegal_dumping_reporter_id ON public.illegal_dumping(reporter_id);
CREATE INDEX IF NOT EXISTS idx_illegal_dumping_created_at ON public.illegal_dumping(created_at DESC);

-- Add row-level security policy
DROP POLICY IF EXISTS "Anyone authenticated can view illegal dumping" ON public.illegal_dumping;
CREATE POLICY "Anyone authenticated can view illegal dumping" ON public.illegal_dumping
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Anyone authenticated can insert illegal dumping" ON public.illegal_dumping;
CREATE POLICY "Anyone authenticated can insert illegal dumping" ON public.illegal_dumping
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Anyone authenticated can update illegal dumping" ON public.illegal_dumping;
CREATE POLICY "Anyone authenticated can update illegal dumping" ON public.illegal_dumping
    FOR UPDATE USING (auth.role() = 'authenticated');

-- =============================================
-- INSERT SAMPLE DATA
-- =============================================
INSERT INTO public.illegal_dumping (
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
        NOW() - INTERVAL '2 days'
    ),
    (
        (SELECT id FROM auth.users LIMIT 1), 
        '{"lat": 5.5750, "lng": -0.2050}', 
        'Circle Interchange, Ring Road Central', 
        'Hazardous chemical containers dumped behind billboard', 
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
        'Properly disposed of at e-waste facility',
        '["https://example.com/images/dump6.jpg"]',
        1,
        NOW() - INTERVAL '5 days'
    ),
    (
        (SELECT id FROM auth.users LIMIT 1), 
        '{"lat": 5.6120, "lng": -0.1590}', 
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

-- =============================================
-- VERIFY TABLE
-- =============================================
SELECT 'Verifying illegal_dumping table...' as status;

SELECT 
    'illegal_dumping' as table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'illegal_dumping') as column_count,
    (SELECT COUNT(*) FROM public.illegal_dumping) as row_count;

SELECT 'The illegal_dumping table has been successfully created and populated!' as status;
