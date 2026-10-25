/**
 * Volunteer group teams: invite links, members and each member's steps.
 * Everything goes through the team_* database functions
 * (supabase/migrations/20261110_team_members.sql); the tables are closed.
 * Those functions raise messages meant for people ("This invite link has
 * expired. Ask the group for a new one."), so those are shown as they are.
 */
import { supabase } from '../utils/supabase';

const missing = (error) => ['42883', 'PGRST202', '42P01'].includes(error?.code) || /could not find the function/i.test(error?.message || '');
const readable = (error) => ['P0001', 'P0002', '42501', '22023'].includes(error?.code);

const call = async (fn, args, fallback) => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    if (missing(error)) throw new Error('Teams aren’t set up in the database yet. Ask an admin to run the latest migrations.');
    if (readable(error) && error.message) throw new Error(error.message);
    console.warn(`${fn}:`, error.message, error.code);
    throw new Error(fallback);
  }
  return data;
};

/** What a link is for (works before signing in): { valid, reason, group_name, region, team_role } */
export const getInviteInfo = (token) => call('team_invite_info', { p_token: token }, 'Couldn’t check this invite link. Try again.');
export const acceptInvite = (token) => call('team_accept_invite', { p_token: token }, 'Couldn’t join the group. Try again.');

export const createInvite = ({ teamRole = 'member', days = 7, maxUses = 25 } = {}) =>
  call('team_create_invite', { p_team_role: teamRole, p_days: days, p_max_uses: maxUses }, 'Couldn’t make an invite link. Try again.');
export const listInvites = async () => (await call('team_invites', {}, 'Couldn’t load the invite links.')) || [];
export const revokeInvite = (id) => call('team_revoke_invite', { p_id: id }, 'Couldn’t cancel the link. Try again.');

/** { group_id, group_name, my_role, members: [...] } */
export const listMembers = () => call('team_members', {}, 'Couldn’t load the team.');
export const setMemberRole = (memberId, teamRole) => call('team_set_role', { p_member: memberId, p_team_role: teamRole }, 'Couldn’t change the role. Try again.');
export const removeMember = (memberId) => call('team_remove_member', { p_member: memberId }, 'Couldn’t remove the member. Try again.');
export const leaveTeam = () => call('team_leave', {}, 'Couldn’t leave the group. Try again.');

/** Each member's steps for the group in the last N days (and the group's own login) */
export const memberStats = async (days) => (await call('team_member_stats', { p_days: days }, 'Couldn’t load the members’ numbers.')) || [];
