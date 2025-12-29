// Mock collector location data with history for Accra, Ghana
const mockCollectorLocations = [
  {
    id: 'col-001',
    name: 'Kwame Asante',
    vehicle: 'TRK-001',
    status: 'active',
    currentLocation: { lat: 5.7100, lng: -0.1900 },
    lastUpdated: '2025-08-05T15:45:00Z',
    profilePic: 'https://randomuser.me/api/portraits/men/32.jpg',
    contactNumber: '+233 20 123 4567',
    locationHistory: [
      { lat: 5.7080, lng: -0.1920, timestamp: '2025-08-05T15:15:00Z' },
      { lat: 5.7090, lng: -0.1910, timestamp: '2025-08-05T15:25:00Z' },
      { lat: 5.7095, lng: -0.1905, timestamp: '2025-08-05T15:35:00Z' },
      { lat: 5.7100, lng: -0.1900, timestamp: '2025-08-05T15:45:00Z' }
    ],
    stats: {
      completedToday: 7,
      pendingPickups: 3,
      totalDistance: 15.4, // km
      avgResponseTime: 28 // minutes
    },
    assignedRegion: 'Ga North Municipal',
    capacityRemaining: 75 // percentage
  },
  {
    id: 'col-002',
    name: 'Akosua Mensah',
    vehicle: 'TRK-014',
    status: 'active',
    currentLocation: { lat: 5.6100, lng: -0.2900 },
    lastUpdated: '2025-08-05T15:48:00Z',
    profilePic: 'https://randomuser.me/api/portraits/women/44.jpg',
    contactNumber: '+233 24 987 6543',
    locationHistory: [
      { lat: 5.6080, lng: -0.2920, timestamp: '2025-08-05T15:18:00Z' },
      { lat: 5.6090, lng: -0.2910, timestamp: '2025-08-05T15:28:00Z' },
      { lat: 5.6100, lng: -0.2900, timestamp: '2025-08-05T15:48:00Z' }
    ],
    stats: {
      completedToday: 5,
      pendingPickups: 2,
      totalDistance: 12.8, // km
      avgResponseTime: 32 // minutes
    },
    assignedRegion: 'Ga West Municipal',
    capacityRemaining: 60 // percentage
  },
  {
    id: 'col-003',
    name: 'Kofi Boateng',
    vehicle: 'TRK-023',
    status: 'active',
    currentLocation: { lat: 5.7050, lng: -0.1950 },
    lastUpdated: '2025-08-05T15:50:00Z',
    profilePic: 'https://randomuser.me/api/portraits/men/55.jpg',
    contactNumber: '+233 26 456 7890',
    locationHistory: [
      { lat: 5.7020, lng: -0.1980, timestamp: '2025-08-05T15:20:00Z' },
      { lat: 5.7030, lng: -0.1970, timestamp: '2025-08-05T15:30:00Z' },
      { lat: 5.7040, lng: -0.1960, timestamp: '2025-08-05T15:40:00Z' },
      { lat: 5.7050, lng: -0.1950, timestamp: '2025-08-05T15:50:00Z' }
    ],
    stats: {
      completedToday: 9,
      pendingPickups: 1,
      totalDistance: 17.2, // km
      avgResponseTime: 25 // minutes
    },
    assignedRegion: 'Ga North Municipal',
    capacityRemaining: 30 // percentage
  },
  {
    id: 'col-004',
    name: 'Ama Owusu',
    vehicle: 'TRK-009',
    status: 'inactive',
    currentLocation: { lat: 5.5900, lng: -0.2200 },
    lastUpdated: '2025-08-05T14:30:00Z',
    profilePic: 'https://randomuser.me/api/portraits/women/65.jpg',
    contactNumber: '+233 23 234 5678',
    locationHistory: [
      { lat: 5.5880, lng: -0.2220, timestamp: '2025-08-05T14:00:00Z' },
      { lat: 5.5890, lng: -0.2210, timestamp: '2025-08-05T14:10:00Z' },
      { lat: 5.5900, lng: -0.2200, timestamp: '2025-08-05T14:30:00Z' }
    ],
    stats: {
      completedToday: 3,
      pendingPickups: 0,
      totalDistance: 8.5, // km
      avgResponseTime: 34 // minutes
    },
    assignedRegion: 'Accra Metropolitan',
    capacityRemaining: 85 // percentage
  },
  {
    id: 'col-005',
    name: 'Emmanuel Adjei',
    vehicle: 'TRK-017',
    status: 'active',
    currentLocation: { lat: 5.6100, lng: -0.1400 },
    lastUpdated: '2025-08-05T15:52:00Z',
    profilePic: 'https://randomuser.me/api/portraits/men/72.jpg',
    contactNumber: '+233 27 345 6789',
    locationHistory: [
      { lat: 5.6070, lng: -0.1430, timestamp: '2025-08-05T15:22:00Z' },
      { lat: 5.6080, lng: -0.1420, timestamp: '2025-08-05T15:32:00Z' },
      { lat: 5.6090, lng: -0.1410, timestamp: '2025-08-05T15:42:00Z' },
      { lat: 5.6100, lng: -0.1400, timestamp: '2025-08-05T15:52:00Z' }
    ],
    stats: {
      completedToday: 6,
      pendingPickups: 4,
      totalDistance: 14.3, // km
      avgResponseTime: 30 // minutes
    },
    assignedRegion: 'Ga East Municipal',
    capacityRemaining: 45 // percentage
  }
];

export default mockCollectorLocations;
