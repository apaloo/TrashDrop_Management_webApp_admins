-- Undo 20261115_access_decision_emails.sql: stops the emails and removes only
-- what that migration added. Accounts, approvals and in-app notifications are
-- not involved. pg_net stays: the pickup alerts use it too.
-- Also delete the access-decision-emails Edge Function.
BEGIN;

SELECT cron.unschedule('td-access-decision-emails');

DROP FUNCTION public.td_access_email_secret_ok(text);
DROP FUNCTION public.td_access_email_mark(uuid, timestamptz, boolean, text);
DROP FUNCTION public.td_access_email_claim(integer);

DELETE FROM vault.secrets WHERE name = 'td_access_email_cron_secret';

DROP TABLE public.td_access_decision_emails;

COMMIT;
