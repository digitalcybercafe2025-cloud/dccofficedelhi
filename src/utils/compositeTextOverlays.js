/**
 * Flattens DOM text overlays directly onto an image using HTML Canvas.
 * Implements precise aspect-ratio scaling during ctx.fillText():
 * 1. uiWidth = container.offsetWidth, uiHeight = container.offsetHeight
 * 2. canvasWidth = canvas.width, canvasHeight = canvas.height
 * 3. scaleX = canvasWidth / uiWidth, scaleY = canvasHeight / uiHeight
 * 4. ctx.fillText(text, domX * scaleX, domY * scaleY)
 * 5. ctx.font = `${baseFontSize * scaleY}px Arial`
 *
 * @param {string} imageBase64 - The base64 data URL of the card image.
 * @param {Array} overlays - Array of text overlay objects belonging to this card side.
 * @param {HTMLElement|Object|number} containerOrDim - DOM container element or dimensions object.
 * @returns {Promise<string>} - The flattened image as a PNG data URL.
 */
export async function flattenTextToCanvas(imageBase64, overlays = [], containerOrDim, selectionBox = null, adjustments = null) {
  if (!imageBase64) return imageBase64;
  const hasOverlays = overlays && overlays.length > 0;
  const hasAdjustments = selectionBox && adjustments && (
    adjustments.brightness !== 100 ||
    adjustments.contrast !== 100 ||
    adjustments.saturation !== 100 ||
    adjustments.beautify ||
    adjustments.autoCorrect
  );

  if (!hasOverlays && !hasAdjustments) return imageBase64;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const canvasWidth = img.naturalWidth || img.width;
        const canvasHeight = img.naturalHeight || img.height;
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageBase64);
          return;
        }

        // Draw background card image (scaled to fill canvas edge-to-edge)
        ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);

        // Apply localized photo enhancement if selectionBox & adjustments are defined
        if (selectionBox && adjustments && hasAdjustments) {
          const selX = Math.round((selectionBox.x / 100) * canvasWidth);
          const selY = Math.round((selectionBox.y / 100) * canvasHeight);
          const selW = Math.round((selectionBox.width / 100) * canvasWidth);
          const selH = Math.round((selectionBox.height / 100) * canvasHeight);

          if (selW > 0 && selH > 0) {
            const offCanvas = document.createElement('canvas');
            offCanvas.width = selW;
            offCanvas.height = selH;
            const offCtx = offCanvas.getContext('2d');
            if (offCtx) {
              offCtx.imageSmoothingEnabled = true;
              offCtx.imageSmoothingQuality = 'high';

              let filterStr = `brightness(${adjustments.brightness ?? 100}%) contrast(${adjustments.contrast ?? 100}%) saturate(${adjustments.saturation ?? 100}%)`;
              if (adjustments.beautify) {
                filterStr += ' contrast(1.12) brightness(1.08) saturate(1.15)';
              }
              if (adjustments.autoCorrect) {
                filterStr += ' contrast(1.18) brightness(1.05)';
              }
              offCtx.filter = filterStr;
              offCtx.drawImage(img, selX, selY, selW, selH, 0, 0, selW, selH);
              ctx.drawImage(offCanvas, selX, selY);
            }
          }
        }

        // 1. Get exact pixel dimensions of the UI container holding the image (strictly inner client dimensions)
        let uiContainer = null;
        let uiWidth = 320;
        let uiHeight = 202;

        if (containerOrDim && typeof containerOrDim === 'object') {
          if ('clientWidth' in containerOrDim && containerOrDim.clientWidth > 0) {
            uiContainer = containerOrDim;
            uiWidth = containerOrDim.clientWidth;
            uiHeight = containerOrDim.clientHeight || 202;
          } else if (containerOrDim.width && containerOrDim.height) {
            uiWidth = containerOrDim.width;
            uiHeight = containerOrDim.height;
          } else if ('offsetWidth' in containerOrDim && containerOrDim.offsetWidth > 0) {
            uiContainer = containerOrDim;
            uiWidth = containerOrDim.offsetWidth;
            uiHeight = containerOrDim.offsetHeight || 202;
          }
        } else if (typeof containerOrDim === 'number' && containerOrDim > 0) {
          uiWidth = containerOrDim;
        }

        // Fallback: look up in DOM by side container ID
        if ((!uiWidth || uiWidth === 320) && typeof document !== 'undefined') {
          const side = overlays[0]?.side || 'front';
          const el = document.getElementById(`idcard-${side}-container`);
          if (el && el.clientWidth > 0) {
            uiWidth = el.clientWidth;
            uiHeight = el.clientHeight || 202;
          } else if (el && el.offsetWidth > 0) {
            uiWidth = el.offsetWidth;
            uiHeight = el.offsetHeight || 202;
          }
        }

        // 2. Calculate aspect-ratio scale factor
        const scaleX = canvasWidth / uiWidth;
        const scaleY = canvasHeight / uiHeight;

        // 3. Render each overlay scaled precisely onto high-res canvas with explicit top baseline
        overlays.forEach((t) => {
          if (!t.text || !t.text.trim()) return;

          // Normalized percentage coordinates (0-100%) for zero-drift alignment
          let percentX = 46.0;
          let percentY = 36.2;

          if (t.x !== undefined) {
            percentX = t.x;
          } else if (t.pixelX !== undefined && uiWidth > 0) {
            percentX = (t.pixelX / uiWidth) * 100.0;
          }

          if (t.y !== undefined) {
            percentY = t.y;
          } else if (t.pixelY !== undefined && uiHeight > 0) {
            percentY = (t.pixelY / uiHeight) * 100.0;
          }

          const targetX = (percentX / 100.0) * canvasWidth;
          const targetY = (percentY / 100.0) * canvasHeight;

          // Proportional typography matching official Aadhaar details font
          const baseFontSize = t.fontSize || 7.5;
          const canvasFontSize = Math.max(14, Math.round(baseFontSize * scaleY));

          ctx.font = `bold ${canvasFontSize}px Arial, Helvetica, sans-serif`;
          ctx.fillStyle = t.color || '#111827';
          ctx.textBaseline = 'alphabetic';
          ctx.textAlign = 'left';

          // Match DOM font baseline (in CSS Arial with lineHeight: 1, baseline sits at ~0.78em from top)
          // This completely eliminates the ~4px downward displacement caused by canvas 'top' textBaseline
          const baselineOffset = Math.round(canvasFontSize * 0.78);

          // 1:1 matching DOM positioning with zero vertical and horizontal drift
          ctx.fillText(t.text, Math.round(targetX), Math.round(targetY + baselineOffset));
        });

        const flattenedDataUrl = canvas.toDataURL('image/png');
        resolve(flattenedDataUrl);
      } catch (err) {
        console.error('flattenTextToCanvas error:', err);
        resolve(imageBase64);
      }
    };

    img.onerror = (err) => {
      console.warn('Failed to load image for text flattening:', err);
      resolve(imageBase64);
    };

    img.src = imageBase64;
  });
}

// Backward-compatibility alias
export const compositeTextOverlays = flattenTextToCanvas;
