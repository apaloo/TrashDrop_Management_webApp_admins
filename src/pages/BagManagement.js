import React, { useState, useEffect } from 'react';
import { bagBatches, generateNewBatch } from '../mock/bags';
import { useAuth } from '../context/AuthContext';

const BagManagement = () => {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    type: 'Recyclable',
    size: 'Medium',
    quantity: 50
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  
  const { user } = useAuth();

  useEffect(() => {
    // Simulate API call with timeout
    setTimeout(() => {
      setBatches(bagBatches);
      setLoading(false);
    }, 1000);
  }, []);

  const handleCreateBatch = (e) => {
    e.preventDefault();
    const { batch, qrCodes } = generateNewBatch(
      formData.type,
      formData.size,
      parseInt(formData.quantity),
      user?.email || 'admin@trashdrop.com'
    );
    
    setBatches([batch, ...batches]);
    setShowModal(false);
    setFormData({
      type: 'Recyclable',
      size: 'Medium',
      quantity: 50
    });
    
    // In a real app, you would save the batch and QR codes to the database
    console.log('Generated QR Codes:', qrCodes);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleViewDetails = (batch) => {
    setSelectedBatch(batch);
  };

  const filteredBatches = batches
    .filter(batch => {
      if (filterStatus !== 'All') {
        return batch.status === filterStatus;
      }
      return true;
    })
    .filter(batch => {
      if (searchTerm) {
        return (
          batch.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          batch.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
          batch.qrPrefix.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      return true;
    });

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Bag Management</h1>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          Create New Batch
        </button>
      </div>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Live Bag Requests KPI */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium text-gray-700 mb-2">Live Bag Requests</h3>
          <div className="flex items-center justify-between">
            <div className="text-3xl font-bold text-green-600">12</div>
            <div className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded">+3 today</div>
          </div>
          <div className="text-sm text-gray-500 mt-2">4 pending collection</div>
          <div className="h-1 w-full bg-gray-200 mt-3">
            <div className="h-1 bg-green-500" style={{width: '75%'}}></div>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-gray-500">8 collected</span>
            <span className="text-xs text-gray-500">4 awaiting</span>
          </div>
        </div>
        
        {/* Collector Status KPI */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium text-gray-700 mb-2">Collector Status</h3>
          <div className="flex items-center justify-between">
            <div className="text-3xl font-bold text-blue-600">8/10</div>
            <div className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">80% Active</div>
          </div>
          <div className="text-sm text-gray-500 mt-2">2 collectors inactive</div>
          <div className="mt-3 flex justify-between">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Active: 8
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
              Inactive: 2
            </span>
          </div>
        </div>
        
        {/* Performance Timeline KPI */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium text-gray-700 mb-2">Performance Timeline</h3>
          <div className="flex items-center justify-between">
            <div className="text-3xl font-bold text-indigo-600">85%</div>
            <div className="text-sm bg-indigo-100 text-indigo-800 px-2 py-1 rounded">+5% from last week</div>
          </div>
          <div className="text-sm text-gray-500 mt-2">Avg. collection time: 28 min</div>
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Response Time</span>
              <span>12 min</span>
            </div>
            <div className="h-1 w-full bg-gray-200">
              <div className="h-1 bg-indigo-500" style={{width: '85%'}}></div>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <div className="w-full md:w-1/2">
          <input
            type="text"
            placeholder="Search by ID, type or QR prefix..."
            className="w-full p-2 border border-gray-300 rounded-lg"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="w-full md:w-1/4">
          <select
            className="w-full p-2 border border-gray-300 rounded-lg"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Batch ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created At
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type & Size
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Distribution
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredBatches.map((batch) => (
                <tr key={batch.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {batch.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(batch.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {batch.type} ({batch.size})
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {batch.quantity}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      batch.status === 'Active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {batch.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className="bg-green-600 h-2.5 rounded-full" 
                        style={{ width: `${(batch.distributed / batch.quantity) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-xs mt-1 block">
                      {batch.distributed} of {batch.quantity} distributed
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center">
                    <button
                      onClick={() => handleViewDetails(batch)}
                      className="text-indigo-600 hover:text-indigo-900 mr-3"
                    >
                      View
                    </button>
                    <button className="text-green-600 hover:text-green-900 mr-3">
                      Print QR
                    </button>
                    {batch.status === 'Active' ? (
                      <button className="text-red-600 hover:text-red-900">
                        Deactivate
                      </button>
                    ) : (
                      <button className="text-green-600 hover:text-green-900">
                        Activate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Batch Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Create New Bag Batch</h2>
            <form onSubmit={handleCreateBatch}>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Type
                </label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded"
                  required
                >
                  <option value="Recyclable">Recyclable</option>
                  <option value="Organic">Organic</option>
                  <option value="Hazardous">Hazardous</option>
                  <option value="Electronic">Electronic</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Size
                </label>
                <select
                  name="size"
                  value={formData.size}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded"
                  required
                >
                  <option value="Small">Small</option>
                  <option value="Medium">Medium</option>
                  <option value="Large">Large</option>
                </select>
              </div>
              
              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Quantity
                </label>
                <input
                  type="number"
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded"
                  min="1"
                  max="1000"
                  required
                />
              </div>
              
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Create Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch Details Modal */}
      {selectedBatch && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Batch Details: {selectedBatch.id}</h2>
              <button 
                onClick={() => setSelectedBatch(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                &times;
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-gray-600 text-sm">Created At</p>
                <p className="font-medium">{new Date(selectedBatch.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Created By</p>
                <p className="font-medium">{selectedBatch.createdBy}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Type</p>
                <p className="font-medium">{selectedBatch.type}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Size</p>
                <p className="font-medium">{selectedBatch.size}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">QR Prefix</p>
                <p className="font-medium">{selectedBatch.qrPrefix}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Status</p>
                <p className={`font-medium ${
                  selectedBatch.status === 'Active' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {selectedBatch.status}
                </p>
              </div>
            </div>
            
            <div className="mb-6">
              <h3 className="font-medium mb-2">Distribution Status</h3>
              <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                <div 
                  className="bg-green-600 h-2.5 rounded-full" 
                  style={{ width: `${(selectedBatch.distributed / selectedBatch.quantity) * 100}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>{selectedBatch.distributed} distributed</span>
                <span>{selectedBatch.scanned} scanned</span>
                <span>{selectedBatch.quantity} total</span>
              </div>
            </div>
            
            <div className="flex justify-end space-x-2">
              <button
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                Print QR Codes
              </button>
              <button
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
                onClick={() => setSelectedBatch(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BagManagement;
