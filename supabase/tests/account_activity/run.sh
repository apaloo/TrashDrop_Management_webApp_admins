#!/usr/bin/env bash
# Tests supabase/migrations/20261108_account_activity.sql on a throwaway local
# PostgreSQL database (never on Supabase).
#
#   PGHOST=/tmp PGPORT=5432 PGUSER=postgres supabase/tests/account_activity/run.sh
#
# 1. scenarios: who is credited for each step (claim, assign, complete,
#    release, expiry)
# 2. safety: a recording failure never blocks the action; no double counting;
#    only staff can read; the apps can't write
# 3. load: 50 accounts at once for 20 s (full report → cleanup flows), then
#    50 groups racing for the same 100 reports; every step recorded once
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
mig="$here/../../migrations"
db="td_account_activity_test"
psql_() { psql -v ON_ERROR_STOP=1 -q "$@"; }

psql_ -d postgres -c "DROP DATABASE IF EXISTS $db" -c "CREATE DATABASE $db"
psql_ -d "$db" -f "$here/00_stubs.sql"
# The real status-flow and assignment-stamp triggers, taken from their migrations
{
  sed -n '/^CREATE OR REPLACE FUNCTION public.enforce_illegal_dumping_status_flow/,/FOR EACH ROW EXECUTE FUNCTION public.enforce_illegal_dumping_status_flow();/p' "$mig/20261013_illegal_dumping_photos_and_status_flow.sql"
  sed -n '/^CREATE OR REPLACE FUNCTION public.td_stamp_assignment/,/FOR EACH ROW EXECUTE FUNCTION public.td_stamp_assignment();/p' "$mig/20261028_volunteer_claims.sql"
} | psql_ -d "$db" 2>/dev/null
psql_ -d "$db" -f "$mig/20261108_account_activity.sql" >/dev/null 2>&1
psql_ -d "$db" -f "$mig/20261108_account_activity.sql" >/dev/null 2>&1   # safe to re-run
psql_ -d "$db" -f "$here/10_scenarios.sql" 2>&1 | grep -E "PASS|FAIL|ERROR"
psql_ -d "$db" -f "$here/20_safety.sql" 2>&1 | grep -E "PASS|FAIL|ERROR"

if command -v pgbench >/dev/null 2>&1; then
  psql_ -d "$db" -c "DELETE FROM illegal_dumping_mobile; TRUNCATE account_activity;
    INSERT INTO collector_profiles (id, user_id, first_name, collector_type)
      SELECT ('33333333-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, ('44444444-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 'Group ' || g, 'volunteer'
      FROM generate_series(1, 200) g;
    INSERT INTO account_roles (user_id, role)
      SELECT ('44444444-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 'volunteer' FROM generate_series(1, 200) g;"
  pgbench -n -c 50 -j 8 -T 20 -f "$here/load_flow.pgb" "$db" 2>&1 | grep -E "processed|failed|latency average|tps"
  psql_ -d "$db" -c "INSERT INTO illegal_dumping_mobile (id, status, region)
    SELECT ('66666666-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 'verified', 'Greater Accra' FROM generate_series(1, 100) g;"
  pgbench -n -c 50 -j 8 -t 40 -f "$here/load_race.pgb" "$db" 2>&1 | grep -E "processed|failed"
  psql_ -d "$db" -f "$here/30_load_check.sql" 2>&1 | grep -E "PASS|FAIL|ERROR"
fi

psql_ -d postgres -c "DROP DATABASE $db"
