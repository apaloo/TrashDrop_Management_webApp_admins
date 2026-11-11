-- ============================================================================
-- Teams for MMDAs (assemblies), the same way volunteer groups have them.
--
-- An approved Authority (MMDA) account can now invite its staff by link from
-- the Team page. Each member signs in with their own account and works as the
-- assembly: the assembly's Authority role and its district, through the same
-- td_my_role() / td_my_area() every access check already uses. Their steps are
-- credited to the assembly (account_activity.team_id), as for volunteer groups.
--
-- Replaces five functions from 20261110_team_members.sql, copied with only
-- these changes:
--   td_team_of          a group may be an approved volunteer group OR an
--                       approved authority (was volunteer only)
--   td_my_team          the owner may be either
--   td_my_role          a member gets their group's role (was always
--                       'volunteer')
--   team_invite_info    valid for either; also returns group_type and district
--                       so the join page can say what the person is joining
--   team_accept_invite  joins either; messages no longer say "volunteer group"
-- Unchanged: who may invite, remove or leave; members must be plain "user"
-- accounts (an account approved as anything else keeps its own role); one
-- team at a time; td_my_area already reads the group's region and district.
--
-- No data is changed. One transaction. Safe to re-run.
-- Undo: supabase/diagnostics/mmda_teams_rollback.sql
-- ============================================================================

BEGIN;
SET LOCAL search_path = public;

