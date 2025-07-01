// Mock data for pickup requests management
export const pickupRequests = [
  {
    id: 'req-001',
    requestedAt: '2025-06-01T09:30:00Z',
    requestedBy: {
      id: 'user-001',
      name: 'John Smith',
      email: 'john.smith@example.com',
      phone: '+1-555-123-4567'
    },
    location: {
      lat: 37.7749,
      lng: -122.4194,
      address: '123 Main St, San Francisco, CA 94105'
    },
    wasteType: 'Recyclable',
    quantity: 2,
    status: 'Completed',
    priority: 'Medium',
    assignedTo: {
      id: 'collector-001',
      name: 'Mike Johnson'
    },
    scheduledTime: '2025-06-02T10:00:00Z',
    completedTime: '2025-06-02T10:15:00Z',
    notes: 'Customer requested contactless pickup'
  },
  {
    id: 'req-002',
    requestedAt: '2025-06-01T14:45:00Z',
    requestedBy: {
      id: 'user-002',
      name: 'Sarah Wilson',
      email: 'sarah.wilson@example.com',
      phone: '+1-555-987-6543'
    },
    location: {
      lat: 37.7833,
      lng: -122.4167,
      address: '456 Market St, San Francisco, CA 94103'
    },
    wasteType: 'Organic',
    quantity: 3,
    status: 'In Progress',
    priority: 'High',
    assignedTo: {
      id: 'collector-003',
      name: 'Lisa Chen'
    },
    scheduledTime: '2025-06-03T09:00:00Z',
    completedTime: null,
    notes: 'Large items, may need extra space'
  },
  {
    id: 'req-003',
    requestedAt: '2025-06-02T08:15:00Z',
    requestedBy: {
      id: 'user-003',
      name: 'Robert Taylor',
      email: 'robert.taylor@example.com',
      phone: '+1-555-456-7890'
    },
    location: {
      lat: 37.7694,
      lng: -122.4862,
      address: '789 Golden Gate Ave, San Francisco, CA 94102'
    },
    wasteType: 'Mixed',
    quantity: 1,
    status: 'Pending',
    priority: 'Medium',
    assignedTo: null,
    scheduledTime: null,
    completedTime: null,
    notes: 'First-time customer'
  },
  {
    id: 'req-004',
    requestedAt: '2025-06-02T16:30:00Z',
    requestedBy: {
      id: 'user-004',
      name: 'Emily Davis',
      email: 'emily.davis@example.com',
      phone: '+1-555-234-5678'
    },
    location: {
      lat: 37.7599,
      lng: -122.4148,
      address: '101 Howard St, San Francisco, CA 94105'
    },
    wasteType: 'Electronic',
    quantity: 2,
    status: 'Completed',
    priority: 'Low',
    assignedTo: {
      id: 'collector-002',
      name: 'James Wilson'
    },
    scheduledTime: '2025-06-03T15:00:00Z',
    completedTime: '2025-06-03T15:10:00Z',
    notes: 'Old computers and monitors'
  },
  {
    id: 'req-005',
    requestedAt: '2025-06-03T11:20:00Z',
    requestedBy: {
      id: 'user-005',
      name: 'Michael Brown',
      email: 'michael.brown@example.com',
      phone: '+1-555-345-6789'
    },
    location: {
      lat: 37.7879,
      lng: -122.4074,
      address: '1 California St, San Francisco, CA 94111'
    },
    wasteType: 'Hazardous',
    quantity: 1,
    status: 'Cancelled',
    priority: 'High',
    assignedTo: {
      id: 'collector-004',
      name: 'David Rodriguez'
    },
    scheduledTime: '2025-06-04T10:00:00Z',
    completedTime: null,
    cancellationReason: 'Customer rescheduled for next week',
    notes: 'Contains paint and chemicals'
  }
];

