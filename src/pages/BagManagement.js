import React, { useState, useEffect, useRef, useCallback } from 'react';
import { saveAs } from 'file-saver';
import { useAuth } from '../context/AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import { 
  fetchBagBatches, 
  createBagBatch, 
  fetchBagRequestStatsReal, 
  fetchCollectorStatsReal, 
  fetchPerformanceStatsReal 
} from '../utils/databaseUtils';
import { STATUS } from '../config/constants';
import { appConfig } from '../config';
import { archiveBagBatch } from '../utils/databaseUtils';

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
  
  // Stats state variables for live data
  const [bagRequestStats, setBagRequestStats] = useState({
    total: 0,
    pending: 0,
    collected: 0,
    awaiting: 0,
    weeklyChange: 0,
    dailyTrend: [0,0,0,0,0,0,0],
    dayLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    todayChange: 0,
    avgDailyRequests: 0
  });
  
  const [collectorStats, setCollectorStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    regions: 0,
    lastUpdated: new Date()
  });
  
  const [performanceStats, setPerformanceStats] = useState({
    overall: 0,
    responseTime: 0,
    collectionTime: 0,
    completionRate: 0,
    scanAccuracy: 0,
    monthlyChange: 0,
    changeInterval: 'week'
  });
  
  const [statsLoading, setStatsLoading] = useState(true);
  
  const { user } = useAuth();

  // QR ZIP download state and worker
  const [isWorkerReady, setIsWorkerReady] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadingBatch, setDownloadingBatch] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState({ progress: 0, stage: 'Preparing...', isProcessing: false, showProgress: false });
  const workerRef = useRef(null);

  const handleWorkerError = useCallback((message) => {
    console.error('QR Code Worker Error:', message);
    setDownloadProgress(prev => ({ ...prev, isProcessing: false }));
    setIsDownloading(false);
    alert(message || 'Failed to generate QR ZIP');
  }, []);

  const initWorker = useCallback(() => {
    try {
      const worker = new Worker(new URL('../workers/QRCodeWorker.js', import.meta.url), { type: 'module' });
      worker.postMessage({ type: 'WORKER_READY' });

      worker.onmessage = (e) => {
        const { type, progress, stage, content, filename, error } = e.data || {};
        if (type === 'WORKER_READY') {
          setIsWorkerReady(true);
          return;
        }
        if (type === 'PROGRESS') {
          setDownloadProgress(prev => ({ ...prev, progress, stage: stage || prev.stage, isProcessing: progress < 100 }));
          return;
        }
        if (type === 'CHUNKS_READY') {
          workerRef.current?.postMessage({
            type: 'CREATE_ZIP',
            payload: {
              chunks: e.data.chunks,
              batch: { id: downloadingBatch },
              baseUrl: 'https://trashdrops.com/scan',
              email: user?.email || 'admin@trashdrop.com'
            }
          });
          return;
        }
        if (type === 'ZIP_READY') {
          try {
            const safeFilename = (filename && filename.endsWith('.zip')) ? filename : `QR_Codes_${downloadingBatch || 'batch'}.zip`;
            // Use Blob directly if provided; otherwise wrap Uint8Array
            const blob = (content instanceof Blob)
              ? content
              : new Blob([content], { type: 'application/zip' });
            saveAs(blob, safeFilename);
            setDownloadProgress(prev => ({ ...prev, progress: 100, stage: 'Download complete!', isProcessing: false }));
          } catch (err) {
            handleWorkerError('Failed to save the ZIP file');
          } finally {
            setIsDownloading(false);
          }
          return;
        }
        if (type === 'ERROR') {
          handleWorkerError(error || 'An error occurred while generating QR codes');
          return;
        }
      };

      worker.onerror = (err) => {
        console.error('Worker error:', err);
        handleWorkerError('Failed to initialize QR code generator');
      };

      workerRef.current = worker;
    } catch (err) {
      console.error('Error initializing worker:', err);
      handleWorkerError('Failed to initialize QR code generator');
    }
  }, [downloadingBatch, handleWorkerError]);

  useEffect(() => {
    initWorker();
    return () => {
      if (workerRef.current) workerRef.current.terminate();
    };
  }, [initWorker]);

  const handleDownloadQRs = async (batch) => {
    try {
      if (!isWorkerReady) {
        alert('QR code generator is not ready yet');
        return;
      }
      setDownloadingBatch(batch.id);
      setIsDownloading(true);
      setDownloadProgress({ progress: 0, stage: 'Preparing...', isProcessing: true, showProgress: true });

      // Ensure required fields for worker
      const payloadBatch = {
        id: batch.id,
        bag_count: batch.bag_count || batch.quantity || 0,
        quantity: batch.bag_count || batch.quantity || 0,
        startNumber: 1
      };

      // small delay to ensure worker is ready
      await new Promise(r => setTimeout(r, 50));

      workerRef.current.postMessage({
        type: 'GENERATE_QR_CODES',
        payload: {
          batch: payloadBatch,
          email: user?.email || 'admin@trashdrop.com',
          baseUrl: 'https://trashdrops.com/scan',
          chunkSize: 20
        }
      });
    } catch (err) {
      console.error('Error initiating QR download:', err);
      handleWorkerError(err.message || 'Failed to start QR code generation');
    }
  };

  // Function to fetch all dashboard statistics from Supabase
  const refreshStats = async () => {
    setStatsLoading(true);
    try {
      console.log('BagManagement: Starting fetch of live statistics...');
      
      // Fetch all stats in parallel for better performance
      const [bagStats, collectorData, performanceData] = await Promise.all([
        fetchBagRequestStatsReal(),
        fetchCollectorStatsReal(),
        fetchPerformanceStatsReal()
      ]);
      
      console.log('BagManagement: Stats fetched successfully:');
      console.log('BagManagement: Bag Stats:', bagStats);
      console.log('BagManagement: Collector Stats:', collectorData);
      console.log('BagManagement: Performance Stats:', performanceData);
      
      // Update state with fetched statistics
      setBagRequestStats(bagStats);
      setCollectorStats(collectorData);
      setPerformanceStats(performanceData);
      
    } catch (error) {
      console.error('BagManagement: Error fetching statistics:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    const loadBatches = async () => {
      setLoading(true);
      try {
        const response = await fetchBagBatches();
        // Handle the response structure properly - fetchBagBatches returns { data, totalCount, page, limit, totalPages }
        const batchData = response.data || [];
        
        // Transform from snake_case to camelCase if needed
        const formattedData = batchData.map(batch => ({
          id: batch.id,
          createdAt: batch.created_at || batch.updated_at,
          quantity: batch.bag_count || batch.quantity,
          bag_count: batch.bag_count || batch.quantity,
          type: batch.type,
          size: batch.size,
          status: batch.status,
          distributed: batch.distributed,
          scanned: batch.scanned,
          qrPrefix: batch.qr_prefix
        }));
        setBatches(formattedData);
      } catch (error) {
        console.error('Error loading bag batches:', error);
        // Set empty array as fallback
        setBatches([]);
      } finally {
        setLoading(false);
      }
    };
    
    // Load batches and fetch statistics
    loadBatches();
    refreshStats();
    
    // Set up an interval to refresh the stats periodically (every 5 minutes)
    const statsInterval = setInterval(refreshStats, 5 * 60 * 1000);
    
    // Clean up interval on component unmount
    return () => clearInterval(statsInterval);
  }, []);

  const handleCreateBatch = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Create batch in database
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
      
      const prefix = `TD-${typeMap[formData.type]}-${sizeMap[formData.size]}`;
      
      const batchData = {
        createdBy: user?.email || 'admin@trashdrop.com',
        quantity: parseInt(formData.quantity),
        type: formData.type,
        size: formData.size,
        qrPrefix: prefix
      };
      
      const { batch, qrCodes } = await createBagBatch(batchData);
      
      // Format the returned batch to match our frontend format
      const newBatch = {
        id: batch.id,
        createdAt: batch.created_at,
        quantity: batch.bag_count,
        type: batch.type,
        size: batch.size,
        status: batch.status,
        distributed: batch.distributed,
        scanned: batch.scanned,
        qrPrefix: batch.qr_prefix
      };
      
      // Add the new batch to the state
      setBatches([newBatch, ...batches]);
      setShowModal(false);
      setFormData({
        type: 'Recyclable',
        size: 'Medium',
        quantity: 50
      });
      
      console.log('Generated QR Codes:', qrCodes.length);
    } catch (error) {
      console.error('Error creating batch:', error);
      // You could add error handling UI here
    } finally {
      setLoading(false);
    }
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

  const handleArchiveBatch = async (batch) => {
    try {
      const confirmArchive = window.confirm(`Archive batch ${batch.id}? This will mark it as Archived.`);
      if (!confirmArchive) return;

      await archiveBagBatch(batch.id);
      // Optimistically update UI
      setBatches(prev => prev.map(b => b.id === batch.id ? { ...b, status: 'Archived' } : b));
    } catch (error) {
      console.error('Error archiving batch:', error);
      alert('Failed to archive batch. Please try again.');
    }
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
        const term = String(searchTerm || '').toLowerCase();
        const idStr = String(batch?.id ?? '').toLowerCase();
        const typeStr = String(batch?.type ?? '').toLowerCase();
        const prefixStr = String(batch?.qrPrefix ?? '').toLowerCase();
        return (
          idStr.includes(term) ||
          typeStr.includes(term) ||
          prefixStr.includes(term)
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
          {statsLoading ? (
            <div className="flex justify-center items-center h-24">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-green-500"></div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-green-600">{bagRequestStats.total || 0}</div>
                <div className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded">
                  {bagRequestStats.todayChange >= 0 ? '+' : ''}{bagRequestStats.todayChange || 0} today
                </div>
              </div>
              <div className="text-sm text-gray-500 mt-2">{bagRequestStats.pending || 0} pending collection</div>
              
              <div className="w-full bg-gray-200 h-1 mt-4">
                {/* Calculate width as percentage of collected bags from total */}
                <div 
                  className="bg-green-500 h-1" 
                  style={{
                    width: `${bagRequestStats.total > 0 ? 
                      (bagRequestStats.collected / bagRequestStats.total) * 100 : 0}%`
                  }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{bagRequestStats.collected || 0} collected</span>
                <span>{bagRequestStats.awaiting || 0} awaiting</span>
              </div>
            </>
          )}
        </div>
        
        {/* Collector Status KPI */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium text-gray-700 mb-2">Collector Status</h3>
          {statsLoading ? (
            <div className="flex justify-center items-center h-24">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-blue-600">{collectorStats.active || 0}/{collectorStats.total || 0}</div>
                <div className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  {collectorStats.total > 0 ? Math.round((collectorStats.active / collectorStats.total) * 100) : 0}% Active
                </div>
              </div>
              <div className="text-sm text-gray-500 mt-2">{collectorStats.inactive || 0} collectors inactive</div>
              <div className="mt-3 flex justify-between">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Active: {collectorStats.active || 0}
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  Inactive: {collectorStats.inactive || 0}
                </span>
              </div>
            </>
          )}
        </div>
        
        {/* Performance Timeline KPI */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium text-gray-700 mb-2">Performance Timeline</h3>
          {statsLoading ? (
            <div className="flex justify-center items-center h-24">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-indigo-600">{performanceStats.overall || 0}%</div>
                <div className="text-sm bg-indigo-100 text-indigo-800 px-2 py-1 rounded">
                  {performanceStats.monthlyChange >= 0 ? '+' : ''}{performanceStats.monthlyChange || 0}% from last {performanceStats.changeInterval || 'week'}
                </div>
              </div>
              <div className="text-sm text-gray-500 mt-2">Avg. collection time: {performanceStats.collectionTime || 0} min</div>
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Response Time</span>
                  <span>{performanceStats.responseTime || 0} min</span>
                </div>
                <div className="h-1 w-full bg-gray-200">
                  <div 
                    className="h-1 bg-indigo-500" 
                    style={{width: `${Math.min(100, ((performanceStats.responseTime || 0) / 60) * 100)}%`}}
                  ></div>
                </div>
              </div>
            </>
          )}
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
            <option value={STATUS.BAG.GENERATED.toString()}>{STATUS.BAG.GENERATED}</option>
            <option value={STATUS.BAG.DISTRIBUTED.toString()}>{STATUS.BAG.DISTRIBUTED}</option>
            <option value={STATUS.BAG.FILLED.toString()}>{STATUS.BAG.FILLED}</option>
            <option value={STATUS.BAG.COLLECTED.toString()}>{STATUS.BAG.COLLECTED}</option>
            <option value={STATUS.BAG.PROCESSED.toString()}>{STATUS.BAG.PROCESSED}</option>
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
                    {batch.bag_count || batch.quantity}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      batch.status === STATUS.BAG.GENERATED || batch.status === STATUS.BAG.DISTRIBUTED
                        ? 'bg-green-100 text-green-800'
                        : batch.status === STATUS.BAG.FILLED
                          ? 'bg-blue-100 text-blue-800'
                          : batch.status === STATUS.BAG.COLLECTED
                            ? 'bg-yellow-100 text-yellow-800'
                            : batch.status === STATUS.BAG.PROCESSED
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-red-100 text-red-800'
                    }`}>
                      {batch.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className="bg-green-600 h-2.5 rounded-full" 
                        style={{ width: `${(batch.distributed / (batch.bag_count || batch.quantity)) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-xs mt-1 block">
                      {batch.distributed} of {batch.bag_count || batch.quantity} distributed
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center">
                    <button
                      onClick={() => handleViewDetails(batch)}
                      className="text-indigo-600 hover:text-indigo-900 mr-3"
                    >
                      View
                    </button>
                    <button onClick={() => handleDownloadQRs(batch)} className="text-green-600 hover:text-green-900 mr-3">
                      Download QRs
                    </button>
                    {batch.status === STATUS.BAG.GENERATED ? (
                      <button className="text-blue-600 hover:text-blue-900">
                        Distribute
                      </button>
                    ) : batch.status === STATUS.BAG.DISTRIBUTED ? (
                      <button className="text-yellow-600 hover:text-yellow-900">
                        Mark Filled
                      </button>
                    ) : batch.status === STATUS.BAG.FILLED ? (
                      <button className="text-purple-600 hover:text-purple-900">
                        Collect
                      </button>
                    ) : batch.status === STATUS.BAG.COLLECTED ? (
                      <button className="text-green-600 hover:text-green-900">
                        Process
                      </button>
                    ) : (
                      <>
                        {batch.status === 'Archived' ? (
                          <span className="text-gray-500">Archived</span>
                        ) : (
                          <button
                            onClick={() => handleArchiveBatch(batch)}
                            className="text-gray-600 hover:text-gray-900"
                          >
                            Archive
                          </button>
                        )}
                      </>
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
                  selectedBatch.status === STATUS.BAG.GENERATED
                    ? 'text-green-600'
                    : selectedBatch.status === STATUS.BAG.DISTRIBUTED
                      ? 'text-blue-600'
                      : selectedBatch.status === STATUS.BAG.FILLED
                        ? 'text-yellow-600'
                        : selectedBatch.status === STATUS.BAG.COLLECTED
                          ? 'text-purple-600'
                          : selectedBatch.status === STATUS.BAG.PROCESSED
                            ? 'text-indigo-600'
                            : 'text-red-600'
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
                  style={{ width: `${(selectedBatch.distributed / (selectedBatch.bag_count || selectedBatch.quantity)) * 100}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>{selectedBatch.distributed} distributed</span>
                <span>{selectedBatch.scanned} scanned</span>
                <span>{selectedBatch.bag_count || selectedBatch.quantity} total</span>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="font-medium mb-2">Batch QR Code</h3>
              <div className="flex items-start gap-4">
                <div className="p-3 bg-white border rounded-md inline-block">
                  <QRCodeSVG
                    value={`https://trashdrops.com/scan?batch=${encodeURIComponent(selectedBatch.id)}`}
                    size={192}
                    includeMargin={true}
                  />
                </div>
                <div className="text-sm text-gray-600 break-all">
                  <div className="font-medium mb-1">Scan URL</div>
                  <a
                    href={`https://trashdrops.com/scan?batch=${encodeURIComponent(selectedBatch.id)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 hover:underline"
                  >
                    {`https://trashdrops.com/scan?batch=${encodeURIComponent(selectedBatch.id)}`}
                  </a>
                </div>
              </div>
            </div>

            {/* Info note about QR code regeneration */}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                <strong>💡 Tip:</strong> QR codes are always generated with the latest settings (600×700px, optimized for printing). 
                Click "Regenerate & Download" to get fresh QR codes with the current enhanced size.
              </p>
            </div>

            <div className="flex justify-end space-x-2 mt-4">
              <button
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                onClick={() => handleDownloadQRs(selectedBatch)}
                title="Regenerate QR codes with new larger size and download"
              >
                🔄 Regenerate & Download
              </button>
              <button
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                onClick={() => handleDownloadQRs(selectedBatch)}
              >
                Download QRs
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

      {/* Download Progress Modal */}
      {downloadProgress.showProgress && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Generating QR Codes</h3>
            </div>
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>{downloadProgress.stage}</span>
                <span>{Math.round(downloadProgress.progress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out" style={{ width: `${downloadProgress.progress}%` }}></div>
              </div>
            </div>
            <div className="text-sm text-gray-500 text-center">
              {downloadProgress.progress < 100 ? (
                <>
                  <p>Generating enhanced QR codes (600×700px)...</p>
                  <p className="mt-1">Please wait while we prepare your download.</p>
                </>
              ) : (
                <>
                  <p className="text-green-600 font-medium">✓ Download complete!</p>
                  <p className="mt-1">The file should start downloading shortly.</p>
                </>
              )}
            </div>

            {/* Close button for dismissing the prompt */}
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setDownloadProgress(prev => ({ ...prev, showProgress: false }))}
                className={`px-4 py-2 text-sm rounded-md border ${downloadProgress.isProcessing ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300'}`}
                disabled={downloadProgress.isProcessing}
                aria-label="Close download prompt"
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
