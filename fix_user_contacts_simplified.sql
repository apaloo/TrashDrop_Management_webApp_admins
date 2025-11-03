-- 1. Create the timestamp trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Drop existing function if it exists
DROP FUNCTION IF EXISTS public.get_user_contacts(uuid);

-- 3. Create the function with correct return types (using text instead of varchar)
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

-- 4. Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_contacts(uuid) TO authenticated;

-- 5. Create the contacts table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.contacts (
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

-- 6. Enable RLS
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS policies
DROP POLICY IF EXISTS "Allow users to view their own contacts" ON public.contacts;
CREATE POLICY "Allow users to view their own contacts"
    ON public.contacts
    FOR SELECT
    TO authenticated
    USING (auth.uid() IS NOT DISTINCT FROM user_id);
    
DROP POLICY IF EXISTS "Allow users to insert their own contacts" ON public.contacts;
CREATE POLICY "Allow users to insert their own contacts"
    ON public.contacts
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() IS NOT DISTINCT FROM user_id);
    
DROP POLICY IF EXISTS "Allow users to update their own contacts" ON public.contacts;
CREATE POLICY "Allow users to update their own contacts"
    ON public.contacts
    FOR UPDATE
    TO authenticated
    USING (auth.uid() IS NOT DISTINCT FROM user_id);
    
DROP POLICY IF EXISTS "Allow users to delete their own contacts" ON public.contacts;
CREATE POLICY "Allow users to delete their own contacts"
    ON public.contacts
    FOR DELETE
    TO authenticated
    USING (auth.uid() IS NOT DISTINCT FROM user_id);
    
-- 8. Create updated_at trigger
DROP TRIGGER IF EXISTS set_updated_at ON public.contacts;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();
