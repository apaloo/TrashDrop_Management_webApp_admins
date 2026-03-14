/* eslint-disable no-restricted-globals */
// Web Worker for handling QR code generation and ZIP creation
// This is an ES Module worker
// VERSION: 2.2 - Large Nested SVG QR Code (450x450px on 600x700 canvas)

// Import JSZip and QRCode libraries directly
import JSZip from 'jszip';
import QRCode from 'qrcode';

const QR_GRAPHIC_WIDTH = 474;
const QR_GRAPHIC_HEIGHT = 561;
const OUTER_CANVAS_WIDTH = 600;
const OUTER_CANVAS_HEIGHT = 700;
const FLYER_TEMPLATE_PATH = '/Batch_QR_frame_base.png';
const FLYER_CANVAS_WIDTH = 3081;
const FLYER_CANVAS_HEIGHT = 1456;
const FLYER_PLACEHOLDER_X = 1055;
const FLYER_PLACEHOLDER_Y = 110;
const FLYER_PLACEHOLDER_W = 622;
const FLYER_PLACEHOLDER_H = 782;
const FLYER_QR_RENDER_WIDTH = 540;
const FLYER_PLACEHOLDER_RADIUS = 44;

// Log version on worker initialization
console.log('QR Code Worker v2.2 initialized - Nested QR graphic (474x561px) embedded on 600x700 canvas');

// Track the current operation for cancellation
let currentOperation = null;

// Simple function to ensure JSZip is loaded
const ensureJSZip = async () => {
  if (typeof JSZip === 'undefined') {
    throw new Error('JSZip failed to load');
  }
  return JSZip;
};

