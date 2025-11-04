import { supabase } from './supabase';
import { formatDistanceToNow } from 'date-fns';
import { safeDatabaseService } from './safeDatabaseService';
import { getUserContacts, fetchMessages as dbFetchMessages } from './dbUtils';
import { getCurrentSession } from './auth';

/**
 * Fetch messages for the current user
 * @returns {Promise<Array>} Array of message objects
 */
export const fetchMessages = async () => {
  try {
    // Get the current user session (works in both dev and production modes)
    const { user } = await getCurrentSession();
    if (!user) {
      throw new Error('No active session - user must be authenticated');
    }
    
    const userId = user.id;
    
    // Use dbUtils to fetch messages with proper error handling
    const { data: messages, error } = await dbFetchMessages({ 
      userId,
      limit: 50 
    });
    
    if (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
    
    // Transform the data to match the format used in the UI
    return (messages || []).map(message => ({
      id: message.id,
      text: message.content,
      timestamp: message.created_at,
      formattedTime: formatMessageTime(message.created_at),
      read: message.read,
      senderId: message.sender_id,
      receiverId: message.recipient_id,
      sender: {
        id: message.sender?.id,
        name: `${message.sender?.first_name} ${message.sender?.last_name}`,
        avatar: message.sender?.avatar_url,
        role: message.sender?.role,
        online: false // We'll need to implement this separately with presence
      },
      recipient: {
        id: message.recipient?.id,
        name: `${message.recipient?.first_name} ${message.recipient?.last_name}`,
        avatar: message.recipient?.avatar_url,
        role: message.recipient?.role,
        online: false
      }
    }));
  } catch (error) {
    console.error('Error fetching messages:', error);
    throw error;
  }
};

/**
 * Get contacts with latest message and online status
 * @returns {Promise<Array>} Array of contact objects with message data
 */
export const fetchContacts = async () => {
  try {
    // Get the current user session (works in both dev and production modes)
    const { user } = await getCurrentSession();
    if (!user) {
      throw new Error('No active session - user must be authenticated');
    }
    
    const userId = user.id;
    
    // Use dbUtils for contacts with proper error handling
    const { data: contacts, error } = await getUserContacts(userId);
    
    if (error) {
      console.error('Error fetching contacts:', error);
      return [];
    }
    
    // Format the contacts data
    return (contacts || []).map(contact => ({
      id: contact.id,
      name: `${contact.first_name} ${contact.last_name}`,
      avatar: contact.avatar_url,
      role: contact.role,
      lastSeen: formatLastSeen(contact.last_seen),
      online: isOnline(contact.last_seen),
      unreadCount: contact.unread_count || 0
    }));
  } catch (error) {
    console.error('Error fetching contacts:', error);
    // Return empty array instead of throwing to avoid breaking the UI
    return [];
  }
};

/**
 * Mark a message as read
 * @param {string} messageId ID of the message to mark as read
 * @returns {Promise} Result of the operation
 */
export const markMessageAsRead = async (messageId) => {
  try {
    const tableExists = await safeDatabaseService.checkTableExists('messages');
    
    if (!tableExists) {
      console.warn('Messages table does not exist, simulating read status');
      return true;
    }
    
    const { data, error } = await supabase
      .from('messages')
      .update({ read: true })
      .eq('id', messageId);
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error marking message as read:', error);
    return false;
  }
};

/**
 * Mark all messages from a specific sender as read
 * @param {string} senderId ID of the sender whose messages should be marked as read
 * @returns {Promise} Result of the operation
 */
export const markAllMessagesFromSenderAsRead = async (senderId) => {
  try {
    // Get current user (works in both dev and production modes)
    const { user } = await getCurrentSession();
    if (!user) throw new Error('No active session');
    
    const userId = user.id;
    
    const { data, error } = await supabase
      .from('messages')
      .update({ read: true })
      .eq('sender_id', senderId)
      .eq('recipient_id', userId)
      .eq('read', false);
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error marking messages as read:', error);
    throw error;
  }
};

/**
 * Get the total count of unread messages for the current user
 * @returns {Promise<number>} Count of unread messages
 */
export const getUnreadMessageCount = async () => {
  try {
    // Get current user (works in both dev and production modes)
    const { user } = await getCurrentSession();
    if (!user) return 0;
    
    const userId = user.id;
    
    // Check if table exists first
    const tableExists = await safeDatabaseService.checkTableExists('messages');
    
    if (!tableExists) {
      console.warn('Messages table does not exist, returning 0 unread count');
      return 0;
    }
    
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', userId)
      .eq('read', false);
    
    if (error) {
      // Check if it's a table missing error
      if (error.code === 'PGRST116' || error.code === 'PGRST204' || error.code === '42P01') {
        console.warn('Messages table query failed, returning 0 unread count');
        return 0;
      }
      throw error;
    }
    
    return count || 0;
  } catch (error) {
    console.error('Error getting unread message count:', error);
    return 0;
  }
};

/**
 * Subscribe to new messages in real-time
 * @param {Function} callback Function to call when new messages arrive
 * @returns {Object} Subscription that can be unsubscribed
 */
export const subscribeToMessages = (callback) => {
  try {
    // Use safe subscription with polling fallback
    return safeDatabaseService.safeSubscription('messages', {
      callback: async (payload) => {
        try {
          const messages = await fetchMessages();
          callback(messages);
        } catch (err) {
          console.error('Error in message subscription callback:', err);
        }
      }
    }, async () => {
      // Polling fallback when table doesn't exist
      try {
        const messages = await fetchMessages();
        callback(messages);
      } catch (err) {
        console.error('Error in message polling:', err);
      }
    });
  } catch (error) {
    console.error('Error setting up message subscription:', error);
    return {
      unsubscribe: () => {}
    };
  }
};

/**
 * Send a message to another user
 * @param {string} recipientId ID of the recipient
 * @param {string} content Message content
 * @returns {Promise} Result of the operation
 */
export const sendMessage = async (recipientId, content) => {
  try {
    // Get current user (works in both dev and production modes)
    const { user } = await getCurrentSession();
    if (!user) {
      console.warn('No active session for sending message');
      return null;
    }
    
    const senderId = user.id;
    
    // Check if table exists first
    const tableExists = await safeDatabaseService.checkTableExists('messages');
    
    if (!tableExists) {
      console.warn('Messages table does not exist, cannot send message');
      return null;
    }
    
    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender_id: senderId,
        recipient_id: recipientId,
        content,
        read: false,
        created_at: new Date().toISOString()
      });
    
    if (error) {
      // Check if it's a table missing error
      if (error.code === 'PGRST116' || error.code === 'PGRST204' || error.code === '42P01') {
        console.warn('Messages table insert failed, table may not exist');
        return null;
      }
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Error sending message:', error);
    return null;
  }
};

