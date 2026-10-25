-- Credit past illegal dumping activity that can be proven from existing data.
-- Run only with the owner's approval, after 20261108_account_activity.sql.
--
-- What existing data proves, and what it can't:
--   report.created         reported_by + created_at on every report          yes
--   cleanup.claimed /      the audit log (logs) has dumping.claimed and
--   cleanup.released       dumping.claim_released with the group's login    yes
--   cleanup.completed      completed / disposed reports with a team
--                          (assigned_to) – credited to that team            yes
--   report.verified,       the report doesn't keep who verified, assigned
--   cleanup.assigned,      or marked it cleaned, so these start from the
--   cleanup.marked_cleaned migration date                                  no
--
-- Every row is marked metadata.backfilled = true. Rows are only added, never
-- changed; once-per-report steps skip reports already recorded, so this is
-- safe to re-run. One transaction.
-- Undo: DELETE FROM public.account_activity WHERE metadata ->> 'backfilled' = 'true';

BEGIN;
SET LOCAL search_path = public;

-- No existing row is changed. Count before:
SELECT count(*) AS rows_before FROM public.account_activity;

-- report.created
INSERT INTO public.account_activity (account_id, account_role, activity, entity_id, region, district, occurred_at, metadata, dedupe_key)
SELECT (j ->> 'reported_by')::uuid, public.td_activity_role((j ->> 'reported_by')::uuid), 'report.created', r.id::text,
       j ->> 'region', j ->> 'district', coalesce((j ->> 'created_at')::timestamptz, now()),
       '{"backfilled": true}'::jsonb, 'report.created:' || r.id::text
FROM public.illegal_dumping_mobile r CROSS JOIN LATERAL (SELECT to_jsonb(r) AS j) x
WHERE nullif(j ->> 'reported_by', '') IS NOT NULL
ON CONFLICT (dedupe_key) DO NOTHING;

-- cleanup.claimed / cleanup.released from the audit log (not once-per-report:
-- skip any already recorded for the same group, report and time)
INSERT INTO public.account_activity (account_id, account_role, activity, entity_id, region, district, occurred_at, metadata)
SELECT l.actor_id, public.td_activity_role(l.actor_id),
       CASE l.action WHEN 'dumping.claimed' THEN 'cleanup.claimed' ELSE 'cleanup.released' END,
       l.entity_id, j ->> 'region', j ->> 'district', l.created_at, '{"backfilled": true}'::jsonb
FROM public.logs l
JOIN public.illegal_dumping_mobile r ON r.id::text = l.entity_id
CROSS JOIN LATERAL (SELECT to_jsonb(r) AS j) x
WHERE l.action IN ('dumping.claimed', 'dumping.claim_released') AND l.actor_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.account_activity a
                  WHERE a.account_id = l.actor_id AND a.entity_id = l.entity_id
                    AND a.activity = CASE l.action WHEN 'dumping.claimed' THEN 'cleanup.claimed' ELSE 'cleanup.released' END
                    AND a.occurred_at = l.created_at);

-- cleanup.completed: the team on the report; minutes from assignment when known
INSERT INTO public.account_activity (account_id, account_role, activity, entity_id, region, district, value, occurred_at, metadata, dedupe_key)
SELECT u.team_user, public.td_activity_role(u.team_user), 'cleanup.completed', r.id::text,
       j ->> 'region', j ->> 'district',
       CASE WHEN (j ->> 'assigned_at') IS NOT NULL AND u.done_at IS NOT NULL AND u.done_at >= (j ->> 'assigned_at')::timestamptz
            THEN round(extract(epoch FROM (u.done_at - (j ->> 'assigned_at')::timestamptz)) / 60.0, 1) END,
       coalesce(u.done_at, (j ->> 'updated_at')::timestamptz, now()),
       jsonb_build_object('backfilled', true, 'team_id', j ->> 'assigned_to', 'assigned_via', j ->> 'assigned_via'),
       'cleanup.completed:' || r.id::text
FROM public.illegal_dumping_mobile r
CROSS JOIN LATERAL (SELECT to_jsonb(r) AS j) x
CROSS JOIN LATERAL (SELECT public.td_team_user(nullif(j ->> 'assigned_to', '')::uuid) AS team_user,
                           coalesce((j ->> 'completed_at')::timestamptz, (j ->> 'cleanup_completed_date')::timestamptz) AS done_at) u
WHERE lower(coalesce(j ->> 'status', '')) IN ('completed', 'disposed') AND u.team_user IS NOT NULL
ON CONFLICT (dedupe_key) DO NOTHING;

-- Check
SELECT activity, count(*) AS rows, count(DISTINCT account_id) AS accounts
FROM public.account_activity WHERE metadata ->> 'backfilled' = 'true'
GROUP BY activity ORDER BY activity;

COMMIT;
