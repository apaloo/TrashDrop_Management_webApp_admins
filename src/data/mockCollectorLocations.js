// Mock collector location data with history for the LiveMap
const mockCollectorLocations = [
  {
    id: 'col-001',
    name: 'Mike Johnson',
    vehicle: 'TRK-001',
    status: 'active',
    currentLocation: { lat: 37.7813, lng: -122.4167 },
    lastUpdated: '2025-06-22T15:45:00Z',
    profilePic: 'https://randomuser.me/api/portraits/men/32.jpg',
    contactNumber: '(555) 123-4567',
    locationHistory: [
      { lat: 37.7825, lng: -122.4200, timestamp: '2025-06-22T15:15:00Z' },
      { lat: 37.7820, lng: -122.4188, timestamp: '2025-06-22T15:25:00Z' },
      { lat: 37.7815, lng: -122.4175, timestamp: '2025-06-22T15:35:00Z' },
      { lat: 37.7813, lng: -122.4167, timestamp: '2025-06-22T15:45:00Z' }
    ],
    stats: {
      completedToday: 7,
      pendingPickups: 3,
      totalDistance: 15.4, // km
      avgResponseTime: 28 // minutes
    },
    assignedRegion: 'North District',
    capacityRemaining: 75 // percentage
  },
  {
    id: 'col-002',
    name: 'Sarah Miller',
    vehicle: 'TRK-014',
    status: 'active',
    currentLocation: { lat: 37.7694, lng: -122.4760 },
    lastUpdated: '2025-06-22T15:48:00Z',
    profilePic: 'https://randomuser.me/api/portraits/women/44.jpg',
    contactNumber: '(555) 987-6543',
    locationHistory: [
      { lat: 37.7685, lng: -122.4790, timestamp: '2025-06-22T15:18:00Z' },
      { lat: 37.7689, lng: -122.4775, timestamp: '2025-06-22T15:28:00Z' },
      { lat: 37.7694, lng: -122.4760, timestamp: '2025-06-22T15:48:00Z' }
    ],
    stats: {
      completedToday: 5,
      pendingPickups: 2,
      totalDistance: 12.8, // km
      avgResponseTime: 32 // minutes
    },
    assignedRegion: 'West District',
    capacityRemaining: 60 // percentage
  },
  {
    id: 'col-003',
    name: 'James Taylor',
    vehicle: 'TRK-023',
    status: 'active',
    currentLocation: { lat: 37.8044, lng: -122.4155 },
    lastUpdated: '2025-06-22T15:50:00Z',
    profilePic: 'https://randomuser.me/api/portraits/men/55.jpg',
    contactNumber: '(555) 456-7890',
    locationHistory: [
      { lat: 37.8033, lng: -122.4180, timestamp: '2025-06-22T15:20:00Z' },
      { lat: 37.8038, lng: -122.4170, timestamp: '2025-06-22T15:30:00Z' },
      { lat: 37.8041, lng: -122.4162, timestamp: '2025-06-22T15:40:00Z' },
      { lat: 37.8044, lng: -122.4155, timestamp: '2025-06-22T15:50:00Z' }
    ],
    stats: {
      completedToday: 9,
      pendingPickups: 1,
      totalDistance: 17.2, // km
      avgResponseTime: 25 // minutes
    },
    assignedRegion: 'North District',
    capacityRemaining: 30 // percentage
  },
  {
    id: 'col-004',
    name: 'Linda Davis',
    vehicle: 'TRK-009',
    status: 'inactive',
    currentLocation: { lat: 37.7880, lng: -122.4324 },
    lastUpdated: '2025-06-22T14:30:00Z',
    profilePic: 'https://randomuser.me/api/portraits/women/65.jpg',
    contactNumber: '(555) 234-5678',
    locationHistory: [
      { lat: 37.7860, lng: -122.4330, timestamp: '2025-06-22T14:00:00Z' },
      { lat: 37.7870, lng: -122.4327, timestamp: '2025-06-22T14:10:00Z' },
      { lat: 37.7880, lng: -122.4324, timestamp: '2025-06-22T14:30:00Z' }
    ],
    stats: {
      completedToday: 3,
      pendingPickups: 0,
      totalDistance: 8.5, // km
      avgResponseTime: 34 // minutes
    },
    assignedRegion: 'Central District',
    capacityRemaining: 85 // percentage
  },
  {
    id: 'col-005',
    name: 'Carlos Rodriguez',
    vehicle: 'TRK-017',
    status: 'active',
    currentLocation: { lat: 37.7579, lng: -122.3980 },
    lastUpdated: '2025-06-22T15:52:00Z',
    profilePic: 'https://randomuser.me/api/portraits/men/72.jpg',
    contactNumber: '(555) 345-6789',
    locationHistory: [
      { lat: 37.7590, lng: -122.4010, timestamp: '2025-06-22T15:22:00Z' },
      { lat: 37.7585, lng: -122.4000, timestamp: '2025-06-22T15:32:00Z' },
      { lat: 37.7582, lng: -122.3990, timestamp: '2025-06-22T15:42:00Z' },
      { lat: 37.7579, lng: -122.3980, timestamp: '2025-06-22T15:52:00Z' }
    ],
    stats: {
      completedToday: 6,
      pendingPickups: 4,
      totalDistance: 14.3, // km
      avgResponseTime: 30 // minutes
    },
    assignedRegion: 'East District',
    capacityRemaining: 45 // percentage
  }
];

export default mockCollectorLocations;
