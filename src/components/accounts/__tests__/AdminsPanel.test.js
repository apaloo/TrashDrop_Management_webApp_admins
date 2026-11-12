// The Admins panel on Account approvals: lists admins, adds one by email, and
// never offers to remove the signed-in admin themselves.
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import AdminsPanel from '../AdminsPanel';

let mockAdmins = [];
let mockAdded = [];
jest.mock('../../../services/staffAdminService', () => ({
  listAdmins: () => Promise.resolve(mockAdmins),
  addAdmin: (email, note) => { mockAdded.push([email, note]); return Promise.resolve({}); },
  removeAdmin: () => Promise.resolve({}),
}));

beforeEach(() => {
  mockAdmins = [
    { userId: 'me', email: 'me@example.com', addedAt: '2026-11-12T10:00:00Z', note: null },
    { userId: 'other', email: 'other@example.com', addedAt: '2026-11-12T11:00:00Z', note: 'ops' },
  ];
  mockAdded = [];
});

it('lists admins and lets you remove others but not yourself', async () => {
  render(<AdminsPanel currentUserId="me" />);
  expect(await screen.findByText('other@example.com')).toBeInTheDocument();
  const rows = screen.getAllByTestId('admin-row');
  expect(rows).toHaveLength(2);
  expect(rows[0]).toHaveTextContent('You');
  expect(within(rows[0]).queryByRole('button')).toBeNull();
  expect(within(rows[1]).getByRole('button', { name: 'Remove' })).toBeInTheDocument();
});

it('adds an admin by email and reloads the list', async () => {
  render(<AdminsPanel currentUserId="me" />);
  await screen.findByText('other@example.com');
  fireEvent.change(screen.getByLabelText(/Email of an existing account/), { target: { value: 'new@example.com' } });
  fireEvent.change(screen.getByLabelText(/Note/), { target: { value: 'weekend cover' } });
  fireEvent.click(screen.getByRole('button', { name: 'Make admin' }));
  await waitFor(() => expect(mockAdded).toEqual([['new@example.com', 'weekend cover']]));
  expect(await screen.findByText('new@example.com is now an admin')).toBeInTheDocument();
});
