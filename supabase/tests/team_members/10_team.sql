\set ON_ERROR_STOP 1
-- People: G = "Clean Accra" volunteer group (Greater Accra), G2 = "Kumasi Keepers" (Ashanti),
-- M1..M3 plain users, A = an MMDA (authority), S = TrashDrop staff
INSERT INTO auth.users (id, email) SELECT ('00000000-0000-0000-0000-0000000000' || x)::uuid, x || '@example.com'
  FROM unnest(ARRAY['91','92','a1','a2','a3','a9','ff']) x;
INSERT INTO account_roles (user_id, role, region, district, org_name) VALUES
 ('00000000-0000-0000-0000-000000000091','volunteer','Greater Accra','Ga East','Clean Accra'),
 ('00000000-0000-0000-0000-000000000092','volunteer','Ashanti','Kumasi Metropolitan','Kumasi Keepers'),
 ('00000000-0000-0000-0000-0000000000a1','user',NULL,NULL,NULL),
 ('00000000-0000-0000-0000-0000000000a2','user',NULL,NULL,NULL),
 ('00000000-0000-0000-0000-0000000000a3','user',NULL,NULL,NULL),
 ('00000000-0000-0000-0000-0000000000a9','authority','Greater Accra','Accra Metropolitan','Accra Metro');

