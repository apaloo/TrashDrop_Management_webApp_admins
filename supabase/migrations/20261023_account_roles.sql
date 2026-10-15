-- ============================================================================
-- Account roles with approval (step 1 of the expanded access levels).
--
-- Until now the admin app took a person's access level from their own
-- user_metadata.role, which they can change themselves, and anyone could
-- become a Manager by choosing a company type. From now on the access level
-- comes only from this table, and only after an admin approves it.
--
-- Needs 20261018_audit_log.sql (td_is_staff, td_write_log). Additive; safe to
-- re-run. Undo: supabase/diagnostics/account_roles_rollback.sql
--
-- Roles: user · volunteer · media · manager · authority · admin
--   admin  = the two whitelisted emails (td_admin_emails), never requested
--   user   = everyone else until a higher role is approved
-- Company type → requested role:
--   waste_management, recycling      → manager
--   municipality (MMDA)              → authority
--   volunteer_group, nonprofit       → volunteer
--   media (journalist)               → media
--   other, individual, anything else → user (approved at once)
--
-- 1. account_roles table (one row per account) + backup-free backfill:
--    existing accounts keep the access they already had, marked
--    "approved on migration" so an admin can review them.
-- 2. New sign-ups get a row automatically (trigger on auth.users).
-- 3. Functions: my_access(), request_account_role(), and for admins
--    admin_list_account_roles(), admin_review_account_role().
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.account_roles (
  user_id        uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  company_type   text,
  org_name       text,
  requested_role text NOT NULL DEFAULT 'user',
  role           text NOT NULL DEFAULT 'user',      -- the approved role in force
  status         text NOT NULL DEFAULT 'approved',  -- of the requested role
  region         text,
  district       text,
  details        jsonb NOT NULL DEFAULT '{}'::jsonb, -- verification info (press ID, letter, group leader…)
  review_note    text,
  reviewed_by    uuid,
  reviewed_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_roles_role_chk CHECK (role IN ('user', 'volunteer', 'media', 'manager', 'authority')),
  CONSTRAINT account_roles_requested_chk CHECK (requested_role IN ('user', 'volunteer', 'media', 'manager', 'authority')),
  CONSTRAINT account_roles_status_chk CHECK (status IN ('pending', 'approved', 'rejected'))
);
CREATE INDEX IF NOT EXISTS account_roles_status_idx ON public.account_roles (status, created_at DESC);

ALTER TABLE public.account_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS account_roles_read ON public.account_roles;
CREATE POLICY account_roles_read ON public.account_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.td_is_staff());
-- No insert / update / delete policies: changes go through the functions below.
REVOKE ALL ON public.account_roles FROM anon;
GRANT SELECT ON public.account_roles TO authenticated;

