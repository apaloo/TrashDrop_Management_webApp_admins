\set ON_ERROR_STOP 1
-- 1. If recording breaks, the report change still goes through
ALTER TABLE account_activity ADD CONSTRAINT break_it CHECK (false) NOT VALID;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
INSERT INTO illegal_dumping_mobile (id, status, region) VALUES ('22222222-0000-0000-0000-000000000009','pending','Greater Accra');
UPDATE illegal_dumping_mobile SET status='verified' WHERE id='22222222-0000-0000-0000-000000000009';
ALTER TABLE account_activity DROP CONSTRAINT break_it;
DO $$ BEGIN
  IF (SELECT status FROM illegal_dumping_mobile WHERE id='22222222-0000-0000-0000-000000000009') <> 'verified' THEN
    RAISE EXCEPTION 'FAIL: a recording failure blocked the change';
  END IF;
  RAISE NOTICE 'PASS a recording failure never blocks the action';
END $$;
-- 2. Once-per-report steps can't be recorded twice
SELECT public.td_record_activity('00000000-0000-0000-0000-00000000000a','report.verified','22222222-0000-0000-0000-000000000001','x','y',NULL,'{}',true);
DO $$ BEGIN
  IF (SELECT count(*) FROM account_activity WHERE activity='report.verified' AND entity_id='22222222-0000-0000-0000-000000000001') <> 1 THEN
    RAISE EXCEPTION 'FAIL: report.verified recorded twice';
  END IF;
  RAISE NOTICE 'PASS once-per-report steps are never doubled';
END $$;
-- 3. Only staff read the record; the apps can't write it
GRANT USAGE ON SCHEMA public, auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid(), auth.jwt() TO authenticated;
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"email":"someone@example.com"}',false);
DO $$ BEGIN
  IF (SELECT count(*) FROM account_activity) <> 0 THEN RAISE EXCEPTION 'FAIL: a non-staff account can read the record'; END IF;
  BEGIN
    INSERT INTO account_activity (account_id, activity, entity_id) VALUES (gen_random_uuid(),'report.created','x');
    RAISE EXCEPTION 'FAIL: an app account could insert';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.td_record_activity(gen_random_uuid(),'report.created','x','r','d');
    RAISE EXCEPTION 'FAIL: an app account could call td_record_activity';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RAISE NOTICE 'PASS only staff can read; apps can''t write';
END $$;
SELECT set_config('request.jwt.claims','{"email":"otisadomako50@gmail.com"}',false);
DO $$ BEGIN
  IF (SELECT count(*) FROM account_activity) = 0 THEN RAISE EXCEPTION 'FAIL: staff can''t read the record'; END IF;
  RAISE NOTICE 'PASS staff can read';
END $$;
RESET ROLE;
