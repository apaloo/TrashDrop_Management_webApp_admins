import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQrcode, faCheck, faExclamationTriangle, faMagic } from '@fortawesome/free-solid-svg-icons';
import { generateNewBatch } from '../mock/bags';

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
  const [error, setError] = useState(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewQR, setPreviewQR] = useState(null);
  
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
                  {/* This would be an actual QR code in production */}
                  <div className="mb-4 p-3 bg-white border border-gray-300 rounded" style={{ width: '200px', height: '200px' }}>
                    <div className="flex justify-center items-center h-full text-gray-400">
                      <FontAwesomeIcon icon={faQrcode} size="4x" />
                    </div>
                  </div>
                  <h6 className="text-lg font-medium mb-2">{previewQR?.prefix}</h6>
                  <p className="text-gray-500 text-sm">Sample: {previewQR?.sample}</p>
                </div>
              </div>
              
              <div>
                <h6 className="text-lg font-medium mb-3">QR Code Details</h6>
                <p className="mb-2"><span className="font-semibold">Prefix:</span> {previewQR?.prefix}</p>
                <p className="mb-2"><span className="font-semibold">Sample Code:</span> {previewQR?.sample}</p>
                <p className="mb-2"><span className="font-semibold">URL Format:</span> {previewQR?.url}</p>
                <p className="text-sm text-gray-600 mt-4">This is an example of how your QR codes will be generated. In production, the actual QR code image will be displayed.</p>
                
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
      
      {/* Generated Batches Table */}
      <div className="bg-white shadow-sm rounded-lg">
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
                            className="inline-flex items-center px-3 py-1 border border-blue-500 text-xs font-medium rounded text-blue-500 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500" 
                            title="Download QR Codes"
                            onClick={() => alert(`Downloading QR codes for batch ${batch.id}`)}
                          >
                            <FontAwesomeIcon icon={faQrcode} className="mr-1" /> Download QRs
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
