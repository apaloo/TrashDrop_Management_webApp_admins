\set ON_ERROR_STOP 1
-- Privacy, staff views and no-code metric edits
GRANT USAGE ON SCHEMA public, auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid(), auth.jwt() TO authenticated;
GRANT EXECUTE ON FUNCTION metric(jsonb, text) TO authenticated;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b1',false);
SELECT set_config('request.jwt.claims','{"email":"group@example.com"}',false);
DO $$ BEGIN
  BEGIN
    PERFORM public.my_performance(30, '00000000-0000-0000-0000-0000000000b2');
    RAISE EXCEPTION 'FAIL: a group read another group''s page';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.performance_overview('volunteer');
    RAISE EXCEPTION 'FAIL: a group opened the staff comparison';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  IF (SELECT count(*) FROM performance_metrics) <> 0 THEN RAISE EXCEPTION 'FAIL: a group can read the metric table'; END IF;
  BEGIN
    INSERT INTO performance_metrics (key, label, roles, calc, params) VALUES ('hack', 'Hack', ARRAY['volunteer'], 'area_open_backlog', '{}');
    RAISE EXCEPTION 'FAIL: a group could add a metric';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM count(*) FROM performance_daily;
    RAISE EXCEPTION 'FAIL: a group can read daily totals';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.td_refresh_performance();
    RAISE EXCEPTION 'FAIL: a group can run the refresh';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RAISE NOTICE 'PASS accounts see only their own page; tables, refresh and comparison are closed to them';
END $$;

-- Staff: any account's page, the comparison, and editing metrics without code
SELECT set_config('request.jwt.claims','{"email":"otisadomako50@gmail.com"}',false);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000ff',false);
DO $$
DECLARE j jsonb;
BEGIN
  j := public.my_performance(30, '00000000-0000-0000-0000-0000000000b2');
  IF metric(j, 'vol_completion_rate') <> '50.0 2/2' THEN RAISE EXCEPTION 'FAIL: staff view of a group: %', metric(j, 'vol_completion_rate'); END IF;
  j := public.performance_overview('volunteer', 'Greater Accra');
  IF jsonb_array_length(j -> 'accounts') <> 3 THEN RAISE EXCEPTION 'FAIL: overview should list the 3 Greater Accra groups, got %', jsonb_array_length(j -> 'accounts'); END IF;
  IF (SELECT a -> 'values' ->> 'vol_cleanups_completed' FROM jsonb_array_elements(j -> 'accounts') a WHERE a ->> 'name' = 'Clean Accra') <> '3' THEN
    RAISE EXCEPTION 'FAIL: overview value for Clean Accra';
  END IF;

  -- hide one, retarget one, add one: no code
  UPDATE performance_metrics SET enabled = false WHERE key = 'vol_claims';
  UPDATE performance_metrics SET target = 10, label = 'Sites cleaned' WHERE key = 'vol_cleanups_completed';
  INSERT INTO performance_metrics (key, label, roles, calc, params, unit, higher_is_better, sort_order)
  VALUES ('vol_started', 'Clean-ups started', ARRAY['volunteer'], 'activity_count', '{"activities": ["cleanup.started"]}', 'count', true, 15);
  -- no refresh call: the edit marks the totals out of date and the page load refreshes them
  j := public.my_performance(30, '00000000-0000-0000-0000-0000000000b1');
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(j -> 'metrics') m WHERE m ->> 'key' = 'vol_claims') THEN RAISE EXCEPTION 'FAIL: hidden metric still shown'; END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(j -> 'metrics') m WHERE m ->> 'key' = 'vol_cleanups_completed' AND m ->> 'label' = 'Sites cleaned' AND m ->> 'target' = '10') THEN
    RAISE EXCEPTION 'FAIL: new label/target not shown';
  END IF;
  IF metric(j, 'vol_started') <> '0 1/3 prev 0' THEN RAISE EXCEPTION 'FAIL: new metric: %', metric(j, 'vol_started'); END IF;

  -- a metric that would not work is refused
  BEGIN
    INSERT INTO performance_metrics (key, label, roles, calc, params) VALUES ('bad_one', 'Bad', ARRAY['volunteer'], 'activity_count', '{"activities": ["drop table"]}');
    RAISE EXCEPTION 'FAIL: unknown activity accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO performance_metrics (key, label, roles, calc, params) VALUES ('bad_two', 'Bad', ARRAY['admin'], 'area_open_backlog', '{}');
    RAISE EXCEPTION 'FAIL: unknown account type accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO performance_metrics (key, label, roles, calc, params) VALUES ('bad_three', 'Bad', ARRAY['authority'], 'area_cleaned_within', '{"days": 400}');
    RAISE EXCEPTION 'FAIL: 400-day window accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  RAISE NOTICE 'PASS staff see any page and the comparison, and can hide, retarget and add metrics (shown on the next page load); broken metrics are refused';
END $$;
RESET ROLE;
