\set ON_ERROR_STOP 1
-- The admin metric editor (src/pages/PerformanceMetrics.js) writes performance_metrics
-- directly; these are exactly the rows it sends, under the database's own rules.
INSERT INTO account_roles (user_id, role, region) VALUES ('00000000-0000-0000-0000-0000000000e1','volunteer','Editor Region');
INSERT INTO account_activity (account_id, activity, entity_id) VALUES ('00000000-0000-0000-0000-0000000000e1','cleanup.started','editor-r1');
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"email":"otisadomako50@gmail.com"}',false);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000ff',false);
INSERT INTO performance_metrics (key, label, description, roles, calc, params, unit, higher_is_better, target, enabled, sort_order, updated_by, updated_at)
VALUES ('vol_clean_ups_started_e','Clean-ups started',NULL,ARRAY['volunteer'],'activity_count','{"activities":["cleanup.started"]}','count',true,4,true,80,'00000000-0000-0000-0000-0000000000ff',now());
DO $$ DECLARE j jsonb; BEGIN
  j := public.my_performance(30, '00000000-0000-0000-0000-0000000000e1');
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(j->'metrics') m WHERE m->>'key'='vol_clean_ups_started_e' AND m->>'value'='1' AND m->>'target'='4') THEN
    RAISE EXCEPTION 'FAIL new metric not on the page with its value: %', j->'metrics'; END IF;
  RAISE NOTICE 'PASS a metric added by the editor shows on the next page load with its number and target';
END $$;
UPDATE performance_metrics SET enabled = false, updated_at = now() WHERE key = 'vol_clean_ups_started_e';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(public.my_performance(30,'00000000-0000-0000-0000-0000000000e1')->'metrics') m WHERE m->>'key'='vol_clean_ups_started_e') THEN
    RAISE EXCEPTION 'FAIL hidden metric still shown'; END IF;
END $$;
DELETE FROM performance_metrics WHERE key = 'vol_clean_ups_started_e';
SELECT set_config('request.jwt.claims','{"email":"group@example.com"}',false);
DO $$ BEGIN
  UPDATE performance_metrics SET target = 1 WHERE key = 'vol_cleanups_completed';
  IF FOUND THEN RAISE EXCEPTION 'FAIL a non-admin could edit a metric'; END IF;
  DELETE FROM performance_metrics WHERE key = 'vol_cleanups_completed';
  IF FOUND THEN RAISE EXCEPTION 'FAIL a non-admin could delete a metric'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM performance_metrics WHERE key = 'vol_clean_ups_started_e')
     OR EXISTS (SELECT 1 FROM performance_daily WHERE metric_key = 'vol_clean_ups_started_e') THEN
    RAISE EXCEPTION 'FAIL deleted metric or its totals remain'; END IF;
  RAISE NOTICE 'PASS editor writes: hide and delete work (totals go too); non-admins can''t edit or delete';
END $$;
