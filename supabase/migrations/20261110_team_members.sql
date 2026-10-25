-- ============================================================================
-- Team members for volunteer groups (website part).
--
-- A volunteer group used one shared login. Now the group's account (the
-- "owner") invites members by link; each member signs in with their own
-- account and works as part of the group:
--
-- 1. team_members: who belongs to which group (member or group admin), and
--    team_invites: invite links (random 64-character token, expiry, uses,
--    revocable). Nobody reads or writes these tables directly; everything
--    goes through the functions below.
-- 2. Access: a member gets the group's volunteer role and area, through the
--    same two functions every check already uses:
--      td_my_role()  volunteer while an active member of an approved
--                    volunteer group, if the member's own approved role is
--                    plain "user" (an account approved as anything else
--                    keeps its own role). Unchanged for everyone else.
--      td_my_area()  the group's region for its members.
--    my_access() also returns the group's name and area and a "team" block
--    ({group_id, group_name, team_role: owner | admin | member}).
--    Members don't claim in the collector app yet (that needs the group's
--    collector profile; a later step).
-- 3. Credit: a member's steps stay credited to the member in
--    account_activity, with the group in a new team_id column, so they count
--    for the group's performance page and show per member.
--    td_record_activity(), td_refresh_performance() and my_performance()
--    are redefined for that; a member opening My Performance sees the
--    group's page.
-- 4. Functions: team_create_invite, team_invites, team_revoke_invite,
--    team_invite_info (also before signing in: group name and whether the
--    link still works), team_accept_invite, team_members, team_set_role,
--    team_remove_member, team_leave, team_member_stats.
--    Owner: everything. Group admin: invite members (not admins), see
--    links, remove members. Member: see the team, leave.
--
-- Creates new tables and functions and replaces six existing functions
-- (td_my_role, td_my_area, my_access, td_record_activity,
-- td_refresh_performance, my_performance: copied from their migrations with
-- only the changes above). No existing data is changed.
-- Needs 20261023, 20261026, 20261108 and 20261109. Safe to re-run.
-- One transaction. Undo: supabase/diagnostics/team_members_rollback.sql
-- ============================================================================

BEGIN;
SET LOCAL search_path = public;

-- ── 1. tables ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.team_members (
  group_id   uuid NOT NULL REFERENCES public.account_roles (user_id) ON DELETE CASCADE,
  member_id  uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  team_role  text NOT NULL DEFAULT 'member',
  status     text NOT NULL DEFAULT 'active',
  invite_id  uuid,
  joined_at  timestamptz NOT NULL DEFAULT now(),
  ended_at   timestamptz,
  ended_by   uuid,
  PRIMARY KEY (group_id, member_id),
  CONSTRAINT team_members_role_chk CHECK (team_role IN ('member', 'admin')),
  CONSTRAINT team_members_status_chk CHECK (status IN ('active', 'removed', 'left')),
  CONSTRAINT team_members_not_self_chk CHECK (group_id <> member_id)
);
-- One group at a time
CREATE UNIQUE INDEX IF NOT EXISTS team_members_one_active_idx ON public.team_members (member_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS team_members_group_idx ON public.team_members (group_id) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.team_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid NOT NULL REFERENCES public.account_roles (user_id) ON DELETE CASCADE,
  token       text NOT NULL UNIQUE,
  team_role   text NOT NULL DEFAULT 'member',
  created_by  uuid NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  max_uses    integer NOT NULL DEFAULT 25,
  uses        integer NOT NULL DEFAULT 0,
  revoked_at  timestamptz,
  CONSTRAINT team_invites_role_chk CHECK (team_role IN ('member', 'admin')),
  CONSTRAINT team_invites_uses_chk CHECK (max_uses BETWEEN 1 AND 200 AND uses BETWEEN 0 AND max_uses)
);
CREATE INDEX IF NOT EXISTS team_invites_group_idx ON public.team_invites (group_id, created_at DESC);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.team_members FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.team_invites FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.team_members IS 'Members of volunteer groups; read and written only through the team_* functions (20261110_team_members.sql).';
COMMENT ON TABLE public.team_invites IS 'Invite links for volunteer groups; read and written only through the team_* functions (20261110_team_members.sql).';

