\set ON_ERROR_STOP 1
-- Known accounts and activity; every starter metric checked against hand-worked numbers.
-- Volunteer groups: three in Greater Accra (one spelled "Greater Accra Region"), one in Ashanti
INSERT INTO account_roles (user_id, role, region, district, org_name) VALUES
 ('00000000-0000-0000-0000-0000000000a1','authority','Greater Accra','Accra Metropolitan','Accra Metro Assembly'),
 ('00000000-0000-0000-0000-0000000000a2','authority','Greater Accra','Tema Metropolitan','Tema Metro Assembly'),
 ('00000000-0000-0000-0000-0000000000b1','volunteer','Greater Accra','Ga East','Clean Accra'),
 ('00000000-0000-0000-0000-0000000000b2','volunteer','Greater Accra','Tema Metropolitan','Green Tema'),
 ('00000000-0000-0000-0000-0000000000b3','volunteer','Greater Accra Region','Ga South','Kasoa Youth'),
 ('00000000-0000-0000-0000-0000000000b4','volunteer','Ashanti','Kumasi Metropolitan','Kumasi Keepers');

CREATE FUNCTION act(who text, what text, n int, days_ago int, val numeric DEFAULT NULL) RETURNS void LANGUAGE sql AS $$
  INSERT INTO account_activity (account_id, account_role, activity, entity_id, occurred_at, value)
  SELECT ('00000000-0000-0000-0000-0000000000' || who)::uuid, 'volunteer', what, gen_random_uuid()::text,
         now() - make_interval(days => days_ago), val
  FROM generate_series(1, n)
$$;
-- Clean Accra: 3 claimed, 3 completed (60, 120, 180 min) this month; 1 completed 40 days ago
SELECT act('b1','cleanup.claimed',3,2);
SELECT act('b1','cleanup.completed',1,1,60); SELECT act('b1','cleanup.completed',1,1,120); SELECT act('b1','cleanup.completed',1,1,180);
SELECT act('b1','cleanup.completed',1,40,90);
-- Green Tema: 2 claimed, 1 completed (30 min), 1 claim ran out
SELECT act('b2','cleanup.claimed',2,3); SELECT act('b2','cleanup.completed',1,2,30); SELECT act('b2','cleanup.claim_expired',1,1);
-- Kumasi Keepers (other region): 5 completed
SELECT act('b4','cleanup.completed',5,1,10);
-- MMDAs verify: Accra 2, Tema 1
SELECT act('a1','report.verified',2,1); SELECT act('a2','report.verified',1,1);

-- Reports: Accra Metropolitan r1 cleaned in 2 days, r2 cleaned in 9 days, r3 pending, r4 verified, r5 cancelled;
-- Tema r6 cleaned in 1 day
INSERT INTO illegal_dumping_mobile (status, region, district, created_at, completed_at) VALUES
 ('completed','Greater Accra','Accra Metropolitan', now() - interval '3 days',  now() - interval '1 day'),
 ('completed','Greater Accra','Accra Metropolitan', now() - interval '10 days', now() - interval '1 day'),
 ('pending',  'Greater Accra','Accra Metropolitan', now() - interval '2 days',  NULL),
 ('verified', 'Greater Accra','Accra Metropolitan', now() - interval '1 day',   NULL),
 ('cancelled','Greater Accra','Accra Metropolitan', now() - interval '1 day',   NULL),
 ('disposed', 'Greater Accra','Tema Metropolitan',  now() - interval '5 days',  now() - interval '4 days');

SELECT public.td_refresh_performance(400) > 0 AS refreshed;

CREATE FUNCTION perf_as(who text) RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000' || who, false);
  PERFORM set_config('request.jwt.claims', '{}', false);
  RETURN public.my_performance(30);
END $$;
CREATE FUNCTION metric(j jsonb, k text) RETURNS text LANGUAGE sql AS $$
  SELECT concat_ws(' ', m ->> 'value', CASE WHEN m ->> 'rank' IS NOT NULL THEN (m ->> 'rank') || '/' || (m ->> 'of') END,
                   CASE WHEN m ->> 'previous' IS NOT NULL THEN 'prev ' || (m ->> 'previous') END)
  FROM jsonb_array_elements(j -> 'metrics') m WHERE m ->> 'key' = k
