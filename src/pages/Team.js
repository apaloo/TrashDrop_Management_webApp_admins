import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  listMembers, listInvites, createInvite, revokeInvite, setMemberRole, removeMember, leaveTeam,
} from '../services/teamService';
import { inviteUrl, whatsappUrl, TEAM_ROLE_LABELS } from '../utils/teamInvite';

const dateText = (v) => (v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

const copy = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    return false;
  }
};

const InvitePanel = ({ isOwner, groupName, onChanged, setNotice, setError }) => {
  const [invites, setInvites] = useState([]);
  const [teamRole, setTeamRole] = useState('member');
  const [days, setDays] = useState(7);
  const [maxUses, setMaxUses] = useState(25);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => listInvites().then(setInvites).catch(e => setError(e.message)), [setError]);
  useEffect(() => { load(); }, [load]);

  const make = async () => {
    setBusy(true);
    setError(null);
    try {
      const inv = await createInvite({ teamRole, days: Number(days), maxUses: Number(maxUses) });
      const url = inviteUrl(inv.token);
      const copied = await copy(url);
      setNotice(copied ? 'New invite link copied. Paste it to the people you want to invite.' : 'New invite link ready below.');
      await load();
      onChanged?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id) => {
    setError(null);
    try {
      await revokeInvite(id);
      setNotice('Invite link cancelled. Nobody can join with it now.');
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const open = invites.filter(i => i.open);
  return (
    <section className="bg-white rounded-lg shadow-sm p-5 mb-6" aria-labelledby="invite-title">
      <h2 id="invite-title" className="text-lg font-semibold text-gray-800">Invite members</h2>
      <p className="text-sm text-gray-600">Each member signs in with their own account. Share a link; anyone with it can join until it expires or is used up.</p>
      <div className="flex flex-wrap items-end gap-3 mt-3">
        {isOwner && (
          <div>
            <label htmlFor="invite-role" className="block text-xs text-gray-600">Joins as</label>
            <select id="invite-role" value={teamRole} onChange={e => setTeamRole(e.target.value)} className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white">
              <option value="member">Member</option>
              <option value="admin">Group admin (can invite and remove members)</option>
            </select>
          </div>
        )}
        <div>
          <label htmlFor="invite-days" className="block text-xs text-gray-600">Works for</label>
          <select id="invite-days" value={days} onChange={e => setDays(e.target.value)} className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white">
            {[1, 7, 14, 30].map(d => <option key={d} value={d}>{d === 1 ? '1 day' : `${d} days`}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="invite-uses" className="block text-xs text-gray-600">People who can use it</label>
          <select id="invite-uses" value={maxUses} onChange={e => setMaxUses(e.target.value)} className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white">
            {[1, 5, 10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <button type="button" onClick={make} disabled={busy}
          className="px-4 py-2 text-sm rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
          <i className="fas fa-link mr-1" aria-hidden="true"></i>{busy ? 'Making…' : 'Make invite link'}
        </button>
      </div>

      {open.length > 0 && (
        <ul className="mt-4 divide-y divide-gray-100" aria-label="Open invite links">
          {open.map(i => {
            const url = inviteUrl(i.token);
            return (
              <li key={i.id} className="py-2 flex flex-wrap items-center gap-2 text-sm" data-testid="invite-link">
                <span className="text-gray-700">{TEAM_ROLE_LABELS[i.team_role]} link · used {i.uses} of {i.max_uses} · until {dateText(i.expires_at)}</span>
                <span className="ml-auto flex gap-2">
                  <button type="button" onClick={async () => setNotice(await copy(url) ? 'Link copied.' : `Copy this link: ${url}`)}
                    className="px-2 py-1 border border-gray-300 rounded-md hover:bg-gray-50">Copy link</button>
                  <a href={whatsappUrl(groupName, url)} target="_blank" rel="noopener noreferrer"
                    className="px-2 py-1 border border-gray-300 rounded-md hover:bg-gray-50">Share on WhatsApp</a>
                  <button type="button" onClick={() => cancel(i.id)} className="px-2 py-1 text-red-700 hover:underline">Cancel link</button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

/**
 * A volunteer group's team: the group's own account and its group admins
 * invite and manage members; every member sees who is in the group.
 */
const Team = () => {
  const navigate = useNavigate();
  const { refreshAccess } = useAuth();
  const [team, setTeam] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(() => listMembers()
    .then(t => { setTeam(t); setStatus('ready'); })
    .catch(e => { setError(e.message); setStatus('error'); }), []);
  useEffect(() => { load(); }, [load]);

  const myRole = team?.my_role;
  const canManage = myRole === 'owner' || myRole === 'admin';

  const act = async (fn, success) => {
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(success);
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const remove = (m) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Remove ${m.name} from the group? They lose the group’s access straight away. What they did stays credited to the group.`)) return;
    act(() => removeMember(m.member_id), `${m.name} was removed.`);
  };

  const leave = async () => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Leave ${team?.group_name || 'the group'}? You lose the group’s access straight away.`)) return;
    try {
      await leaveTeam();
      await refreshAccess?.();
      navigate('/settings', { replace: true });
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="p-4">
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="text-3xl font-bold text-gray-800">Team</h1>
          <p className="text-gray-600">{team?.group_name || 'Your volunteer group'}{myRole ? ` · you are the ${TEAM_ROLE_LABELS[myRole].toLowerCase()}` : ''}</p>
        </div>
        {(myRole === 'member' || myRole === 'admin') && (
          <button type="button" onClick={leave} className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50">Leave group</button>
        )}
      </div>

      {error && <div role="alert" className="mb-4 rounded-md bg-red-50 text-red-800 px-4 py-3 text-sm">{error}</div>}
      {notice && <div role="status" className="mb-4 rounded-md bg-green-50 text-green-800 px-4 py-3 text-sm">{notice}</div>}

      {status === 'loading' && <p className="text-gray-500">Loading…</p>}

      {status === 'ready' && canManage && (
        <InvitePanel isOwner={myRole === 'owner'} groupName={team.group_name} setNotice={setNotice} setError={setError} />
      )}

      {status === 'ready' && (
        <section className="bg-white rounded-lg shadow-sm overflow-x-auto" aria-labelledby="members-title">
          <h2 id="members-title" className="text-lg font-semibold text-gray-800 px-5 pt-5">Members ({team.members.length})</h2>
          {team.members.length === 0 ? (
            <p className="px-5 py-4 text-sm text-gray-500" data-testid="no-members">No members yet. Make an invite link and share it with your group.</p>
          ) : (
            <table className="min-w-full text-sm mt-2">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th scope="col" className="text-left px-5 py-2 font-medium">Name</th>
                  {canManage && <th scope="col" className="text-left px-3 py-2 font-medium">Email</th>}
                  <th scope="col" className="text-left px-3 py-2 font-medium">Role</th>
                  <th scope="col" className="text-left px-3 py-2 font-medium">Joined</th>
                  {canManage && <th scope="col" className="px-3 py-2"><span className="sr-only">Actions</span></th>}
                </tr>
              </thead>
              <tbody>
                {team.members.map(m => {
                  // Owner manages everyone; group admins manage members only
                  const mayManage = canManage && !m.is_me && (myRole === 'owner' || m.team_role === 'member');
                  return (
                    <tr key={m.member_id} className="border-t border-gray-100" data-testid="member-row">
                      <td className="px-5 py-2 font-medium text-gray-800">{m.name}{m.is_me ? ' (you)' : ''}</td>
                      {canManage && <td className="px-3 py-2 text-gray-600">{m.email || '—'}</td>}
                      <td className="px-3 py-2">{TEAM_ROLE_LABELS[m.team_role]}</td>
                      <td className="px-3 py-2 text-gray-600">{dateText(m.joined_at)}</td>
                      {canManage && (
                        <td className="px-3 py-2 whitespace-nowrap text-right">
                          {myRole === 'owner' && !m.is_me && (
                            <button type="button" className="text-green-700 hover:underline mr-3"
                              onClick={() => act(() => setMemberRole(m.member_id, m.team_role === 'admin' ? 'member' : 'admin'),
                                m.team_role === 'admin' ? `${m.name} is now a member.` : `${m.name} is now a group admin.`)}>
                              {m.team_role === 'admin' ? 'Make member' : 'Make group admin'}<span className="sr-only"> {m.name}</span>
                            </button>
                          )}
                          {mayManage && (
                            <button type="button" className="text-red-700 hover:underline" onClick={() => remove(m)}>
                              Remove<span className="sr-only"> {m.name}</span>
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
};

export default Team;
