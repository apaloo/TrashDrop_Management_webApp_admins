import React, { useState } from 'react';
import { useImageEnhancer } from '../../hooks/useImageEnhancer';

/**
 * EnhancedImage
 * Renders an image with client-side canvas enhancement (contrast, saturation, sharpening).
 * Shows a toggle so the admin can switch between original and enhanced views.
 *
 * @param {string}   src          - Image URL
 * @param {string}   alt          - Alt text
 * @param {string}   className    - Classes applied to both img and canvas
 * @param {object}   enhanceOpts  - Options forwarded to useImageEnhancer
 */
const EnhancedImage = ({ src, alt = 'Evidence photo', className = '', enhanceOpts = {}, style }) => {
  const [showEnhanced, setShowEnhanced] = useState(true);
  const { canvasRef, enhanced, processing } = useImageEnhancer(src, enhanceOpts);

  return (
    <div className="relative group">
      {/* Original image — always in DOM but hidden when enhanced view is active */}
      <img
        src={src}
        alt={alt}
        className={className}
        style={{ display: showEnhanced && enhanced ? 'none' : 'block', ...style }}
        crossOrigin="anonymous"
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EImage unavailable%3C/text%3E%3C/svg%3E';
        }}
      />

      {/* Enhanced canvas — visible only when ready and toggled on */}
      <canvas
        ref={canvasRef}
        className={className}
        style={{ display: showEnhanced && enhanced ? 'block' : 'none', ...style }}
      />

      {/* Processing spinner overlay */}
      {processing && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded">
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {/* Enhance / Original toggle badge */}
      {enhanced && !processing && (
        <button
          onClick={(e) => { e.stopPropagation(); setShowEnhanced(v => !v); }}
          title={showEnhanced ? 'View original' : 'View enhanced'}
          className="absolute bottom-1.5 right-1.5 flex items-center gap-1 bg-black bg-opacity-60 hover:bg-opacity-80 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full transition-all opacity-0 group-hover:opacity-100"
        >
          <i className={`fas ${showEnhanced ? 'fa-eye-slash' : 'fa-magic'} text-[9px]`}></i>
          {showEnhanced ? 'Original' : 'Enhance'}
        </button>
      )}
    </div>
  );
};

export default EnhancedImage;
