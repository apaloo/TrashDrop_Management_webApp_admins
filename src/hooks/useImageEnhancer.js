import { useEffect, useRef, useState } from 'react';

/**
 * Enhances a low-quality image using Canvas 2D filters:
 * - Contrast boost
 * - Saturation increase
 * - Unsharp-mask style sharpening via convolution kernel
 *
 * @param {string} src - Original image URL
 * @param {object} opts
 * @param {number} opts.contrast   - CSS contrast multiplier (default 1.25)
 * @param {number} opts.saturate   - CSS saturate multiplier (default 1.4)
 * @param {number} opts.brightness - CSS brightness multiplier (default 1.05)
 * @param {boolean} opts.sharpen   - Whether to apply sharpening kernel (default true)
 * @returns {{ canvasRef, enhanced, processing }}
 */
export function useImageEnhancer(src, {
  contrast = 1.25,
  saturate = 1.4,
  brightness = 1.05,
  sharpen = true,
} = {}) {
  const canvasRef = useRef(null);
  const [enhanced, setEnhanced] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!src) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    setProcessing(true);
    setEnhanced(false);

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      const ctx = canvas.getContext('2d');

      // Step 1: apply CSS-level filters via canvas filter property
      ctx.filter = `contrast(${contrast}) saturate(${saturate}) brightness(${brightness})`;
      ctx.drawImage(img, 0, 0);
      ctx.filter = 'none';

      if (!sharpen) {
        setEnhanced(true);
        setProcessing(false);
        return;
      }

      // Step 2: unsharp-mask via convolution
      // Sharpening kernel: center=5, neighbours=-1, corners=0
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const src32 = new Uint8ClampedArray(imageData.data);
      const dst = imageData.data;
      const w = canvas.width;
      const h = canvas.height;

      const kernel = [
         0, -1,  0,
        -1,  5, -1,
         0, -1,  0,
      ];

      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const idx = (y * w + x) * 4;
          for (let c = 0; c < 3; c++) {
            let val = 0;
            val += kernel[0] * src32[((y - 1) * w + (x - 1)) * 4 + c];
            val += kernel[1] * src32[((y - 1) * w +  x     ) * 4 + c];
            val += kernel[2] * src32[((y - 1) * w + (x + 1)) * 4 + c];
            val += kernel[3] * src32[( y      * w + (x - 1)) * 4 + c];
            val += kernel[4] * src32[( y      * w +  x     ) * 4 + c];
            val += kernel[5] * src32[( y      * w + (x + 1)) * 4 + c];
            val += kernel[6] * src32[((y + 1) * w + (x - 1)) * 4 + c];
            val += kernel[7] * src32[((y + 1) * w +  x     ) * 4 + c];
            val += kernel[8] * src32[((y + 1) * w + (x + 1)) * 4 + c];
            dst[idx + c] = Math.min(255, Math.max(0, val));
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);
      setEnhanced(true);
      setProcessing(false);
    };

    img.onerror = () => {
      setProcessing(false);
    };

    img.src = src;
  }, [src, contrast, saturate, brightness, sharpen]);

  return { canvasRef, enhanced, processing };
}
