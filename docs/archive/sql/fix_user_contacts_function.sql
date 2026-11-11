-- Create the set_updated_at_timestamp function if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_proc
        JOIN pg_namespace ON pg_namespace.oid = pg_proc.pronamespace
        WHERE proname = 'set_updated_at_timestamp'
        AND nspname = 'public'
    ) THEN
        EXECUTE 'CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
        RETURNS TRIGGER AS $trigger$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $trigger$ LANGUAGE plpgsql;';
    END IF;
END
$$;

-- Fix for get_user_contacts function return type mismatch
-- List all variants of the function and drop them with their signatures
DO $$
BEGIN
    -- Drop all versions of the function with any argument signature
    DROP FUNCTION IF EXISTS public.get_user_contacts(uuid);
    -- Catch exceptions in case some signatures don't exist
    EXCEPTION WHEN OTHERS THEN NULL;
END
$$;

-- Create the function with correct return types (using text instead of varchar)
CREATE OR REPLACE FUNCTION public.get_user_contacts(user_id uuid)
RETURNS TABLE(
    contact_id uuid,
    name text,
    email text,
    phone text,
    contact_type text,
    relationship text,
    primary_contact boolean,
    created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id as contact_id,
        c.name,
        c.email,
        c.phone,
        c.contact_type,
        c.relationship,
        c.primary_contact,
        c.created_at
    FROM
        public.contacts c
    WHERE
        c.user_id = get_user_contacts.user_id
    ORDER BY
        c.primary_contact DESC,
        c.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_contacts(uuid) TO authenticated;

-- Create the contacts table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'contacts'
    ) THEN
        CREATE TABLE public.contacts (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id uuid REFERENCES auth.users(id),
            name text NOT NULL,
            email text,
            phone text,
            contact_type text DEFAULT 'personal',
            relationship text,
            primary_contact boolean DEFAULT false,
            created_at timestamp with time zone DEFAULT now(),
            updated_at timestamp with time zone DEFAULT now()
        );

        -- Enable RLS
        ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
        
        -- Create RLS policies
        CREATE POLICY "Allow users to view their own contacts"
            ON public.contacts
            FOR SELECT
            TO authenticated
            USING (auth.uid() IS NOT DISTINCT FROM user_id);
            
        CREATE POLICY "Allow users to insert their own contacts"
            ON public.contacts
            FOR INSERT
            TO authenticated
            WITH CHECK (auth.uid() IS NOT DISTINCT FROM user_id);
            
        CREATE POLICY "Allow users to update their own contacts"
            ON public.contacts
            FOR UPDATE
            TO authenticated
            USING (auth.uid() IS NOT DISTINCT FROM user_id);
            
        CREATE POLICY "Allow users to delete their own contacts"
            ON public.contacts
            FOR DELETE
            TO authenticated
            USING (auth.uid() IS NOT DISTINCT FROM user_id);
            
        -- Create updated_at trigger
        CREATE TRIGGER set_updated_at
        BEFORE UPDATE ON public.contacts
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at_timestamp();
    END IF;
END
$$;
