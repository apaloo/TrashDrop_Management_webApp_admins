/**
 * Admins (TD10). The database keeps who is an admin in staff_admins, readable
 * by admins only; it changes only through admin_add_staff and
 * admin_remove_staff, which check the caller is an admin, record every change
 * in Logs and refuse to remove the last admin
 * (household repository migration 20261112133434_td10_staff_admins.sql).
 */
import { supabase } from '../utils/supabase';

/** Admins, oldest first, with their email ({ userId, email, addedAt, note }) */
export const listAdmins = async () => {
  const { data, error } = await supabase
    .from('staff_admins')
    .select('user_id, added_at, note')
    .order('added_at', { ascending: true });
  if (error) throw new Error(error.message || 'Admins could not be loaded');
  const rows = data || [];
  let emails = {};
  if (rows.length) {
    const { data: found, error: emailError } = await supabase.rpc('get_user_emails', { user_ids: rows.map(r => r.user_id) });
    if (!emailError) emails = Object.fromEntries((found || []).map(e => [e.id, e.email]));
  }
  return rows.map(r => ({ userId: r.user_id, email: emails[r.user_id] || null, addedAt: r.added_at, note: r.note || null }));
};

/** Make the account with this email an admin */
export const addAdmin = async (email, note = '') => {
  const clean = String(email || '').trim();
  if (!clean) throw new Error('Enter the email of an existing account');
  const { data, error } = await supabase.rpc('admin_add_staff', { p_email: clean, p_note: note.trim() || null });
  if (error) throw new Error(error.message || 'Admin not added');
  return data;
};

/** Stop an account being an admin (the database refuses to remove the last one) */
export const removeAdmin = async (userId, note = '') => {
  const { data, error } = await supabase.rpc('admin_remove_staff', { p_user_id: userId, p_note: note.trim() || null });
  if (error) throw new Error(error.message || 'Admin not removed');
  return data;
};
