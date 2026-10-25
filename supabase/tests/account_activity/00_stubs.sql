-- Stand-ins for the parts of Supabase the account_activity migration uses,
-- so it can be tested on a plain, empty local PostgreSQL. Never run this on
-- Supabase: it refuses when an auth schema already exists.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    RAISE EXCEPTION 'This test only runs on an empty local database (found an auth schema)';
  END IF;
END $$;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
CREATE FUNCTION public.td_admin_emails() RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT ARRAY['otisadomako50@gmail.com'] $$;
CREATE FUNCTION public.td_is_staff() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT coalesce(lower(auth.jwt() ->> 'email') = ANY (public.td_admin_emails()), false) $$;
CREATE TABLE public.account_roles (user_id uuid PRIMARY KEY, role text NOT NULL DEFAULT 'user', region text, district text);
CREATE TABLE public.collector_profiles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, first_name varchar, last_name varchar, status varchar, collector_type text NOT NULL DEFAULT 'collector');
CREATE TABLE public.illegal_dumping_mobile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reported_by uuid, status text DEFAULT 'pending', assigned_to uuid,
  assigned_at timestamptz, assigned_via text, region text, district text, completed_at timestamptz,
  cleanup_fee numeric, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
