// Mock data for illegal dumping management
export const dumpingReports = [
  {
    id: 'dump-001',
    reportedAt: '2025-06-01T08:30:00Z',
    reportedBy: 'citizen@example.com',
    location: {
      lat: 37.7564,
      lng: -122.4016,
      address: '250 Bryant St, San Francisco, CA'
    },
    description: 'Large pile of construction debris left on the sidewalk',
    images: ['dump001_img1.jpg', 'dump001_img2.jpg'],
    severity: 'High',
    wasteType: 'Construction',
    status: 'Under Investigation',
    verifiedAt: '2025-06-01T14:20:00Z',
    verifiedBy: 'inspector@trashdrop.com',
    cleanupAssigned: true,
    cleanupTeam: 'Team Alpha',
    estimatedCleanupDate: '2025-06-05T10:00:00Z'
  },
  {
    id: 'dump-002',
    reportedAt: '2025-06-02T11:45:00Z',
    reportedBy: 'resident@example.com',
    location: {
      lat: 37.7739,
      lng: -122.4312,
      address: '620 Divisadero St, San Francisco, CA'
    },
    description: 'Electronics and old furniture dumped in the alleyway',
    images: ['dump002_img1.jpg'],
    severity: 'Medium',
    wasteType: 'Mixed',
    status: 'Cleanup Scheduled',
    verifiedAt: '2025-06-02T16:10:00Z',
    verifiedBy: 'inspector@trashdrop.com',
    cleanupAssigned: true,
    cleanupTeam: 'Team Bravo',
    estimatedCleanupDate: '2025-06-06T09:00:00Z'
  },
  {
    id: 'dump-003',
    reportedAt: '2025-06-03T07:20:00Z',
    reportedBy: 'business@example.com',
    location: {
      lat: 37.7595,
      lng: -122.4089,
      address: '326 Townsend St, San Francisco, CA'
    },
    description: 'Industrial waste containers illegally disposed of',
    images: ['dump003_img1.jpg', 'dump003_img2.jpg', 'dump003_img3.jpg'],
    severity: 'Critical',
    wasteType: 'Industrial',
    status: 'Under Investigation',
    verifiedAt: '2025-06-03T10:30:00Z',
    verifiedBy: 'senior_inspector@trashdrop.com',
    cleanupAssigned: false,
    cleanupTeam: null,
    estimatedCleanupDate: null
  },
  {
    id: 'dump-004',
    reportedAt: '2025-06-05T15:10:00Z',
    reportedBy: 'park_staff@example.com',
    location: {
      lat: 37.7694,
      lng: -122.4862,
      address: 'Golden Gate Park, San Francisco, CA'
    },
    description: 'Plastic waste and picnic remains left in protected area',
    images: ['dump004_img1.jpg'],
    severity: 'Low',
    wasteType: 'Household',
    status: 'Cleaned Up',
    verifiedAt: '2025-06-05T17:40:00Z',
    verifiedBy: 'inspector@trashdrop.com',
    cleanupAssigned: true,
    cleanupTeam: 'Team Charlie',
    cleanupCompletedAt: '2025-06-07T12:30:00Z',
    cleanupNotes: 'Area restored to original condition, 3 bags collected'
  },
  {
    id: 'dump-005',
    reportedAt: '2025-06-08T10:05:00Z',
    reportedBy: 'citizen@example.com',
    location: {
      lat: 37.7837,
      lng: -122.4324,
      address: '1100 Fillmore St, San Francisco, CA'
    },
    description: 'Multiple bags of household waste left on corner',
    images: ['dump005_img1.jpg'],
    severity: 'Medium',
    wasteType: 'Household',
    status: 'Cleanup Scheduled',
    verifiedAt: '2025-06-08T14:20:00Z',
    verifiedBy: 'inspector@trashdrop.com',
    cleanupAssigned: true,
    cleanupTeam: 'Team Delta',
    estimatedCleanupDate: '2025-06-10T08:00:00Z'
  },
  {
    id: 'dump-006',
    reportedAt: '2025-06-10T16:40:00Z',
    reportedBy: 'resident@example.com',
    location: {
      lat: 37.7648,
      lng: -122.4186,
      address: '2550 Mission St, San Francisco, CA'
    },
    description: 'Old appliances dumped behind the building',
    images: ['dump006_img1.jpg', 'dump006_img2.jpg'],
    severity: 'High',
    wasteType: 'Electronic',
    status: 'Under Investigation',
    verifiedAt: null,
    verifiedBy: null,
    cleanupAssigned: false,
    cleanupTeam: null,
    estimatedCleanupDate: null
  },
  {
    id: 'dump-007',
    reportedAt: '2025-06-12T09:15:00Z',
    reportedBy: 'business@example.com',
    location: {
      lat: 37.7785,
      lng: -122.3892,
      address: '1 The Embarcadero, San Francisco, CA'
    },
    description: 'Chemical containers left near water',
    images: ['dump007_img1.jpg'],
    severity: 'Critical',
    wasteType: 'Hazardous',
    status: 'Cleaned Up',
    verifiedAt: '2025-06-12T10:00:00Z',
    verifiedBy: 'hazmat_inspector@trashdrop.com',
    cleanupAssigned: true,
    cleanupTeam: 'Hazmat Team',
    cleanupCompletedAt: '2025-06-12T14:20:00Z',
    cleanupNotes: 'Hazardous materials safely contained and removed'
  },
  {
    id: 'dump-008',
    reportedAt: '2025-06-14T13:50:00Z',
    reportedBy: 'citizen@example.com',
    location: {
      lat: 37.7759,
      lng: -122.4245,
      address: '400 Hayes St, San Francisco, CA'
    },
    description: 'Discarded furniture blocking sidewalk',
    images: ['dump008_img1.jpg'],
    severity: 'Medium',
    wasteType: 'Bulky',
    status: 'Reported',
    verifiedAt: null,
    verifiedBy: null,
    cleanupAssigned: false,
    cleanupTeam: null,
    estimatedCleanupDate: null
  },
  {
    id: 'dump-009',
    reportedAt: '2025-06-15T08:30:00Z',
    reportedBy: 'park_staff@example.com',
    location: {
      lat: 37.8012,
      lng: -122.4372,
      address: 'Fort Mason, San Francisco, CA'
    },
    description: 'Illegal dumping of landscape waste',
    images: ['dump009_img1.jpg'],
    severity: 'Low',
    wasteType: 'Green',
    status: 'Canceled',
    verifiedAt: '2025-06-15T11:20:00Z',
    verifiedBy: 'inspector@trashdrop.com',
    cancellationReason: 'Upon inspection, waste was found to be authorized park maintenance debris'
  },
  {
    id: 'dump-010',
    reportedAt: '2025-06-18T17:05:00Z',
    reportedBy: 'school@example.com',
    location: {
      lat: 37.7202,
      lng: -122.4359,
      address: '200 Winston Dr, San Francisco, CA'
    },
    description: 'Construction materials dumped on school grounds',
    images: ['dump010_img1.jpg', 'dump010_img2.jpg'],
    severity: 'High',
    wasteType: 'Construction',
    status: 'Cleanup Scheduled',
    verifiedAt: '2025-06-19T09:15:00Z',
    verifiedBy: 'inspector@trashdrop.com',
    cleanupAssigned: true,
    cleanupTeam: 'Team Echo',
    estimatedCleanupDate: '2025-06-21T08:00:00Z'
  }
];

