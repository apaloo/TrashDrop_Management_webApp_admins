-- Add missing columns to illegal_dumping_mobile table if they don't exist
DO $$
BEGIN
    -- Add description column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'illegal_dumping_mobile' 
                  AND column_name = 'description') THEN
        ALTER TABLE public.illegal_dumping_mobile ADD COLUMN description TEXT;
    END IF;

    -- Add assigned_to column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'illegal_dumping_mobile' 
                  AND column_name = 'assigned_to') THEN
        ALTER TABLE public.illegal_dumping_mobile 
        ADD COLUMN assigned_to UUID 
        REFERENCES public.collectors(id);
    END IF;

    -- Add cleanup_scheduled_date column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'illegal_dumping_mobile' 
                  AND column_name = 'cleanup_scheduled_date') THEN
        ALTER TABLE public.illegal_dumping_mobile 
        ADD COLUMN cleanup_scheduled_date TIMESTAMPTZ;
    END IF;

    -- Add cleanup_completed_date column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'illegal_dumping_mobile' 
                  AND column_name = 'cleanup_completed_date') THEN
        ALTER TABLE public.illegal_dumping_mobile 
        ADD COLUMN cleanup_completed_date TIMESTAMPTZ;
    END IF;

    -- Add notes column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'illegal_dumping_mobile' 
                  AND column_name = 'notes') THEN
        ALTER TABLE public.illegal_dumping_mobile 
        ADD COLUMN notes TEXT;
    END IF;

    -- Create index on status if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'illegal_dumping_mobile' 
        AND indexname = 'idx_illegal_dumping_mobile_status'
    ) THEN
        CREATE INDEX idx_illegal_dumping_mobile_status ON public.illegal_dumping_mobile(status);
    END IF;

    -- Create index on reported_by if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'illegal_dumping_mobile' 
        AND indexname = 'idx_illegal_dumping_mobile_reported_by'
    ) THEN
        CREATE INDEX idx_illegal_dumping_mobile_reported_by ON public.illegal_dumping_mobile(reported_by);
    END IF;

    -- Create index on assigned_to if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'illegal_dumping_mobile' 
        AND indexname = 'idx_illegal_dumping_mobile_assigned_to'
    ) THEN
        CREATE INDEX idx_illegal_dumping_mobile_assigned_to ON public.illegal_dumping_mobile(assigned_to);
    END IF;

    -- Create index on created_at if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'illegal_dumping_mobile' 
        AND indexname = 'idx_illegal_dumping_mobile_created_at'
    ) THEN
        CREATE INDEX idx_illegal_dumping_mobile_created_at ON public.illegal_dumping_mobile(created_at);
    END IF;

    -- Create a trigger function to update the updated_at column
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- Create the trigger if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_illegal_dumping_mobile_updated_at'
    ) THEN
        CREATE TRIGGER update_illegal_dumping_mobile_updated_at
        BEFORE UPDATE ON public.illegal_dumping_mobile
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- Create a function to log changes to the illegal_dumping_history_mobile table
    CREATE OR REPLACE FUNCTION log_illegal_dumping_changes()
    RETURNS TRIGGER AS $$
    BEGIN
        IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
            INSERT INTO public.illegal_dumping_history_mobile (
                dumping_id, 
                status, 
                notes, 
                updated_by
            ) VALUES (
                NEW.id,
                NEW.status,
                COALESCE(NEW.notes, ''),
                auth.uid()
            );
        END IF;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- Create the trigger for logging changes if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trigger_log_illegal_dumping_changes'
    ) THEN
        CREATE TRIGGER trigger_log_illegal_dumping_changes
        AFTER UPDATE ON public.illegal_dumping_mobile
        FOR EACH ROW
        WHEN (OLD.status IS DISTINCT FROM NEW.status)
        EXECUTE FUNCTION log_illegal_dumping_changes();
    END IF;

    -- Create a function to get nearby illegal dumping reports if it doesn't exist
    CREATE OR REPLACE FUNCTION public.get_nearby_illegal_dumping(
        lat DOUBLE PRECISION,
        lng DOUBLE PRECISION,
        radius_km INTEGER DEFAULT 10
    )
    RETURNS TABLE (
        id UUID,
        location TEXT,
        distance_km DOUBLE PRECISION,
        waste_type TEXT,
        severity TEXT,
        status TEXT,
        created_at TIMESTAMPTZ
    )
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
        RETURN QUERY
        SELECT 
            d.id,
            d.location,
            ST_Distance(
                ST_MakePoint(lng, lat)::geography,
                ST_MakePoint(ST_X(d.coordinates::geometry), ST_Y(d.coordinates::geometry))::geography
            ) / 1000 AS distance_km,
            d.waste_type,
            d.severity,
            d.status,
            d.created_at
        FROM 
            public.illegal_dumping_mobile d
        WHERE 
            ST_DWithin(
                ST_MakePoint(lng, lat)::geography,
                ST_MakePoint(ST_X(d.coordinates::geometry), ST_Y(d.coordinates::geometry))::geography,
                radius_km * 1000  -- Convert km to meters
            )
            AND d.status IN ('pending', 'verified')
        ORDER BY 
            distance_km ASC;
    END;
    $$;

    -- Enable Row Level Security (RLS) if not already enabled
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'illegal_dumping_mobile' 
        AND rowsecurity = true
    ) THEN
        ALTER TABLE public.illegal_dumping_mobile ENABLE ROW LEVEL SECURITY;
    END IF;

    -- Create RLS policies if they don't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'illegal_dumping_mobile' 
        AND policyname = 'Enable read access for all users'
    ) THEN
        CREATE POLICY "Enable read access for all users" 
        ON public.illegal_dumping_mobile
        FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'illegal_dumping_mobile' 
        AND policyname = 'Enable insert for authenticated users'
    ) THEN
        CREATE POLICY "Enable insert for authenticated users" 
        ON public.illegal_dumping_mobile
        FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'illegal_dumping_mobile' 
        AND policyname = 'Enable update for assigned collectors and admins'
    ) THEN
        CREATE POLICY "Enable update for assigned collectors and admins" 
        ON public.illegal_dumping_mobile
        FOR UPDATE 
        USING (
            auth.uid() = reported_by OR 
            auth.uid() = assigned_to OR
            EXISTS (
                SELECT 1 FROM auth.users 
                WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin'
            )
        );
    END IF;

    -- Grant necessary permissions
    GRANT SELECT ON public.illegal_dumping_mobile TO anon, authenticated, service_role;
    GRANT INSERT, UPDATE, DELETE ON public.illegal_dumping_mobile TO authenticated, service_role;
    GRANT USAGE ON SEQUENCE illegal_dumping_mobile_id_seq TO authenticated, service_role;
    
    -- Grant execute permission on the function
    GRANT EXECUTE ON FUNCTION public.get_nearby_illegal_dumping(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER) TO anon, authenticated, service_role;

    RAISE NOTICE 'Successfully added missing columns and set up permissions for illegal_dumping_mobile table';
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Error setting up illegal_dumping_mobile table: %', SQLERRM;
END;
$$;
