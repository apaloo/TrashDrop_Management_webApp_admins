/**
 * Utility to fix blob URLs in existing illegal dumping reports
 * This should be run once to clean up any reports with blob URLs
 */

import { supabase } from './supabase';

/**
 * Fix blob URLs in a single report by removing them
 * @param {string} reportId - The report ID to fix
 * @returns {Promise<Object>}
 */
export const fixBlobUrlsInReport = async (reportId) => {
  try {
    // Fetch the report
    const { data: report, error: fetchError } = await supabase
      .from('illegal_dumping_mobile')
      .select('photos')
      .eq('id', reportId)
      .single();

    if (fetchError) throw fetchError;

    // Filter out blob URLs
    const photos = Array.isArray(report.photos) ? report.photos : [];
    const cleanPhotos = photos.filter(url => !url.startsWith('blob:'));

    // Update the report
    const { data, error } = await supabase
      .from('illegal_dumping_mobile')
      .update({ photos: cleanPhotos })
      .eq('id', reportId)
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      data,
      removedCount: photos.length - cleanPhotos.length
    };
  } catch (error) {
    console.error('Error fixing blob URLs:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Fix blob URLs in all reports
 * @returns {Promise<Object>}
 */
export const fixAllBlobUrls = async () => {
  try {
    // Fetch all reports with photos
    const { data: reports, error: fetchError } = await supabase
      .from('illegal_dumping_mobile')
      .select('id, photos')
      .not('photos', 'is', null);

    if (fetchError) throw fetchError;

    let fixedCount = 0;
    let totalRemoved = 0;
    const errors = [];

    // Process each report
    for (const report of reports) {
      const photos = Array.isArray(report.photos) ? report.photos : [];
      const hasBlobUrls = photos.some(url => url.startsWith('blob:'));

      if (hasBlobUrls) {
        const result = await fixBlobUrlsInReport(report.id);
        if (result.success) {
          fixedCount++;
          totalRemoved += result.removedCount;
        } else {
          errors.push({ id: report.id, error: result.error });
        }
      }
    }

    return {
      success: true,
      fixedCount,
      totalRemoved,
      errors: errors.length > 0 ? errors : null
    };
  } catch (error) {
    console.error('Error fixing all blob URLs:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Extract coordinates from PostGIS geometry
 * @param {string} reportId - The report ID
 * @returns {Promise<Object>}
 */
export const extractCoordinates = async (reportId) => {
  try {
    // This requires a database function to parse the PostGIS geometry
    const { data, error } = await supabase.rpc('extract_coordinates_from_geometry', {
      report_id: reportId
    });

    if (error) throw error;

    return {
      success: true,
      data
    };
  } catch (error) {
    console.error('Error extracting coordinates:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Validate and clean photo URLs
 * @param {string[]} photoUrls - Array of photo URLs
 * @returns {string[]} Cleaned array of valid URLs
 */
export const cleanPhotoUrls = (photoUrls) => {
  if (!Array.isArray(photoUrls)) return [];
  
  return photoUrls.filter(url => {
    // Remove blob URLs
    if (url.startsWith('blob:')) return false;
    
    // Remove data URLs (base64)
    if (url.startsWith('data:')) return false;
    
    // Keep only valid HTTP(S) URLs
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  });
};

/**
 * Get report statistics including photo issues
 * @returns {Promise<Object>}
 */
export const getPhotoStatistics = async () => {
  try {
    const { data: reports, error } = await supabase
      .from('illegal_dumping_mobile')
      .select('id, photos');

    if (error) throw error;

    const stats = {
      totalReports: reports.length,
      reportsWithPhotos: 0,
      reportsWithBlobUrls: 0,
      reportsWithNoPhotos: 0,
      totalPhotos: 0,
      totalBlobUrls: 0
    };

    reports.forEach(report => {
      const photos = Array.isArray(report.photos) ? report.photos : [];
      const blobUrls = photos.filter(url => url.startsWith('blob:'));

      if (photos.length > 0) {
        stats.reportsWithPhotos++;
        stats.totalPhotos += photos.length;
      } else {
        stats.reportsWithNoPhotos++;
      }

      if (blobUrls.length > 0) {
        stats.reportsWithBlobUrls++;
        stats.totalBlobUrls += blobUrls.length;
      }
    });

    return {
      success: true,
      stats
    };
  } catch (error) {
    console.error('Error getting photo statistics:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