-- The approved volunteer group or assembly a user is an active member of (or NULL)
CREATE OR REPLACE FUNCTION public.td_team_of(p_user uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tm.group_id
  FROM public.team_members tm
  JOIN public.account_roles g ON g.user_id = tm.group_id AND g.role IN ('volunteer', 'authority')
  WHERE tm.member_id = p_user AND tm.status = 'active'
    AND NOT EXISTS (SELECT 1 FROM public.account_roles me WHERE me.user_id = p_user AND me.role <> 'user')
  LIMIT 1
$$;

-- The caller's place in a team: owner (the group's or assembly's own
-- account), admin, member, or NULL
CREATE OR REPLACE FUNCTION public.td_my_team()
RETURNS TABLE (group_id uuid, team_role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid(), 'owner'::text
  FROM public.account_roles r WHERE r.user_id = auth.uid() AND r.role IN ('volunteer', 'authority')
  UNION ALL
  SELECT tm.group_id, tm.team_role
  FROM public.team_members tm
  WHERE tm.member_id = auth.uid() AND tm.status = 'active' AND tm.group_id = public.td_team_of(auth.uid())
  LIMIT 1
$$;

-- Same as 20261110, but an active member works with their group's role
-- (volunteer or authority), not always volunteer
CREATE OR REPLACE FUNCTION public.td_my_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN public.td_is_staff() THEN 'admin'
    ELSE coalesce(
      (SELECT r.role FROM public.account_roles r WHERE r.user_id = auth.uid() AND r.role <> 'user'),
      (SELECT g.role FROM public.account_roles g WHERE g.user_id = public.td_team_of(auth.uid())),
      'user') END
$$;

-- What an invite link is for, before or after signing in. Says only the
-- group's name, type and area and whether the link still works.
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
    'group_name', coalesce(g.org_name, CASE WHEN g.role = 'authority' THEN 'An assembly' ELSE 'A volunteer group' END),
    'group_type', g.role,
    'region', g.region,
    'district', CASE WHEN g.role = 'authority' THEN g.district END,
    'team_role', i.team_role,
    'valid', i.revoked_at IS NULL AND i.expires_at > now() AND i.uses < i.max_uses AND g.role IN ('volunteer', 'authority'),
    'reason', CASE WHEN i.revoked_at IS NOT NULL THEN 'revoked'
                   WHEN i.expires_at <= now() THEN 'expired'
                   WHEN i.uses >= i.max_uses THEN 'used_up'
                   WHEN g.role IS NULL OR g.role NOT IN ('volunteer', 'authority') THEN 'group_inactive' END);
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
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to join a team' USING ERRCODE = '42501'; END IF;
  IF public.td_is_staff() THEN RAISE EXCEPTION 'TrashDrop admin accounts can''t join a team' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO i FROM public.team_invites WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This invite link doesn''t exist' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO g FROM public.account_roles WHERE user_id = i.group_id;
  IF i.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'This invite link was cancelled. Ask the group for a new one.' USING ERRCODE = 'P0001'; END IF;
  IF i.expires_at <= now() THEN RAISE EXCEPTION 'This invite link has expired. Ask the group for a new one.' USING ERRCODE = 'P0001'; END IF;
  IF i.uses >= i.max_uses THEN RAISE EXCEPTION 'This invite link has been used up. Ask the group for a new one.' USING ERRCODE = 'P0001'; END IF;
  IF g.role IS NULL OR g.role NOT IN ('volunteer', 'authority') THEN
    RAISE EXCEPTION 'This group isn''t approved on TrashDrop at the moment' USING ERRCODE = 'P0001';
  END IF;
  IF i.group_id = auth.uid() THEN RAISE EXCEPTION 'This is your own team' USING ERRCODE = 'P0001'; END IF;

  SELECT coalesce((SELECT r.role FROM public.account_roles r WHERE r.user_id = auth.uid()), 'user') INTO my_role;
  IF my_role <> 'user' THEN
    RAISE EXCEPTION 'Your account is approved as %, so it can''t join a team. Use a personal account.', my_role USING ERRCODE = 'P0001';
  END IF;
  SELECT tm.group_id INTO current_group FROM public.team_members tm WHERE tm.member_id = auth.uid() AND tm.status = 'active';
  IF current_group = i.group_id THEN
    RETURN jsonb_build_object('group_id', i.group_id, 'group_name', g.org_name, 'already_member', true);
  END IF;
  IF current_group IS NOT NULL THEN
    RAISE EXCEPTION 'You are already in another team. Leave it first.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.team_members (group_id, member_id, team_role, status, invite_id, joined_at)
  VALUES (i.group_id, auth.uid(), i.team_role, 'active', i.id, now())
  ON CONFLICT (group_id, member_id) DO UPDATE
    SET team_role = EXCLUDED.team_role, status = 'active', invite_id = EXCLUDED.invite_id,
        joined_at = now(), ended_at = NULL, ended_by = NULL;
  UPDATE public.team_invites SET uses = uses + 1 WHERE id = i.id;

  PERFORM public.td_write_log('info', 'admin', 'team.member_joined', 'user', auth.uid()::text,
    format('%s joined %s as %s', coalesce(auth.jwt() ->> 'email', auth.uid()::text),
           coalesce(g.org_name, CASE WHEN g.role = 'authority' THEN 'an assembly' ELSE 'a volunteer group' END), i.team_role),
    NULL, jsonb_build_object('group_id', i.group_id, 'group_type', g.role, 'team_role', i.team_role),
    jsonb_build_object('invite_id', i.id), auth.uid(), auth.jwt() ->> 'email', 'user');
  RETURN jsonb_build_object('group_id', i.group_id, 'group_name', g.org_name, 'team_role', i.team_role, 'already_member', false);
END $$;

-- Same grants as 20261110 (CREATE OR REPLACE keeps them; repeated so a re-run
-- on a fresh database matches)
REVOKE ALL ON FUNCTION public.td_team_of(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.td_my_team() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.td_my_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.team_invite_info(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.team_accept_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.td_my_team() TO authenticated;
GRANT EXECUTE ON FUNCTION public.td_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_invite_info(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.team_accept_invite(text) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Check: approved assemblies that can now invite, and nobody's role changed
-- (members of assemblies only exist once someone accepts an invite)
SELECT
  (SELECT count(*) FROM public.account_roles WHERE role = 'authority') AS assemblies,
  (SELECT count(*) FROM public.team_members tm JOIN public.account_roles g ON g.user_id = tm.group_id
    WHERE tm.status = 'active' AND g.role = 'authority') AS assembly_members;
