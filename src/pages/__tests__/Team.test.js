import React from 'react';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Team from '../Team';
import * as svc from '../../services/teamService';
import { useAuth } from '../../context/AuthContext';

jest.mock('../../utils/supabase', () => ({ supabase: {} }));
jest.mock('../../services/teamService', () => ({
  listMembers: jest.fn(), listInvites: jest.fn(), createInvite: jest.fn(), revokeInvite: jest.fn(),
  setMemberRole: jest.fn(), removeMember: jest.fn(), leaveTeam: jest.fn(),
}));
jest.mock('../../context/AuthContext', () => ({ useAuth: jest.fn() }));

const token = 'ab'.repeat(32);
const members = (myRole, withEmail) => ({
  group_id: 'g', group_name: 'Clean Accra', my_role: myRole,
  members: [
    { member_id: 'm2', name: 'Esi Mensah', team_role: 'admin', joined_at: '2026-10-20T10:00:00Z', is_me: myRole === 'admin', email: withEmail ? 'esi@example.com' : null },
    { member_id: 'm1', name: 'Kofi Asante', team_role: 'member', joined_at: '2026-10-21T10:00:00Z', is_me: myRole === 'member', email: withEmail ? 'kofi@example.com' : null },
  ],
});
const refreshAccess = jest.fn(() => Promise.resolve());

const renderAs = (myRole) => {
  svc.listMembers.mockResolvedValue(members(myRole, myRole !== 'member'));
  return render(
    <MemoryRouter initialEntries={['/team']}>
      <Routes>
        <Route path="/team" element={<Team />} />
        <Route path="/settings" element={<p>Settings page</p>} />
      </Routes>
    </MemoryRouter>
  );
};
const row = (name) => screen.getAllByTestId('member-row').find(r => within(r).getAllByRole('cell')[0].textContent.startsWith(name));

beforeEach(() => {
  jest.clearAllMocks();
  useAuth.mockReturnValue({ refreshAccess });
  svc.listInvites.mockResolvedValue([
    { id: 'i1', token, team_role: 'member', uses: 2, max_uses: 25, expires_at: '2026-11-01T00:00:00Z', open: true },
    { id: 'i0', token: 'cd'.repeat(32), team_role: 'member', uses: 25, max_uses: 25, expires_at: '2026-11-01T00:00:00Z', open: false },
  ]);
  svc.createInvite.mockResolvedValue({ id: 'i2', token, team_role: 'member' });
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: jest.fn(() => Promise.resolve()) } });
});

it('the group account invites (members or group admins), copies the link and shares on WhatsApp', async () => {
  renderAs('owner');
  await screen.findByTestId('invite-link');
  expect(screen.getByRole('option', { name: /Group admin/ })).toBeInTheDocument();
  expect(screen.getAllByTestId('invite-link')).toHaveLength(1); // used-up links are not offered
  const link = screen.getByTestId('invite-link');
  expect(link).toHaveTextContent('Member link · used 2 of 25');
  expect(within(link).getByRole('link', { name: 'Share on WhatsApp' }).getAttribute('href'))
    .toContain(encodeURIComponent(`/join/${token}`));

  fireEvent.change(screen.getByLabelText('Joins as'), { target: { value: 'admin' } });
  fireEvent.change(screen.getByLabelText('Works for'), { target: { value: '14' } });
  fireEvent.click(screen.getByRole('button', { name: /Make invite link/ }));
  await waitFor(() => expect(svc.createInvite).toHaveBeenCalledWith({ teamRole: 'admin', days: 14, maxUses: 25 }));
  await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`http://localhost/join/${token}`));
  expect(await screen.findByRole('status')).toHaveTextContent('New invite link copied');
});

it('the group account changes roles and removes anyone, after confirming', async () => {
  renderAs('owner');
  await screen.findAllByTestId('member-row');
  expect(within(row('Esi')).getByText('esi@example.com')).toBeInTheDocument();
  fireEvent.click(within(row('Kofi')).getByRole('button', { name: /Make group admin/ }));
  await waitFor(() => expect(svc.setMemberRole).toHaveBeenCalledWith('m1', 'admin'));

  const confirm = jest.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
  fireEvent.click(within(row('Esi')).getByRole('button', { name: /Remove/ }));
  expect(svc.removeMember).not.toHaveBeenCalled();
  fireEvent.click(within(row('Esi')).getByRole('button', { name: /Remove/ }));
  await waitFor(() => expect(svc.removeMember).toHaveBeenCalledWith('m2'));
  expect(confirm.mock.calls[0][0]).toMatch(/stays credited to the group/);
});

it('a group admin invites members only and removes members, not admins or themself', async () => {
  renderAs('admin');
  await screen.findAllByTestId('member-row');
  expect(screen.queryByLabelText('Joins as')).not.toBeInTheDocument();
  expect(within(row('Kofi')).getByRole('button', { name: /Remove/ })).toBeInTheDocument();
  expect(within(row('Esi')).queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Make group admin/ })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Leave group' })).toBeInTheDocument();
});

it('a member sees who is in the group (no emails, no invites) and can leave', async () => {
  renderAs('member');
  await screen.findAllByTestId('member-row');
  expect(screen.queryByRole('heading', { name: 'Invite members' })).not.toBeInTheDocument();
  expect(svc.listInvites).not.toHaveBeenCalled();
  expect(screen.queryByText('esi@example.com')).not.toBeInTheDocument();
  expect(screen.queryByRole('columnheader', { name: 'Email' })).not.toBeInTheDocument();
  expect(screen.getByText('Kofi Asante (you)')).toBeInTheDocument();

  jest.spyOn(window, 'confirm').mockReturnValue(true);
  svc.leaveTeam.mockResolvedValue({ left: true });
  fireEvent.click(screen.getByRole('button', { name: 'Leave group' }));
  expect(await screen.findByText('Settings page')).toBeInTheDocument();
  expect(refreshAccess).toHaveBeenCalled();
});

it('shows the database’s refusal', async () => {
  svc.createInvite.mockRejectedValue(new Error('This group already has 20 open invite links; cancel some first'));
  renderAs('owner');
  await screen.findAllByTestId('member-row');
  fireEvent.click(screen.getByRole('button', { name: /Make invite link/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent('20 open invite links');
});