-- Steps a member did, credited to the group they were in at the time
ALTER TABLE public.account_activity ADD COLUMN IF NOT EXISTS team_id uuid;
CREATE INDEX IF NOT EXISTS account_activity_team_idx ON public.account_activity (team_id, occurred_at DESC) WHERE team_id IS NOT NULL;

-- ── 2. who belongs where ─────────────────────────────────────────────────
-- The approved volunteer group a user is an active member of (or NULL)
CREATE OR REPLACE FUNCTION public.td_team_of(p_user uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tm.group_id
  FROM public.team_members tm
  JOIN public.account_roles g ON g.user_id = tm.group_id AND g.role = 'volunteer'
  WHERE tm.member_id = p_user AND tm.status = 'active'
    AND NOT EXISTS (SELECT 1 FROM public.account_roles me WHERE me.user_id = p_user AND me.role <> 'user')
  LIMIT 1
$$;

-- The account whose role and area a user works with: their group's, while a
-- member; otherwise their own
CREATE OR REPLACE FUNCTION public.td_effective_account(p_user uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(public.td_team_of(p_user), p_user)
$$;

-- The caller's place in a team: owner (the group's own account), admin,
-- member, or NULL
CREATE OR REPLACE FUNCTION public.td_my_team()
RETURNS TABLE (group_id uuid, team_role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid(), 'owner'::text
  FROM public.account_roles r WHERE r.user_id = auth.uid() AND r.role = 'volunteer'
  UNION ALL
  SELECT tm.group_id, tm.team_role
  FROM public.team_members tm
  WHERE tm.member_id = auth.uid() AND tm.status = 'active' AND tm.group_id = public.td_team_of(auth.uid())
  LIMIT 1
$$;

-- ── 3. access: the group's role and area for its members ─────────────────
-- Same as 20261023, plus: an active member of an approved volunteer group
-- whose own approved role is "user" works as a volunteer
CREATE OR REPLACE FUNCTION public.td_my_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN public.td_is_staff() THEN 'admin'
    ELSE coalesce(
      (SELECT r.role FROM public.account_roles r WHERE r.user_id = auth.uid() AND r.role <> 'user'),
      (SELECT 'volunteer' WHERE public.td_team_of(auth.uid()) IS NOT NULL),
      'user') END
$$;

-- Same as 20261026, but a member's area is their group's
CREATE OR REPLACE FUNCTION public.td_my_area()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (
    SELECT public.td_my_role() AS role,
           (SELECT d.region FROM public.gh_districts d WHERE d.region = ar.region LIMIT 1) AS region,
           (SELECT d.name FROM public.gh_districts d WHERE d.name = ar.district AND d.region = ar.region) AS district
    FROM (SELECT 1) one
    LEFT JOIN public.account_roles ar ON ar.user_id = public.td_effective_account(auth.uid())
  )
  SELECT CASE
    WHEN role IN ('admin', 'manager', 'media') THEN jsonb_build_object('level', 'national', 'role', role)
    WHEN role = 'authority' AND district IS NOT NULL THEN jsonb_build_object('level', 'district', 'role', role, 'region', region, 'district', district)
    WHEN role = 'volunteer' AND region IS NOT NULL THEN jsonb_build_object('level', 'region', 'role', role, 'region', region)
    ELSE jsonb_build_object('level', 'none', 'role', role)
  END
  FROM me
$$;

-- Same as 20261023, plus the group's name and area for members, and "team"
CREATE OR REPLACE FUNCTION public.my_access()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  r public.account_roles;
  g public.account_roles;
  t record;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('role', 'user', 'status', 'approved'); END IF;
  SELECT * INTO r FROM public.account_roles WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    INSERT INTO public.account_roles (user_id) VALUES (auth.uid()) ON CONFLICT DO NOTHING RETURNING * INTO r;
    IF r.user_id IS NULL THEN SELECT * INTO r FROM public.account_roles WHERE user_id = auth.uid(); END IF;
  END IF;
  SELECT * INTO g FROM public.account_roles WHERE user_id = public.td_effective_account(auth.uid());
  SELECT * INTO t FROM public.td_my_team();
  RETURN jsonb_build_object(
    'role', public.td_my_role(),
    'requested_role', CASE WHEN public.td_is_staff() THEN 'admin' ELSE r.requested_role END,
    'status', CASE WHEN public.td_is_staff() THEN 'approved' ELSE r.status END,
    'company_type', g.company_type, 'org_name', g.org_name, 'region', g.region, 'district', g.district,
    'review_note', r.review_note,
    'team', CASE WHEN t.group_id IS NULL THEN NULL ELSE jsonb_build_object(
      'group_id', t.group_id, 'group_name', g.org_name, 'team_role', t.team_role) END);
END $$;

-- ── 4. invites ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.team_create_invite(p_team_role text DEFAULT 'member', p_days integer DEFAULT 7, p_max_uses integer DEFAULT 25)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me record;
  inv public.team_invites;
BEGIN
  SELECT * INTO me FROM public.td_my_team();
  IF me.group_id IS NULL OR me.team_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only the group and its admins can invite members' USING ERRCODE = '42501';
  END IF;
  IF coalesce(p_team_role, 'member') NOT IN ('member', 'admin') THEN
    RAISE EXCEPTION 'An invite is for a member or a group admin' USING ERRCODE = '22023';
  END IF;
  IF p_team_role = 'admin' AND me.team_role <> 'owner' THEN
    RAISE EXCEPTION 'Only the group''s own account can invite group admins' USING ERRCODE = '42501';
  END IF;
  IF (SELECT count(*) FROM public.team_invites
      WHERE group_id = me.group_id AND revoked_at IS NULL AND expires_at > now() AND uses < max_uses) >= 20 THEN
    RAISE EXCEPTION 'This group already has 20 open invite links; cancel some first' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.team_invites (group_id, token, team_role, created_by, expires_at, max_uses)
  VALUES (me.group_id,
          replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
          coalesce(p_team_role, 'member'), auth.uid(),
          now() + make_interval(days => greatest(1, least(coalesce(p_days, 7), 30))),
          greatest(1, least(coalesce(p_max_uses, 25), 200)))
  RETURNING * INTO inv;
  RETURN jsonb_build_object('id', inv.id, 'token', inv.token, 'team_role', inv.team_role,
    'expires_at', inv.expires_at, 'max_uses', inv.max_uses);
END $$;

-- The group's invite links (owner and group admins)
CREATE OR REPLACE FUNCTION public.team_invites()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE me record;
BEGIN
  SELECT * INTO me FROM public.td_my_team();
  IF me.group_id IS NULL OR me.team_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only the group and its admins can see invite links' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', i.id, 'token', i.token, 'team_role', i.team_role, 'created_at', i.created_at,
      'expires_at', i.expires_at, 'uses', i.uses, 'max_uses', i.max_uses,
      'open', i.revoked_at IS NULL AND i.expires_at > now() AND i.uses < i.max_uses) ORDER BY i.created_at DESC)
    FROM public.team_invites i WHERE i.group_id = me.group_id
      AND (i.revoked_at IS NULL AND i.expires_at > now() - interval '30 days')), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.team_revoke_invite(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me record;
BEGIN
  SELECT * INTO me FROM public.td_my_team();
  IF me.group_id IS NULL OR me.team_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only the group and its admins can cancel invite links' USING ERRCODE = '42501';
  END IF;
  UPDATE public.team_invites SET revoked_at = now()
  WHERE id = p_id AND group_id = me.group_id AND revoked_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invite link not found' USING ERRCODE = 'P0002'; END IF;
  RETURN jsonb_build_object('id', p_id, 'revoked', true);
END $$;

-- What an invite link is for, before or after signing in. Says only the
-- group's name and region and whether the link still works.
CREATE OR REPLACE FUNCTION public.team_invite_info(p_token text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  i public.team_invites;
  g public.account_roles;
BEGIN
  SELECT * INTO i FROM public.team_invites WHERE token = p_token;
  IF NOT FOUND OR p_token IS NULL OR length(p_token) <> 64 THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;
  SELECT * INTO g FROM public.account_roles WHERE user_id = i.group_id;
  RETURN jsonb_build_object(
    'group_name', coalesce(g.org_name, 'A volunteer group'), 'region', g.region, 'team_role', i.team_role,
    'valid', i.revoked_at IS NULL AND i.expires_at > now() AND i.uses < i.max_uses AND g.role = 'volunteer',
    'reason', CASE WHEN i.revoked_at IS NOT NULL THEN 'revoked'
                   WHEN i.expires_at <= now() THEN 'expired'
                   WHEN i.uses >= i.max_uses THEN 'used_up'
                   WHEN g.role IS DISTINCT FROM 'volunteer' THEN 'group_inactive' END);
END $$;

CREATE OR REPLACE FUNCTION public.team_accept_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  i public.team_invites;
  g public.account_roles;
  my_role text;
  current_group uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to join a group' USING ERRCODE = '42501'; END IF;
  IF public.td_is_staff() THEN RAISE EXCEPTION 'TrashDrop admin accounts can''t join a group' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO i FROM public.team_invites WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This invite link doesn''t exist' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO g FROM public.account_roles WHERE user_id = i.group_id;
  IF i.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'This invite link was cancelled. Ask the group for a new one.' USING ERRCODE = 'P0001'; END IF;
  IF i.expires_at <= now() THEN RAISE EXCEPTION 'This invite link has expired. Ask the group for a new one.' USING ERRCODE = 'P0001'; END IF;
  IF i.uses >= i.max_uses THEN RAISE EXCEPTION 'This invite link has been used up. Ask the group for a new one.' USING ERRCODE = 'P0001'; END IF;
  IF g.role IS DISTINCT FROM 'volunteer' THEN RAISE EXCEPTION 'This group isn''t an approved volunteer group' USING ERRCODE = 'P0001'; END IF;
  IF i.group_id = auth.uid() THEN RAISE EXCEPTION 'This is your own group' USING ERRCODE = 'P0001'; END IF;

  SELECT coalesce((SELECT r.role FROM public.account_roles r WHERE r.user_id = auth.uid()), 'user') INTO my_role;
  IF my_role <> 'user' THEN
    RAISE EXCEPTION 'Your account is approved as %, so it can''t join a volunteer group. Use a personal account.', my_role USING ERRCODE = 'P0001';
  END IF;
  SELECT tm.group_id INTO current_group FROM public.team_members tm WHERE tm.member_id = auth.uid() AND tm.status = 'active';
  IF current_group = i.group_id THEN
    RETURN jsonb_build_object('group_id', i.group_id, 'group_name', g.org_name, 'already_member', true);
  END IF;
  IF current_group IS NOT NULL THEN
    RAISE EXCEPTION 'You are already in another group. Leave it first.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.team_members (group_id, member_id, team_role, status, invite_id, joined_at)
  VALUES (i.group_id, auth.uid(), i.team_role, 'active', i.id, now())
  ON CONFLICT (group_id, member_id) DO UPDATE
    SET team_role = EXCLUDED.team_role, status = 'active', invite_id = EXCLUDED.invite_id,
        joined_at = now(), ended_at = NULL, ended_by = NULL;
  UPDATE public.team_invites SET uses = uses + 1 WHERE id = i.id;

  PERFORM public.td_write_log('info', 'admin', 'team.member_joined', 'user', auth.uid()::text,
    format('%s joined %s as %s', coalesce(auth.jwt() ->> 'email', auth.uid()::text), coalesce(g.org_name, 'a volunteer group'), i.team_role),
    NULL, jsonb_build_object('group_id', i.group_id, 'team_role', i.team_role),
    jsonb_build_object('invite_id', i.id), auth.uid(), auth.jwt() ->> 'email', 'user');
  RETURN jsonb_build_object('group_id', i.group_id, 'group_name', g.org_name, 'team_role', i.team_role, 'already_member', false);
END $$;

-- ── 5. members ───────────────────────────────────────────────────────────
-- Display name for a user: their name from sign-up, else the start of their email
CREATE OR REPLACE FUNCTION public.td_user_name(p_user uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT coalesce(nullif(btrim(concat_ws(' ', u.raw_user_meta_data ->> 'firstName', u.raw_user_meta_data ->> 'lastName')), ''),
                  nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''), split_part(u.email, '@', 1))
  FROM auth.users u WHERE u.id = p_user
$$;

-- The group's active members (any member may look; emails for owner and admins)
CREATE OR REPLACE FUNCTION public.team_members()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE me record;
BEGIN
  SELECT * INTO me FROM public.td_my_team();
  IF me.group_id IS NULL THEN RAISE EXCEPTION 'You are not in a volunteer group' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object(
    'group_id', me.group_id, 'my_role', me.team_role,
    'group_name', (SELECT org_name FROM public.account_roles WHERE user_id = me.group_id),
    'members', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'member_id', tm.member_id, 'name', public.td_user_name(tm.member_id), 'team_role', tm.team_role,
        'joined_at', tm.joined_at, 'is_me', tm.member_id = auth.uid(),
        'email', CASE WHEN me.team_role IN ('owner', 'admin') THEN (SELECT email FROM auth.users WHERE id = tm.member_id) END)
        ORDER BY tm.team_role DESC, tm.joined_at)
      FROM public.team_members tm WHERE tm.group_id = me.group_id AND tm.status = 'active'), '[]'::jsonb));