export const dumpingHistory = [
  {
    id: 'history-001',
    reportId: 'dump-004',
    timestamp: '2025-06-05T17:40:00Z',
    action: 'Verified',
    performedBy: 'inspector@trashdrop.com',
    notes: 'Confirmed illegal dumping, priority set to low'
  },
  {
    id: 'history-002',
    reportId: 'dump-004',
    timestamp: '2025-06-06T10:15:00Z',
    action: 'Assigned',
    performedBy: 'coordinator@trashdrop.com',
    notes: 'Cleanup assigned to Team Charlie'
  },
  {
    id: 'history-003',
    reportId: 'dump-004',
    timestamp: '2025-06-07T12:30:00Z',
    action: 'Cleaned Up',
    performedBy: 'team_lead@trashdrop.com',
    notes: 'Area restored to original condition, 3 bags collected'
  },
  {
    id: 'history-004',
    reportId: 'dump-007',
    timestamp: '2025-06-12T10:00:00Z',
    action: 'Verified',
    performedBy: 'hazmat_inspector@trashdrop.com',
    notes: 'Confirmed hazardous materials, escalated to critical'
  },
  {
    id: 'history-005',
    reportId: 'dump-007',
    timestamp: '2025-06-12T10:30:00Z',
    action: 'Assigned',
    performedBy: 'emergency_coordinator@trashdrop.com',
    notes: 'Emergency cleanup assigned to Hazmat Team'
  },
  {
    id: 'history-006',
    reportId: 'dump-007',
    timestamp: '2025-06-12T14:20:00Z',
    action: 'Cleaned Up',
    performedBy: 'hazmat_lead@trashdrop.com',
    notes: 'Hazardous materials safely contained and removed'
  },
  {
    id: 'history-007',
    reportId: 'dump-009',
    timestamp: '2025-06-15T11:20:00Z',
    action: 'Verified',
    performedBy: 'inspector@trashdrop.com',
    notes: 'Investigated the site'
  },
  {
    id: 'history-008',
    reportId: 'dump-009',
    timestamp: '2025-06-15T11:45:00Z',
    action: 'Canceled',
    performedBy: 'inspector@trashdrop.com',
    notes: 'Upon inspection, waste was found to be authorized park maintenance debris'
  }
];

// Helper functions for filtering and statistics
export const getReportsByStatus = (status) => {
  return dumpingReports.filter(report => report.status === status);
};

export const getReportsBySeverity = (severity) => {
  return dumpingReports.filter(report => report.severity === severity);
};

export const getReportsByWasteType = (wasteType) => {
  return dumpingReports.filter(report => report.wasteType === wasteType);
};

export const getCleanupMetrics = () => {
  const totalReports = dumpingReports.length;
  const verifiedReports = dumpingReports.filter(report => report.verifiedAt !== null).length;
  const cleanedUpReports = dumpingReports.filter(report => report.status === 'Cleaned Up').length;
  
  // Calculate average cleanup time in hours for completed cleanups
  const completedCleanups = dumpingReports.filter(report => 
    report.status === 'Cleaned Up' && report.verifiedAt && report.cleanupCompletedAt
  );
  
  let totalCleanupHours = 0;
  completedCleanups.forEach(report => {
    const verifiedTime = new Date(report.verifiedAt).getTime();
    const completedTime = new Date(report.cleanupCompletedAt).getTime();
    const hoursDiff = (completedTime - verifiedTime) / (1000 * 60 * 60);
    totalCleanupHours += hoursDiff;
  });
  
  const avgCleanupTime = completedCleanups.length > 0 ? 
    totalCleanupHours / completedCleanups.length : 0;
  
  return {
    totalReports,
    verifiedReports,
    cleanedUpReports,
    verificationRate: totalReports > 0 ? (verifiedReports / totalReports) * 100 : 0,
    avgCleanupTimeHours: avgCleanupTime,
  };
};
