import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { pendingInvite } from '../utils/teamInvite';

// Pages someone may still need before joining (signing up, onboarding)
const WAIT_ON = ['/login', '/signup', '/onboarding', '/forgot-password', '/reset-password'];

/**
 * Someone who opened a volunteer group's invite link before having an
 * account goes back to it once they are signed in and onboarded.
 */
const PendingInviteRedirect = () => {
  const { isAuthenticated, authInitialized, loading, onboardingCompleted } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authInitialized || loading || !isAuthenticated) return;
    let onboarded = onboardingCompleted;
    try { onboarded = onboarded || localStorage.getItem('trashdrop_onboarding_completed') === 'true'; } catch (e) { /* no storage */ }
    if (!onboarded) return;
    const path = location.pathname;
    if (path.startsWith('/join/') || WAIT_ON.includes(path)) return;
    const token = pendingInvite();
    if (token) navigate(`/join/${token}`, { replace: true });
  }, [authInitialized, loading, isAuthenticated, onboardingCompleted, location.pathname, navigate]);

  return null;
};

export default PendingInviteRedirect;
