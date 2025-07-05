import React, { useState, useEffect } from 'react';
import { fetchMobileAppDumpingReports, verifyDumpingReport, assignDumpingCleaner, fetchCollectors } from '../utils/databaseUtils';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';
import ImageGalleryModal from './common/ImageGalleryModal';

/**
 * @component MobileReportsVerification
 * @description A component for verifying and processing mobile app submitted dumping reports.
 * Provides functionality to view report details, verify reports, view attached images in a gallery,
 * and assign cleaners to verified reports. Supports real-time status updates and error handling.
 * 
 * @param {Object} props - Component properties
 * @param {Function} props.onReportVerified - Callback function triggered when a report is successfully verified or assigned
 *                                          Used to refresh parent component data
 * 
 * @example
 * // Basic usage in a parent component
 * const refreshIllegalDumpingData = () => {
 *   // reload data
 * };
 * 
 * <MobileReportsVerification onReportVerified={refreshIllegalDumpingData} />
 */
const MobileReportsVerification = ({ onReportVerified }) => {
  /** @state {Array} reports - List of mobile app submitted dumping reports pending verification */
  const [reports, setReports] = useState([]);
  /** @state {boolean} loading - Loading state for reports data */
  const [loading, setLoading] = useState(true);
  /** @state {string|null} error - Error message if any operation fails */
  const [error, setError] = useState(null);
  /** @state {Object} user - Current authenticated user from AuthContext */
  const { user } = useAuth();
  /** @state {string|null} processingId - ID of report currently being processed (for UI feedback) */
  const [processingId, setProcessingId] = useState(null);
  /** @state {boolean} showGallery - Controls visibility of the image gallery modal */
  const [showGallery, setShowGallery] = useState(false);
  /** @state {Array<string>} currentImages - URLs of images to display in the gallery */
  const [currentImages, setCurrentImages] = useState([]);
  /** @state {boolean} showAssignModal - Controls visibility of the cleaner assignment modal */
  const [showAssignModal, setShowAssignModal] = useState(false);
  /** @state {string|null} currentReportId - ID of the report being assigned */
  const [currentReportId, setCurrentReportId] = useState(null);
  /** @state {Array} collectors - List of available collectors/cleaners */
  const [collectors, setCollectors] = useState([]);
  /** @state {boolean} loadingCollectors - Loading state for collectors data */
  const [loadingCollectors, setLoadingCollectors] = useState(false);
  /** @state {string} selectedCollector - ID of selected collector for assignment */
  const [selectedCollector, setSelectedCollector] = useState('');
  /** @state {string} scheduledDate - Selected cleanup date for assignment */
  const [scheduledDate, setScheduledDate] = useState('');
  /** @state {string} assignmentNotes - Optional notes for cleaner assignment */
  const [assignmentNotes, setAssignmentNotes] = useState('');
  /** @state {Object} verifiedReports - Map of verified reports keyed by report ID */
  const [verifiedReports, setVerifiedReports] = useState({});

  /**
   * Load reports on component mount
   */
  useEffect(() => {
    loadReports();
  }, []);
  
  /**
   * Load available collectors when the assignment modal is opened
   */
  useEffect(() => {
    if (showAssignModal) {
      loadCollectors();
    }
  }, [showAssignModal]);
  
  /**
   * Fetch active collectors from the database
   * @async
   * @function loadCollectors
   * @returns {Promise<void>}
   */
  const loadCollectors = async () => {
    try {
      setLoadingCollectors(true);
      const collectorsData = await fetchCollectors('Active');
      setCollectors(collectorsData);
    } catch (err) {
      toast.error('Failed to load collectors: ' + err.message);
      setError('Failed to load collectors: ' + err.message);
    } finally {
      setLoadingCollectors(false);
    }
  };

  /**
   * Fetch mobile app submitted reports with 'reported' status from the database
   * @async
   * @function loadReports
   * @returns {Promise<void>}
   */
  const loadReports = async () => {
    try {
      setLoading(true);
      const data = await fetchMobileAppDumpingReports('reported');
      setReports(data);
      setError(null);
    } catch (err) {
      setError('Failed to load reports: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Verify a dumping report and create a task
   * @async
   * @function handleVerify
   * @param {string} reportId - ID of the report to verify
   * @returns {Promise<void>}
   */
  const handleVerify = async (reportId) => {
    try {
      setProcessingId(reportId);
      const verifiedReport = await verifyDumpingReport(reportId, user.id, 'Verified via admin portal');
      toast.success('Report verified and task created successfully');
      
      // Save the verified report for possible assignment
      setVerifiedReports(prev => ({
        ...prev,
        [reportId]: verifiedReport
      }));
      
      // Refresh the list after verification
      loadReports();
      
      // Notify parent component that a report was verified
      if (onReportVerified) {
        onReportVerified(verifiedReport);
      }
    } catch (err) {
      toast.error('Failed to verify report: ' + err.message);
      setError('Failed to verify report: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };
  
  /**
   * Open the assignment modal for a verified report
   * @function handleAssign
   * @param {string} reportId - ID of the report to assign a cleaner to
   */
  const handleAssign = (reportId) => {
    setCurrentReportId(reportId);
    setSelectedCollector('');
    setScheduledDate('');
    setAssignmentNotes('');
    setShowAssignModal(true);
  };
  
  /**
   * Submit cleaner assignment for a verified report
   * Validates required fields and assigns the selected cleaner to the dumping report
   * @async
   * @function handleSubmitAssignment
   * @returns {Promise<void>}
   */
  const handleSubmitAssignment = async () => {
    if (!selectedCollector) {
      toast.error('Please select a collector');
      return;
    }
    
    if (!scheduledDate) {
      toast.error('Please select a cleanup date');
      return;
    }
    
    try {
      setProcessingId('assign-' + currentReportId);
      
      // Get the illegal_dumping ID from the verified report
      const illegalDumpingId = verifiedReports[currentReportId]?.id;
      
      if (!illegalDumpingId) {
        throw new Error('Could not find the verified report');
      }
      
      await assignDumpingCleaner(
        illegalDumpingId,
        selectedCollector,
        user.id,
        scheduledDate,
        assignmentNotes || 'Assigned via admin portal'
      );
      
      toast.success('Cleaner assigned successfully');
      setShowAssignModal(false);
      
      // Refresh reports
      loadReports();
      
      // Notify parent component about assignment
      if (onReportVerified) {
        onReportVerified();
      }
    } catch (err) {
      toast.error('Failed to assign cleaner: ' + err.message);
      setError('Failed to assign cleaner: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  /**
   * Open the image gallery modal to view report images
   * @function handleViewImages
   * @param {Array<string>} images - Array of image URLs to display in the gallery
   */
  const handleViewImages = (images) => {
    setCurrentImages(images);
    setShowGallery(true);
  };

  return (
    <div className="bg-white shadow rounded-lg p-4 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Mobile App Reports Pending Verification</h2>
        <button 
          onClick={loadReports}
          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded flex items-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>
      
      {loading && <p className="text-gray-500">Loading reports...</p>}
      {error && <p className="text-red-500 p-2 bg-red-50 rounded">{error}</p>}
      
      {reports.length === 0 && !loading ? (
        <p className="text-gray-500 italic">No pending reports to verify.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reporter</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Waste Type</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reported On</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Images</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reports.map(report => (
                <tr key={report.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 whitespace-nowrap">
                    {report.profiles?.first_name || 'Anonymous'} {report.profiles?.last_name || ''}
                    {report.is_anonymous && <span className="ml-1 text-xs bg-gray-200 px-1 rounded">Anonymous</span>}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {report.address || `${report.latitude.toFixed(4)}, ${report.longitude.toFixed(4)}`}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                      {report.waste_type}
                    </span>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">{report.approximate_size}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {new Date(report.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {report.images && report.images.length > 0 ? (
                      <button 
                        onClick={() => handleViewImages(report.images)}
                        className="text-blue-500 hover:text-blue-700"
                      >
                        View {report.images.length} {report.images.length === 1 ? 'image' : 'images'}
                      </button>
                    ) : (
                      <span className="text-gray-400">No images</span>
                    )}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap flex space-x-2">
                    {verifiedReports[report.id] ? (
                      <button
                        onClick={() => handleAssign(report.id)}
                        disabled={processingId === 'assign-' + report.id}
                        className={`${
                          processingId === 'assign-' + report.id
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-purple-500 hover:bg-purple-600'
                        } text-white px-3 py-1 rounded flex items-center`}
                      >
                        {processingId === 'assign-' + report.id ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Assigning
                          </>
                        ) : (
                          <>Assign Cleaner</>
                        )}
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleVerify(report.id)}
                        disabled={processingId === report.id}
                        className={`${
                          processingId === report.id 
                            ? 'bg-gray-400 cursor-not-allowed' 
                            : 'bg-green-500 hover:bg-green-600'
                        } text-white px-3 py-1 rounded flex items-center`}
                      >
                        {processingId === report.id ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Processing
                          </>
                        ) : (
                          <>Verify</>
                        )}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Image Gallery Modal */}
      <ImageGalleryModal 
        images={currentImages} 
        isOpen={showGallery} 
        onClose={() => setShowGallery(false)} 
      />
      
      {/* Assignment Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setShowAssignModal(false)}></div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-purple-100 sm:mx-0 sm:h-10 sm:w-10">
                    <svg className="h-6 w-6 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">Assign Cleaner</h3>
                    <div className="mt-4">
                      <form>
                        <div className="mb-4">
                          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="collector">
                            Select Collector
                          </label>
                          <select
                            id="collector"
                            value={selectedCollector}
                            onChange={(e) => setSelectedCollector(e.target.value)}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            disabled={loadingCollectors}
                          >
                            <option value="">-- Select a collector --</option>
                            {collectors.map(collector => (
                              <option key={collector.id} value={collector.id}>
                                {collector.first_name} {collector.last_name} - {collector.region || 'No region'}
                              </option>
                            ))}
                          </select>
                          {loadingCollectors && <p className="text-xs text-gray-500 mt-1">Loading collectors...</p>}
                        </div>
                        <div className="mb-4">
                          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="date">
                            Scheduled Cleanup Date
                          </label>
                          <input
                            id="date"
                            type="date"
                            value={scheduledDate}
                            onChange={(e) => setScheduledDate(e.target.value)}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            min={new Date().toISOString().split('T')[0]}
                          />
                        </div>
                        <div className="mb-4">
                          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="notes">
                            Notes (Optional)
                          </label>
                          <textarea
                            id="notes"
                            value={assignmentNotes}
                            onChange={(e) => setAssignmentNotes(e.target.value)}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            rows="3"
                            placeholder="Add any special instructions or notes for the cleaner"
                          />
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleSubmitAssignment}
                  disabled={processingId === 'assign-' + currentReportId}
                  className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 ${processingId ? 'bg-gray-400' : 'bg-purple-600 hover:bg-purple-700'} text-base font-medium text-white focus:outline-none sm:ml-3 sm:w-auto sm:text-sm`}
                >
                  {processingId === 'assign-' + currentReportId ? 'Processing...' : 'Assign Cleaner'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileReportsVerification;
