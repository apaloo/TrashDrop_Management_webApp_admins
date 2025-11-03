import { supabase } from './supabase';
import { safeDatabaseService } from './safeDatabaseService';
import { 
  generateMockBagBatches,
  generateMockCollectors,
  generateMockCollectionsData,
  generateMockWasteDistribution,
  generateMockCollectorPerformance,
  generateMockPickupRequests,
  generateMockBagStats,
  generateMockCollectorStats,
  generateMockPerformanceStats,
  generateMockBagUtilizationData,
  generateMockPickupStatusData,
  generateMockCollectorActivityData,
  generateMockServiceAreas,
  generateMockIllegalDumpingReports
} from './databaseUtils';

/**
 * Standardized database query function with automatic fallback to mock data
 */
export const dbQuery = async ({
  tableName,
  queryFn,
  mockDataFn,
  mockParams = {},
  isRpc = false,
  enableMock = true,
  throwOnMissing = undefined,
  forceRealData = undefined
}) => {
  return safeDatabaseService.safeQuery({
    tableName,
    queryFn,
    mockDataFn,
    mockDataParams: mockParams,
    isRpc,
    enableMock,
    throwOnMissing,
    forceRealData
  });
};

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
    mockDataFn: () => [], // Return empty array if messages table doesn't exist
    mockParams: { userId, limit },
    enableMock: true
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
    mockDataFn: () => generateMockNotifications(limit),
    mockParams: { limit },
    enableMock: true
  });
};

/**
 * Generate mock notifications for development
 */
const generateMockNotifications = (count = 5) => {
  const types = ['info', 'alert', 'success', 'warning'];
  const categories = ['system', 'pickup', 'billing', 'maintenance', 'update'];
  const messages = [
    'Your pickup request has been confirmed',
    'New update available for review',
    'Scheduled maintenance this weekend',
    'New message from support team',
    'Payment received successfully',
    'Reminder: Your subscription is expiring soon',
    'New feature: Mobile app notifications',
    'Your report has been processed',
    'Action required: Please verify your email',
    'Welcome to TrashDrop Admin Portal!'
  ];

  return Array.from({ length: count }, (_, i) => ({
    id: `mock-notif-${i + 1}`,
    type: types[Math.floor(Math.random() * types.length)],
    category: categories[Math.floor(Math.random() * categories.length)],
    message: messages[Math.floor(Math.random() * messages.length)],
    created_at: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)).toISOString(),
    read: Math.random() > 0.5
  }));
};

export const fetchBagInventories = async (params = {}) => {
  return dbQuery({
    tableName: 'bag_inventories',
    queryFn: async () => supabase
      .from('bag_inventories')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(params.limit || 100),
    mockDataFn: () => [], // No mock data by default
    enableMock: false // Don't use mock data for bag inventories
  });
};

export const fetchPickups = async (params = {}) => {
  return dbQuery({
    tableName: 'pickups',
    queryFn: async () => supabase
      .from('pickups')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(params.limit || 100),
    mockDataFn: () => [], // No mock data by default
    enableMock: false // Don't use mock data for pickups
  });
};

export const fetchIllegalDumpingReports = async (params = {}) => {
  return dbQuery({
    tableName: 'illegal_dumping_reports',
    queryFn: async () => supabase
      .from('illegal_dumping_reports')
      .select('*')
      .order('reported_at', { ascending: false })
      .limit(params.limit || 100),
    mockDataFn: () => generateMockIllegalDumpingReports(params)
  });
};

export const getUserContacts = async (userId) => {
  try {
    // Define mock contacts for fallback behavior
    const mockContacts = [
      {
        id: '1',
        first_name: 'John',
        last_name: 'Admin',
        avatar_url: null,
        role: 'admin',
        email: 'admin@trashdrop.com',
        status: 'online'
      },
      {
        id: '2', 
        first_name: 'Sarah',
        last_name: 'Manager',
        avatar_url: null,
        role: 'manager',
        email: 'manager@trashdrop.com',
        status: 'away'
      }
    ];

    // Use safeRPC for calling the function with graceful fallback
    const data = await safeDatabaseService.safeRPC({
      functionName: 'get_user_contacts',
      params: { user_id: userId },
      throwOnMissing: false,
      mockFallback: mockContacts
    });

    return { data: data ?? mockContacts, error: null };
  } catch (error) {
    console.error('Error in getUserContacts:', error);
    // Return mock data as ultimate fallback
    return { 
      data: [
        {
          id: '1',
          first_name: 'System',
          last_name: 'Admin',
          avatar_url: null,
          role: 'admin',
          email: 'admin@trashdrop.com',
          status: 'online'
        }
      ], 
      error: null 
    };
  }
};