$$;

DO $$
DECLARE
  j jsonb;
  bad text := '';
BEGIN
  j := perf_as('b1');
  -- value rank/of [prev]
  IF metric(j,'vol_cleanups_completed') <> '3 1/3 prev 1' THEN bad := bad || ' completed=' || metric(j,'vol_cleanups_completed'); END IF;
  IF metric(j,'vol_claims') <> '3 1/3 prev 0' THEN bad := bad || ' claims=' || metric(j,'vol_claims'); END IF;
  IF metric(j,'vol_completion_rate') <> '100.0 1/2' THEN bad := bad || ' rate=' || metric(j,'vol_completion_rate'); END IF;
  IF metric(j,'vol_avg_cleanup_time') <> '120.0 2/2 prev 90.0' THEN bad := bad || ' avg=' || metric(j,'vol_avg_cleanup_time'); END IF;
  IF metric(j,'vol_claims_expired') <> '0 1/3 prev 0' THEN bad := bad || ' expired=' || metric(j,'vol_claims_expired'); END IF;
  IF j ->> 'rank_area' <> 'Greater Accra' THEN bad := bad || ' area=' || (j ->> 'rank_area'); END IF;
  IF jsonb_array_length(j -> 'metrics') <> 6 THEN bad := bad || ' volunteer metric count'; END IF;
  IF j::text LIKE '%0000000000b2%' OR j::text LIKE '%Green Tema%' THEN bad := bad || ' leaks another group'; END IF;

  j := perf_as('b2');
  IF metric(j,'vol_completion_rate') <> '50.0 2/2' THEN bad := bad || ' b2rate=' || metric(j,'vol_completion_rate'); END IF;
  IF metric(j,'vol_avg_cleanup_time') <> '30.0 1/2' THEN bad := bad || ' b2avg=' || metric(j,'vol_avg_cleanup_time'); END IF;
  IF metric(j,'vol_claims_expired') <> '1 3/3 prev 0' THEN bad := bad || ' b2expired=' || metric(j,'vol_claims_expired'); END IF;

  j := perf_as('b4');   -- alone in Ashanti
  IF metric(j,'vol_cleanups_completed') <> '5 1/1 prev 0' THEN bad := bad || ' b4=' || metric(j,'vol_cleanups_completed'); END IF;

  j := perf_as('a1');
  IF metric(j,'mmda_new_reports') <> '4 prev 0' THEN bad := bad || ' a1new=' || metric(j,'mmda_new_reports'); END IF;
  IF metric(j,'mmda_verified') <> '2 1/2 prev 0' THEN bad := bad || ' a1verified=' || metric(j,'mmda_verified'); END IF;
  IF metric(j,'mmda_cleaned') <> '2 1/2 prev 0' THEN bad := bad || ' a1cleaned=' || metric(j,'mmda_cleaned'); END IF;
  IF metric(j,'mmda_cleaned_within_7d') <> '25.0 2/2' THEN bad := bad || ' a1within=' || metric(j,'mmda_cleaned_within_7d'); END IF;
  IF metric(j,'mmda_avg_clean_hours') <> '132.0 2/2' THEN bad := bad || ' a1hours=' || metric(j,'mmda_avg_clean_hours'); END IF;
  IF metric(j,'mmda_open_backlog') <> '2 2/2' THEN bad := bad || ' a1backlog=' || metric(j,'mmda_open_backlog'); END IF;

  j := perf_as('a2');
  IF metric(j,'mmda_cleaned_within_7d') <> '100.0 1/2' THEN bad := bad || ' a2within=' || metric(j,'mmda_cleaned_within_7d'); END IF;
  IF metric(j,'mmda_avg_clean_hours') <> '24.0 1/2' THEN bad := bad || ' a2hours=' || metric(j,'mmda_avg_clean_hours'); END IF;
  IF metric(j,'mmda_open_backlog') <> '0 1/2' THEN bad := bad || ' a2backlog=' || metric(j,'mmda_open_backlog'); END IF;

  IF bad <> '' THEN RAISE EXCEPTION 'FAIL metrics:%', bad; END IF;
  RAISE NOTICE 'PASS every starter metric, previous period and rank match the hand-worked numbers';
END $$;
