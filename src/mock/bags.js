// Mock data for bag management
export const bagBatches = [
  {
    id: 'batch-001',
    createdAt: '2025-05-15T10:30:00Z',
    createdBy: 'admin@trashdrop.com',
    quantity: 100,
    type: 'Recyclable',
    size: 'Large',
    status: 'Active',
    distributed: 75,
    scanned: 60,
    qrPrefix: 'TD-REC-L'
  },
  {
    id: 'batch-002',
    createdAt: '2025-05-20T14:45:00Z',
    createdBy: 'manager@trashdrop.com',
    quantity: 50,
    type: 'Organic',
    size: 'Medium',
    status: 'Active',
    distributed: 40,
    scanned: 32,
    qrPrefix: 'TD-ORG-M'
  },
  {
    id: 'batch-003',
    createdAt: '2025-05-25T09:15:00Z',
    createdBy: 'admin@trashdrop.com',
    quantity: 75,
    type: 'Recyclable',
    size: 'Small',
    status: 'Active',
    distributed: 65,
    scanned: 50,
    qrPrefix: 'TD-REC-S'
  },
  {
    id: 'batch-004',
    createdAt: '2025-06-01T11:00:00Z',
    createdBy: 'manager@trashdrop.com',
    quantity: 120,
    type: 'Hazardous',
    size: 'Large',
    status: 'Inactive',
    distributed: 110,
    scanned: 108,
    qrPrefix: 'TD-HAZ-L'
  },
  {
    id: 'batch-005',
    createdAt: '2025-06-10T16:20:00Z',
    createdBy: 'admin@trashdrop.com',
    quantity: 80,
    type: 'Electronic',
    size: 'Medium',
    status: 'Active',
    distributed: 15,
    scanned: 5,
    qrPrefix: 'TD-ELE-M'
  }
];

export const bagHistory = [
  {
    id: 'scan-001',
    bagId: 'TD-REC-L-001',
    batchId: 'batch-001',
    scannedAt: '2025-06-01T10:15:00Z',
    scannedBy: 'collector1@trashdrop.com',
    location: {
      lat: 37.7749,
      lng: -122.4194,
      address: '123 Main St, San Francisco, CA'
    },
    status: 'Collected',
    weight: 3.2
  },
  {
    id: 'scan-002',
    bagId: 'TD-REC-L-002',
    batchId: 'batch-001',
    scannedAt: '2025-06-01T11:30:00Z',
    scannedBy: 'collector1@trashdrop.com',
    location: {
      lat: 37.7833,
      lng: -122.4167,
      address: '456 Market St, San Francisco, CA'
    },
    status: 'Collected',
    weight: 2.7
  },
  {
    id: 'scan-003',
    bagId: 'TD-ORG-M-015',
    batchId: 'batch-002',
    scannedAt: '2025-06-02T09:45:00Z',
    scannedBy: 'collector2@trashdrop.com',
    location: {
      lat: 37.7694,
      lng: -122.4862,
      address: '789 Golden Gate Ave, San Francisco, CA'
    },
    status: 'Collected',
    weight: 4.1
  },
  {
    id: 'scan-004',
    bagId: 'TD-REC-S-022',
    batchId: 'batch-003',
    scannedAt: '2025-06-03T14:20:00Z',
    scannedBy: 'collector3@trashdrop.com',
    location: {
      lat: 37.7599,
      lng: -122.4148,
      address: '101 Howard St, San Francisco, CA'
    },
    status: 'Processing',
    weight: 1.8
  },
  {
    id: 'scan-005',
    bagId: 'TD-HAZ-L-054',
    batchId: 'batch-004',
    scannedAt: '2025-06-04T16:10:00Z',
    scannedBy: 'collector2@trashdrop.com',
    location: {
      lat: 37.7879,
      lng: -122.4074,
      address: '1 California St, San Francisco, CA'
    },
    status: 'Processed',
    weight: 5.3
  },
  {
    id: 'scan-006',
    bagId: 'TD-ELE-M-007',
    batchId: 'batch-005',
    scannedAt: '2025-06-15T11:05:00Z',
    scannedBy: 'collector1@trashdrop.com',
    location: {
      lat: 37.7841,
      lng: -122.4088,
      address: '350 Mission St, San Francisco, CA'
    },
    status: 'Collected',
    weight: 6.2
  }
];

// Helper function to generate QR codes for a batch
export const generateQRCodes = (batchId, quantity, prefix) => {
  const qrCodes = [];
  for (let i = 1; i <= quantity; i++) {
    const qrId = `${prefix}-${String(i).padStart(3, '0')}`;
    qrCodes.push({
      id: qrId,
      batchId,
      url: `https://trashdrop.com/bag/${qrId}`,
      createdAt: new Date().toISOString(),
      status: 'Active'
    });
  }
  return qrCodes;
};

// Helper function to generate a new batch
export const generateNewBatch = (type, size, quantity, createdBy) => {
  const typeMap = {
    'Recyclable': 'REC',
    'Organic': 'ORG',
    'Hazardous': 'HAZ',
    'Electronic': 'ELE',
    'Other': 'OTH'
  };
  
  const sizeMap = {
    'Small': 'S',
    'Medium': 'M',
    'Large': 'L'
  };
  
  const prefix = `TD-${typeMap[type]}-${sizeMap[size]}`;
  const batchId = `batch-${Math.random().toString(36).substring(2, 8)}`;
  
  const newBatch = {
    id: batchId,
    createdAt: new Date().toISOString(),
    createdBy,
    quantity,
    type,
    size,
    status: 'Active',
    distributed: 0,
    scanned: 0,
    qrPrefix: prefix
  };
  
  const qrCodes = generateQRCodes(batchId, quantity, prefix);
  
  return { batch: newBatch, qrCodes };
};
