import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AssignCleanupModal from '../AssignCleanupModal';

const teams = [
  { id: 'c1', first_name: 'Kofi', last_name: 'Mensah', email: 'kofi@x.com', status: 'active', collector_type: 'collector' },
  { id: 'v1', first_name: 'Bus Stop', last_name: 'Boys', email: 'bsb@x.com', status: 'active', collector_type: 'volunteer' },
  { id: 'c2', first_name: 'Ama', last_name: 'Owusu', email: 'ama@x.com', status: 'active' }, // no collector_type column yet → collector
];

jest.mock('../../../utils/supabase', () => {
  const chain = { select: () => chain, eq: () => chain, order: () => Promise.resolve({ data: mockTeams(), error: null }) };
  return { supabase: { from: () => chain } };
});
const mockTeams = () => teams;

const report = { id: 'r1234567890', status: 'verified', size: 'large', severity: 'high', locationLabel: 'Madina' };

const open = (onAssign = jest.fn().mockResolvedValue(true), onClose = jest.fn()) => {
  render(<AssignCleanupModal report={report} onAssign={onAssign} onClose={onClose} />);
  return { onAssign, onClose };
};

describe('AssignCleanupModal', () => {
  it('lists paid collectors and volunteer groups separately', async () => {
    open();
    expect(await screen.findByText('Paid collectors')).toBeInTheDocument();
    expect(screen.getByText('Volunteer groups')).toBeInTheDocument();
    expect(screen.getByText('Volunteer group · unpaid')).toBeInTheDocument();
    expect(screen.getAllByText('Paid collector')).toHaveLength(2);
  });

  it('a volunteer group skips the fee and is assigned with no fee', async () => {
    const { onAssign, onClose } = open();
    fireEvent.click(await screen.findByText('Bus Stop Boys'));
    expect(screen.getByTestId('volunteer-confirm')).toHaveTextContent('Volunteer cleanups are unpaid');
    expect(screen.queryByLabelText('Cleanup fee (GHS)')).toBeNull();
    fireEvent.click(screen.getByTestId('assign-confirm'));
    await waitFor(() => expect(onAssign).toHaveBeenCalledWith({ teamId: 'v1', teamName: 'Bus Stop Boys', fee: null, volunteer: true }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('a collector with no fee gets the standard rate (stored as no fee)', async () => {
    const { onAssign } = open();
    fireEvent.click(await screen.findByText('Kofi Mensah'));
    expect(screen.getByTestId('fee-hint')).toHaveTextContent('standard rate: GHS 30.00');
    expect(screen.getByTestId('assign-confirm')).toHaveTextContent('Assign · GHS 30.00');
    fireEvent.click(screen.getByTestId('assign-confirm'));
    await waitFor(() => expect(onAssign).toHaveBeenCalledWith({ teamId: 'c1', teamName: 'Kofi Mensah', fee: null, volunteer: false }));
  });

  it('a collector with a fee is assigned with that fee; a negative fee is refused', async () => {
    const { onAssign } = open();
    fireEvent.click(await screen.findByText('Ama Owusu'));
    fireEvent.change(screen.getByLabelText('Cleanup fee (GHS)'), { target: { value: '-5' } });
    expect(screen.getByTestId('assign-confirm')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Cleanup fee (GHS)'), { target: { value: '45' } });
    expect(screen.getByTestId('assign-confirm')).toHaveTextContent('Assign · GHS 45.00');
    fireEvent.click(screen.getByTestId('assign-confirm'));
    await waitFor(() => expect(onAssign).toHaveBeenCalledWith({ teamId: 'c2', teamName: 'Ama Owusu', fee: 45, volunteer: false }));
  });

  it('stays open when the assignment failed', async () => {
    const { onClose } = open(jest.fn().mockResolvedValue(false));
    fireEvent.click(await screen.findByText('Kofi Mensah'));
    fireEvent.click(screen.getByTestId('assign-confirm'));
    await waitFor(() => expect(screen.getByTestId('assign-confirm')).not.toBeDisabled());
    expect(onClose).not.toHaveBeenCalled();
  });
});
