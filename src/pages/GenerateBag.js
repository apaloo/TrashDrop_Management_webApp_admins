import React, { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faQrcode, 
  faCheck, 
  faExclamationTriangle, 
  faMagic, 
  faSpinner, 
  faDownload,
  faTimes
} from '@fortawesome/free-solid-svg-icons';
import { generateNewBatch } from '../mock/bags';
import { saveAs } from 'file-saver';

const GenerateBag = () => {
  // State for form values
  const [formData, setFormData] = useState({
    trashType: 'Organic',
    bagSize: 'Medium',
    numberOfBags: 50,
    numberOfBatches: 1
  });
  
  // State for generated batches
  const [generatedBatches, setGeneratedBatches] = useState([]);
  
  // State for loading and errors
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadingBatch, setDownloadingBatch] = useState(null);
  const [error, setError] = useState(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewQR, setPreviewQR] = useState(null);
  const [isWorkerReady, setIsWorkerReady] = useState(false);
  const [workerError, setWorkerError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;
  const qrCodeRefs = useRef({});
  const workerRef = useRef(null);

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Validate numeric inputs
    if (name === 'numberOfBags') {
      const numValue = parseInt(value, 10);
      if (isNaN(numValue) || numValue < 1) return;
      if (numValue > 1000) return;
      setFormData({ ...formData, [name]: numValue });
    } else if (name === 'numberOfBatches') {
      const numValue = parseInt(value, 10);
      if (isNaN(numValue) || numValue < 1) return;
      if (numValue > 10) return;
      setFormData({ ...formData, [name]: numValue });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  // State for download progress
  const [downloadProgress, setDownloadProgress] = useState({
    progress: 0,
    stage: 'Preparing...',
    isProcessing: false,
    showProgress: false
  });

  // Initialize Web Worker with retry mechanism
  const initWorker = useCallback(() => {
    try {
      // Use the Worker constructor with import.meta.url to load the worker as a module
      const worker = new Worker(new URL('../workers/QRCodeWorker.js', import.meta.url), {
        type: 'module'
      });
      
      // Handle worker ready state
      worker.postMessage({ type: 'WORKER_READY' });
      
      worker.onmessage = (e) => {
        const { type, progress, stage, chunks, content, filename, error } = e.data;
        
        if (type === 'WORKER_READY') {
          setIsWorkerReady(true);
          setWorkerError(null);
        } else if (type === 'PROGRESS') {
          setDownloadProgress(prev => ({
            ...prev,
            progress,
            stage: stage || prev.stage,
            isProcessing: progress < 100
          }));
        } else if (type === 'CHUNKS_READY') {
          // Start creating ZIP with the chunks
          workerRef.current.postMessage({
            type: 'CREATE_ZIP',
            payload: {
              chunks: e.data.chunks,
              batch: downloadingBatch
            }
          });
        } else if (type === 'ZIP_READY') {
          console.log('ZIP_READY received, starting download...');
          try {
            // Ensure the filename ends with .zip
            const safeFilename = filename.endsWith('.zip') ? filename : `${filename}.zip`;
            
            try {
              // Convert Uint8Array to Blob
              const blob = new Blob([content], { type: 'application/zip' });
              
              // Create object URL and trigger download
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.style.display = 'none';
              a.href = url;
              a.download = safeFilename;
              document.body.appendChild(a);
              a.click();
              
              // Clean up
              window.URL.revokeObjectURL(url);
              document.body.removeChild(a);
            } catch (error) {
              console.error('Error creating download:', error);
              throw new Error('Failed to create download');
            }
            
            console.log('Download started successfully');
            setDownloadProgress(prev => ({
              ...prev,
              progress: 100,
              stage: 'Download complete!',
              isProcessing: false
            }));
            setIsDownloading(false);
            setRetryCount(0); // Reset retry count on success
          } catch (error) {
            console.error('Error saving file:', error);
            handleWorkerError('Failed to save the ZIP file');
          }
        } else if (type === 'ERROR') {
          handleWorkerError(error || 'An error occurred while generating QR codes');
        }
      };
      
      worker.onerror = (error) => {
        console.error('Worker error:', error);
        handleWorkerError('Failed to initialize QR code generator');
      };
      
      workerRef.current = worker;
      
      return () => {
        worker.terminate();
      };
    } catch (error) {
      console.error('Error initializing worker:', error);
      handleWorkerError('Failed to initialize QR code generator');
    }
  }, []);

  // Handle worker errors with retry logic
  const handleWorkerError = useCallback((error) => {
    console.error('QR Code Worker Error:', error);
    setWorkerError(error);
    
    if (retryCount < MAX_RETRIES) {
      setRetryCount(prev => prev + 1);
      setError(`Attempting to recover... (${retryCount + 1}/${MAX_RETRIES})`);
      
      // Retry after a delay
      const timer = setTimeout(() => {
        if (workerRef.current) {
          workerRef.current.terminate();
        }
        initWorker();
      }, 1000 * (retryCount + 1)); // Exponential backoff
      
      return () => clearTimeout(timer);
    } else {
      setError('Failed to generate QR codes after several attempts. Please refresh the page and try again.');
      setDownloadProgress(prev => ({
        ...prev,
        isProcessing: false,
        showProgress: false
      }));
      setIsDownloading(false);
    }
  }, [retryCount]);

  // Initialize worker on mount and retries
  useEffect(() => {
    const cleanup = initWorker();
    return () => {
      if (cleanup) cleanup();
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, [initWorker]);

  // Function to handle downloading QR codes for a batch using Web Worker
  const handleDownloadClick = async (batch) => {
    try {
      setDownloadingBatch(batch.id);
      setIsDownloading(true);
      setError(null);
      setDownloadProgress({
        progress: 0,
        stage: 'Preparing...',
        isProcessing: true,
        showProgress: true
      });
      
      if (!isWorkerReady) {
        throw new Error('QR code generator is not ready yet');
      }
      
      // Reset retry count for this operation
      setRetryCount(0);
      
      // Add a small delay to ensure worker is ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Start the process
      workerRef.current.postMessage({
        type: 'GENERATE_QR_CODES',
        payload: {
          batch,
          email: 'admin@trashdrop.com',
          baseUrl: 'https://trashdrops.com/scan',
          chunkSize: 20 // Process 20 QR codes at a time
        }
      });
    } catch (error) {
      console.error('Error initiating download:', error);
      setError(error.message || 'Failed to start QR code generation');
      setIsDownloading(false);
      setDownloadProgress(prev => ({
        ...prev,
        isProcessing: false,
        showProgress: false
      }));
    }
  };

  // Function to render a QR code for a specific bag in the batch
  const renderQRCode = (batch, index) => {
    const qrCodeId = `${batch.id}_${index + 1}`;
    const qrValue = `https://trashdrops.com/bag/TD-${batch.type.substring(0, 3).toUpperCase()}-${batch.size.charAt(0)}-${String(index + 1).padStart(3, '0')}`;
    
    return (
      <div key={qrCodeId} id={`qrcode-${qrCodeId}`} className="hidden">
        <QRCodeSVG
          value={qrValue}
          size={200}
          level="M"
          includeMargin={false}
          renderAs="svg"
          fgColor="#000000"
          bgColor="#ffffff"
        />
      </div>
    );
  };

  // Generate QR code preview
  const handlePreview = () => {
    setError(null);
    
    // Validate inputs
    if (formData.numberOfBags < 1 || formData.numberOfBags > 1000) {
      setError('Number of bags must be between 1 and 1000');
      return;
    }
    
    if (formData.numberOfBatches < 1 || formData.numberOfBatches > 10) {
      setError('Number of batches must be between 1 and 10');
      return;
    }
    
    setPreviewVisible(true);
    
    // Generate sample QR code for preview
    const trashTypePrefix = formData.trashType === 'Organic' ? 'ORG' : 
                           formData.trashType === 'Recyclable' ? 'REC' : 'HAZ';
    const bagSizePrefix = formData.bagSize === 'Small' ? 'S' : 
                         formData.bagSize === 'Medium' ? 'M' : 'L';
    
    setPreviewQR({
      prefix: `TD-${trashTypePrefix}-${bagSizePrefix}`,
      sample: `TD-${trashTypePrefix}-${bagSizePrefix}-001`,
      url: `https://trashdrop.com/bag/TD-${trashTypePrefix}-${bagSizePrefix}-001`
    });
  };
  
  // Generate actual QR codes
  const handleGenerate = () => {
    setIsLoading(true);
    setError(null);
    
    // Validate inputs again
    if (formData.numberOfBags < 1 || formData.numberOfBags > 1000) {
      setError('Number of bags must be between 1 and 1000');
      setIsLoading(false);
      return;
    }
    
    if (formData.numberOfBatches < 1 || formData.numberOfBatches > 10) {
      setError('Number of batches must be between 1 and 10');
      setIsLoading(false);
      return;
    }
    
    // Simulate API call delay
    setTimeout(() => {
      try {
        const newBatches = [];
        
        for (let i = 0; i < formData.numberOfBatches; i++) {
          // Use the helper function from bags.js
          const { batch } = generateNewBatch(
            formData.trashType,
            formData.bagSize,
            formData.numberOfBags,
            'admin@trashdrop.com' // In a real app, this would be the current user
          );
          
          newBatches.push(batch);
        }
        
        setGeneratedBatches(prevBatches => [...newBatches, ...prevBatches]);
        setPreviewVisible(false);
        setPreviewQR(null);
        
      } catch (err) {
        setError('Error generating QR codes: ' + err.message);
      } finally {
        setIsLoading(false);
      }
    }, 1500); // Simulate 1.5s API delay
  };
  
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Generate Bag Batches</h2>
      
      {/* Form section */}
      <div className="bg-white shadow-sm rounded-lg mb-6">
        <div className="p-6">
          <h5 className="text-xl font-semibold mb-4 text-gray-700">Bag Batch Configuration</h5>
          
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded flex items-center mb-4" role="alert">
              <FontAwesomeIcon icon={faExclamationTriangle} className="mr-2" />
              <span>{error}</span>
            </div>
          )}
          
          <form>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label htmlFor="trashType" className="block text-sm font-medium text-gray-700 mb-1">Trash Type</label>
                <select 
                  id="trashType" 
                  name="trashType" 
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 rounded-md shadow-sm" 
                  value={formData.trashType}
                  onChange={handleInputChange}
                >
                  <option value="Organic">Green/Organic</option>
                  <option value="Recyclable">Blue/Recyclable</option>
                  <option value="Hazardous">Red/Hazardous</option>
                </select>
                <p className="mt-2 text-sm text-gray-500">Select the type of trash for this batch.</p>
              </div>
              
              <div>
                <label htmlFor="bagSize" className="block text-sm font-medium text-gray-700 mb-1">Bag Size</label>
                <select 
                  id="bagSize" 
                  name="bagSize" 
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 rounded-md shadow-sm" 
                  value={formData.bagSize}
                  onChange={handleInputChange}
                >
                  <option value="Small">Small/5 gallons</option>
                  <option value="Medium">Medium/13 gallons</option>
                  <option value="Large">Large/30 gallons</option>
                </select>
                <p className="mt-2 text-sm text-gray-500">Select the size of the bags in this batch.</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label htmlFor="numberOfBags" className="block text-sm font-medium text-gray-700 mb-1">Number of Bags</label>
                <input 
                  type="number" 
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500" 
                  id="numberOfBags" 
                  name="numberOfBags" 
                  min="1" 
                  max="1000" 
                  value={formData.numberOfBags}
                  onChange={handleInputChange}
                />
                <p className="mt-2 text-sm text-gray-500">Enter a number between 1 and 1000.</p>
              </div>
              
              <div>
                <label htmlFor="numberOfBatches" className="block text-sm font-medium text-gray-700 mb-1">Number of Batches</label>
                <input 
                  type="number" 
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500" 
                  id="numberOfBatches" 
                  name="numberOfBatches" 
                  min="1" 
                  max="10" 
                  value={formData.numberOfBatches}
                  onChange={handleInputChange}
                />
                <p className="mt-2 text-sm text-gray-500">Enter a number between 1 and 10.</p>
              </div>
            </div>
            
            <div className="flex justify-end mt-6 space-x-4">
              <button 
                type="button" 
                className="py-2 px-4 border border-blue-500 rounded-md shadow-sm text-sm font-medium text-blue-500 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500" 
                onClick={handlePreview}
              >
                <FontAwesomeIcon icon={faMagic} className="mr-2" /> Preview
              </button>
              
              <button 
                type="button" 
                className="py-2 px-4 bg-green-600 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500" 
                onClick={handleGenerate}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faQrcode} className="mr-2" /> Generate
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
      
      {/* QR Code Preview */}
      {previewVisible && (
        <div className="bg-white shadow-sm rounded-lg mb-6">
          <div className="p-6">
            <h5 className="text-xl font-semibold mb-4 text-gray-700">QR Code Preview</h5>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex flex-col items-center border rounded-lg p-6 bg-gray-50">
                  <div className="mb-4 p-3 bg-white border border-gray-300 rounded flex justify-center items-center" style={{ width: '200px', height: '200px' }}>
                    {previewQR && (
                      <QRCodeSVG
                        value={previewQR.url}
                        size={180}
                        level="M"
                        includeMargin={false}
                        renderAs="svg"
                        fgColor="#000000"
                        bgColor="#ffffff"
                      />
                    )}
                  </div>
                  <h6 className="text-lg font-medium mb-2 text-center">{previewQR?.prefix}</h6>
                  <p className="text-gray-500 text-sm text-center">Sample: {previewQR?.sample}</p>
                </div>
              </div>
              
              <div>
                <h6 className="text-lg font-medium mb-3">QR Code Details</h6>
                <p className="mb-2"><span className="font-semibold">Prefix:</span> {previewQR?.prefix}</p>
                <p className="mb-2"><span className="font-semibold">Sample Code:</span> {previewQR?.sample}</p>
                <p className="mb-2"><span className="font-semibold">URL Format:</span> {previewQR?.url}</p>
                <p className="text-sm text-gray-600 mt-4">Scan this QR code to view the bag details in the TrashDrop app.</p>
                
                <div className="mt-6">
                  <h6 className="text-lg font-medium mb-3">Batch Summary</h6>
                  <ul className="divide-y divide-gray-200">
                    <li className="py-3 flex justify-between">
                      <span className="text-gray-600">Number of Batches:</span>
                      <span className="font-bold">{formData.numberOfBatches}</span>
                    </li>
                    <li className="py-3 flex justify-between">
                      <span className="text-gray-600">QR Code Prefix:</span>
                      <span className="font-bold">{previewQR?.prefix}</span>
                    </li>
                  </ul>
                
                  <div className="mt-6">
                    <button 
                      type="button" 
                      className="w-full py-2 px-4 bg-green-600 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500" 
                      onClick={handleGenerate}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Generating...
                        </>
                      ) : (
                        <>
                          <FontAwesomeIcon icon={faCheck} className="mr-2" /> Confirm & Generate
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
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
              <button 
                onClick={() => setDownloadProgress(prev => ({ ...prev, showProgress: false }))}
                className="text-gray-500 hover:text-gray-700"
                disabled={downloadProgress.isProcessing}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>{downloadProgress.stage}</span>
                <span>{Math.round(downloadProgress.progress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
                  style={{ width: `${downloadProgress.progress}%` }}
                ></div>
              </div>
            </div>
            
            <div className="text-sm text-gray-500 text-center">
              {downloadProgress.progress < 100 
                ? 'Please wait while we prepare your download...'
                : 'Download complete! The file should start downloading shortly.'
              }
            </div>
          </div>
        </div>
      )}
      
      {/* Generated Batches Table */}
      <div className="mt-8 bg-white shadow-sm rounded-lg">
        <div className="p-6">
          <h5 className="text-xl font-semibold mb-4 text-gray-700">Generated Batches</h5>
          
          {generatedBatches.length === 0 ? (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded flex items-center" role="alert">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"></path></svg>
              <span>No batches have been generated yet. Use the form above to create new bag batches.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch ID</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trash Type</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bag Size</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Number of Bags</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Generation Date</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {generatedBatches.map((batch) => {
                    // Format the date
                    const formattedDate = new Date(batch.createdAt).toLocaleString();
                    
                    // Get color for trash type using Tailwind classes
                    const getTrashTypeColor = (type) => {
                      switch(type) {
                        case 'Organic': return 'bg-green-100 text-green-800';
                        case 'Recyclable': return 'bg-blue-100 text-blue-800';
                        case 'Hazardous': return 'bg-red-100 text-red-800';
                        default: return 'bg-gray-100 text-gray-800';
                      }
                    };
                    
                    return (
                      <tr key={batch.id} className="hover:bg-gray-50">
                        {/* Hidden QR codes for this batch */}
                        {Array.from({ length: Math.min(batch.quantity, 10) }).map((_, index) => (
                          renderQRCode(batch, index)
                        ))}
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{batch.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getTrashTypeColor(batch.type)}`}>
                            {batch.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{batch.size}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{batch.quantity}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formattedDate}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleDownloadClick(batch)}
                            disabled={isDownloading && downloadingBatch === batch.id}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            title="Download QR Codes"
                          >
                            <FontAwesomeIcon 
                              icon={isDownloading && downloadingBatch === batch.id ? faSpinner : faDownload} 
                              className={isDownloading && downloadingBatch === batch.id ? 'animate-spin mr-2' : 'mr-2'} 
                            />
                            <span>Download QRs</span>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );




};

export default GenerateBag;
