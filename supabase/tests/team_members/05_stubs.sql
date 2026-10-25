-- Extra stand-ins for the team test (on top of ../account_activity/00_stubs.sql)
ALTER TABLE auth.users ADD COLUMN raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb; -- as Supabase has it
ALTER TABLE public.account_roles ADD COLUMN requested_role text NOT NULL DEFAULT 'user', ADD COLUMN status text NOT NULL DEFAULT 'approved',
  ADD COLUMN company_type text, ADD COLUMN review_note text; -- columns my_access() reads (20261023)
CREATE TABLE public.gh_districts (region text, name text);
INSERT INTO public.gh_districts VALUES ('Greater Accra','Ga East'), ('Greater Accra','Accra Metropolitan'), ('Ashanti','Kumasi Metropolitan');
CREATE FUNCTION public.td_write_log(text, text, text, text, text, text, jsonb DEFAULT NULL, jsonb DEFAULT NULL,
  jsonb DEFAULT '{}'::jsonb, uuid DEFAULT NULL, text DEFAULT NULL, text DEFAULT NULL)
RETURNS text LANGUAGE sql AS $$ SELECT NULL::text $$;
-- 20261026's td_my_area as it was, to prove nothing changes for accounts outside teams
CREATE FUNCTION public.old_my_role(p uuid, p_email text) RETURNS text LANGUAGE sql AS $$
  SELECT CASE WHEN lower(p_email) = ANY (public.td_admin_emails()) THEN 'admin'
              ELSE coalesce((SELECT r.role FROM public.account_roles r WHERE r.user_id = p), 'user') END
$$;
