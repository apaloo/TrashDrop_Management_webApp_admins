# TrashDrop Admin Portal: Supabase Integration

This document outlines how the TrashDrop Admin Portal integrates with Supabase to provide real-time, dynamic data throughout the application.

## Table of Contents

1. [Overview](#overview)
2. [Service Modules](#service-modules)
3. [Data Flows](#data-flows)
4. [Subscription Model](#subscription-model)
5. [Component Integration](#component-integration)
6. [Error Handling](#error-handling)

## Overview

The TrashDrop Admin Portal connects to Supabase to retrieve and display real-time data across all components. We've implemented several service modules that encapsulate Supabase queries, subscriptions, and data transformations to provide clean APIs for React components to consume.

Key integration points include:
- **Dashboard**: All metrics, charts, and activity feeds
- **Navbar**: Notifications and messages
- **Live Map**: Collector status, pickup locations, and service areas

## Service Modules

### notificationService.js

Manages notification-related interactions with Supabase:

```javascript
// Key functions
fetchNotifications() // Gets all notifications
markNotificationAsRead(notificationId) // Marks a notification as read
markAllNotificationsAsRead() // Marks all notifications as read
getUnreadNotificationsCount(notifications) // Returns count of unread notifications
subscribeToNotifications(callback) // Sets up real-time subscription
```

### messageService.js

Manages message-related interactions with Supabase:

```javascript
// Key functions
fetchMessages(contactId) // Gets messages for a specific contact
fetchContacts() // Gets all message contacts with last message preview
sendMessage(contactId, message) // Sends a new message
markMessageAsRead(messageId) // Marks a message as read
markAllMessagesFromSenderAsRead(senderId) // Marks all messages from a sender as read
getUnreadMessageCount() // Returns count of all unread messages
subscribeToMessages(callback) // Sets up real-time subscription
```

### dashboardService.js

Manages dashboard data interactions with Supabase:

```javascript
// Key functions
fetchDashboardMetrics() // Gets primary metrics (requests, collectors, SLA)
fetchPickupStatusChartData() // Gets data for pickup status chart
fetchCollectorActivityChartData() // Gets data for collector activity chart
fetchWasteDistributionChartData() // Gets data for waste distribution chart
fetchBagUtilizationTrendData() // Gets data for bag utilization chart
fetchDashboardAlerts() // Gets recent alerts for activity feed
subscribeToDashboardUpdates(callback) // Sets up real-time subscription
```

### collectorService.js, serviceAreaService.js, etc.

Additional services that handle specific domain entities and provide clean APIs for components.

## Data Flows

1. **Component Mount**: When components mount, they call the relevant service functions to fetch initial data.
2. **Real-time Updates**: Components subscribe to real-time channels to receive updates when data changes.
3. **User Actions**: When users perform actions (e.g., marking a notification as read), components call service functions that update Supabase and trigger real-time updates.

## Subscription Model

We implement real-time subscriptions using Supabase Channels:

```javascript
// Example subscription pattern
const subscription = supabase
  .channel('channel_name')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'table_name' },
    handleDataChange
  )
  .subscribe();

// Clean up when component unmounts
return () => {
  subscription.unsubscribe();
};
```

Each service module provides a subscription function that encapsulates this pattern and provides a clean API for components.

## Component Integration

### Dashboard Component

The Dashboard component uses the dashboardService.js to fetch and display real-time metrics and charts:

```javascript
// Initial data fetch
useEffect(() => {
  const fetchData = async () => {
    const [
      metricsData,
      pickupData,
      collectorActivityData,
      wasteData,
      bagData,
      alerts
    ] = await Promise.all([
      fetchDashboardMetrics(),
      fetchPickupStatusChartData(),
      fetchCollectorActivityChartData(),
      fetchWasteDistributionChartData(),
      fetchBagUtilizationTrendData(),
      fetchDashboardAlerts()
    ]);
    
    // Update state with fetched data
    // ...
  };
  
  fetchData();
  
  // Subscribe to real-time updates
  const subscription = subscribeToDashboardUpdates((dashboardData) => {
    // Update state with new data
    // ...
  });
  
  return () => {
    subscription.unsubscribe();
  };
}, []);
```

### Navbar Component

The Navbar component uses both notificationService.js and messageService.js to display real-time notifications and messages:

```javascript
// Fetch notifications
useEffect(() => {
  const loadNotifications = async () => {
    const notificationsData = await fetchNotifications();
    // Update state
  };
  
  loadNotifications();
  
  // Subscribe to real-time updates
  const subscription = subscribeToNotifications((updatedNotifications) => {
    // Update state
  });
  
  return () => {
    subscription.unsubscribe();
  };
}, []);

// Similar pattern for messages
// ...
```

## Error Handling

Each service module implements error handling to ensure graceful degradation:

1. **Try/Catch Blocks**: All Supabase interactions are wrapped in try/catch blocks.
2. **Error State**: Components maintain error state to display user-friendly error messages.
3. **Fallback Values**: In case of errors, services return empty arrays or default objects to prevent null pointer exceptions.
4. **Retry Mechanisms**: UI components provide retry buttons for users to attempt data fetching again.

Example error handling pattern:

```javascript
try {
  const { data, error } = await supabase.from('table').select('*');
  if (error) throw error;
  return data;
} catch (error) {
  console.error('Error fetching data:', error);
  return []; // Return empty array as fallback
}
```

Components display appropriate loading and error states:

```jsx
{loading ? (
  <LoadingSpinner />
) : error ? (
  <ErrorMessage message={error} onRetry={fetchData} />
) : (
  <DataDisplay data={data} />
)}
```

---

This documentation outlines the core Supabase integration patterns used throughout the TrashDrop Admin Portal. For specific implementation details, refer to the individual service modules and components.