-- Company type → requested role (one place)
CREATE OR REPLACE FUNCTION public.td_role_for_company_type(p_company_type text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE lower(btrim(coalesce(p_company_type, '')))
    WHEN 'waste_management' THEN 'manager'
    WHEN 'recycling' THEN 'manager'
    WHEN 'municipality' THEN 'authority'
    WHEN 'volunteer_group' THEN 'volunteer'
    WHEN 'nonprofit' THEN 'volunteer'
    WHEN 'media' THEN 'media'
    ELSE 'user' END
$$;

-- The caller's role: whitelisted admin, else the approved role, else user
CREATE OR REPLACE FUNCTION public.td_my_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN public.td_is_staff() THEN 'admin'
    ELSE coalesce((SELECT r.role FROM public.account_roles r WHERE r.user_id = auth.uid()), 'user') END
$$;
REVOKE ALL ON FUNCTION public.td_my_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.td_my_role() TO authenticated;

-- ── 1. backfill existing accounts ──────────────────────────────────────────
-- They keep exactly the access they had (Manager or User), marked approved
-- on migration so an admin can review the Managers.
INSERT INTO public.account_roles (user_id, company_type, org_name, requested_role, role, status, review_note, reviewed_at)
SELECT u.id,
       nullif(u.raw_user_meta_data ->> 'companyType', ''),
       nullif(u.raw_user_meta_data ->> 'companyName', ''),
       x.r, x.r, 'approved',
       CASE WHEN x.r <> 'user' THEN 'Existing account: access kept when roles moved to the database. Review if unsure.' END,
       CASE WHEN x.r <> 'user' THEN now() END
FROM auth.users u
-- The old app only ever gave Manager (metadata role 'manager') or User; keep exactly that.
CROSS JOIN LATERAL (SELECT CASE
    WHEN lower(coalesce(u.raw_user_meta_data ->> 'role', '')) = 'manager' THEN 'manager'
    ELSE 'user' END AS r) x
ON CONFLICT (user_id) DO NOTHING;

-- ── 2. new sign-ups ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.td_account_role_on_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ct text := nullif(NEW.raw_user_meta_data ->> 'companyType', '');
  req text := public.td_role_for_company_type(ct);
BEGIN
  BEGIN
    INSERT INTO public.account_roles (user_id, company_type, org_name, requested_role, role, status, region, district)
    VALUES (NEW.id, ct, nullif(NEW.raw_user_meta_data ->> 'companyName', ''), req, 'user',
            CASE WHEN req = 'user' THEN 'approved' ELSE 'pending' END,
            nullif(NEW.raw_user_meta_data ->> 'region', ''), nullif(NEW.raw_user_meta_data ->> 'district', ''))
    ON CONFLICT (user_id) DO NOTHING;
    IF req <> 'user' THEN
      PERFORM public.td_write_log('info', 'auth', 'account.role_requested', 'user', NEW.id::text,
        format('%s requested %s access', coalesce(NEW.email, 'A new account'), req), NULL,
        jsonb_build_object('requested_role', req, 'company_type', ct), '{}'::jsonb, NEW.id, NEW.email, 'user');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- never block a sign-up; my_access() creates the row later if needed
  END;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS td_account_role_on_signup ON auth.users;
CREATE TRIGGER td_account_role_on_signup AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.td_account_role_on_signup();

-- ── 3. functions ───────────────────────────────────────────────────────────
-- The caller's access (creates a basic row on first call if missing)
CREATE OR REPLACE FUNCTION public.my_access()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE r public.account_roles;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('role', 'user', 'status', 'approved'); END IF;
  SELECT * INTO r FROM public.account_roles WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    INSERT INTO public.account_roles (user_id) VALUES (auth.uid()) ON CONFLICT DO NOTHING RETURNING * INTO r;
    IF r.user_id IS NULL THEN SELECT * INTO r FROM public.account_roles WHERE user_id = auth.uid(); END IF;
  END IF;
  RETURN jsonb_build_object(
    'role', public.td_my_role(),
    'requested_role', CASE WHEN public.td_is_staff() THEN 'admin' ELSE r.requested_role END,
    'status', CASE WHEN public.td_is_staff() THEN 'approved' ELSE r.status END,
    'company_type', r.company_type, 'org_name', r.org_name, 'region', r.region, 'district', r.district,
    'review_note', r.review_note);
END $$;
REVOKE ALL ON FUNCTION public.my_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_access() TO authenticated;

-- Ask for (or change) the access that goes with a company type. A request for
-- more than basic access waits for approval; the current approved role stays
-- in force meanwhile.
CREATE OR REPLACE FUNCTION public.request_account_role(
  p_company_type text, p_org_name text DEFAULT NULL, p_region text DEFAULT NULL,
  p_district text DEFAULT NULL, p_details jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  req text := public.td_role_for_company_type(p_company_type);
  cur public.account_roles;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = 'insufficient_privilege'; END IF;
  INSERT INTO public.account_roles (user_id) VALUES (auth.uid()) ON CONFLICT DO NOTHING;
  SELECT * INTO cur FROM public.account_roles WHERE user_id = auth.uid() FOR UPDATE;
  UPDATE public.account_roles SET
    company_type = nullif(btrim(coalesce(p_company_type, '')), ''),
    org_name = coalesce(nullif(btrim(coalesce(p_org_name, '')), ''), org_name),
    region = coalesce(nullif(btrim(coalesce(p_region, '')), ''), region),
    district = coalesce(nullif(btrim(coalesce(p_district, '')), ''), district),
    details = coalesce(details, '{}'::jsonb) || coalesce(p_details, '{}'::jsonb),
    requested_role = req,
    -- same role as already approved, or basic access: nothing to approve
    status = CASE WHEN req = 'user' OR req = cur.role THEN 'approved' ELSE 'pending' END,
    role = CASE WHEN req = 'user' THEN 'user' ELSE role END,
    review_note = NULL,
    updated_at = now()
  WHERE user_id = auth.uid();
  IF req <> 'user' AND req <> cur.role THEN
    PERFORM public.td_write_log('info', 'auth', 'account.role_requested', 'user', auth.uid()::text,
      format('%s requested %s access', coalesce(auth.jwt() ->> 'email', 'An account'), req), NULL,
      jsonb_build_object('requested_role', req, 'company_type', p_company_type));
  END IF;
  RETURN public.my_access();
END $$;
REVOKE ALL ON FUNCTION public.request_account_role(text, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_account_role(text, text, text, text, jsonb) TO authenticated;

-- Admin: accounts with their requests (filter by status; NULL = all)
CREATE OR REPLACE FUNCTION public.admin_list_account_roles(p_status text DEFAULT 'pending')
RETURNS TABLE (user_id uuid, email text, name text, company_type text, org_name text, requested_role text,
               role text, status text, region text, district text, details jsonb, review_note text,
               reviewed_at timestamptz, created_at timestamptz, signed_up_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  IF NOT public.td_is_staff() THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE = 'insufficient_privilege'; END IF;
  RETURN QUERY
    SELECT r.user_id, u.email::text,
           coalesce(nullif(btrim(concat_ws(' ', u.raw_user_meta_data ->> 'firstName', u.raw_user_meta_data ->> 'lastName')), ''),
                    u.raw_user_meta_data ->> 'name', split_part(u.email, '@', 1))::text,
           r.company_type, r.org_name, r.requested_role, r.role, r.status, r.region, r.district, r.details,
           r.review_note, r.reviewed_at, r.created_at, u.created_at
    FROM public.account_roles r JOIN auth.users u ON u.id = r.user_id
    WHERE p_status IS NULL OR r.status = p_status
    ORDER BY (r.status = 'pending') DESC, r.created_at DESC
    LIMIT 500;
END $$;
REVOKE ALL ON FUNCTION public.admin_list_account_roles(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_account_roles(text) TO authenticated;

-- Admin: approve (optionally as a different role) or reject a request,
-- or change an account's role directly (p_role given, p_approve true).
CREATE OR REPLACE FUNCTION public.admin_review_account_role(
  p_user_id uuid, p_approve boolean, p_role text DEFAULT NULL, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  cur public.account_roles;
  new_role text;
  who text;
BEGIN
  IF NOT public.td_is_staff() THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE = 'insufficient_privilege'; END IF;
  SELECT * INTO cur FROM public.account_roles WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Account not found' USING ERRCODE = 'no_data_found'; END IF;
  SELECT email INTO who FROM auth.users WHERE id = p_user_id;
  IF NOT p_approve AND nullif(btrim(coalesce(p_note, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Give a reason when rejecting' USING ERRCODE = 'check_violation';
  END IF;
  new_role := CASE WHEN p_approve THEN lower(coalesce(nullif(btrim(p_role), ''), cur.requested_role)) ELSE cur.role END;
  IF new_role NOT IN ('user', 'volunteer', 'media', 'manager', 'authority') THEN
    RAISE EXCEPTION 'Unknown role "%"', p_role USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.account_roles SET
    role = new_role,
    requested_role = CASE WHEN p_approve THEN new_role ELSE requested_role END,
    status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
    review_note = nullif(btrim(coalesce(p_note, '')), ''),
    reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  WHERE user_id = p_user_id;
  PERFORM public.td_write_log('info', 'auth', CASE WHEN p_approve THEN 'account.role_approved' ELSE 'account.role_rejected' END,
    'user', p_user_id::text,
    format('%s: %s', coalesce(who, p_user_id::text),
           CASE WHEN p_approve THEN 'approved as ' || new_role ELSE cur.requested_role || ' access rejected' END),
    jsonb_build_object('role', cur.role, 'status', cur.status, 'requested_role', cur.requested_role),
    jsonb_build_object('role', new_role, 'status', CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END),
    jsonb_strip_nulls(jsonb_build_object('note', p_note)));
  -- tell the person (in-app notification), never blocks the review
  BEGIN
    INSERT INTO public.notifications (user_id, title, message, type, read)
    VALUES (p_user_id,
            CASE WHEN p_approve THEN 'Access approved' ELSE 'Access request not approved' END,
            CASE WHEN p_approve THEN format('Your TrashDrop account now has %s access.', new_role)
                 ELSE format('Your request for %s access was not approved: %s', cur.requested_role, p_note) END,
            CASE WHEN p_approve THEN 'success' ELSE 'info' END, false);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;
REVOKE ALL ON FUNCTION public.admin_review_account_role(uuid, boolean, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_account_role(uuid, boolean, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Check: accounts by role and status
SELECT role, status, count(*) FROM public.account_roles GROUP BY 1, 2 ORDER BY 1, 2;
