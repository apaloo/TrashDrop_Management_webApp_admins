import { supabase } from './supabase';
import { formatDistanceToNow } from 'date-fns';

/**
 * Fetch messages for the current user
 * @returns {Promise<Array>} Array of message objects
 */
export const fetchMessages = async () => {
  try {
    // Get the current user session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No active session');
    
    const userId = session.user.id;
    
    // Fetch messages where the current user is either the sender or the recipient
    const { data: messages, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:sender_id(id, first_name, last_name, email, avatar_url, role),
        recipient:recipient_id(id, first_name, last_name, email, avatar_url, role)
      `)
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Transform the data to match the format used in the UI
    return messages.map(message => ({
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
    // Get the current user session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No active session');
    
    const userId = session.user.id;
    
    // Get users the current user has communicated with
    const { data: contacts, error } = await supabase.rpc('get_user_contacts', { 
      user_id: userId 
    });
    
    if (error) throw error;
    
    // Format the contacts data
    return contacts.map(contact => ({
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
    const { data, error } = await supabase
      .from('messages')
      .update({ read: true })
      .eq('id', messageId);
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error marking message as read:', error);
    throw error;
  }
};

/**
 * Mark all messages from a specific sender as read
 * @param {string} senderId ID of the sender whose messages should be marked as read
 * @returns {Promise} Result of the operation
 */
export const markAllMessagesFromSenderAsRead = async (senderId) => {
  try {
    // Get current user
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No active session');
    
    const userId = session.user.id;
    
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
    // Get current user
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return 0;
    
    const userId = session.user.id;
    
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', userId)
      .eq('read', false);
    
    if (error) throw error;
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
    const subscription = supabase
      .channel('messages_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'messages' 
        }, 
        async (payload) => {
          // When messages change, fetch all messages again
          try {
            const messages = await fetchMessages();
            callback(messages);
          } catch (err) {
            console.error('Error in message subscription callback:', err);
          }
        }
      )
      .subscribe();
    
    return {
      unsubscribe: () => {
        subscription.unsubscribe();
      }
    };
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
    // Get current user
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No active session');
    
    const senderId = session.user.id;
    
    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender_id: senderId,
        recipient_id: recipientId,
        content,
        read: false,
        created_at: new Date().toISOString()
      });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
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
