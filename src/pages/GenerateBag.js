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
    <div className="container-fluid px-4 py-5">
      <h2 className="mb-4">Generate Bag Batches</h2>
      
      {/* Form section */}
      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <h5 className="card-title mb-3">Bag Batch Configuration</h5>
          
          {error && (
            <div className="alert alert-danger d-flex align-items-center" role="alert">
              <FontAwesomeIcon icon={faExclamationTriangle} className="me-2" />
              {error}
            </div>
          )}
          
          <form>
            <div className="row mb-3">
              <div className="col-md-6">
                <label htmlFor="trashType" className="form-label">Trash Type</label>
                <select 
                  id="trashType" 
                  name="trashType" 
                  className="form-select" 
                  value={formData.trashType}
                  onChange={handleInputChange}
                >
                  <option value="Organic">Green/Organic</option>
                  <option value="Recyclable">Blue/Recyclable</option>
                  <option value="Hazardous">Red/Hazardous</option>
                </select>
                <div className="form-text">Select the type of trash for this batch.</div>
              </div>
              
              <div className="col-md-6">
                <label htmlFor="bagSize" className="form-label">Bag Size</label>
                <select 
                  id="bagSize" 
                  name="bagSize" 
                  className="form-select" 
                  value={formData.bagSize}
                  onChange={handleInputChange}
                >
                  <option value="Small">Small/5 gallons</option>
                  <option value="Medium">Medium/13 gallons</option>
                  <option value="Large">Large/30 gallons</option>
                </select>
                <div className="form-text">Select the size of the bags in this batch.</div>
              </div>
            </div>
            
            <div className="row mb-3">
              <div className="col-md-6">
                <label htmlFor="numberOfBags" className="form-label">Number of Bags</label>
                <input 
                  type="number" 
                  className="form-control" 
                  id="numberOfBags" 
                  name="numberOfBags" 
                  min="1" 
                  max="1000" 
                  value={formData.numberOfBags}
                  onChange={handleInputChange}
                />
                <div className="form-text">Enter a number between 1 and 1000.</div>
              </div>
              
              <div className="col-md-6">
                <label htmlFor="numberOfBatches" className="form-label">Number of Batches</label>
                <input 
                  type="number" 
                  className="form-control" 
                  id="numberOfBatches" 
                  name="numberOfBatches" 
                  min="1" 
                  max="10" 
                  value={formData.numberOfBatches}
                  onChange={handleInputChange}
                />
                <div className="form-text">Enter a number between 1 and 10.</div>
              </div>
            </div>
            
            <div className="d-flex justify-content-end mt-4">
              <button 
                type="button" 
                className="btn btn-outline-primary me-2" 
                onClick={handlePreview}
              >
                <FontAwesomeIcon icon={faMagic} className="me-1" /> Preview
              </button>
              
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleGenerate}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Generating...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faQrcode} className="me-1" /> Generate
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
      
      {/* QR Code Preview */}
      {previewVisible && (
        <div className="card shadow-sm mb-4">
          <div className="card-body">
            <h5 className="card-title mb-3">QR Code Preview</h5>
            
            <div className="row">
              <div className="col-md-6">
                <div className="d-flex flex-column align-items-center border rounded p-4 bg-light">
                  {/* This would be an actual QR code in production */}
                  <div className="mb-3 p-3 bg-white border" style={{ width: '200px', height: '200px' }}>
                    <div className="d-flex justify-content-center align-items-center h-100">
                      <FontAwesomeIcon icon={faQrcode} size="6x" className="text-primary" />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="mb-1 fw-bold">{previewQR?.sample}</p>
                    <p className="text-muted small">{previewQR?.url}</p>
                  </div>
                </div>
              </div>
              
              <div className="col-md-6">
                <h6>Batch Summary</h6>
                <ul className="list-group">
                  <li className="list-group-item d-flex justify-content-between">
                    <span>Trash Type:</span>
                    <span className="fw-bold">{formData.trashType}</span>
                  </li>
                  <li className="list-group-item d-flex justify-content-between">
                    <span>Bag Size:</span>
                    <span className="fw-bold">{formData.bagSize}</span>
                  </li>
                  <li className="list-group-item d-flex justify-content-between">
                    <span>Number of Bags:</span>
                    <span className="fw-bold">{formData.numberOfBags}</span>
                  </li>
                  <li className="list-group-item d-flex justify-content-between">
                    <span>Number of Batches:</span>
                    <span className="fw-bold">{formData.numberOfBatches}</span>
                  </li>
                  <li className="list-group-item d-flex justify-content-between">
                    <span>QR Code Prefix:</span>
                    <span className="fw-bold">{previewQR?.prefix}</span>
                  </li>
                </ul>
                
                <div className="d-grid mt-3">
                  <button 
                    type="button" 
                    className="btn btn-success" 
                    onClick={handleGenerate}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Generating...
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faCheck} className="me-1" /> Confirm & Generate
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Generated Batches Table */}
      <div className="card shadow-sm">
        <div className="card-body">
          <h5 className="card-title mb-3">Generated Batches</h5>
          
          {generatedBatches.length === 0 ? (
            <div className="alert alert-info" role="alert">
              No batches have been generated yet. Use the form above to create new bag batches.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Batch ID</th>
                    <th>Trash Type</th>
                    <th>Bag Size</th>
                    <th>Number of Bags</th>
                    <th>Generation Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {generatedBatches.map((batch) => {
                    // Format the date
                    const formattedDate = new Date(batch.createdAt).toLocaleString();
                    
                    // Get color for trash type
                    const getTrashTypeColor = (type) => {
                      switch(type) {
                        case 'Organic': return 'success';
                        case 'Recyclable': return 'primary';
                        case 'Hazardous': return 'danger';
                        default: return 'secondary';
                      }
                    };
                    
                    return (
                      <tr key={batch.id}>
                        <td>{batch.id}</td>
                        <td>
                          <span className={`badge bg-${getTrashTypeColor(batch.type)} text-white`}>
                            {batch.type}
                          </span>
                        </td>
                        <td>{batch.size}</td>
                        <td>{batch.quantity}</td>
                        <td>{formattedDate}</td>
                        <td>
                          <button 
                            className="btn btn-sm btn-outline-primary" 
                            title="Download QR Codes"
                            onClick={() => alert(`Downloading QR codes for batch ${batch.id}`)}
                          >
                            <FontAwesomeIcon icon={faQrcode} /> Download QRs
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
