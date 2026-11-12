// The MoMo payments page: lists payments awaiting confirmation and records an
// admin's decision only with a note saying what was checked in TrendiPay.
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import PaymentConfirmations from '../PaymentConfirmations';

let mockRows = [];
let mockDecided = [];
jest.mock('../../services/paymentConfirmationService', () => ({
  listPaymentsToConfirm: () => Promise.resolve(mockRows),
  decidePayment: (id, decision, note) => { mockDecided.push([id, decision, note]); return Promise.resolve({}); },
}));

beforeEach(() => {
  mockRows = [
    { id: 'p1', digital_bin_id: 'bin-1234567890', bin_status: 'disposed', collector_name: 'Kofi Mensah', payment_mode: 'momo',
      total_bill: 25, client_momo: '024***56', gateway_reference: 'RRN-1', status: 'success', confirmed_by: 'collector', created_at: '2026-11-12T10:00:00Z' },
    { id: 'p2', digital_bin_id: 'bin-2', bin_status: 'disposed', collector_name: 'Ama Owusu', payment_mode: 'momo',
      total_bill: 40, client_momo: '055***12', gateway_reference: null, status: 'pending', confirmed_by: null, created_at: '2026-11-12T11:00:00Z' },
  ];
  mockDecided = [];
});

it('lists each payment with who it is from and its state', async () => {
  render(<PaymentConfirmations />);
  const rows = await screen.findAllByTestId('payment-row');
  expect(rows).toHaveLength(2);
  expect(rows[0]).toHaveTextContent('Kofi Mensah');
  expect(rows[0]).toHaveTextContent('GH₵25.00');
  expect(rows[0]).toHaveTextContent('024***56');
  expect(rows[0]).toHaveTextContent('RRN-1');
  expect(rows[0]).toHaveTextContent('Collector says paid');
  expect(rows[1]).toHaveTextContent('Waiting for the client');
});

it('confirms a payment only with a note, then reloads', async () => {
  render(<PaymentConfirmations />);
  const [first] = await screen.findAllByTestId('payment-row');
  fireEvent.click(within(first).getByRole('button', { name: 'Confirm paid' }));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByRole('button', { name: 'Confirm paid' })).toBeDisabled();
  fireEvent.change(within(dialog).getByLabelText(/What you checked in TrendiPay/), { target: { value: 'Successful in TrendiPay' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm paid' }));
  await waitFor(() => expect(mockDecided).toEqual([['p1', 'confirm', 'Successful in TrendiPay']]));
  expect(await screen.findByText('GH₵25.00 from 024***56: confirmed')).toBeInTheDocument();
});

it('says when there is nothing to confirm', async () => {
  mockRows = [];
  render(<PaymentConfirmations />);
  expect(await screen.findByText('Nothing to confirm.')).toBeInTheDocument();
});
