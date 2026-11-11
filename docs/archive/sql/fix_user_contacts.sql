-- Fix for the get_user_contacts function
-- First drop the existing function
DROP FUNCTION IF EXISTS public.get_user_contacts(UUID);

-- Then recreate it with the proper definition
CREATE OR REPLACE FUNCTION public.get_user_contacts(user_id UUID)
RETURNS TABLE(
    contact_id UUID,
    name TEXT,
    email TEXT,
    phone TEXT,
    contact_type TEXT,
    relationship TEXT,
    primary_contact BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
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
GRANT EXECUTE ON FUNCTION public.get_user_contacts(UUID) TO authenticated;
