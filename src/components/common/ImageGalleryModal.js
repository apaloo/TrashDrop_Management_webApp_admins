import React, { useState } from 'react';
import EnhancedImage from './EnhancedImage';

/**
 * @component ImageGalleryModal
 * @description A responsive modal component for displaying multiple images in a gallery view with navigation controls.
 * Supports keyboard navigation, thumbnails for quick selection, and responsive layout.
 * 
 * @param {Object} props - Component props
 * @param {string[]} props.images - Array of image URLs to display in the gallery
 * @param {boolean} props.isOpen - Controls whether the modal is visible
 * @param {Function} props.onClose - Callback function to close the modal
 * 
 * @example
 * // Basic usage
 * const [isGalleryOpen, setIsGalleryOpen] = useState(false);
 * const imageUrls = ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'];
 * 
 * <ImageGalleryModal 
 *   images={imageUrls}
 *   isOpen={isGalleryOpen}
 *   onClose={() => setIsGalleryOpen(false)}
 * />
 */
const ImageGalleryModal = ({ images, isOpen, onClose }) => {
  // State to track the currently displayed image index
  const [currentIndex, setCurrentIndex] = useState(0);

  // Don't render anything if the modal is closed or no images are provided
  if (!isOpen || !images || images.length === 0) return null;

  /**
   * Navigate to the previous image in the gallery
   * Loops back to the last image if at the beginning
   */
  const handlePrevious = () => {
    setCurrentIndex((prevIndex) => (prevIndex > 0 ? prevIndex - 1 : images.length - 1));
  };

  /**
   * Navigate to the next image in the gallery
   * Loops back to the first image if at the end
   */
  const handleNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex < images.length - 1 ? prevIndex + 1 : 0));
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={onClose}></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full">
          <div className="bg-gray-800 px-4 py-3 flex justify-between items-center">
            <h3 className="text-lg leading-6 font-medium text-white">
              Image {currentIndex + 1} of {images.length}
            </h3>
            <button 
              className="text-white hover:text-gray-200"
              onClick={onClose}
            >
              <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="bg-black flex justify-center items-center relative" style={{ height: '500px' }}>
            <EnhancedImage
              src={images[currentIndex]}
              alt={`Image ${currentIndex + 1}`}
              className="max-h-full max-w-full object-contain"
              style={{ maxHeight: '100%', maxWidth: '100%' }}
            />
            
            {images.length > 1 && (
              <>
                <button 
                  className="absolute left-2 bg-black bg-opacity-50 hover:bg-opacity-75 rounded-full p-2 text-white"
                  onClick={handlePrevious}
                >
                  <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button 
                  className="absolute right-2 bg-black bg-opacity-50 hover:bg-opacity-75 rounded-full p-2 text-white"
                  onClick={handleNext}
                >
                  <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}
          </div>

          <div className="bg-gray-100 px-4 py-3 sm:px-6 flex justify-center">
            <div className="flex space-x-2 overflow-x-auto py-2" style={{ maxWidth: '100%' }}>
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-16 w-16 flex-shrink-0 rounded-md overflow-hidden border-2 ${
                    idx === currentIndex ? 'border-blue-500' : 'border-transparent'
                  }`}
                >
                  <EnhancedImage
                    src={img}
                    alt={`Thumbnail ${idx + 1}`}
                    className="h-full w-full object-cover"
                    style={{ height: '100%', width: '100%', objectFit: 'cover' }}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageGalleryModal;
