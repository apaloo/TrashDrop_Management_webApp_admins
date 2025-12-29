import React, { useState } from 'react';

/**
 * QR Code Floating Card Component
 * Displays a QR code with options to download and print
 * 
 * @param {Boolean} isOpen - Controls visibility of the modal
 * @param {Function} onClose - Function to call when closing the modal
 * @param {Object} qrData - Data for the QR code
 */
const QrCodeModal = ({ isOpen, onClose, qrData }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  
  // Mock download function - in a real app, this would generate an actual QR code image
  const handleDownload = () => {
    setIsDownloading(true);
    
    // Simulate download delay
    setTimeout(() => {
      setIsDownloading(false);
      
      // Create a fake download link
      const link = document.createElement('a');
      link.href = qrData?.qrImageUrl || '#';
      link.download = `${qrData?.id || 'qrcode'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }, 1000);
  };
  
  // Mock print function
  const handlePrint = () => {
    window.open(qrData?.qrImageUrl || '#', '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-white rounded-lg shadow-xl w-80 animate-float"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 flex justify-between items-center border-b">
          <h3 className="text-lg font-semibold text-gray-800">
            QR Code: {qrData?.id || 'Batch'}
          </h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
        
        <div className="p-6 flex flex-col items-center">
          {qrData?.qrImageUrl ? (
            <img 
              src={qrData.qrImageUrl} 
              alt="QR Code" 
              className="w-48 h-48 border p-2"
            />
          ) : (
            <div className="w-48 h-48 border p-2 flex items-center justify-center bg-gray-50">
              <span className="text-gray-400">QR Preview</span>
            </div>
          )}
          
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-500 mb-1">
              {qrData?.description || 'Scan this code with the TrashDrop app'}
            </p>
            <p className="text-xs text-gray-400">
              Prefix: {qrData?.prefix || 'TD-'}
            </p>
          </div>
        </div>
        
        <div className="border-t p-4 flex justify-between">
          <button
            onClick={handleDownload}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
            disabled={isDownloading}
          >
            {isDownloading ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                Downloading...
              </>
            ) : (
              <>
                <i className="fas fa-download mr-2"></i>
                Download
              </>
            )}
          </button>
          
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 flex items-center"
          >
            <i className="fas fa-print mr-2"></i>
            Print
          </button>
        </div>
      </div>
    </div>
  );
};

export default QrCodeModal;

// Add this to your global CSS for the floating animation:
/*
@keyframes float {
  0% {
    transform: translateY(0px);
    box-shadow: 0 5px 15px 0px rgba(0,0,0,0.1);
  }
  50% {
    transform: translateY(-5px);
    box-shadow: 0 15px 15px 0px rgba(0,0,0,0.1);
  }
  100% {
    transform: translateY(0px);
    box-shadow: 0 5px 15px 0px rgba(0,0,0,0.1);
  }
}

.animate-float {
  animation: float 3s ease-in-out infinite;
}
*/
