\set ON_ERROR_STOP 1
-- Who is credited for each step, end to end. Fails loudly on any difference.
INSERT INTO account_roles VALUES
 ('00000000-0000-0000-0000-00000000000a','authority','Greater Accra','Accra Metropolitan'),
 ('00000000-0000-0000-0000-00000000000b','volunteer','Greater Accra','Ga East');
INSERT INTO collector_profiles (id,user_id,first_name,collector_type) VALUES
 ('11111111-0000-0000-0000-00000000000b','00000000-0000-0000-0000-00000000000b','Clean Accra','volunteer'),
 ('11111111-0000-0000-0000-00000000000c','00000000-0000-0000-0000-00000000000c','Kofi','collector');
CREATE FUNCTION as_user(u text) RETURNS void LANGUAGE sql AS $$ SELECT set_config('request.jwt.claim.sub', u, false) $$;
-- Report 1: claimed and cleaned by the volunteer group
SELECT as_user('00000000-0000-0000-0000-000000000001');
INSERT INTO illegal_dumping_mobile (id, reported_by, region, district) VALUES ('22222222-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Greater Accra','Ga East');
SELECT as_user('00000000-0000-0000-0000-00000000000a');
UPDATE illegal_dumping_mobile SET status='verified' WHERE id='22222222-0000-0000-0000-000000000001';
SELECT as_user('00000000-0000-0000-0000-00000000000b');
BEGIN; SELECT set_config('app.td_claim','on',true);
UPDATE illegal_dumping_mobile SET assigned_to='11111111-0000-0000-0000-00000000000b' WHERE id='22222222-0000-0000-0000-000000000001'; COMMIT;
UPDATE illegal_dumping_mobile SET assigned_at = now() - interval '90 minutes' WHERE id='22222222-0000-0000-0000-000000000001';
UPDATE illegal_dumping_mobile SET status='in_progress' WHERE id='22222222-0000-0000-0000-000000000001';
UPDATE illegal_dumping_mobile SET status='completed' WHERE id='22222222-0000-0000-0000-000000000001';
UPDATE illegal_dumping_mobile SET status='disposed' WHERE id='22222222-0000-0000-0000-000000000001';
-- Report 2: MMDA assigns a paid collector with a fee, collector starts, MMDA marks cleaned
SELECT as_user('00000000-0000-0000-0000-000000000001');
INSERT INTO illegal_dumping_mobile (id, reported_by, region, district) VALUES ('22222222-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','Greater Accra','Accra Metropolitan');
SELECT as_user('00000000-0000-0000-0000-00000000000a');
UPDATE illegal_dumping_mobile SET status='verified' WHERE id='22222222-0000-0000-0000-000000000002';
UPDATE illegal_dumping_mobile SET assigned_to='11111111-0000-0000-0000-00000000000c', cleanup_fee=50 WHERE id='22222222-0000-0000-0000-000000000002';
SELECT as_user('00000000-0000-0000-0000-00000000000c');
UPDATE illegal_dumping_mobile SET status='in_progress' WHERE id='22222222-0000-0000-0000-000000000002';
SELECT as_user('00000000-0000-0000-0000-00000000000a');
UPDATE illegal_dumping_mobile SET status='completed' WHERE id='22222222-0000-0000-0000-000000000002';
-- Report 3: claimed then given back by the group
INSERT INTO illegal_dumping_mobile (id, status, region, district) VALUES ('22222222-0000-0000-0000-000000000003','verified','Greater Accra','Ga East');
SELECT as_user('00000000-0000-0000-0000-00000000000b');
BEGIN; SELECT set_config('app.td_claim','on',true);
UPDATE illegal_dumping_mobile SET assigned_to='11111111-0000-0000-0000-00000000000b' WHERE id='22222222-0000-0000-0000-000000000003'; COMMIT;
BEGIN; SELECT set_config('app.td_claim','on',true); SELECT set_config('app.skip_status_flow','on',true);
UPDATE illegal_dumping_mobile SET assigned_to=NULL, status='verified' WHERE id='22222222-0000-0000-0000-000000000003'; COMMIT;
-- Report 4: claimed 25 h ago, released by the expiry job (no signed-in user)
INSERT INTO illegal_dumping_mobile (id, status, region, district) VALUES ('22222222-0000-0000-0000-000000000004','verified','Greater Accra','Ga East');
BEGIN; SELECT set_config('app.td_claim','on',true);
UPDATE illegal_dumping_mobile SET assigned_to='11111111-0000-0000-0000-00000000000b' WHERE id='22222222-0000-0000-0000-000000000004'; COMMIT;
UPDATE illegal_dumping_mobile SET assigned_at = now() - interval '25 hours' WHERE id='22222222-0000-0000-0000-000000000004';
SELECT as_user('');
BEGIN; SELECT set_config('app.td_claim','on',true); SELECT set_config('app.skip_status_flow','on',true);
UPDATE illegal_dumping_mobile SET assigned_to=NULL, status='verified' WHERE assigned_via='claim' AND status='verified' AND assigned_at < now() - interval '24 hours'; COMMIT;


DO $$
DECLARE
  got text;
  want text := string_agg(x, E'\n' ORDER BY x) FROM unnest(ARRAY[
    '1 report.created 01 user', '1 report.verified 0a authority', '1 cleanup.claimed 0b volunteer',
    '1 cleanup.started 0b volunteer', '1 cleanup.completed 0b volunteer 90.0',
    '2 report.created 01 user', '2 report.verified 0a authority', '2 cleanup.assigned 0a authority 50',
    '2 cleanup.received 0c collector', '2 cleanup.started 0c collector', '2 cleanup.completed 0c collector 0.0',
    '2 cleanup.marked_cleaned 0a authority',
    '3 cleanup.claimed 0b volunteer', '3 cleanup.released 0b volunteer',
    '4 cleanup.claimed 0b volunteer', '4 cleanup.claim_expired 0b volunteer']) x;
BEGIN
  SELECT string_agg(line, E'\n' ORDER BY line) INTO got
  FROM (SELECT concat_ws(' ', right(entity_id, 1), activity, right(account_id::text, 2), account_role, value) AS line
        FROM account_activity) x;
  IF got IS DISTINCT FROM want THEN
    RAISE EXCEPTION E'FAIL scenarios.\nwanted:\n%\ngot:\n%', want, got;
  END IF;
  RAISE NOTICE 'PASS scenarios (16 steps credited correctly; disposing did not count the cleanup twice)';
END $$;
