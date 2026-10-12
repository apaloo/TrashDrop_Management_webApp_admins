import React from 'react';
import EnhancedImage from '../common/EnhancedImage';
import { splitReportPhotos } from '../../utils/illegalDumpingReportUtils';

/** Evidence photos, plus a note for photos that never reached storage */
const ReportPhotos = ({ photos, enhanced = true }) => {
  const { viewable, lost } = splitReportPhotos(photos);
  return (
    <div>
      <h3 className="font-medium mb-2">Photos ({viewable.length})</h3>
      {viewable.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mb-2">
          {viewable.map((src, index) => (
            <a key={index} href={src} target="_blank" rel="noopener noreferrer" className="block bg-gray-100 rounded overflow-hidden">
              {enhanced
                ? <EnhancedImage src={src} alt={`Report evidence ${index + 1}`} className="w-full h-48 object-cover" />
                : <img src={src} alt={`Report evidence ${index + 1}`} className="w-full h-24 object-cover" loading="lazy" />}
            </a>
          ))}
        </div>
      )}
      {lost > 0 && (
        <p className="text-sm bg-amber-50 text-amber-800 border border-amber-200 rounded p-3 mb-2" data-testid="photos-lost">
          {lost} photo{lost > 1 ? 's' : ''} lost: taken before the app uploaded photos, so {lost > 1 ? 'they were' : 'it was'} never saved (legacy upload bug).
        </p>
      )}
      {viewable.length === 0 && lost === 0 && (
        <p className="text-sm text-gray-500 bg-gray-50 rounded p-3">No photos were attached to this report.</p>
      )}
    </div>
  );
};

export default ReportPhotos;
