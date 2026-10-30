import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RewardRedemptions from '../RewardRedemptions';
import { listRedemptions, setRedemptionStatus } from '../../services/rewardRedemptionService';

jest.mock('../../services/rewardRedemptionService', () => ({ listRedemptions: jest.fn(), setRedemptionStatus: jest.fn() }));
jest.mock('../../utils/supabase', () => ({ supabase: {} }));

const row = (over) => ({
  id: 'r1', created_at: '2026-10-30T09:00:00Z', status: 'pending', points_spent: 2000,
  phone_number: '0244123456', network: 'MTN', reward_name: 'Airtime GH₵10', reward_category: 'airtime',
  household_name: 'Abena Darko', household_email: 'abena@x.com', ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  setRedemptionStatus.mockResolvedValue({});
});

it('lists what to send: household, reward, number and network', async () => {
  listRedemptions.mockResolvedValue([row()]);
  render(<RewardRedemptions />);
  expect(await screen.findByText('Abena Darko')).toBeInTheDocument();
  expect(listRedemptions).toHaveBeenCalledWith('pending');
  const r = screen.getByTestId('redemption-row');
  expect(r).toHaveTextContent('Airtime GH₵10');
  expect(r).toHaveTextContent('2,000 points · GH₵10');
  expect(r).toHaveTextContent('024 412 3456');
  expect(r).toHaveTextContent('MTN');
});

it('marks one sent', async () => {
  listRedemptions.mockResolvedValue([row()]);
  render(<RewardRedemptions />);
  fireEvent.click(await screen.findByRole('button', { name: 'Mark sent' }));
  fireEvent.click(screen.getAllByRole('button', { name: 'Mark sent' }).pop());
  await waitFor(() => expect(setRedemptionStatus).toHaveBeenCalledWith('r1', 'sent', ''));
});

it('a rejection needs a reason', async () => {
  listRedemptions.mockResolvedValue([row()]);
  render(<RewardRedemptions />);
  fireEvent.click(await screen.findByRole('button', { name: 'Reject' }));
  const confirm = screen.getAllByRole('button', { name: 'Reject' }).pop();
  expect(confirm).toBeDisabled();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Number not on MTN' } });
  fireEvent.click(confirm);
  await waitFor(() => expect(setRedemptionStatus).toHaveBeenCalledWith('r1', 'rejected', 'Number not on MTN'));
});

it('an older reward without a number cannot be marked sent', async () => {
  listRedemptions.mockResolvedValue([row({ phone_number: null, network: null, reward_name: 'Recycled Tote Bag' })]);
  render(<RewardRedemptions />);
  expect(await screen.findByText('No number (older reward)')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Mark sent' })).toBeDisabled();
});
