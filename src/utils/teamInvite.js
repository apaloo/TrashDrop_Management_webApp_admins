/**
 * Invite links: the address to share, the WhatsApp message, and the link a
 * person opened before signing up (kept in this browser so they come back to
 * it after signing in and onboarding).
 */

export const inviteUrl = (token, origin = window.location.origin) => `${origin}/join/${token}`;

export const whatsappUrl = (groupName, url) =>
  `https://wa.me/?text=${encodeURIComponent(`Join ${groupName || 'our volunteer group'} on TrashDrop: ${url}`)}`;

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
  group_inactive: 'This group isn’t an approved volunteer group at the moment.',
};

export const TEAM_ROLE_LABELS = { owner: 'Group account', admin: 'Group admin', member: 'Member' };
