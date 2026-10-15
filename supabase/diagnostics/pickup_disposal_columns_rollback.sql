-- Undo 20261029_pickup_disposal_columns.sql: removes the two disposal columns
-- (and the site names saved in them since). The payout columns are left alone
-- because they may have existed before.
ALTER TABLE public.pickup_requests DROP COLUMN IF EXISTS disposal_site, DROP COLUMN IF EXISTS disposal_timestamp;
NOTIFY pgrst, 'reload schema';