function buildQRGraphicSVG({ qrViewBox, qrSvgContent, batchId, bagNumber }) {
  const safeBatchId = String(batchId || '');
  const batchLabel = safeBatchId.length > 18 ? `${safeBatchId.substring(0, 18)}...` : safeBatchId;
  const bagLabel = bagNumber !== null && bagNumber !== undefined ? `Bag #${bagNumber}` : 'Batch QR';
  const qrY = 87;
  const textCenterX = Math.round(QR_GRAPHIC_WIDTH / 2);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${QR_GRAPHIC_WIDTH}" height="${QR_GRAPHIC_HEIGHT}" viewBox="0 0 ${QR_GRAPHIC_WIDTH} ${QR_GRAPHIC_HEIGHT}" style="background: white;">
  <rect width="100%" height="100%" fill="white"/>
  <text x="${textCenterX}" y="26" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#333">TrashDrop QR Code</text>
  <text x="${textCenterX}" y="52" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" fill="#666">Batch: ${escapeXml(batchLabel)}</text>
  <text x="${textCenterX}" y="74" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" fill="#666">${escapeXml(bagLabel)}</text>
  <svg x="0" y="${qrY}" width="${QR_GRAPHIC_WIDTH}" height="${QR_GRAPHIC_WIDTH}" viewBox="${qrViewBox}">${qrSvgContent}</svg>
</svg>`;
}

function extractInnerSvg(svgString) {
  const match = String(svgString || '').match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
  return match ? match[1] : '';
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function tryGenerateFlyerPosterPNG(qrData) {
  try {
    if (typeof fetch !== 'function') return null;

    const res = await fetch(FLYER_TEMPLATE_PATH, { cache: 'no-store' });
    if (!res.ok) return null;
    const templateBlob = await res.blob();
    const templateBitmap = await createImageBitmap(templateBlob);

    const qrGraphicSvg = await generateQRGraphicSVG(qrData);
    const qrGraphicBlob = new Blob([qrGraphicSvg], { type: 'image/svg+xml;charset=utf-8' });
    const qrBitmap = await createImageBitmap(qrGraphicBlob);

    const canvas = new OffscreenCanvas(FLYER_CANVAS_WIDTH, FLYER_CANVAS_HEIGHT);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, FLYER_CANVAS_WIDTH, FLYER_CANVAS_HEIGHT);
    ctx.drawImage(templateBitmap, 0, 0);

    const scale = FLYER_QR_RENDER_WIDTH / QR_GRAPHIC_WIDTH;
    const renderW = FLYER_QR_RENDER_WIDTH;
    const renderH = Math.round(QR_GRAPHIC_HEIGHT * scale);

    const x = Math.round(FLYER_PLACEHOLDER_X + (FLYER_PLACEHOLDER_W - renderW) / 2);
    const y = Math.round(FLYER_PLACEHOLDER_Y + (FLYER_PLACEHOLDER_H - renderH) / 2);

    ctx.save();
    clipRoundedRect(ctx, FLYER_PLACEHOLDER_X, FLYER_PLACEHOLDER_Y, FLYER_PLACEHOLDER_W, FLYER_PLACEHOLDER_H, FLYER_PLACEHOLDER_RADIUS);
    ctx.drawImage(qrBitmap, x, y, renderW, renderH);
    ctx.restore();

    const posterBlob = await canvas.convertToBlob({ type: 'image/png' });
    return posterBlob;
  } catch (error) {
    console.error('Error generating flyer poster PNG:', error);
    return null;
  }
}

async function generateQRGraphicSVG(qrData) {
  const { url, bagNumber, batchId } = qrData;
  const qrSvgString = await QRCode.toString(url, {
    type: 'svg',
    width: QR_GRAPHIC_WIDTH,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    },
    errorCorrectionLevel: 'M'
  });

  const svgContentMatch = qrSvgString.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
  const qrSvgContent = svgContentMatch ? svgContentMatch[1] : '';
  const viewBoxMatch = qrSvgString.match(/viewBox="([^"]*)"/i);
  const qrViewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 100 100';

  return buildQRGraphicSVG({ qrViewBox, qrSvgContent, batchId, bagNumber });
}

function clipRoundedRect(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.clip();
}

function isLarge240LBatch(batch) {
  if (!batch || typeof batch !== 'object') return false;
  const sizeCandidates = [
    batch.size,
    batch.bag_size,
    batch.capacity_label,
    batch.bagSize,
    batch.bin_size,
    batch.bin_capacity_label
  ];
  const numericCandidates = [
    batch.capacity_l,
    batch.capacityL,
    batch.bag_capacity,
    batch.bin_capacity
  ];

  for (const candidate of sizeCandidates) {
    if (!candidate) continue;
    const normalized = String(candidate).trim().toLowerCase();
    if (!normalized) continue;
    if (normalized.includes('240')) return true;
    if (normalized === 'large' || normalized === 'l') return true;
  }

  for (const num of numericCandidates) {
    if (typeof num === 'number' && num >= 240) {
      return true;
    }
    if (typeof num === 'string' && Number(num) >= 240) {
      return true;
    }
  }

  return false;
}

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

  if (type === 'GENERATE_POSTER_PNG') {
    const { batch, baseUrl = 'https://trashdrops.com/scan', email = 'admin@trashdrop.com', requestId } = payload || {};
    try {
      const batchId = (typeof batch === 'string') ? batch : (batch?.id || new Date().getTime().toString());

      if (!isLarge240LBatch(batch)) {
        self.postMessage({
          type: 'POSTER_READY',
          requestId,
          content: null,
          filename: null
        });
        return;
      }

      const batchQR = {
        id: `batch-${batchId}`,
        url: `${baseUrl}?batch=${encodeURIComponent(batchId)}`,
        bagNumber: null,
        batchId,
        email
      };

      const posterPng = await tryGenerateFlyerPosterPNG(batchQR);
      if (!posterPng) {
        self.postMessage({
          type: 'POSTER_READY',
          requestId,
          content: null,
          filename: null
        });
        return;
      }

      self.postMessage({
        type: 'POSTER_READY',
        requestId,
        content: posterPng,
        filename: `Poster_Batch_${batchId}.png`
      });
    } catch (error) {
      self.postMessage({
        type: 'POSTER_ERROR',
        requestId,
        error: error?.message || 'Error generating poster PNG'
      });
    }
    return;
  }
  
  if (type === 'GENERATE_QR_CODES') {
    const { batch, email, baseUrl, chunkSize = 20, attempt = 1 } = payload;
    const chunks = [];
    const total = batch.bag_count || batch.quantity;
    
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
    const { chunks, batch, baseUrl = 'https://trashdrops.com/scan', email = 'admin@trashdrop.com', attempt = 1 } = payload;
    
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
      // Ensure we have a valid batch ID (batch can be string or object)
      const batchId = (typeof batch === 'string') ? batch : (batch?.id || new Date().getTime().toString());

      // Prepare folders
      const bagsFolder = zip.folder('bags');

      // Add batch-level QR at the root of the ZIP
      try {
        const batchQR = {
          id: `batch-${batchId}`,
          url: `${baseUrl}?batch=${encodeURIComponent(batchId)}`,
          bagNumber: null,
          batchId,
          email
        };
        const batchSvg = await generateQRCodeSVG(batchQR);
        zip.file(`Batch_QR_${batchId}.svg`, batchSvg);
      } catch (err) {
        console.error('Error creating batch-level QR SVG:', err);
      }

      // Add each bag QR code SVG to the 'bags/' folder
      for (const qrData of flatChunks) {
        if (operation.cancel) {
          self.postMessage({ type: 'CANCELLED' });
          return;
        }
        
        try {
          const svgContent = await generateQRCodeSVG(qrData);
          const fileName = `QR_${qrData.batchId}_${qrData.bagNumber}.svg`;
          if (bagsFolder) {
            bagsFolder.file(fileName, svgContent);
          } else {
            zip.file(`bags/${fileName}`, svgContent);
          }
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

      if (isLarge240LBatch(batch)) {
        try {
          const batchQR = {
            id: `batch-${batchId}`,
            url: `${baseUrl}?batch=${encodeURIComponent(batchId)}`,
            bagNumber: null,
            batchId,
            email
          };
          const posterPng = await tryGenerateFlyerPosterPNG(batchQR);
          if (posterPng) {
            zip.file(`Poster_Batch_${batchId}.png`, posterPng);
          }
        } catch (err) {
          console.error('Error creating batch poster PNG:', err);
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
        // Use the computed batchId from above
        const filename = `QR_Codes_${batchId}.zip`;
        
        console.log('Starting ZIP generation for batch:', batchId);
        const startTime = performance.now();
        
        // Generate ZIP as a Blob for maximum compatibility with unzip tools
        const content = await zip.generateAsync({
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: {
            level: 6
          },
          platform: 'DOS',
          encodeFileName: (string) => string
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
async function generateQRCodeSVG(qrData) {
  const { url, bagNumber, batchId } = qrData;
  
  try {
    // Generate actual QR code SVG using qrcode library
    console.log(`Generating large QR code: 450x450px for ${bagNumber !== null ? `Bag #${bagNumber}` : 'Batch'}`);
    const qrSvgString = await QRCode.toString(url, {
      type: 'svg',
      width: QR_GRAPHIC_WIDTH,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    });
    
    // Extract the inner SVG content (everything between <svg> tags)
    const svgContentMatch = qrSvgString.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
    const qrSvgContent = svgContentMatch ? svgContentMatch[1] : '';
    
    // Get viewBox from the generated QR SVG to maintain aspect ratio
    const viewBoxMatch = qrSvgString.match(/viewBox="([^"]*)"/i);
    const qrViewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 100 100';
    
    const qrGraphicSvg = buildQRGraphicSVG({
      qrViewBox,
      qrSvgContent,
      batchId,
      bagNumber
    });

    const qrGraphicViewBox = `0 0 ${QR_GRAPHIC_WIDTH} ${QR_GRAPHIC_HEIGHT}`;
    const embeddedX = Math.round((OUTER_CANVAS_WIDTH - QR_GRAPHIC_WIDTH) / 2);
    const embeddedY = 120;

    // Create enhanced SVG with nested QR code SVG - optimized for printing
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" 
     width="${OUTER_CANVAS_WIDTH}" 
     height="${OUTER_CANVAS_HEIGHT}" 
     viewBox="0 0 ${OUTER_CANVAS_WIDTH} ${OUTER_CANVAS_HEIGHT}" 
     style="background: white;">
  <!-- Background -->
  <rect width="100%" height="100%" fill="white"/>
  
  <!-- Header -->
  <text x="300" y="40" 
        text-anchor="middle" 
        font-family="Arial, sans-serif" 
        font-size="24" 
        font-weight="bold"
        fill="#333">
    TrashDrop QR Code
  </text>
  
  <!-- Batch Info -->
  <text x="300" y="70" 
        text-anchor="middle" 
        font-family="Arial, sans-serif" 
        font-size="16" 
        fill="#666">
    Batch: ${(String(batchId || '')).substring(0, 18)}...
  </text>
  
  <!-- Bag Info -->
  <text x="300" y="95" 
        text-anchor="middle" 
        font-family="Arial, sans-serif" 
        font-size="16" 
        fill="#666">
    ${bagNumber !== null && bagNumber !== undefined ? `Bag #${bagNumber}` : 'Batch QR'}
  </text>
  
  <svg x="${embeddedX}" y="${embeddedY}" width="${QR_GRAPHIC_WIDTH}" height="${QR_GRAPHIC_HEIGHT}" viewBox="${qrGraphicViewBox}">
    ${extractInnerSvg(qrGraphicSvg)}
  </svg>
  
  <!-- URL Info (truncated for display) -->
  <text x="300" y="600" 
        text-anchor="middle" 
        font-family="Arial, sans-serif" 
        font-size="14" 
        fill="#999">
    Scan to verify
  </text>
  
  <!-- Footer -->
  <text x="300" y="675" 
        text-anchor="middle" 
        font-family="Arial, sans-serif" 
        font-size="12" 
        fill="#999">
    Generated by TrashDrop Admin
  </text>
</svg>`;
  } catch (error) {
    console.error('Error generating QR code SVG:', error);
    // Fallback to text-based SVG if QR generation fails
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="380" viewBox="0 0 300 380" style="background: white;">
  <rect width="100%" height="100%" fill="white"/>
  <text x="150" y="190" text-anchor="middle" font-family="Arial" font-size="12" fill="red">
    QR Generation Error
  </text>
  <text x="150" y="210" text-anchor="middle" font-family="Arial" font-size="8" fill="#666">
    ${url.replace(/&/g, '&amp;')}
  </text>
</svg>`;
  }
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
