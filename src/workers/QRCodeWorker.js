/* eslint-disable no-restricted-globals */
// Web Worker for handling QR code generation and ZIP creation
// This is an ES Module worker

// Import JSZip directly
import JSZip from 'jszip';

// Track the current operation for cancellation
let currentOperation = null;

// Simple function to ensure JSZip is loaded
const ensureJSZip = async () => {
  if (typeof JSZip === 'undefined') {
    throw new Error('JSZip failed to load');
  }
  return JSZip;
};

// Define message handler
self.onmessage = async function(e) {
  try {
    // Handle initialization
    if (e.data.type === 'WORKER_READY') {
      // Ensure JSZip is available
      await ensureJSZip();
      self.postMessage({ type: 'WORKER_READY' });
      return;
    }
    
    // Handle cancellation if requested
    if (e.data.type === 'CANCEL') {
      if (currentOperation) {
        currentOperation.cancel = true;
      }
      return;
    }
    
    // Get JSZip instance
    const JSZipInstance = await ensureJSZip();
    
    // Create a new operation ID
    const operationId = Date.now();
    currentOperation = { id: operationId, cancel: false };
    
    // Process the message with the current operation context
    await processMessage(e, JSZipInstance, currentOperation);
    
  } catch (error) {
    console.error('Error in worker:', error);
    self.postMessage({
      type: 'ERROR',
      error: error.message || 'An error occurred in the QR code generator',
      isFatal: true
    });
  } finally {
    currentOperation = null;
  }
};

