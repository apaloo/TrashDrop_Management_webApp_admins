-- Fix for the relationship between alerts and created_by

-- Add the created_by column to the alerts table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'alerts'
        AND column_name = 'created_by'
    ) THEN
        ALTER TABLE public.alerts ADD COLUMN created_by UUID REFERENCES auth.users(id);
    END IF;
END
$$;

-- Make sure the creator column exists for backward compatibility
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'alerts'
        AND column_name = 'creator'
    ) THEN
        ALTER TABLE public.alerts ADD COLUMN creator UUID;
    END IF;
END
$$;

-- Update the alerts table to ensure created_by has values if creator is set
UPDATE public.alerts 
SET created_by = creator 
WHERE created_by IS NULL AND creator IS NOT NULL;

-- Update the creator to match created_by if needed
UPDATE public.alerts 
SET creator = created_by 
WHERE creator IS NULL AND created_by IS NOT NULL;

-- Add a foreign key constraint for created_by if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'alerts_created_by_fkey' 
        AND table_name = 'alerts'
    ) THEN
        ALTER TABLE public.alerts 
        ADD CONSTRAINT alerts_created_by_fkey 
        FOREIGN KEY (created_by) REFERENCES auth.users(id);
    END IF;
END
$$;
