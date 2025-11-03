import { supabase } from './supabase';

/**
 * Upload images to Supabase Storage and return permanent URLs
 * @param {File[]} files - Array of File objects
 * @param {string} reportId - ID of the report for organizing uploads
 * @returns {Promise<string[]>} Array of permanent image URLs
 */
export const uploadIllegalDumpingImages = async (files, reportId) => {
  try {
    const uploadPromises = files.map(async (file, index) => {
      // Generate unique filename
      const timestamp = Date.now();
      const filename = `${reportId}/${timestamp}-${index}-${file.name}`;
      
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('illegal-dumping-photos')
        .upload(filename, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error(`Error uploading ${file.name}:`, error);
        throw error;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('illegal-dumping-photos')
        .getPublicUrl(filename);

      return publicUrl;
    });

    const urls = await Promise.all(uploadPromises);
    return urls;
  } catch (error) {
    console.error('Error uploading images:', error);
    throw new Error('Failed to upload images');
  }
};

/**
 * Delete images from Supabase Storage
 * @param {string[]} imageUrls - Array of image URLs to delete
 * @returns {Promise<boolean>}
 */
export const deleteIllegalDumpingImages = async (imageUrls) => {
  try {
    // Extract filenames from URLs
    const filenames = imageUrls.map(url => {
      const parts = url.split('/illegal-dumping-photos/');
      return parts[1];
    }).filter(Boolean);

    if (filenames.length === 0) return true;

    const { error } = await supabase.storage
      .from('illegal-dumping-photos')
      .remove(filenames);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting images:', error);
    return false;
  }
};

/**
 * Convert blob URLs to actual File objects (if you have them in memory)
 * This is only useful during the same session
 * @param {string[]} blobUrls - Array of blob URLs
 * @returns {Promise<File[]>}
 */
export const blobUrlsToFiles = async (blobUrls) => {
  const filePromises = blobUrls.map(async (blobUrl, index) => {
    try {
      const response = await fetch(blobUrl);
      const blob = await response.blob();
      return new File([blob], `image-${index}.jpg`, { type: blob.type });
    } catch (error) {
      console.error(`Failed to convert blob URL ${index}:`, error);
      return null;
    }
  });

  const files = await Promise.all(filePromises);
  return files.filter(Boolean);
};
