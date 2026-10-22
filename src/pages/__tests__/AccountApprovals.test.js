import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AccountApprovals from '../AccountApprovals';
import { listAccountRoles, reviewAccountRole, setAccountArea } from '../../services/accountRoleService';

jest.mock('../../services/accountRoleService', () => ({
  listAccountRoles: jest.fn(), reviewAccountRole: jest.fn(), setAccountArea: jest.fn(),
}));
jest.mock('../../utils/supabase', () => ({ supabase: {} }));
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'admin-1' } }) }));

const manager = (over) => ({
  user_id: 'm1', email: 'wm@x.com', name: 'Waste Co', company_type: 'waste_management', org_name: 'Waste Co',
  requested_role: 'manager', role: 'manager', status: 'approved', region: null, district: null, details: {}, ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  reviewAccountRole.mockResolvedValue({});
  setAccountArea.mockResolvedValue({});
});

it('a Waste Management Manager needs a region, which is saved with the role', async () => {
  listAccountRoles.mockResolvedValue([manager()]);
  render(<AccountApprovals />);
  fireEvent.click(await screen.findByText('Change role'));
  expect(screen.getByTestId('area-fields')).toHaveTextContent('assigns pickup requests in this region only');
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  fireEvent.change(screen.getByTestId('area-region'), { target: { value: 'Greater Accra' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(setAccountArea).toHaveBeenCalledWith('m1', { region: 'Greater Accra', district: null }));
  await waitFor(() => expect(reviewAccountRole).toHaveBeenCalledWith('m1', expect.objectContaining({ approve: true, role: 'manager' })));
});

it('a Recycling Manager is not asked for a region', async () => {
  listAccountRoles.mockResolvedValue([manager({ user_id: 'm2', email: 'rc@x.com', company_type: 'recycling' })]);
  render(<AccountApprovals />);
  fireEvent.click(await screen.findByText('Change role'));
  expect(screen.queryByTestId('area-fields')).toBeNull();
  expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();
});
