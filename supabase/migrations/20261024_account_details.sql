-- ============================================================================
-- Sign-up details for access requests (step 2).
-- The sign-up form now asks for region, district and verification details
-- (position, group leader, press ID, registration number…) and saves them in
-- the account metadata as region / district / accessDetails. This keeps them
-- with the request in account_roles, for the admin who approves it.
-- Needs 20261023_account_roles.sql. Safe to re-run; changes no existing rows
-- except filling empty details from metadata already saved.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.td_account_role_on_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  meta jsonb := coalesce(NEW.raw_user_meta_data, '{}'::jsonb);
  ct text := nullif(meta ->> 'companyType', '');
  req text := public.td_role_for_company_type(ct);
  det jsonb := CASE WHEN jsonb_typeof(meta -> 'accessDetails') = 'object' THEN meta -> 'accessDetails' ELSE '{}'::jsonb END;
BEGIN
  BEGIN
    INSERT INTO public.account_roles (user_id, company_type, org_name, requested_role, role, status, region, district, details)
    VALUES (NEW.id, ct, nullif(meta ->> 'companyName', ''), req, 'user',
            CASE WHEN req = 'user' THEN 'approved' ELSE 'pending' END,
            nullif(meta ->> 'region', ''), nullif(meta ->> 'district', ''), det)
    ON CONFLICT (user_id) DO NOTHING;
    IF req <> 'user' THEN
      PERFORM public.td_write_log('info', 'auth', 'account.role_requested', 'user', NEW.id::text,
        format('%s requested %s access', coalesce(NEW.email, 'A new account'), req), NULL,
        jsonb_build_object('requested_role', req, 'company_type', ct, 'region', meta ->> 'region', 'district', meta ->> 'district'),
        '{}'::jsonb, NEW.id, NEW.email, 'user');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- never block a sign-up; my_access() creates the row later if needed
  END;
  RETURN NEW;
END $$;

-- Requests created before this update: take region / district / details from metadata where empty
UPDATE public.account_roles r SET
  region = coalesce(r.region, nullif(u.raw_user_meta_data ->> 'region', '')),
  district = coalesce(r.district, nullif(u.raw_user_meta_data ->> 'district', '')),
  details = CASE WHEN r.details = '{}'::jsonb AND jsonb_typeof(u.raw_user_meta_data -> 'accessDetails') = 'object'
                 THEN u.raw_user_meta_data -> 'accessDetails' ELSE r.details END
FROM auth.users u
WHERE u.id = r.user_id
  AND (r.region IS NULL OR r.district IS NULL OR r.details = '{}'::jsonb)
  AND (u.raw_user_meta_data ? 'region' OR u.raw_user_meta_data ? 'district' OR u.raw_user_meta_data ? 'accessDetails');

NOTIFY pgrst, 'reload schema';

SELECT status, count(*) AS accounts, count(region) AS with_region, count(district) AS with_district
FROM public.account_roles GROUP BY 1 ORDER BY 1;
