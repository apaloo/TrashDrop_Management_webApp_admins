#!/usr/bin/env bash
# Tests supabase/migrations/20261110_team_members.sql (with 20261108 and
# 20261109) on a throwaway local PostgreSQL database (never on Supabase).
#
#   PGHOST=/tmp PGPORT=5432 PGUSER=postgres supabase/tests/team_members/run.sh
#
# Roles of accounts outside teams are unchanged; invites, joining, the access
# members get, who may do what, who can't join, credit for the group,
# removal, dead links, a group losing approval; then 50 people racing for a
# 10-use invite at the same moment.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
act="$here/../account_activity"
mig="$here/../../migrations"
db="td_team_members_test"
psql_() { psql -v ON_ERROR_STOP=1 -q "$@"; }

psql_ -d postgres -c "DROP DATABASE IF EXISTS $db" -c "CREATE DATABASE $db"
psql_ -d "$db" -f "$act/00_stubs.sql"
psql_ -d "$db" -f "$here/05_stubs.sql"
{
  sed -n '/^CREATE OR REPLACE FUNCTION public.enforce_illegal_dumping_status_flow/,/FOR EACH ROW EXECUTE FUNCTION public.enforce_illegal_dumping_status_flow();/p' "$mig/20261013_illegal_dumping_photos_and_status_flow.sql"
  sed -n '/^CREATE OR REPLACE FUNCTION public.td_stamp_assignment/,/FOR EACH ROW EXECUTE FUNCTION public.td_stamp_assignment();/p' "$mig/20261028_volunteer_claims.sql"
  # 20261023's td_my_role and 20261026's td_my_area, as production has them before this migration
  sed -n '/^CREATE OR REPLACE FUNCTION public.td_my_role()/,/^\$\$;/p' "$mig/20261023_account_roles.sql"
  sed -n '/^CREATE OR REPLACE FUNCTION public.td_my_area()/,/^\$\$;/p' "$mig/20261026_area_scope.sql"
} | psql_ -d "$db" >/dev/null
psql_ -d "$db" -f "$mig/20261108_account_activity.sql" >/dev/null 2>&1
psql_ -d "$db" -f "$mig/20261109_account_performance.sql" >/dev/null 2>&1
psql_ -d "$db" -f "$mig/20261110_team_members.sql" >/dev/null
psql_ -d "$db" -f "$mig/20261110_team_members.sql" >/dev/null 2>&1   # safe to re-run
psql_ -d "$db" -f "$here/10_team.sql" 2>&1 | grep -E "PASS|FAIL|ERROR"

if command -v pgbench >/dev/null 2>&1; then
  psql_ -d "$db" -c "
    INSERT INTO auth.users (id, email) SELECT ('55555555-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 'race' || g || '@example.com' FROM generate_series(1, 50) g;
    INSERT INTO account_roles (user_id, role) SELECT ('55555555-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 'user' FROM generate_series(1, 50) g;
    SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000091', false);
    INSERT INTO tokens SELECT 'race', public.team_create_invite('member', 7, 10) ->> 'token';"
  pgbench -n -c 50 -j 8 -t 1 -f "$here/load_join.pgb" "$db" 2>&1 | grep -E "processed|failed"
  psql_ -d "$db" -c "
    DO \$\$ DECLARE joined int; used int; BEGIN
      SELECT count(*) INTO joined FROM team_members WHERE member_id::text LIKE '55555555%' AND status = 'active';
      SELECT uses INTO used FROM team_invites WHERE token = (SELECT token FROM tokens WHERE name = 'race');
      IF joined <> 10 OR used <> 10 THEN RAISE EXCEPTION 'FAIL race: % joined, % uses', joined, used; END IF;
      RAISE NOTICE 'PASS 50 people opening a 10-use link at the same moment: exactly 10 joined';
    END \$\$;" 2>&1 | grep -E "PASS|FAIL|ERROR"
fi

[ -n "${KEEP_DB:-}" ] || psql_ -d postgres -c "DROP DATABASE $db"