// Helper Functions

/**
 * Format a date string to a relative time (e.g., "5 mins ago")
 * @param {string} dateString ISO date string
 * @returns {string} Formatted relative time
 */
function formatMessageTime(dateString) {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return formatDistanceToNow(date, { addSuffix: true });
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString;
  }
}

/**
 * Format last seen time
 * @param {string} dateString ISO date string
 * @returns {string} Formatted last seen time
 */
function formatLastSeen(dateString) {
  if (!dateString) return 'Never';
  
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 0.17) { // 10 minutes
      return 'Just now';
    } else if (diffInHours < 1) {
      return `${Math.round(diffInHours * 60)} min ago`;
    } else if (diffInHours < 24) {
      return `${Math.round(diffInHours)} hours ago`;
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return formatDistanceToNow(date, { addSuffix: true });
    }
  } catch (error) {
    console.error('Error formatting last seen date:', error);
    return dateString;
  }
}

/**
 * Check if a user is considered online
 * @param {string} lastSeenDate ISO date string of last activity
 * @returns {boolean} Whether user is considered online
 */
function isOnline(lastSeenDate) {
  if (!lastSeenDate) return false;
  
  try {
    const date = new Date(lastSeenDate);
    const now = new Date();
    // Consider online if activity in last 10 minutes
    return (now - date) < (1000 * 60 * 10);
  } catch (error) {
    return false;
  }
}
