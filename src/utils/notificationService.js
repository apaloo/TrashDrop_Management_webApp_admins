import { supabase } from './supabase';

/**
 * Fetches all notifications for the current user
 * @returns {Promise<Array>} Array of notification objects
 */
export const fetchNotifications = async () => {
  try {
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;
    
    if (!userId) {
      throw new Error('User not authenticated');
    }
    
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    
    // Transform to match the expected format used in the UI
    return data.map(notification => ({
      id: notification.id,
      type: notification.type || 'info', // alert, info, success
      category: notification.category || 'general',
      message: notification.message,
      time: formatNotificationTime(notification.created_at),
      read: notification.read || false
    }));
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return []; // Return empty array on error to avoid breaking the UI
  }
};

/**
 * Marks a notification as read
 * @param {string} notificationId - The ID of the notification to mark as read
 * @returns {Promise<boolean>} Success status
 */
export const markNotificationAsRead = async (notificationId) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);
      
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }
};

/**
 * Marks all notifications as read for the current user
 * @returns {Promise<boolean>} Success status
 */
export const markAllNotificationsAsRead = async () => {
  try {
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;
    
    if (!userId) {
      throw new Error('User not authenticated');
    }
    
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);
      
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return false;
  }
};

/**
 * Subscribes to real-time updates for notifications
 * @param {Function} callback - Callback function to handle updates
 * @returns {Object} Subscription object with unsubscribe method
 */
export const subscribeToNotifications = (callback) => {
  const { data: session } = supabase.auth.getSession();
  const userId = session?.session?.user?.id;
  
  if (!userId) {
    console.error('User not authenticated');
    return { unsubscribe: () => {} };
  }
  
  // Subscribe to changes in the notifications table for the current user
  const subscription = supabase
    .channel('notifications-channel')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        // Fetch all notifications again when there's an update
        fetchNotifications().then(notifications => {
          callback(notifications);
        });
      }
    )
    .subscribe();
    
  return subscription;
};

/**
 * Gets the count of unread notifications
 * @param {Array} notifications - Array of notifications
 * @returns {number} Count of unread notifications
 */
export const getUnreadNotificationsCount = (notifications) => {
  return notifications?.filter(notification => !notification.read).length || 0;
};

/**
 * Formats notification time to relative format (5 min ago, 2 hours ago, etc.)
 * @param {string} timestamp - ISO timestamp
 * @returns {string} Formatted relative time
 */
const formatNotificationTime = (timestamp) => {
  if (!timestamp) return 'Unknown time';
  
  const now = new Date();
  const notificationDate = new Date(timestamp);
  const diffMs = now - notificationDate;
  const diffMins = Math.round(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins === 1) return '1 min ago';
  if (diffMins < 60) return `${diffMins} mins ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  
  return notificationDate.toLocaleDateString();
};
