import React, { useState } from 'react';
import EnhancedImage from '../common/EnhancedImage';
import PhotoViewer from '../common/PhotoViewer';
import { splitReportPhotos } from '../../utils/illegalDumpingReportUtils';

/** Evidence photos, plus a note for photos that never reached storage. A tap
    opens the full-screen viewer (a slideshow) at that photo. */
const ReportPhotos = ({ photos, enhanced = true, title = 'Photos', emptyText = 'No photos were attached to this report.' }) => {
  const { viewable, lost } = splitReportPhotos(photos);
  // Index of the photo open full screen, or null
  const [viewerIndex, setViewerIndex] = useState(null);
  return (
    <div>
      <h3 className="font-medium mb-2">{title} ({viewable.length})</h3>
      {viewable.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mb-2">
          {viewable.map((src, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setViewerIndex(index)}
              aria-label={`Open photo ${index + 1} of ${viewable.length}`}
              className="block w-full bg-gray-100 rounded overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
            >
              {enhanced
                ? <EnhancedImage src={src} alt={`Report evidence ${index + 1}`} className="w-full h-48 object-cover" />
                : <img src={src} alt={`Report evidence ${index + 1}`} className="w-full h-24 object-cover" loading="lazy" />}
            </button>
          ))}
        </div>
      )}
      {lost > 0 && (
        <p className="text-sm bg-amber-50 text-amber-800 border border-amber-200 rounded p-3 mb-2" data-testid="photos-lost">
          {lost} photo{lost > 1 ? 's' : ''} lost: taken before the app uploaded photos, so {lost > 1 ? 'they were' : 'it was'} never saved (legacy upload bug).
        </p>
      )}
      {viewable.length === 0 && lost === 0 && (
        <p className="text-sm text-td-sage bg-td-cream rounded p-3">{emptyText}</p>
      )}
      {viewerIndex !== null && viewable.length > 0 && (
        <PhotoViewer
          photos={viewable}
          index={Math.min(viewerIndex, viewable.length - 1)}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </div>
  );
};

export default ReportPhotos;