GRANT USAGE ON SCHEMA public, auth TO authenticated, anon;
GRANT EXECUTE ON FUNCTION auth.uid(), auth.jwt() TO authenticated, anon;
CREATE FUNCTION as_(who text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', CASE WHEN who = '' THEN '' ELSE '00000000-0000-0000-0000-0000000000' || who END, false);
  PERFORM set_config('request.jwt.claims', CASE who WHEN 'ff' THEN '{"email":"otisadomako50@gmail.com"}' WHEN '' THEN '{}'
    ELSE '{"email":"' || who || '@example.com"}' END, false);
END $$;
GRANT EXECUTE ON FUNCTION as_(text) TO authenticated, anon;
CREATE FUNCTION refused(sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN EXECUTE sql; RETURN 'allowed';
EXCEPTION WHEN OTHERS THEN RETURN 'refused: ' || SQLERRM; END $$;
GRANT EXECUTE ON FUNCTION refused(text) TO authenticated, anon;
CREATE TABLE tokens (name text PRIMARY KEY, token text);
GRANT ALL ON tokens TO authenticated, anon;

-- Accounts outside teams: the new td_my_role gives exactly what the old one did
DO $$ DECLARE u record; bad text := ''; BEGIN
  FOR u IN SELECT id, email FROM auth.users UNION ALL SELECT '00000000-0000-0000-0000-0000000000ee'::uuid, 'otisadomako50@gmail.com' LOOP
    PERFORM set_config('request.jwt.claim.sub', u.id::text, false);
    PERFORM set_config('request.jwt.claims', jsonb_build_object('email', u.email)::text, false);
    IF public.td_my_role() IS DISTINCT FROM old_my_role(u.id, u.email) THEN bad := bad || ' ' || u.email; END IF;
  END LOOP;
  IF bad <> '' THEN RAISE EXCEPTION 'FAIL role changed for:%', bad; END IF;
  RAISE NOTICE 'PASS roles of every account outside a team are unchanged (incl. staff, MMDA, groups, users)';
END $$;

SET ROLE authenticated;

-- 1. The group invites; the link says only the group's name and region
SELECT as_('91');
INSERT INTO tokens SELECT 'member', public.team_create_invite('member') ->> 'token';
INSERT INTO tokens SELECT 'admin', public.team_create_invite('admin', 7, 5) ->> 'token';
SET ROLE anon; SELECT as_('');
DO $$ DECLARE j jsonb := public.team_invite_info((SELECT token FROM tokens WHERE name = 'member')); BEGIN
  IF length((SELECT token FROM tokens WHERE name = 'member')) <> 64 OR NOT (j ->> 'valid')::boolean OR j ->> 'group_name' <> 'Clean Accra'
     OR j ? 'group_id' OR j ? 'token' THEN RAISE EXCEPTION 'FAIL invite info: %', j; END IF;
  IF (public.team_invite_info('nope') ->> 'reason') <> 'not_found' THEN RAISE EXCEPTION 'FAIL unknown token'; END IF;
  RAISE NOTICE 'PASS an invite link (64-character token) shows only the group name and region, also before signing in';
END $$;
DO $$ BEGIN
  IF refused('SELECT public.team_accept_invite((SELECT token FROM tokens WHERE name = ''member''))') = 'allowed' THEN
    RAISE EXCEPTION 'FAIL joined without signing in'; END IF;
END $$;
SET ROLE authenticated;

-- 2. M1 joins as a member and works as the group: volunteer, group's region
SELECT as_('a1');
DO $$ DECLARE j jsonb; a jsonb; BEGIN
  IF public.td_my_role() <> 'user' THEN RAISE EXCEPTION 'FAIL M1 should start as user'; END IF;
  j := public.team_accept_invite((SELECT token FROM tokens WHERE name = 'member'));
  a := public.my_access();
  IF public.td_my_role() <> 'volunteer' THEN RAISE EXCEPTION 'FAIL member role %', public.td_my_role(); END IF;
  IF public.td_my_area() ->> 'level' <> 'region' OR public.td_my_area() ->> 'region' <> 'Greater Accra' THEN
    RAISE EXCEPTION 'FAIL member area %', public.td_my_area(); END IF;
  IF a -> 'team' ->> 'team_role' <> 'member' OR a ->> 'org_name' <> 'Clean Accra' OR a ->> 'role' <> 'volunteer' THEN
    RAISE EXCEPTION 'FAIL my_access %', a; END IF;
  IF NOT ((public.team_accept_invite((SELECT token FROM tokens WHERE name = 'member')) ->> 'already_member')::boolean) THEN
    RAISE EXCEPTION 'FAIL joining twice'; END IF;
  RAISE NOTICE 'PASS a member works as the group: volunteer role, the group''s region, team in my_access';
END $$;

-- 3. Who may do what
DO $$ DECLARE r text; BEGIN
  r := refused('SELECT public.team_create_invite(''member'')');
  IF r = 'allowed' THEN RAISE EXCEPTION 'FAIL a member created an invite'; END IF;
  r := refused('SELECT public.team_invites()');
  IF r = 'allowed' THEN RAISE EXCEPTION 'FAIL a member listed invites'; END IF;
  IF (SELECT bool_or(m ? 'email' AND m ->> 'email' IS NOT NULL) FROM jsonb_array_elements(public.team_members() -> 'members') m) THEN
    RAISE EXCEPTION 'FAIL a member sees emails'; END IF;
  IF refused('SELECT count(*) FROM public.team_members') = 'allowed' OR refused('SELECT count(*) FROM public.team_invites') = 'allowed' THEN
    RAISE EXCEPTION 'FAIL tables readable directly'; END IF;
  RAISE NOTICE 'PASS members can''t invite or see invite links or emails; the tables are closed';
END $$;
SELECT as_('a2');
DO $$ BEGIN
  PERFORM public.team_accept_invite((SELECT token FROM tokens WHERE name = 'admin'));
  IF public.my_access() -> 'team' ->> 'team_role' <> 'admin' THEN RAISE EXCEPTION 'FAIL group admin'; END IF;
  PERFORM public.team_create_invite('member');
  IF refused('SELECT public.team_create_invite(''admin'')') = 'allowed' THEN RAISE EXCEPTION 'FAIL admin invited an admin'; END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(public.team_members() -> 'members') m WHERE m ->> 'email' IS NOT NULL) <> 2 THEN
    RAISE EXCEPTION 'FAIL group admin should see emails'; END IF;
  RAISE NOTICE 'PASS a group admin invites members (not admins) and sees emails';
END $$;

-- 4. Who can't join
SELECT as_('92'); INSERT INTO tokens SELECT 'g2', public.team_create_invite('member') ->> 'token';
DO $$ DECLARE r text; BEGIN
  PERFORM as_('a9'); r := refused('SELECT public.team_accept_invite((SELECT token FROM tokens WHERE name = ''member''))');
  IF r NOT LIKE '%approved as authority%' THEN RAISE EXCEPTION 'FAIL MMDA joined: %', r; END IF;
  PERFORM as_('91'); r := refused('SELECT public.team_accept_invite((SELECT token FROM tokens WHERE name = ''member''))');
  IF r NOT LIKE '%own group%' THEN RAISE EXCEPTION 'FAIL group joined itself: %', r; END IF;
  PERFORM as_('ff'); r := refused('SELECT public.team_accept_invite((SELECT token FROM tokens WHERE name = ''member''))');
  IF r NOT LIKE '%admin accounts%' THEN RAISE EXCEPTION 'FAIL staff joined: %', r; END IF;
  PERFORM as_('a1'); r := refused('SELECT public.team_accept_invite((SELECT token FROM tokens WHERE name = ''g2''))');
  IF r NOT LIKE '%another group%' THEN RAISE EXCEPTION 'FAIL joined two groups: %', r; END IF;
  RAISE NOTICE 'PASS MMDAs, staff, the group itself and members of another group can''t join';
END $$;

-- 5. Credit: M1's step counts for the group, and shows per member
RESET ROLE;
INSERT INTO illegal_dumping_mobile (id, status, region, district) VALUES ('77777777-0000-0000-0000-000000000001','pending','Greater Accra','Ga East');
SELECT as_('a1');
UPDATE illegal_dumping_mobile SET status = 'verified' WHERE id = '77777777-0000-0000-0000-000000000001';
SELECT public.td_refresh_performance(400) >= 0;
-- (read as the database owner: apps can't read account_activity)
DO $$ BEGIN
  IF (SELECT team_id FROM account_activity WHERE entity_id = '77777777-0000-0000-0000-000000000001' AND activity = 'report.verified')
     IS DISTINCT FROM '00000000-0000-0000-0000-000000000091' THEN RAISE EXCEPTION 'FAIL step not tagged with the group'; END IF;
END $$;
SET ROLE authenticated;
DO $$ DECLARE j jsonb; s jsonb; BEGIN
  PERFORM as_('a1'); j := public.my_performance(30);
  IF j ->> 'account_id' <> '00000000-0000-0000-0000-000000000091'
     OR (SELECT m ->> 'value' FROM jsonb_array_elements(j -> 'metrics') m WHERE m ->> 'key' = 'vol_reports_verified') <> '1' THEN
    RAISE EXCEPTION 'FAIL member page: %', j; END IF;
  PERFORM as_('91'); j := public.my_performance(30);
  IF (SELECT m ->> 'value' FROM jsonb_array_elements(j -> 'metrics') m WHERE m ->> 'key' = 'vol_reports_verified') <> '1' THEN
    RAISE EXCEPTION 'FAIL group page: %', j; END IF;
  PERFORM as_('a1'); s := public.team_member_stats(30);
  IF (SELECT x ->> 'verified' FROM jsonb_array_elements(s) x WHERE x ->> 'member_id' = '00000000-0000-0000-0000-0000000000a1') <> '1'
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(s) x WHERE (x ->> 'is_group')::boolean) THEN
    RAISE EXCEPTION 'FAIL member stats: %', s; END IF;
  IF refused('SELECT public.my_performance(30, ''00000000-0000-0000-0000-000000000092'')') = 'allowed' THEN
    RAISE EXCEPTION 'FAIL member read another group'; END IF;
  PERFORM as_('92');
  IF refused('SELECT public.team_member_stats(30)') <> 'allowed'
     OR jsonb_array_length(public.team_member_stats(30)) <> 1 THEN RAISE EXCEPTION 'FAIL other group sees our members'; END IF;
  RAISE NOTICE 'PASS a member''s step counts for the group page and shows on the members table; other groups see none of it';
END $$;

-- 6. Removal: access ends at once; the group keeps the credit
SELECT as_('a2');
DO $$ DECLARE j jsonb; BEGIN
  PERFORM public.team_remove_member('00000000-0000-0000-0000-0000000000a1');
  PERFORM as_('a1');
  IF public.td_my_role() <> 'user' OR public.td_my_area() ->> 'level' <> 'none' OR public.my_access() -> 'team' <> 'null'::jsonb THEN
    RAISE EXCEPTION 'FAIL removed member keeps access'; END IF;
  j := public.my_performance(30);
  IF jsonb_array_length(j -> 'metrics') <> 0 THEN RAISE EXCEPTION 'FAIL removed member still sees the group page'; END IF;
  PERFORM as_('91');
  IF (SELECT m ->> 'value' FROM jsonb_array_elements(public.my_performance(30) -> 'metrics') m WHERE m ->> 'key' = 'vol_reports_verified') <> '1' THEN
    RAISE EXCEPTION 'FAIL group lost the credit'; END IF;
  IF refused('SELECT public.team_remove_member(''00000000-0000-0000-0000-0000000000a2'')') <> 'allowed' THEN
    RAISE EXCEPTION 'FAIL owner could not remove an admin'; END IF;
  RAISE NOTICE 'PASS removal ends access at once; the group keeps the credit; the owner can remove admins';
END $$;

-- 7. Dead links: expired, cancelled, used up
SELECT as_('91');
INSERT INTO tokens SELECT 'once', public.team_create_invite('member', 7, 1) ->> 'token';
INSERT INTO tokens SELECT 'cancel', public.team_create_invite('member') ->> 'token';
SELECT public.team_revoke_invite((SELECT (i ->> 'id')::uuid FROM jsonb_array_elements(public.team_invites()) i WHERE i ->> 'token' = (SELECT token FROM tokens WHERE name = 'cancel')));
RESET ROLE;
UPDATE team_invites SET expires_at = now() - interval '1 minute' WHERE token = (SELECT token FROM tokens WHERE name = 'admin');
SET ROLE authenticated;
SELECT as_('a3'); SELECT public.team_accept_invite((SELECT token FROM tokens WHERE name = 'once')) IS NOT NULL;
SELECT as_('a3'); SELECT public.team_leave() IS NOT NULL;
DO $$ DECLARE r text; BEGIN
  PERFORM as_('a1');
  r := refused('SELECT public.team_accept_invite((SELECT token FROM tokens WHERE name = ''once''))');
  IF r NOT LIKE '%used up%' THEN RAISE EXCEPTION 'FAIL used-up link: %', r; END IF;
  r := refused('SELECT public.team_accept_invite((SELECT token FROM tokens WHERE name = ''cancel''))');
  IF r NOT LIKE '%cancelled%' THEN RAISE EXCEPTION 'FAIL cancelled link: %', r; END IF;
  r := refused('SELECT public.team_accept_invite((SELECT token FROM tokens WHERE name = ''admin''))');
  IF r NOT LIKE '%expired%' THEN RAISE EXCEPTION 'FAIL expired link: %', r; END IF;
  IF public.team_invite_info((SELECT token FROM tokens WHERE name = 'cancel')) ->> 'reason' <> 'revoked' THEN RAISE EXCEPTION 'FAIL info'; END IF;
  PERFORM as_('a3');
  IF public.td_my_role() <> 'user' THEN RAISE EXCEPTION 'FAIL left member keeps access'; END IF;
  RAISE NOTICE 'PASS used-up, cancelled and expired links are refused; leaving ends access';
END $$;

-- 8. A group that loses its approval takes its members' access with it
SELECT as_('a1'); SELECT public.team_accept_invite((SELECT token FROM tokens WHERE name = 'member')) IS NOT NULL;
RESET ROLE;
UPDATE account_roles SET role = 'user' WHERE user_id = '00000000-0000-0000-0000-000000000091';
SET ROLE authenticated;
SELECT as_('a1');
DO $$ BEGIN
  IF public.td_my_role() <> 'user' THEN RAISE EXCEPTION 'FAIL members of an unapproved group keep access'; END IF;
  IF public.team_invite_info((SELECT token FROM tokens WHERE name = 'member')) ->> 'reason' <> 'group_inactive' THEN RAISE EXCEPTION 'FAIL link of inactive group'; END IF;
  RAISE NOTICE 'PASS when a group loses its approval, its members lose the group''s access and its links stop working';
END $$;
RESET ROLE;
UPDATE account_roles SET role = 'volunteer' WHERE user_id = '00000000-0000-0000-0000-000000000091';
