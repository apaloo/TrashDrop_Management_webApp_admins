/**
 * Recognises a password reset link and remembers it for this browser tab.
 *
 * Sign-in uses the PKCE flow (src/utils/supabase.js), so a reset link arrives as
 * /reset-password?code=... and Supabase reports it as an ordinary SIGNED_IN, not
 * PASSWORD_RECOVERY. The code is removed from the address once it is exchanged,
 * so the tab keeps a flag: refreshing must not skip the new-password form.
 */
const FLAG = 'trashdrop_password_recovery';

export const isRecoveryLink = (loc = window.location) => {
  if (loc.hash?.includes('type=recovery')) return true;
  return loc.pathname === '/reset-password' && new URLSearchParams(loc.search).has('code');
};

export const rememberRecovery = () => {
  try { sessionStorage.setItem(FLAG, '1'); } catch { /* storage blocked: this page load still knows */ }
};

export const forgetRecovery = () => {
  try { sessionStorage.removeItem(FLAG); } catch { /* nothing stored */ }
};

export const hasRememberedRecovery = () => {
  try { return sessionStorage.getItem(FLAG) === '1'; } catch { return false; }
};
