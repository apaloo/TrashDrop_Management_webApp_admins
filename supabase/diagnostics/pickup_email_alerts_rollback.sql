-- Undo 20261114_pickup_email_alerts.sql: stops the emails and removes only what
-- that migration added. Request data and existing rules are not involved.
-- Also delete the pickup-email-alerts Edge Function and RESEND_API_KEY secret.
BEGIN;

SELECT cron.unschedule('td-pickup-email-alerts');

DROP FUNCTION public.td_pickup_email_secret_ok(text);
DROP FUNCTION public.td_pickup_email_mark(text, text, boolean, text);
DROP FUNCTION public.td_pickup_email_claim(integer);

DELETE FROM vault.secrets WHERE name = 'td_pickup_email_cron_secret';

DROP TABLE public.td_pickup_email_alerts;
DROP TABLE public.td_pickup_email_recipients;

DROP EXTENSION pg_net;

COMMIT;
