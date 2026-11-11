-- Undo 20261116_mmda_teams.sql: puts back the five functions exactly as
-- 20261110_team_members.sql defined them (teams for volunteer groups only).
-- Members of assemblies stay in team_members but get no access through the
-- assembly any more (td_team_of ignores them again); open invite links of
-- assemblies stop working. Nothing else is changed.
BEGIN;
SET LOCAL search_path = public;

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

COMMIT;

NOTIFY pgrst, 'reload schema';
