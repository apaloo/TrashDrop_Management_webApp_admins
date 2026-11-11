/**
 * Invite links: the address to share, the WhatsApp message, and the link a
 * person opened before signing up (kept in this browser so they come back to
 * it after signing in and onboarding).
 */

export const inviteUrl = (token, origin = window.location.origin) => `${origin}/join/${token}`;

export const whatsappUrl = (groupName, url) =>
  `https://wa.me/?text=${encodeURIComponent(`Join ${groupName || 'our team'} on TrashDrop: ${url}`)}`;

const KEY = 'td_pending_invite';
const TOKEN = /^[0-9a-f]{64}$/;

export const isInviteToken = (token) => TOKEN.test(String(token || ''));

export const rememberInvite = (token) => {
  if (!isInviteToken(token)) return;
  try { localStorage.setItem(KEY, token); } catch (e) { /* private mode: they can open the link again */ }
};

export const pendingInvite = () => {
  try {
    const t = localStorage.getItem(KEY);
    return isInviteToken(t) ? t : null;
  } catch (e) {
    return null;
  }
};

export const forgetInvite = () => {
  try { localStorage.removeItem(KEY); } catch (e) { /* nothing to clear */ }
};

/** Why a link doesn't work, in words */
export const INVITE_PROBLEMS = {
  not_found: 'This invite link doesn’t exist. Check you copied all of it.',
  expired: 'This invite link has expired. Ask the group for a new one.',
  revoked: 'This invite link was cancelled. Ask the group for a new one.',
  used_up: 'This invite link has been used up. Ask the group for a new one.',
  group_inactive: 'This group isn’t approved on TrashDrop at the moment.',
};

/**
 * How to describe a team by the kind of account that owns it
 * (team_invite_info's group_type): a volunteer group or an assembly (MMDA).
 */
export const teamKind = (groupType) => (groupType === 'authority'
  ? {
    noun: 'assembly (MMDA)',
    withArticle: 'an assembly (MMDA)',
    fallbackName: 'an assembly',
    duties: 'Members work on the assembly’s illegal dumping reports in its district (verify, assign and follow up cleanups) and see its performance.',
  }
  : {
    noun: 'volunteer group',
    withArticle: 'a volunteer group',
    fallbackName: 'a volunteer group',
    duties: 'Members verify and clean up illegal dumping reports with the group, and see the group’s performance.',
  });

export const TEAM_ROLE_LABELS = { owner: 'Group account', admin: 'Group admin', member: 'Member' };
