import { supabase } from './supabase';
import { safeDatabaseService } from './safeDatabaseService';

/**
 * Standardized database query. Real data only: a missing table or a failed
 * query throws (safeDatabaseService.safeQuery); nothing is ever made up.
 */
export const dbQuery = async ({ tableName, queryFn, isRpc = false }) =>
  safeDatabaseService.safeQuery({ tableName, queryFn, isRpc });

// Pre-configured database queries for common tables

/**
 * Fetch messages with related user data
 */
export const fetchMessages = async ({ userId, limit = 50 } = {}) => {
  if (!userId) {
    console.error('User ID is required to fetch messages');
    return { data: [], error: { message: 'User ID is required' } };
  }
  return dbQuery({
    tableName: 'messages',
    queryFn: async () => supabase
      .from('messages')
      .select(`
        *,
        sender:sender_id(id, first_name, last_name, email, avatar_url, role),
        recipient:recipient_id(id, first_name, last_name, email, avatar_url, role)
      `)
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(limit),
  });
};

/**
 * Fetch notifications for a user
 */
export const fetchNotifications = async ({ userId, limit = 50 } = {}) => {
  if (!userId) {
    console.error('User ID is required to fetch notifications');
    return { data: [], error: { message: 'User ID is required' } };
  }

  return dbQuery({
    tableName: 'notifications',
    queryFn: async () => supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit),
  });
};

export const fetchIllegalDumpingReports = async (params = {}) => {
  return dbQuery({
    tableName: 'illegal_dumping_mobile',
    queryFn: async () => supabase
      .from('illegal_dumping_mobile')
      .select('*')
      .order('reported_at', { ascending: false })
      .limit(params.limit || 100),
  });
};

export const getUserContacts = async (userId) => {
  // Real contacts only: on failure the caller shows none and logs the error,
  // never made-up people whose ids lead nowhere.
  try {
    const data = await safeDatabaseService.safeRPC({
      functionName: 'get_user_contacts',
      params: { p_user_id: userId },
    });
    return { data: Array.isArray(data) ? data : [], error: null };
  } catch (error) {
    return { data: [], error };
  }
};