export const collectors = [
  {
    id: 'collector-001',
    name: 'Mike Johnson',
    email: 'mike.johnson@trashdrop.com',
    phone: '+1-555-111-2222',
    status: 'Active',
    currentLocation: {
      lat: 37.7765,
      lng: -122.4200
    },
    activeRequests: 2,
    completedToday: 5,
    vehicle: {
      id: 'v-001',
      type: 'Truck',
      plate: 'TD-1234',
      capacity: '1.5 tons'
    },
    rating: 4.8
  },
  {
    id: 'collector-002',
    name: 'James Wilson',
    email: 'james.wilson@trashdrop.com',
    phone: '+1-555-222-3333',
    status: 'Active',
    currentLocation: {
      lat: 37.7850,
      lng: -122.4100
    },
    activeRequests: 1,
    completedToday: 3,
    vehicle: {
      id: 'v-002',
      type: 'Van',
      plate: 'TD-2345',
      capacity: '0.8 tons'
    },
    rating: 4.5
  },
  {
    id: 'collector-003',
    name: 'Lisa Chen',
    email: 'lisa.chen@trashdrop.com',
    phone: '+1-555-333-4444',
    status: 'Active',
    currentLocation: {
      lat: 37.7830,
      lng: -122.4170
    },
    activeRequests: 3,
    completedToday: 4,
    vehicle: {
      id: 'v-003',
      type: 'Truck',
      plate: 'TD-3456',
      capacity: '1.2 tons'
    },
    rating: 4.9
  },
  {
    id: 'collector-004',
    name: 'David Rodriguez',
    email: 'david.rodriguez@trashdrop.com',
    phone: '+1-555-444-5555',
    status: 'Inactive',
    currentLocation: null,
    activeRequests: 0,
    completedToday: 2,
    vehicle: {
      id: 'v-004',
      type: 'Van',
      plate: 'TD-4567',
      capacity: '0.8 tons'
    },
    rating: 4.7
  },
  {
    id: 'collector-005',
    name: 'Karen Thompson',
    email: 'karen.thompson@trashdrop.com',
    phone: '+1-555-555-6666',
    status: 'Active',
    currentLocation: {
      lat: 37.7890,
      lng: -122.4150
    },
    activeRequests: 2,
    completedToday: 6,
    vehicle: {
      id: 'v-005',
      type: 'Truck',
      plate: 'TD-5678',
      capacity: '1.5 tons'
    },
    rating: 4.6
  }
];

export const alerts = [
  {
    id: 'alert-001',
    createdAt: '2025-06-01T10:20:00Z',
    type: 'Delay',
    severity: 'Medium',
    status: 'Active',
    relatedTo: {
      type: 'Request',
      id: 'req-002'
    },
    message: 'Pickup delayed due to traffic congestion',
    assignedTo: 'dispatcher@trashdrop.com',
    resolvedAt: null
  },
  {
    id: 'alert-002',
    createdAt: '2025-06-02T09:15:00Z',
    type: 'Vehicle',
    severity: 'High',
    status: 'Resolved',
    relatedTo: {
      type: 'Collector',
      id: 'collector-001'
    },
    message: 'Vehicle breakdown requires immediate assistance',
    assignedTo: 'maintenance@trashdrop.com',
    resolvedAt: '2025-06-02T11:45:00Z',
    resolution: 'Vehicle repaired on site'
  },
  {
    id: 'alert-003',
    createdAt: '2025-06-03T14:50:00Z',
    type: 'Customer',
    severity: 'Low',
    status: 'Active',
    relatedTo: {
      type: 'Request',
      id: 'req-004'
    },
    message: 'Customer requested specific time window',
    assignedTo: 'support@trashdrop.com',
    resolvedAt: null
  }
];

// Helper functions for data manipulation
export const getRequestsByStatus = (status) => {
  return pickupRequests.filter(request => request.status === status);
};

export const getRequestsByPriority = (priority) => {
  return pickupRequests.filter(request => request.priority === priority);
};

export const getActiveCollectors = () => {
  return collectors.filter(collector => collector.status === 'Active');
};

export const getRequestsForCollector = (collectorId) => {
  return pickupRequests.filter(request => 
    request.assignedTo && request.assignedTo.id === collectorId
  );
};