END $$;

-- Owner only: make a member a group admin, or back
CREATE OR REPLACE FUNCTION public.team_set_role(p_member uuid, p_team_role text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me record;
BEGIN
  SELECT * INTO me FROM public.td_my_team();
  IF me.group_id IS NULL OR me.team_role <> 'owner' THEN
    RAISE EXCEPTION 'Only the group''s own account can change member roles' USING ERRCODE = '42501';
  END IF;
  IF p_team_role NOT IN ('member', 'admin') THEN RAISE EXCEPTION 'A member or a group admin' USING ERRCODE = '22023'; END IF;
  UPDATE public.team_members SET team_role = p_team_role
  WHERE group_id = me.group_id AND member_id = p_member AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found' USING ERRCODE = 'P0002'; END IF;
  RETURN jsonb_build_object('member_id', p_member, 'team_role', p_team_role);
END $$;

-- Owner removes anyone; a group admin removes members (not other admins)
CREATE OR REPLACE FUNCTION public.team_remove_member(p_member uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me record;
  target public.team_members;
BEGIN
  SELECT * INTO me FROM public.td_my_team();
  IF me.group_id IS NULL OR me.team_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only the group and its admins can remove members' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO target FROM public.team_members
  WHERE group_id = me.group_id AND member_id = p_member AND status = 'active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found' USING ERRCODE = 'P0002'; END IF;
  IF target.team_role = 'admin' AND me.team_role <> 'owner' THEN
    RAISE EXCEPTION 'Only the group''s own account can remove a group admin' USING ERRCODE = '42501';
  END IF;
  UPDATE public.team_members SET status = 'removed', ended_at = now(), ended_by = auth.uid()
  WHERE group_id = me.group_id AND member_id = p_member;
  PERFORM public.td_write_log('info', 'admin', 'team.member_removed', 'user', p_member::text,
    format('%s was removed from the group', coalesce(public.td_user_name(p_member), p_member::text)),
    jsonb_build_object('group_id', me.group_id, 'team_role', target.team_role), NULL,
    '{}'::jsonb, auth.uid(), auth.jwt() ->> 'email', 'volunteer');
  RETURN jsonb_build_object('member_id', p_member, 'removed', true);
END $$;

CREATE OR REPLACE FUNCTION public.team_leave()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g uuid;
BEGIN
  UPDATE public.team_members SET status = 'left', ended_at = now(), ended_by = auth.uid()
  WHERE member_id = auth.uid() AND status = 'active'
  RETURNING group_id INTO g;
  IF g IS NULL THEN RAISE EXCEPTION 'You are not in a volunteer group' USING ERRCODE = 'P0002'; END IF;
  PERFORM public.td_write_log('info', 'admin', 'team.member_left', 'user', auth.uid()::text,
    format('%s left the group', coalesce(public.td_user_name(auth.uid()), auth.uid()::text)),
    jsonb_build_object('group_id', g), NULL, '{}'::jsonb, auth.uid(), auth.jwt() ->> 'email', 'user');
  RETURN jsonb_build_object('left', true);
END $$;

-- Each member's steps for the group in the last N days, plus the group's own
-- account (steps done with the shared login, e.g. in the collector app).
-- Only people in the group see this.
CREATE OR REPLACE FUNCTION public.team_member_stats(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  me record;
  since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
BEGIN
  SELECT * INTO me FROM public.td_my_team();
  IF me.group_id IS NULL THEN
    RAISE EXCEPTION 'You are not in a volunteer group' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(x ORDER BY (x ->> 'is_group')::boolean DESC, (x ->> 'total')::int DESC, x ->> 'name')
    FROM (
      SELECT jsonb_build_object(
        'member_id', p.id, 'is_group', p.id = me.group_id,
        'name', CASE WHEN p.id = me.group_id THEN 'Group account' ELSE public.td_user_name(p.id) END,
        'verified', count(*) FILTER (WHERE a.activity = 'report.verified'),
        'assigned', count(*) FILTER (WHERE a.activity = 'cleanup.assigned'),
        'claimed', count(*) FILTER (WHERE a.activity = 'cleanup.claimed'),
        'completed', count(*) FILTER (WHERE a.activity = 'cleanup.completed'),
        'marked_cleaned', count(*) FILTER (WHERE a.activity = 'cleanup.marked_cleaned'),
        'total', count(a.id)) AS x
      FROM (
        SELECT me.group_id AS id
        UNION
        SELECT tm.member_id FROM public.team_members tm WHERE tm.group_id = me.group_id AND tm.status = 'active'
      ) p
      LEFT JOIN public.account_activity a
        ON a.account_id = p.id AND a.occurred_at >= since
       AND (p.id = me.group_id OR a.team_id = me.group_id)
      GROUP BY p.id
    ) s), '[]'::jsonb);
END $$;

-- ── 6. credit members' steps to their group ──────────────────────────────
-- Same as 20261108, plus team_id: the group the account was in at the time
CREATE OR REPLACE FUNCTION public.td_record_activity(
  p_account uuid, p_activity text, p_entity_id text, p_region text, p_district text,
  p_value numeric DEFAULT NULL, p_metadata jsonb DEFAULT '{}'::jsonb, p_once boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_account IS NULL OR p_entity_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.account_activity
    (account_id, account_role, activity, entity_id, region, district, value, metadata, dedupe_key, team_id)
  VALUES
    (p_account, public.td_activity_role(p_account), p_activity, p_entity_id, p_region, p_district,
     p_value, coalesce(p_metadata, '{}'::jsonb),
     CASE WHEN p_once THEN p_activity || ':' || p_entity_id END,
     public.td_team_of(p_account))
  ON CONFLICT (dedupe_key) DO NOTHING;
END $$;

-- Same as 20261109, but a member's steps count for their group
CREATE OR REPLACE FUNCTION public.td_refresh_performance(p_days integer DEFAULT 35)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  from_day date := (now() AT TIME ZONE 'Africa/Accra')::date - greatest(1, least(p_days, 3650));
  t0 timestamptz := clock_timestamp();
  n integer := 0;
  k integer;
BEGIN
  -- One refresh at a time; a second caller just skips
  IF NOT pg_try_advisory_xact_lock(hashtext('td_refresh_performance')) THEN RETURN -1; END IF;

  DELETE FROM public.performance_daily WHERE day >= from_day;

  -- Steps the account did
  INSERT INTO public.performance_daily (account_id, metric_key, day, num, den)
  SELECT coalesce(a.team_id, a.account_id), m.key, (a.occurred_at AT TIME ZONE 'Africa/Accra')::date,
         CASE m.calc WHEN 'activity_avg' THEN sum(a.value) ELSE count(*) END,
         CASE m.calc WHEN 'activity_avg' THEN count(a.value) END
  FROM public.performance_metrics m
  JOIN public.account_activity a
    ON a.activity IN (SELECT jsonb_array_elements_text(m.params -> 'activities'))
   AND a.occurred_at >= from_day
  JOIN public.td_performance_accounts() acc ON acc.account_id = coalesce(a.team_id, a.account_id) AND acc.role = ANY (m.roles)
  WHERE m.enabled AND m.calc IN ('activity_count', 'activity_avg')
  GROUP BY 1, 2, 3
  HAVING m.calc <> 'activity_avg' OR count(a.value) > 0;
  GET DIAGNOSTICS k = ROW_COUNT; n := n + k;

  -- Ratios: numerator and denominator steps per day
  INSERT INTO public.performance_daily (account_id, metric_key, day, num, den)
  SELECT coalesce(a.team_id, a.account_id), m.key, (a.occurred_at AT TIME ZONE 'Africa/Accra')::date,
         count(*) FILTER (WHERE a.activity IN (SELECT jsonb_array_elements_text(m.params -> 'activities'))),
         count(*) FILTER (WHERE a.activity IN (SELECT jsonb_array_elements_text(m.params -> 'of')))
  FROM public.performance_metrics m
  JOIN public.account_activity a
    ON (a.activity IN (SELECT jsonb_array_elements_text(m.params -> 'activities'))
        OR a.activity IN (SELECT jsonb_array_elements_text(m.params -> 'of')))
   AND a.occurred_at >= from_day
  JOIN public.td_performance_accounts() acc ON acc.account_id = coalesce(a.team_id, a.account_id) AND acc.role = ANY (m.roles)
  WHERE m.enabled AND m.calc = 'activity_ratio'
  GROUP BY 1, 2, 3;
  GET DIAGNOSTICS k = ROW_COUNT; n := n + k;

  -- The account's area: new and cleaned reports, cleaned within N days,
  -- hours to clean up
  WITH acc AS (
    SELECT * FROM public.td_performance_accounts() WHERE role IN ('authority', 'volunteer')
  ), rep AS (
    SELECT r.region, r.district, r.created_at, r.completed_at,
           lower(coalesce(r.status, '')) IN ('completed', 'disposed') AS cleaned
    FROM public.illegal_dumping_mobile r
    WHERE lower(coalesce(r.status, '')) <> 'cancelled'
      AND (r.created_at >= from_day OR r.completed_at >= from_day)
  )
  INSERT INTO public.performance_daily (account_id, metric_key, day, num, den)
  SELECT acc.account_id, m.key, x.day, sum(x.num), CASE WHEN m.calc = 'area_reports' THEN NULL ELSE sum(x.den) END
  FROM public.performance_metrics m
  JOIN acc ON acc.role = ANY (m.roles)
  JOIN rep ON public.td_in_account_area(acc.role, acc.region, acc.district, rep.region, rep.district)
  CROSS JOIN LATERAL (
    SELECT (rep.created_at AT TIME ZONE 'Africa/Accra')::date AS day, 1 AS num, NULL::numeric AS den
    WHERE m.calc = 'area_reports' AND m.params ->> 'status' = 'new' AND rep.created_at >= from_day
    UNION ALL
    SELECT (rep.completed_at AT TIME ZONE 'Africa/Accra')::date, 1, NULL
    WHERE m.calc = 'area_reports' AND m.params ->> 'status' = 'cleaned' AND rep.cleaned AND rep.completed_at >= from_day
    UNION ALL
    SELECT (rep.created_at AT TIME ZONE 'Africa/Accra')::date,
           CASE WHEN rep.cleaned AND rep.completed_at <= rep.created_at + make_interval(days => (m.params ->> 'days')::int) THEN 1 ELSE 0 END,
           1
    WHERE m.calc = 'area_cleaned_within' AND rep.created_at >= from_day
    UNION ALL
    SELECT (rep.completed_at AT TIME ZONE 'Africa/Accra')::date,
           round(extract(epoch FROM (rep.completed_at - rep.created_at)) / 3600.0, 2), 1
    WHERE m.calc = 'area_avg_clean_hours' AND rep.cleaned AND rep.completed_at >= from_day
      AND rep.completed_at >= rep.created_at
  ) x
  WHERE m.enabled AND m.calc IN ('area_reports', 'area_cleaned_within', 'area_avg_clean_hours')
  GROUP BY 1, 2, 3, m.calc;
  GET DIAGNOSTICS k = ROW_COUNT; n := n + k;

  UPDATE public.performance_refresh
  SET refreshed_at = now(), took_ms = (extract(epoch FROM clock_timestamp() - t0) * 1000)::int, rows_written = n;
  RETURN n;
END $$;

-- Same as 20261109, but a member opening My Performance sees the group's page
CREATE OR REPLACE FUNCTION public.my_performance(p_days integer DEFAULT 30, p_account uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  who uuid := coalesce(p_account, public.td_effective_account(auth.uid()));
  days integer := greatest(1, least(coalesce(p_days, 30), 365));
  today date := (now() AT TIME ZONE 'Africa/Accra')::date;
  p_from date;
  prev_from date;
  me record;
  peers uuid[];
  m public.performance_metrics;
  mine numeric;
  prev numeric;
  rnk integer;
  ranked integer;
  trend jsonb;
  result jsonb := '[]'::jsonb;
  refreshed timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to see performance' USING ERRCODE = '42501';
  END IF;
  IF who IS DISTINCT FROM public.td_effective_account(auth.uid()) AND NOT public.td_is_staff() THEN
    RAISE EXCEPTION 'You can only see your own performance' USING ERRCODE = '42501';
  END IF;

  -- Totals older than 5 minutes (no pg_cron, or it lags): refresh now
  SELECT refreshed_at INTO refreshed FROM public.performance_refresh;
  IF refreshed IS NULL OR refreshed < now() - interval '5 minutes' THEN
    PERFORM public.td_refresh_performance();
    SELECT refreshed_at INTO refreshed FROM public.performance_refresh;
  END IF;

  SELECT ar.user_id, ar.role, ar.org_name, ar.region, ar.district INTO me
  FROM public.account_roles ar WHERE ar.user_id = who;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('account_id', who, 'role', 'user', 'metrics', '[]'::jsonb, 'refreshed_at', refreshed);
  END IF;

  p_from := today - (days - 1);
  prev_from := p_from - days;

  -- Peers: approved accounts of the same type in the same region (or all of
  -- Ghana when the account has no region)
  SELECT array_agg(acc.account_id) INTO peers
  FROM public.td_performance_accounts() acc
  WHERE acc.role = me.role
    AND (me.region IS NULL OR public.td_norm_region(acc.region) = public.td_norm_region(me.region));

  FOR m IN
    SELECT * FROM public.performance_metrics
    WHERE enabled AND me.role = ANY (roles)
    ORDER BY sort_order, key
  LOOP
    SELECT v.value INTO mine FROM public.td_metric_values(m.key, ARRAY[who], p_from, today) v;
    prev := NULL;
    trend := NULL;
    IF m.calc <> 'area_open_backlog' THEN
      SELECT v.value INTO prev FROM public.td_metric_values(m.key, ARRAY[who], prev_from, p_from - 1) v;
      SELECT coalesce(jsonb_agg(jsonb_build_object('day', d.day,
               'value', CASE
                 WHEN m.calc IN ('activity_count', 'area_reports') THEN d.num
                 WHEN m.calc IN ('activity_ratio', 'area_cleaned_within') THEN round(100 * d.num / nullif(d.den, 0), 1)
                 ELSE round(d.num / nullif(d.den, 0), 1) END) ORDER BY d.day), '[]'::jsonb)
      INTO trend
      FROM public.performance_daily d
      WHERE d.account_id = who AND d.metric_key = m.key AND d.day BETWEEN p_from AND today;
    END IF;

    rnk := NULL;
    ranked := NULL;
    IF m.higher_is_better IS NOT NULL AND mine IS NOT NULL THEN
      SELECT count(*) FILTER (WHERE v.value IS NOT NULL),
             1 + count(*) FILTER (WHERE v.value IS NOT NULL AND
                   CASE WHEN m.higher_is_better THEN v.value > mine ELSE v.value < mine END)
      INTO ranked, rnk
      FROM public.td_metric_values(m.key, peers, p_from, today) v;
    END IF;

    result := result || jsonb_build_object(
      'key', m.key, 'label', m.label, 'description', m.description, 'unit', m.unit,
      'higher_is_better', m.higher_is_better, 'target', m.target,
      'value', mine, 'previous', prev, 'trend', trend,
      'rank', rnk, 'of', ranked, 'live', m.calc = 'area_open_backlog');
  END LOOP;

  RETURN jsonb_build_object(
    'account_id', who, 'role', me.role, 'name', me.org_name,
    'region', me.region, 'district', me.district,
    'rank_area', coalesce(me.region, 'Ghana'),
    'period', jsonb_build_object('from', p_from, 'to', today, 'days', days),
    'refreshed_at', refreshed,
    'metrics', result);
END $$;

-- ── 7. who may call what ─────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.td_team_of(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.td_effective_account(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.td_user_name(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.td_my_team() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.td_my_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.td_my_area() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_access() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.team_create_invite(text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.team_invites() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.team_revoke_invite(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.team_invite_info(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.team_accept_invite(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.team_members() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.team_set_role(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.team_remove_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.team_leave() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.team_member_stats(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.td_record_activity(uuid, text, text, text, text, numeric, jsonb, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.td_refresh_performance(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.my_performance(integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.td_my_team() TO authenticated;
GRANT EXECUTE ON FUNCTION public.td_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.td_my_area() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_create_invite(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_invites() TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_revoke_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_invite_info(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.team_accept_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_members() TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_set_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_remove_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_leave() TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_member_stats(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_performance(integer, uuid) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Check: new tables are empty; everyone's role is as before (no members yet)
SELECT
  (SELECT count(*) FROM public.team_members) AS members,
  (SELECT count(*) FROM public.team_invites) AS invites,
  (SELECT count(*) FROM public.account_activity WHERE team_id IS NOT NULL) AS member_steps;