// Main worker processing function
async function processMessage(e, JSZip, operation) {
  const { type, payload } = e.data;
  
  if (type === 'GENERATE_QR_CODES') {
    const { batch, email, baseUrl, chunkSize = 20, attempt = 1 } = payload;
    const chunks = [];
    const total = batch.quantity;
    
    try {
      // Process in chunks to prevent UI blocking
      for (let i = 0; i < total; i += chunkSize) {
        // Check if operation was cancelled
        if (operation.cancel) {
          self.postMessage({ type: 'CANCELLED' });
          return;
        }
        
        const chunk = [];
        const end = Math.min(i + chunkSize, total);
        
        // Generate QR codes for this chunk
        for (let j = 0; j < end - i; j++) {
          const currentIndex = i + j;
          if (operation.cancel) {
            self.postMessage({ type: 'CANCELLED' });
            return;
          }
          
          try {
            const bagNumber = batch.startNumber + currentIndex;
            const qrData = {
              id: `${batch.id}-${bagNumber}`,
              url: `${baseUrl}?batch=${encodeURIComponent(batch.id)}&bag=${bagNumber}&email=${encodeURIComponent(email)}`,
              bagNumber,
              batchId: batch.id,
              email
            };
            
            chunk.push(qrData);
          } catch (error) {
            console.error(`Error generating QR code for bag ${currentIndex}:`, error);
            // Continue with next bag even if one fails
          }
        }
        
        if (chunk.length > 0) {
          chunks.push(chunk);
          const progress = Math.min(Math.ceil((i + chunk.length) / total * 100), 100);
          self.postMessage({ 
            type: 'PROGRESS', 
            progress, 
            stage: `Generating QR Codes (${i + chunk.length}/${total})`,
            attempt
          });
          
          // Small delay to prevent UI blocking
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      
      if (chunks.length === 0) {
        throw new Error('Failed to generate any QR codes');
      }
      
      self.postMessage({ 
        type: 'CHUNKS_READY', 
        chunks,
        totalChunks: chunks.length,
        attempt
      });
      
    } catch (error) {
      console.error('Error in QR code generation:', error);
      throw new Error(`QR code generation failed: ${error.message}`);
    }
  }
  
  if (type === 'CREATE_ZIP') {
    const { chunks, batch, attempt = 1 } = payload;
    
    // Initialize JSZip
    const JSZipInstance = await ensureJSZip();
    const zip = new JSZipInstance();
    
    let processed = 0;
    const flatChunks = chunks.flat();
    const total = flatChunks.length;
    
    if (total === 0) {
      throw new Error('No QR codes to include in ZIP');
    }
    
    try {
      // Add each QR code to the ZIP with error handling for each file
      for (const qrData of flatChunks) {
        if (operation.cancel) {
          self.postMessage({ type: 'CANCELLED' });
          return;
        }
        
        try {
          const svgContent = generateQRCodeSVG(qrData);
          zip.file(`QR_${qrData.batchId}_${qrData.bagNumber}.svg`, svgContent);
          processed++;
          
          // Update progress every 5 files or when reaching the end
          if (processed % 5 === 0 || processed === total) {
            const progress = Math.min(Math.ceil((processed / total) * 100), 100);
            self.postMessage({ 
              type: 'PROGRESS', 
              progress,
              stage: `Creating ZIP (${processed}/${total} files)`,
              attempt
            });
          }
          
          // Small delay to prevent UI blocking
          if (processed % 20 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
          }
          
        } catch (error) {
          console.error(`Error adding QR code ${qrData.id} to ZIP:`, error);
          // Continue with next file even if one fails
        }
      }
      
      if (processed === 0) {
        throw new Error('Failed to add any files to ZIP');
      }
      
      // Generate the ZIP file with minimal options
      self.postMessage({ 
        type: 'PROGRESS', 
        progress: 95, 
        stage: 'Creating ZIP file...',
        attempt
      });
      
      try {
        // Ensure we have a valid batch ID
        const batchId = batch?.id || new Date().getTime().toString();
        const filename = `QR_Codes_${batchId}.zip`;
        
        console.log('Starting ZIP generation for batch:', batchId);
        const startTime = performance.now();
        
        // Generate ZIP with minimal options for maximum compatibility
        const content = await zip.generateAsync({
          type: 'uint8array', // Use Uint8Array for binary data
          compression: 'DEFLATE',
          compressionOptions: {
            level: 6
          },
          platform: 'DOS', // Use DOS for maximum compatibility
          encodeFileName: (string) => {
            return string; // Keep original filenames
          }
        });
        
        const endTime = performance.now();
        console.log(`ZIP generation completed in ${(endTime - startTime).toFixed(2)}ms`);
        console.log(`ZIP size: ${content.size} bytes`);
        
        // Send the final message with the ZIP content
        self.postMessage({ 
          type: 'ZIP_READY', 
          content,
          filename,
          fileCount: processed,
          attempt
        });
        
      } catch (error) {
        console.error('Error generating ZIP:', error);
        self.postMessage({
          type: 'ERROR',
          error: `Failed to generate ZIP: ${error.message}`,
          stack: error.stack
        });
      }
      
    } catch (error) {
      console.error('Error creating ZIP:', error);
      throw new Error(`ZIP creation failed: ${error.message}`);
    }
  }
}

// Generate SVG content for a QR code
function generateQRCodeSVG(qrData) {
  // In a real implementation, this would use a QR code library
  // This is a simplified version that creates a basic SVG
  const { url, bagNumber, batchId } = qrData;
  
  // Create a simple SVG with the URL as text (for demo purposes)
  // In production, replace this with actual QR code generation
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" 
     width="256" 
     height="256" 
     viewBox="0 0 256 256" 
     style="background: white;">
  <rect width="100%" height="100%" fill="white"/>
  <rect x="20" y="20" width="216" height="216" 
        fill="none" stroke="black" stroke-width="2"/>
  <text x="128" y="50" 
        text-anchor="middle" 
        font-family="Arial" 
        font-size="10" 
        fill="black">
    QR Code (Generated)
  </text>
  <text x="128" y="70" 
        text-anchor="middle" 
        font-family="Arial" 
        font-size="8" 
        fill="black">
    Batch: ${batchId}
  </text>
  <text x="128" y="90" 
        text-anchor="middle" 
        font-family="Arial" 
        font-size="8" 
        fill="black">
    Bag: ${bagNumber}
  </text>
  <text x="128" y="150" 
        text-anchor="middle" 
        font-family="Arial" 
        font-size="6" 
        fill="blue"
        style="word-spacing: 0;">
    ${url}
  </text>
  <text x="128" y="240" 
        text-anchor="middle" 
        font-family="Arial" 
        font-size="6" 
        fill="gray">
    Generated by TrashDrop Admin
  </text>
</svg>`;
}

// Add error handling for uncaught errors
if (typeof self.addEventListener === 'function') {
  self.addEventListener('error', (error) => {
    console.error('Uncaught error in worker:', error);
    if (self.postMessage) {
      self.postMessage({
        type: 'ERROR',
        error: error.message || 'Unknown error in worker',
        isFatal: true
      });
    }
  });

  // Handle unhandled promise rejections
  self.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled rejection in worker:', event.reason);
    if (self.postMessage) {
      self.postMessage({
        type: 'ERROR',
        error: (event.reason && event.reason.message) || 'Unhandled promise rejection in worker',
        isFatal: true
      });
    }
  });

  // Handle termination
  self.addEventListener('message', (e) => {
    if (e.data === 'TERMINATE') {
      self.close();
    }
  });
}
