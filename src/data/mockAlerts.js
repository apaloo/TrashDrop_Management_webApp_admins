const mockAlerts = [
  {
    id: 'alert-001',
    title: 'SLA breach risk: Request #12378',
    description: 'Pickup request #12378 is at risk of breaching service level agreement. Requires attention within the next 2 hours to avoid customer SLA violation.',
    status: 'open',
    priority: 'critical',
    createdAt: '2025-06-22T10:15:00Z',
    updatedAt: '2025-06-22T10:15:00Z',
    relatedTo: {
      type: 'pickup_request',
      id: '12378',
      location: 'North District'
    },
    assignedTo: null,
    comments: [
      {
        id: 'comment-001-1',
        text: 'Alert created based on SLA monitoring system',
        createdAt: '2025-06-22T10:15:00Z',
        createdBy: 'System',
        isSystem: true
      }
    ]
  },
  {
    id: 'alert-002',
    title: 'New collector approved',
    description: 'Michael Johnson has been automatically approved as a collector. Please review credentials and confirm approval or take appropriate action.',
    status: 'open',
    priority: 'medium',
    createdAt: '2025-06-22T09:45:00Z',
    updatedAt: '2025-06-22T09:45:00Z',
    relatedTo: {
      type: 'collector',
      id: 'col-001',
      location: 'North District'
    },
    assignedTo: null,
    comments: []
  },
  {
    id: 'alert-003',
    title: 'System maintenance scheduled',
    description: 'Routine maintenance scheduled for June 25, 2025 at 02:00 AM. Service may be disrupted for up to 30 minutes. Please notify all active collectors.',
    status: 'open',
    priority: 'low',
    createdAt: '2025-06-21T14:30:00Z',
    updatedAt: '2025-06-21T14:30:00Z',
    relatedTo: {
      type: 'system',
      id: 'maintenance-0025',
      location: null
    },
    assignedTo: null,
    comments: []
  },
  {
    id: 'alert-004',
    title: 'Collector availability low in South District',
    description: 'Only 2 active collectors available in South District. May cause delays in pickup requests. Consider temporarily reassigning collectors from other regions.',
    status: 'open',
    priority: 'high',
    createdAt: '2025-06-22T08:15:00Z',
    updatedAt: '2025-06-22T08:15:00Z',
    relatedTo: {
      type: 'region',
      id: 'south-district',
      location: 'South District'
    },
    assignedTo: null,
    comments: []
  },
  {
    id: 'alert-005',
    title: 'Multiple pickups canceled by collector',
    description: 'Collector ID col-003 has canceled 3 pickups in the last 24 hours. May require investigation into performance or technical issues.',
    status: 'open',
    priority: 'high',
    createdAt: '2025-06-21T17:20:00Z',
    updatedAt: '2025-06-21T17:20:00Z',
    relatedTo: {
      type: 'collector',
      id: 'col-003',
      location: 'West District'
    },
    assignedTo: null,
    comments: []
  },
  {
    id: 'alert-006',
    title: 'Request #12350 delayed for 48 hours',
    description: 'Pickup request #12350 has been delayed by more than 48 hours. Customer has been notified via automated system.',
    status: 'resolved',
    priority: 'high',
    createdAt: '2025-06-20T09:10:00Z',
    updatedAt: '2025-06-21T15:30:00Z',
    relatedTo: {
      type: 'pickup_request',
      id: '12350',
      location: 'East District'
    },
    assignedTo: 'admin@trashdrop.com',
    comments: [
      {
        id: 'comment-006-1',
        text: 'Assigned to admin for review',
        createdAt: '2025-06-20T10:30:00Z',
        createdBy: 'System',
        isSystem: true
      },
      {
        id: 'comment-006-2',
        text: 'Customer contacted and issue resolved. The delay was caused by road construction blocking access to the pickup location.',
        createdAt: '2025-06-21T15:30:00Z',
        createdBy: 'Admin',
        isSystem: false
      }
    ]
  },
  {
    id: 'alert-007',
    title: 'Success: New region added',
    description: 'Central Business District has been successfully added as a new operating region. Collectors can now accept jobs in this area.',
    status: 'resolved',
    priority: 'medium',
    createdAt: '2025-06-19T11:25:00Z',
    updatedAt: '2025-06-19T11:25:00Z',
    relatedTo: {
      type: 'region',
      id: 'central-business-district',
      location: 'Central Business District'
    },
    assignedTo: 'admin@trashdrop.com',
    comments: []
  },
  {
    id: 'alert-008',
    title: 'Database backup failed',
    description: 'Scheduled database backup operation failed on June 21. Technical team needs to investigate and ensure data integrity.',
    status: 'open',
    priority: 'critical',
    createdAt: '2025-06-21T02:15:00Z',
    updatedAt: '2025-06-21T02:15:00Z',
    relatedTo: {
      type: 'system',
      id: 'db-backup',
      location: null
    },
    assignedTo: 'support@trashdrop.com',
    comments: [
      {
        id: 'comment-008-1',
        text: 'Assigned to support team for investigation',
        createdAt: '2025-06-21T08:45:00Z',
        createdBy: 'Admin',
        isSystem: false
      },
      {
        id: 'comment-008-2',
        text: 'Initial investigation shows disk space issue on backup server. Working on resolution.',
        createdAt: '2025-06-21T10:30:00Z',
        createdBy: 'Support Team',
        isSystem: false
      }
    ]
  },
  {
    id: 'alert-009',
    title: 'New high volume customer onboarded',
    description: 'ExampleCorp has been onboarded and expects to generate approximately 50 pickup requests per week. Consider resource allocation.',
    status: 'open',
    priority: 'medium',
    createdAt: '2025-06-22T11:20:00Z',
    updatedAt: '2025-06-22T11:20:00Z',
    relatedTo: {
      type: 'system',
      id: 'customer-onboarding',
      location: 'Multiple Regions'
    },
    assignedTo: 'operations@trashdrop.com',
    comments: []
  },
  {
    id: 'alert-010',
    title: 'Collector app version update required',
    description: 'Critical security update available for collector mobile application. All collectors should be notified to update their apps immediately.',
    status: 'open',
    priority: 'high',
    createdAt: '2025-06-22T07:45:00Z',
    updatedAt: '2025-06-22T07:45:00Z',
    relatedTo: {
      type: 'system',
      id: 'app-update',
      location: null
    },
    assignedTo: null,
    comments: []
  },
  {
    id: 'alert-011',
    title: 'API rate limit reached',
    description: 'External integration with payment processor has reached its API rate limit. This may affect payment processing for completed pickups.',
    status: 'resolved',
    priority: 'critical',
    createdAt: '2025-06-21T16:30:00Z',
    updatedAt: '2025-06-21T18:45:00Z',
    relatedTo: {
      type: 'system',
      id: 'api-integration',
      location: null
    },
    assignedTo: 'support@trashdrop.com',
    comments: [
      {
        id: 'comment-011-1',
        text: 'Issue resolved by upgrading the API plan to accommodate higher volume.',
        createdAt: '2025-06-21T18:45:00Z',
        createdBy: 'Support Team',
        isSystem: false
      }
    ]
  },
  {
    id: 'alert-012',
    title: 'Repeated pickup cancellation at location',
    description: 'Location ID loc-567 has had 5 pickup cancellations in the last 7 days. May indicate access issues or customer dissatisfaction.',
    status: 'open',
    priority: 'medium',
    createdAt: '2025-06-22T09:10:00Z',
    updatedAt: '2025-06-22T09:10:00Z',
    relatedTo: {
      type: 'pickup_request',
      id: 'loc-567',
      location: 'East District'
    },
    assignedTo: null,
    comments: []
  },
  {
    id: 'alert-013',
    title: 'Customer feedback: Collector was excellent',
    description: 'Positive feedback received for collector ID col-052. Customer mentioned exceptional service and professionalism.',
    status: 'resolved',
    priority: 'low',
    createdAt: '2025-06-20T14:55:00Z',
    updatedAt: '2025-06-20T15:30:00Z',
    relatedTo: {
      type: 'collector',
      id: 'col-052',
      location: 'North District'
    },
    assignedTo: 'admin@trashdrop.com',
    comments: [
      {
        id: 'comment-013-1',
        text: 'Recognition email sent to collector.',
        createdAt: '2025-06-20T15:30:00Z',
        createdBy: 'Admin',
        isSystem: false
      }
    ]
  },
  {
    id: 'alert-014',
    title: 'Region meeting pickup SLA goals',
    description: 'West District has maintained 100% pickup SLA compliance for 30 consecutive days. Consider team recognition.',
    status: 'resolved',
    priority: 'low',
    createdAt: '2025-06-21T10:00:00Z',
    updatedAt: '2025-06-21T10:15:00Z',
    relatedTo: {
      type: 'region',
      id: 'west-district',
      location: 'West District'
    },
    assignedTo: 'operations@trashdrop.com',
    comments: []
  },
  {
    id: 'alert-015',
    title: 'New collector verification required',
    description: 'New collector application ID app-089 needs document verification before approval.',
    status: 'open',
    priority: 'medium',
    createdAt: '2025-06-22T13:10:00Z',
    updatedAt: '2025-06-22T13:10:00Z',
    relatedTo: {
      type: 'collector',
      id: 'app-089',
      location: 'South District'
    },
    assignedTo: null,
    comments: []
  }
];

export default mockAlerts;
