-- UNDO 20261023_account_roles.sql. The admin app then falls back to the old
-- behaviour (role from the account's own metadata) until the migration is run
-- again. Approvals recorded in account_roles are lost if you drop the table.
BEGIN;
DROP TRIGGER IF EXISTS td_account_role_on_signup ON auth.users;
DROP FUNCTION IF EXISTS public.td_account_role_on_signup();
DROP FUNCTION IF EXISTS public.admin_review_account_role(uuid, boolean, text, text);
DROP FUNCTION IF EXISTS public.admin_list_account_roles(text);
DROP FUNCTION IF EXISTS public.request_account_role(text, text, text, text, jsonb);
DROP FUNCTION IF EXISTS public.my_access();
DROP FUNCTION IF EXISTS public.td_my_role();
DROP FUNCTION IF EXISTS public.td_role_for_company_type(text);
DROP TABLE IF EXISTS public.account_roles;
COMMIT;
