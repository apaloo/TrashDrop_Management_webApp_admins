/**
 * Airtime and data rewards households redeemed in the household app, sent by
 * staff; see supabase/migrations/20261111_reward_redemptions.sql.
 */
import { supabase } from '../utils/supabase';

/** Redemptions with a given status (pending, sent, rejected), or all of them */
export const listRedemptions = async (status = 'pending') => {
  const { data, error } = await supabase.rpc('admin_reward_redemptions', { p_status: status });
  if (error) throw new Error(error.message || 'Redemptions could not be loaded');
  return Array.isArray(data) ? data : [];
};

/** Mark a pending redemption sent, or rejected (needs a reason; gives the points back) */
export const setRedemptionStatus = async (id, status, note = null) => {
  const { data, error } = await supabase.rpc('admin_set_redemption_status', {
    p_id: String(id), p_status: status, p_note: note || null,
  });
  if (error) throw new Error(error.message || 'Not saved');
  return data;
};
