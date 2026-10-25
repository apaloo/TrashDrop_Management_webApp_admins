import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getInviteInfo, acceptInvite } from '../services/teamService';
import {
  isInviteToken, rememberInvite, forgetInvite, INVITE_PROBLEMS, TEAM_ROLE_LABELS,
} from '../utils/teamInvite';

const Card = ({ children }) => (
  <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-lg shadow-sm p-6 w-full max-w-md text-gray-800">
      <img src="/logo.svg" alt="TrashDrop" className="h-10 w-auto mb-4" />
      {children}
    </div>
  </div>
);

/**
 * Opening a volunteer group's invite link (/join/:token). Signed out: who the
 * group is, and sign up / sign in (the link is remembered for after).
 * Signed in: join with one click.
 */
const JoinTeam = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, authInitialized, loading, access, refreshAccess } = useAuth();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!isInviteToken(token)) {
      setInfo({ valid: false, reason: 'not_found' });
      return;
    }
    rememberInvite(token);
    getInviteInfo(token).then(setInfo).catch(e => setError(e.message));
  }, [token]);

  // A link that can't be used isn't worth coming back to after signing in
  useEffect(() => { if (info && !info.valid) forgetInvite(); }, [info]);

  const join = async () => {
    setJoining(true);
    setError(null);
    try {
      await acceptInvite(token);
      forgetInvite();
      await refreshAccess?.();
      navigate('/team', { replace: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setJoining(false);
    }
  };

  if (!info && !error) {
    return <Card><p className="text-gray-500">Checking the invite link…</p></Card>;
  }

  if (info && !info.valid) {
    return (
      <Card>
        <h1 className="text-xl font-semibold mb-2">This link can’t be used</h1>
        <p role="alert" className="text-gray-700">{INVITE_PROBLEMS[info.reason] || INVITE_PROBLEMS.not_found}</p>
        <Link to="/" className="inline-block mt-4 text-green-700 hover:underline">Go to TrashDrop</Link>
      </Card>
    );
  }

  const groupName = info?.group_name || 'a volunteer group';
  const asRole = (TEAM_ROLE_LABELS[info?.team_role] || 'Member').toLowerCase();
  const alreadyIn = access?.team && access.team.groupName === info?.group_name && access.team.teamRole !== 'owner';

  return (
    <Card>
      <h1 className="text-xl font-semibold">Join {groupName}</h1>
      <p className="text-gray-600 mt-1" data-testid="invite-line">
        You’ve been invited as a {asRole}{info?.region ? ` of a volunteer group in ${info.region}` : ''}.
        Members verify and clean up illegal dumping reports with the group, and see the group’s performance.
      </p>

      {error && <p role="alert" className="mt-4 rounded-md bg-red-50 text-red-800 px-3 py-2 text-sm">{error}</p>}

      {(loading || !authInitialized) ? (
        <p className="mt-4 text-gray-500">Loading…</p>
      ) : !isAuthenticated ? (
        <div className="mt-5 space-y-2">
          <p className="text-sm text-gray-600">Use your own account. New to TrashDrop? Create one with “Individual / Other” as the account type; you’ll come back here after.</p>
          <div className="flex gap-2">
            <Link to="/signup" className="px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 text-sm">Create an account</Link>
            <Link to="/login" className="px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-50 text-sm">Sign in</Link>
          </div>
        </div>
      ) : alreadyIn ? (
        <div className="mt-5">
          <p className="text-sm">You’re already in {groupName}.</p>
          <Link to="/team" onClick={forgetInvite} className="inline-block mt-2 text-green-700 hover:underline">Open the team</Link>
        </div>
      ) : (
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={join} disabled={joining}
            className="px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 text-sm disabled:opacity-50">
            {joining ? 'Joining…' : `Join ${groupName}`}
          </button>
          <Link to="/" onClick={forgetInvite} className="px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-50 text-sm">Not now</Link>
        </div>
      )}
    </Card>
  );
};

export default JoinTeam;
