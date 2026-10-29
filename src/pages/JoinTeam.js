import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthShell, { AUTH } from '../components/auth/AuthShell';
import { getInviteInfo, acceptInvite } from '../services/teamService';
import { updateUserMetadata } from '../utils/auth';
import {
  isInviteToken, rememberInvite, forgetInvite, INVITE_PROBLEMS, TEAM_ROLE_LABELS,
} from '../utils/teamInvite';

const Card = ({ children }) => (
  <AuthShell><div className="text-td-ink">{children}</div></AuthShell>
);

/**
 * Opening a volunteer group's invite link (/join/:token). Signed out: who the
 * group is, and sign up / sign in (the link is remembered for after).
 * Signed in: join with one click; someone who signed up through this link
 * joins straight away.
 */
const JoinTeam = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, authInitialized, loading, access, refreshAccess } = useAuth();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [joining, setJoining] = useState(false);
  const autoJoined = useRef(false);
  const signedUpWithLink = user?.user_metadata?.inviteToken === token;

  // Done with the link: stop coming back to it, here and on other devices
  const dropInvite = useCallback(() => {
    forgetInvite();
    if (user?.user_metadata?.inviteToken) updateUserMetadata({ inviteToken: null }).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!isInviteToken(token)) {
      setInfo({ valid: false, reason: 'not_found' });
      return;
    }
    rememberInvite(token);
    getInviteInfo(token).then(setInfo).catch(e => setError(e.message));
  }, [token]);

  // A link that can't be used isn't worth coming back to after signing in
  useEffect(() => { if (info && !info.valid) dropInvite(); }, [info, dropInvite]);

  const join = useCallback(async () => {
    setJoining(true);
    setError(null);
    try {
      await acceptInvite(token);
      dropInvite();
      await refreshAccess?.();
      navigate('/team', { replace: true });
    } catch (e) {
      setError(e.message);
      // Tried once on their behalf; the button stays for another go
      if (signedUpWithLink) updateUserMetadata({ inviteToken: null }).catch(() => {});
    } finally {
      setJoining(false);
    }
  }, [token, dropInvite, refreshAccess, navigate, signedUpWithLink]);

  const groupName = info?.group_name || 'a volunteer group';
  const asRole = (TEAM_ROLE_LABELS[info?.team_role] || 'Member').toLowerCase();
  const alreadyIn = access?.team && access.team.groupName === info?.group_name && access.team.teamRole !== 'owner';
  const ready = info?.valid && isAuthenticated && authInitialized && !loading;

  // They asked to join when they signed up with this link
  useEffect(() => {
    if (!ready || !signedUpWithLink || autoJoined.current) return;
    autoJoined.current = true;
    if (alreadyIn) dropInvite(); else join();
  }, [ready, signedUpWithLink, alreadyIn, join, dropInvite]);

  if (!info && !error) {
    return <Card><p className="text-td-sage text-center">Checking the invite link…</p></Card>;
  }

  if (info && !info.valid) {
    return (
      <Card>
        <h1 className={`${AUTH.title} mb-3`}>This link can’t be used</h1>
        <p role="alert" className="text-td-sage">{INVITE_PROBLEMS[info.reason] || INVITE_PROBLEMS.not_found}</p>
        <Link to="/" className={`inline-block mt-4 ${AUTH.link}`}>Go to TrashDrop</Link>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className={AUTH.title}>Join {groupName}</h1>
      <p className="text-td-sage mt-2" data-testid="invite-line">
        You’ve been invited as a {asRole}{info?.region ? ` of a volunteer group in ${info.region}` : ''}.
        Members verify and clean up illegal dumping reports with the group, and see the group’s performance.
      </p>

      {error && <p role="alert" className={`${AUTH.alertError} mt-4`}>{error}</p>}

      {(loading || !authInitialized) ? (
        <p className="mt-4 text-td-sage">Loading…</p>
      ) : !isAuthenticated ? (
        <div className="mt-6 space-y-4">
          <p className="text-sm text-td-sage">New to TrashDrop? Sign up with just your name, email and a password; you join the group when you first sign in. Already have an account? Sign in to join.</p>
          <div className="flex flex-wrap gap-3">
            <Link to={`/signup?invite=${token}`} className={AUTH.primary}>Create an account</Link>
            <Link to="/login" className={AUTH.secondary}>Sign in</Link>
          </div>
        </div>
      ) : alreadyIn ? (
        <div className="mt-5">
          <p className="text-sm">You’re already in {groupName}.</p>
          <Link to="/team" onClick={dropInvite} className={`inline-block mt-2 ${AUTH.link}`}>Open the team</Link>
        </div>
      ) : (
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={join} disabled={joining}
            className={AUTH.primary}>
            {joining ? 'Joining…' : `Join ${groupName}`}
          </button>
          <Link to="/" onClick={dropInvite} className={AUTH.secondary}>Not now</Link>
        </div>
      )}
    </Card>
  );
};

export default JoinTeam;
