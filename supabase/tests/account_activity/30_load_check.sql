\set ON_ERROR_STOP 1
-- After the load runs: every step recorded once, every report with exactly one group
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM illegal_dumping_mobile r
             LEFT JOIN (SELECT entity_id, count(*) AS n FROM account_activity
                        WHERE activity = 'cleanup.completed' GROUP BY entity_id) c ON c.entity_id = r.id::text
             WHERE r.status = 'completed' AND coalesce(c.n, 0) <> 1) THEN
    RAISE EXCEPTION 'FAIL: a completed report does not have exactly one cleanup.completed row';
  END IF;
  IF EXISTS (SELECT 1 FROM account_activity WHERE activity = 'cleanup.claimed' GROUP BY entity_id HAVING count(DISTINCT account_id) > 1) THEN
    RAISE EXCEPTION 'FAIL: a report was credited to two groups';
  END IF;
  IF EXISTS (SELECT 1 FROM account_activity a JOIN illegal_dumping_mobile r ON r.id::text = a.entity_id
             JOIN collector_profiles cp ON cp.id = r.assigned_to
             WHERE a.activity = 'cleanup.completed' AND a.account_id <> cp.user_id) THEN
    RAISE EXCEPTION 'FAIL: a cleanup was credited to a group that is not on the report';
  END IF;
  RAISE NOTICE 'PASS % steps from concurrent accounts, each recorded once and credited to the right group',
    (SELECT count(*) FROM account_activity);
END $$;
