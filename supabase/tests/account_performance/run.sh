#!/usr/bin/env bash
# Tests supabase/migrations/20261109_account_performance.sql (with 20261108)
# on a throwaway local PostgreSQL database (never on Supabase).
#
#   PGHOST=/tmp PGPORT=5432 PGUSER=postgres supabase/tests/account_performance/run.sh
#
# 1. metrics: every starter metric, previous period and rank against
#    hand-worked numbers (3 groups in Greater Accra, 1 in Ashanti, 2 MMDAs)
# 2. access: accounts see only their own page; staff see any page and the
#    comparison and edit metrics without code; broken metrics are refused
# 3. editor: the rows the admin metric editor writes, under the database rules
# 4. load: 200 groups opening dashboards (50 at once) while reports are
#    worked and the refresh runs; no errors, totals consistent
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
act="$here/../account_activity"
mig="$here/../../migrations"
db="td_account_performance_test"
psql_() { psql -v ON_ERROR_STOP=1 -q "$@"; }

psql_ -d postgres -c "DROP DATABASE IF EXISTS $db" -c "CREATE DATABASE $db"
psql_ -d "$db" -f "$act/00_stubs.sql"
{
  sed -n '/^CREATE OR REPLACE FUNCTION public.enforce_illegal_dumping_status_flow/,/FOR EACH ROW EXECUTE FUNCTION public.enforce_illegal_dumping_status_flow();/p' "$mig/20261013_illegal_dumping_photos_and_status_flow.sql"
  sed -n '/^CREATE OR REPLACE FUNCTION public.td_stamp_assignment/,/FOR EACH ROW EXECUTE FUNCTION public.td_stamp_assignment();/p' "$mig/20261028_volunteer_claims.sql"
} | psql_ -d "$db" 2>/dev/null
psql_ -d "$db" -f "$mig/20261108_account_activity.sql" >/dev/null 2>&1
psql_ -d "$db" -f "$mig/20261109_account_performance.sql" >/dev/null 2>&1
psql_ -d "$db" -f "$mig/20261109_account_performance.sql" >/dev/null 2>&1   # safe to re-run
psql_ -d "$db" -f "$here/10_metrics.sql" 2>&1 | grep -E "PASS|FAIL|ERROR"
psql_ -d "$db" -f "$here/20_access.sql" 2>&1 | grep -E "PASS|FAIL|ERROR"
psql_ -d "$db" -f "$here/30_editor.sql" 2>&1 | grep -E "PASS|FAIL|ERROR"

if command -v pgbench >/dev/null 2>&1; then
  psql_ -d "$db" -c "
    INSERT INTO collector_profiles (id, user_id, first_name, collector_type)
      SELECT ('33333333-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, ('44444444-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 'Group ' || g, 'volunteer'
      FROM generate_series(1, 200) g;
    INSERT INTO account_roles (user_id, role, region, org_name)
      SELECT ('44444444-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 'volunteer', 'Load Region', 'Group ' || g FROM generate_series(1, 200) g;"
  # work reports for a while so there is something to count
  pgbench -n -c 20 -j 4 -T 10 -f "$act/load_flow.pgb" "$db" 2>&1 | grep -E "processed|failed"
  echo "-- 50 groups opening dashboards while reports are worked and the refresh runs:"
  pgbench -n -c 50 -j 8 -T 20 -f "$here/load_dashboards.pgb" -f "$act/load_flow.pgb" -f "$here/load_refresh.pgb@1" "$db" 2>&1 \
    | grep -E "processed|failed|SQL script|latency average" | sed "s/^ - //"
  psql_ -d "$db" -At -c "SELECT public.td_refresh_performance(400) >= 0;" >/dev/null
  psql_ -d "$db" -c "
    DO \$\$ DECLARE want numeric; got numeric; BEGIN
      SELECT count(*) INTO want FROM account_activity a JOIN account_roles r ON r.user_id = a.account_id
        WHERE a.activity = 'cleanup.completed' AND r.role = 'volunteer';
      SELECT sum(num) INTO got FROM performance_daily WHERE metric_key = 'vol_cleanups_completed';
      IF want IS DISTINCT FROM got THEN RAISE EXCEPTION 'FAIL: totals % <> activity %', got, want; END IF;
      RAISE NOTICE 'PASS totals match the activity record exactly (% clean-ups) after concurrent load', got;
    END \$\$;" 2>&1 | grep -E "PASS|FAIL|ERROR"
  psql_ -d "$db" -At -c "SELECT 'refresh with ' || (SELECT count(*) FROM account_activity) || ' activity rows took ' || took_ms || ' ms' FROM performance_refresh"
fi

psql_ -d postgres -c "DROP DATABASE $db"
