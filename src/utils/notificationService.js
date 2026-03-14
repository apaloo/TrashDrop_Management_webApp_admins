import { supabase } from './supabase';
import { safeDatabaseService } from './safeDatabaseService';
import { fetchNotifications as dbFetchNotifications } from './dbUtils';
import { realtimeManager } from '../services/realtimeManager';
import { getCurrentSession } from './auth';

/**
 * Fetches all notifications for the current user
 * @returns {Promise<Array>} Array of notification objects
 */
export const fetchNotifications = async () => {
  const { user } = await getCurrentSession();
  const userId = user?.id;
  
  if (!userId) {
    // Silently return empty array for unauthenticated users instead of throwing error
    // This prevents console spam on public pages
    return [];
  }
  
  const { data: notifications, error } = await dbFetchNotifications({ 
    userId,
    limit: 50 
  });
  
  if (error) {
    throw error;
  }
  
  const data = notifications || [];
  
  // Transform to match the expected format used in the UI  
  return (data || []).map(notification => ({
    id: notification.id,
    type: notification.type || 'info', // alert, info, success
    category: notification.category || 'general',
    message: notification.message,
    time: formatNotificationTime(notification.created_at),
    read: notification.read || false
  }));
};

/**
 * Marks a notification as read
 * @param {string} notificationId - The ID of the notification to mark as read
 * @returns {Promise<boolean>} Success status
 */
export const markNotificationAsRead = async (notificationId) => {
  try {
    const { user } = await getCurrentSession();
    const userId = user?.id;
    
    if (!userId) {
      console.warn('User not authenticated');
      return false;
    }

    const { error } = await safeDatabaseService.safeQuery({
      table: 'notifications',
      query: (client) => client
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)
        .eq('user_id', userId)
    });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    // Even if marking as read fails, we still return true to prevent UI issues
    // The next refresh will sync the actual read status
    return true;
  }
};

/**
 * Marks all notifications as read for the current user
 * @returns {Promise<boolean>} Success status
 */
export const markAllNotificationsAsRead = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    
    if (!userId) {
      console.warn('User not authenticated');
      return false;
    }

    const { error } = await safeDatabaseService.safeQuery({
      table: 'notifications',
      query: (client) => client
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false)
    });

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
 * @param {Object} options - Additional options
 * @param {string} [options.userId] - Optional user ID to filter notifications for a specific user
 * @returns {Object} Subscription object with unsubscribe method
 */
export const subscribeToNotifications = (callback, { userId } = {}) => {
  // Use the realtimeManager to handle the subscription
  const channelName = userId ? `notifications:user:${userId}` : 'notifications:all';
  
  // Set up a polling fallback in case realtime fails
  const pollingInterval = setInterval(async () => {
    try {
      const { data: notifications } = await fetchNotifications();
      callback({
        eventType: 'SYNC',
        new: notifications,
        old: null
      });
    } catch (error) {
      console.error('Error in notification polling:', error);
    }
  }, 30000); // Poll every 30 seconds as fallback
  
  // Set up the realtime subscription
  const subscription = realtimeManager?.subscribeToTable?.({
    table: 'notifications',
    event: '*',
    filter: userId ? `user_id=eq.${userId}` : undefined,
    callback: (payload) => {
      try {
        // Transform the payload to match our notification format
        const notification = {
          id: payload.new?.id || payload.old?.id,
          type: payload.new?.type || 'info',
          category: payload.new?.category || 'system',
          message: payload.new?.message || '',
          created_at: payload.new?.created_at || new Date().toISOString(),
          read: payload.new?.read || false
        };
        
        // Call the callback with the transformed notification and the original event type
        callback({
          eventType: payload.eventType,
          new: payload.new ? notification : undefined,
          old: payload.old ? {
            ...notification,
            ...payload.old
          } : undefined
        });
      } catch (error) {
        console.error('Error processing realtime notification:', error);
      }
    }
  });
  
  return {
    unsubscribe: () => {
      // Clear the polling interval
      clearInterval(pollingInterval);
      
      // Unsubscribe from the realtime channel if it exists
      if (realtimeManager?.unsubscribe) {
        realtimeManager.unsubscribe(channelName);
      }
      
      // Also clean up the subscription if it was created
      if (typeof subscription?.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    }
  };
};

/**
 * Gets the count of unread notifications
 * @param {Array} notifications - Array of notifications
 * @returns {number} Count of unread notifications
 */
export const getUnreadNotificationsCount = (notifications) => {
  if (!Array.isArray(notifications)) return 0;
  return notifications.filter(notification => notification && !notification.read).length;
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
