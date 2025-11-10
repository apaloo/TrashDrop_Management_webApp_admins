// Mock data for messages and notifications
export const contacts = [
  {
    id: 1,
    name: 'John',
    avatar: '/avatars/john.jpg',
    role: 'Collector',
    lastSeen: '5 min ago',
    online: true,
    unreadCount: 3
  },
  {
    id: 2,
    name: 'Sarah',
    avatar: '/avatars/sarah.jpg',
    role: 'Admin',
    lastSeen: '1 hour ago',
    online: false,
    unreadCount: 0
  },
  {
    id: 3,
    name: 'Mike',
    avatar: '/avatars/mike.jpg',
    role: 'Driver',
    lastSeen: 'Yesterday',
    online: false,
    unreadCount: 2
  },
  {
    id: 4,
    name: 'Emily',
    avatar: '/avatars/emily.jpg',
    role: 'Customer Support',
    lastSeen: '2 min ago',
    online: true,
    unreadCount: 0
  }
];

export const conversations = {
  1: [
    {
      id: 101,
      senderId: 1,
      receiverId: "me",
      text: "Hey, I'm having trouble accessing pickup location #4532. The gate is locked.",
      timestamp: "2025-06-22T09:15:00Z",
      read: false
    },
    {
      id: 102,
      senderId: "me",
      receiverId: 1,
      text: "I'll contact the property manager right away. Can you proceed to the next location?",
      timestamp: "2025-06-22T09:20:00Z",
      read: true
    },
    {
      id: 103,
      senderId: 1,
      receiverId: "me",
      text: "Yes, moving to location #4533 now. Please let me know when I can return to #4532.",
      timestamp: "2025-06-22T09:22:00Z",
      read: false
    },
    {
      id: 104,
      senderId: 1,
      receiverId: "me",
      text: "Also, do you want me to take pictures of the locked gate?",
      timestamp: "2025-06-22T09:23:00Z",
      read: false
    }
  ],
  2: [
    {
      id: 201,
      senderId: 2,
      receiverId: "me",
      text: "The new monthly report template looks great! Thanks for implementing the changes.",
      timestamp: "2025-06-21T14:30:00Z",
      read: true
    },
    {
      id: 202,
      senderId: "me",
      receiverId: 2,
      text: "Glad you like it! Let me know if you need any other adjustments.",
      timestamp: "2025-06-21T14:35:00Z",
      read: true
    }
  ],
  3: [
    {
      id: 301,
      senderId: 3,
      receiverId: "me",
      text: "Route optimization system is acting up again. Several locations are out of order.",
      timestamp: "2025-06-21T08:45:00Z",
      read: false
    },
    {
      id: 302,
      senderId: "me",
      receiverId: 3,
      text: "I'll have our tech team look into it. Can you send screenshots of the issue?",
      timestamp: "2025-06-21T08:50:00Z",
      read: true
    },
    {
      id: 303,
      senderId: 3,
      receiverId: "me",
      text: "Sure, sending them now. It's affecting my entire afternoon route.",
      timestamp: "2025-06-21T08:55:00Z",
      read: false
    }
  ],
  4: [
    {
      id: 401,
      senderId: 4,
      receiverId: "me",
      text: "We've been getting a lot of positive feedback on the new bag design!",
      timestamp: "2025-06-20T11:20:00Z",
      read: true
    },
    {
      id: 402,
      senderId: "me",
      receiverId: 4,
      text: "That's great to hear! The design team will be thrilled.",
      timestamp: "2025-06-20T11:25:00Z",
      read: true
    }
  ]
};

export const notifications = [
  // Alerts
  {
    id: 1,
    type: 'alert',
    category: 'alerts',
    message: 'Critical: 3 collectors reported app crashes in downtown area',
    time: '5 min ago',
    read: false
  },
  {
    id: 2,
    type: 'alert',
    category: 'alerts',
    message: 'Pickup location #4532 inaccessible due to construction',
    time: '30 min ago',
    read: false
  },
  {
    id: 3,
    type: 'alert',
    category: 'alerts',
    message: 'System maintenance scheduled for tonight at 2 AM EST',
    time: '2 hours ago',
    read: true
  },
  
  // Pickup
  {
    id: 4,
    type: 'info',
    category: 'pickup',
    message: 'New pickup request from Riverfront Apartments',
    time: '1 hour ago',
    read: false
  },
  {
    id: 5,
    type: 'success',
    category: 'pickup',
    message: '15 pickup requests completed today',
    time: '3 hours ago',
    read: true
  },
  {
    id: 6,
    type: 'info',
    category: 'pickup',
    message: 'Route #372 optimized: 3 new stops added',
    time: '5 hours ago',
    read: true
  },
  
  // Reports
  {
    id: 7,
    type: 'info',
    category: 'reports',
    message: 'New illegal dumping reported at 1234 Oak Street',
    time: '45 min ago',
    read: false
  },
  {
    id: 8,
    type: 'success',
    category: 'reports',
    message: 'Monthly collection report is ready for review',
    time: '1 day ago',
    read: true
  },
  {
    id: 9,
    type: 'info',
    category: 'reports',
    message: 'Weekly efficiency metrics updated',
    time: '2 days ago',
    read: true
  }
];

export const getUnreadCount = () => {
  return notifications.filter(n => !n.read).length;
};

export const getUnreadMessageCount = () => {
  return contacts.reduce((total, contact) => total + contact.unreadCount, 0);
};

const messageData = {
  contacts,
  conversations,
  notifications,
  getUnreadCount,
  getUnreadMessageCount
};

export default messageData;
