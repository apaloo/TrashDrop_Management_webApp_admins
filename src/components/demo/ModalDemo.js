import React from 'react';
import { useModal } from '../../context/ModalContext';

/**
 * Demo component showing how to use the modal system
 * This component demonstrates how to open each type of modal from any page
 */
const ModalDemo = () => {
  const { openModal } = useModal();

  // Mock data for demos
  const mockCollector = {
    id: 1,
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '555-123-4567',
    region: 'North',
    status: 'Active',
    vehicleType: 'Van',
    vehicleId: 'TD-VAN-001',
    joinDate: '2023-08-15',
    collectionsCount: 245,
    rating: 4.9,
    onTimeRate: '98%',
    capacity: '200kg',
    lastMaintenance: '2025-05-15T09:00:00Z',
    recentActivity: [
      {
        type: 'collection',
        description: 'Completed pickup at Downtown mall',
        timestamp: '2025-06-22T14:30:00Z'
      },
      {
        type: 'delivery',
        description: 'Delivered 8 bags to processing center',
        timestamp: '2025-06-22T15:45:00Z'
      },
      {
        type: 'maintenance',
        description: 'Vehicle check-in at depot',
        timestamp: '2025-06-21T18:00:00Z'
      }
    ],
    notes: 'Excellent collector, very reliable and consistently meets targets.'
  };

  const mockScanHistory = [
    {
      id: 1,
      status: 'Scanned',
      timestamp: '2025-06-22T09:15:00Z',
      collectorName: 'John Doe',
      location: 'Downtown Mall',
      deviceId: 'TD-DEVICE-123',
      source: 'Mobile App',
      notes: 'Bag scanned at pickup point'
    },
    {
      id: 2,
      status: 'Collected',
      timestamp: '2025-06-22T09:30:00Z',
      collectorName: 'John Doe',
      location: 'Downtown Mall',
      deviceId: 'TD-DEVICE-123',
      source: 'Mobile App',
      notes: 'Bag collected from bin'
    },
    {
      id: 3,
      status: 'Delivered',
      timestamp: '2025-06-22T11:45:00Z',
      collectorName: 'John Doe',
      location: 'Processing Center',
      deviceId: 'TD-DEVICE-123',
      source: 'Scanner',
      notes: 'Delivered to processing center'
    },
    {
      id: 4,
      status: 'Processed',
      timestamp: '2025-06-22T14:20:00Z',
      collectorName: 'Processing Staff',
      location: 'Processing Center',
      deviceId: 'TD-DEVICE-456',
      source: 'Processing System',
      notes: 'Bag contents sorted and processed'
    }
  ];

  const mockQrData = {
    id: 'TD-BAG-1234',
    prefix: 'TD-',
    description: 'Trash collection bag for Downtown area',
    qrImageUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=TD-BAG-1234'
  };

  // Handler functions
  const handleSaveCollector = (updatedCollector) => {
    console.log('Collector saved:', updatedCollector);
    // In a real app, this would update the backend
  };

  const handleConfirmDelete = () => {
    console.log('Confirmed deletion');
    // In a real app, this would delete the item
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-xl font-semibold mb-4">Modal System Demo</h2>
      <p className="text-gray-600 mb-6">
        Click the buttons below to test the different modals available in the system.
        These modals can be triggered from anywhere in the application.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* QR Code Modal */}
        <div className="p-4 border rounded-lg">
          <h3 className="font-medium mb-2">QR Code Modal</h3>
          <p className="text-sm text-gray-500 mb-3">
            Displays a QR code with download and print options
          </p>
          <button
            onClick={() => openModal('qrCode', mockQrData)}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Show QR Code
          </button>
        </div>
        
        {/* Confirmation Modal */}
        <div className="p-4 border rounded-lg">
          <h3 className="font-medium mb-2">Confirmation Modal</h3>
          <p className="text-sm text-gray-500 mb-3">
            Asks for confirmation before proceeding
          </p>
          <button
            onClick={() => openModal('confirmation', {
              title: 'Delete Batch',
              message: 'Are you sure you want to delete this batch? This action cannot be undone.',
              confirmText: 'Delete',
              cancelText: 'Cancel',
              type: 'danger',
              onConfirm: handleConfirmDelete
            })}
            className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Delete Item
          </button>
        </div>
        
        {/* Scan History Modal */}
        <div className="p-4 border rounded-lg">
          <h3 className="font-medium mb-2">Scan History Modal</h3>
          <p className="text-sm text-gray-500 mb-3">
            Shows timeline of bag scans
          </p>
          <button
            onClick={() => openModal('scanHistory', {
              bagId: 'TD-BAG-1234',
              scanHistory: mockScanHistory
            })}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            View Scan History
          </button>
        </div>
        
        {/* Collector Profile Modal */}
        <div className="p-4 border rounded-lg">
          <h3 className="font-medium mb-2">Collector Profile Modal</h3>
          <p className="text-sm text-gray-500 mb-3">
            View and edit collector details
          </p>
          <button
            onClick={() => openModal('collectorProfile', {
              collector: mockCollector,
              onSave: handleSaveCollector
            })}
            className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            View Collector
          </button>
        </div>
        
        {/* Notifications Modal */}
        <div className="p-4 border rounded-lg">
          <h3 className="font-medium mb-2">Notifications Modal</h3>
          <p className="text-sm text-gray-500 mb-3">
            Shows system notifications with filters
          </p>
          <button
            onClick={() => openModal('notifications')}
            className="w-full px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
          >
            Open Notifications
          </button>
        </div>
        
        {/* Messages Modal */}
        <div className="p-4 border rounded-lg">
          <h3 className="font-medium mb-2">Messages Modal</h3>
          <p className="text-sm text-gray-500 mb-3">
            Chat interface with contacts
          </p>
          <button
            onClick={() => openModal('messages')}
            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Open Messages
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalDemo;
