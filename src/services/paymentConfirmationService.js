/**
 * MoMo/e-Cash payments for digital bins that the payment gateway hasn't
 * confirmed. Collectors can cash a bin out only once its payment is confirmed
 * by the gateway or an admin (TD53). An admin checks TrendiPay and records
 * the result; see supabase/migrations/20261117_admin_confirm_bin_payments.sql.
 */
import { supabase } from '../utils/supabase';

/** Payments still pending, or confirmed only by the collector */
export const listPaymentsToConfirm = async () => {
  const { data, error } = await supabase.rpc('admin_bin_payments_to_confirm');
  if (error) throw new Error(error.message || 'Payments could not be loaded');
  return Array.isArray(data) ? data : [];
};

/** 'confirm' (the client paid) or 'fail' (they didn't); a note is required */
export const decidePayment = async (id, decision, note) => {
  const clean = String(note || '').trim();
  if (!clean) throw new Error('Say what you checked in TrendiPay');
  const { data, error } = await supabase.rpc('admin_confirm_bin_payment', {
    p_id: String(id), p_decision: decision, p_note: clean,
  });
  if (error) throw new Error(error.message || 'Not saved');
  return data;
};
