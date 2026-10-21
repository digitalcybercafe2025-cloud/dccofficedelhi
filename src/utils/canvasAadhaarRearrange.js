/**
 * HTML Canvas API - Aadhaar Card Image Manipulation Utility
 * 
 * Slices the card image using HTML Canvas pixel manipulation:
 * 1. Strictly PRESERVES the bottom 20% of the image (tagline "Mera Aadhaar, Meri Pehchaan").
 * 2. Scans pixel data to locate the upper-middle red instruction/warning box.
 * 3. Crops out / minimizes the red instruction box completely.
 * 4. Translates (shifts) the 12-digit Aadhaar number UPWARDS (negative Y translation) into the cleared space.
 * 
 * Returns the altered image data as a Base64 PNG Data URL.
 */
export async function rearrangeAadhaarOnCanvas(imageDataUrl) {
  return new Promise((resolve, reject) => {
    if (!imageDataUrl) {
      return reject(new Error('No image provided for Aadhaar canvas manipulation'));
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const W = img.naturalWidth || img.width;
        const H = img.naturalHeight || img.height;

        if (W === 0 || H === 0) {
          return reject(new Error('Invalid image dimensions'));
        }

        // Source canvas to read raw pixel data
        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = W;
        srcCanvas.height = H;
        const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
        srcCtx.drawImage(img, 0, 0);

        // Strictly PRESERVE bottom 20% of the image (y = 0.80 * H to H)
        const taglineTop = Math.floor(H * 0.80);
        const taglineHeight = H - taglineTop;

        // Scan the band (44% to 70% of card height) to locate red warning/instruction box
        const scanY1 = Math.floor(H * 0.44);
        const scanY2 = Math.floor(H * 0.70);
        const scanH = scanY2 - scanY1;
        const imgData = srcCtx.getImageData(0, scanY1, W, scanH);
        const data = imgData.data;

        let minRedY = null;
        let maxRedY = null;

        for (let y = 0; y < scanH; y++) {
          let redPixelCount = 0;
          for (let x = 0; x < W; x++) {
            const idx = (y * W + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            // Red / crimson boundary or text pixels of UIDAI warning box
            if (r > 125 && g < 80 && b < 80) {
              redPixelCount++;
            }
          }
          if (redPixelCount > W * 0.03) {
            if (minRedY === null) minRedY = y + scanY1;
            maxRedY = y + scanY1;
          }
        }

        // Define instruction box vertical boundaries with safety bounds
        const warningTop = minRedY !== null 
          ? Math.max(Math.floor(H * 0.46), minRedY - 2) 
          : Math.floor(H * 0.49);
        const warningBottom = maxRedY !== null 
          ? Math.min(Math.floor(H * 0.68), maxRedY + 4) 
          : Math.floor(H * 0.65);

        // Aadhaar 12-digit number strip (between warningBottom and the strictly preserved bottom 20%)
        const numberTop = warningBottom;
        const numberHeight = Math.max(20, taglineTop - warningBottom);

        // Destination Canvas
        const dstCanvas = document.createElement('canvas');
        dstCanvas.width = W;
        dstCanvas.height = H;
        const dstCtx = dstCanvas.getContext('2d');

        // Sample background color from demographic area (x: 88%, y: 38%)
        const bgSample = srcCtx.getImageData(Math.floor(W * 0.88), Math.floor(H * 0.38), 1, 1).data;
        dstCtx.fillStyle = `rgb(${bgSample[0]}, ${bgSample[1]}, ${bgSample[2]})`;
        dstCtx.fillRect(0, 0, W, H);

        // Step 1: Draw the top portion (Government header, Photo, Demographics, QR)
        dstCtx.drawImage(
          srcCanvas,
          0, 0, W, warningTop,
          0, 0, W, warningTop
        );

        // Step 2: Translate (shift) the 12-digit Aadhaar number UPWARDS into the cleared space
        // targetNumberY is higher up on the canvas (negative Y translation relative to numberTop)
        const targetNumberY = warningTop + Math.floor(H * 0.012);
        dstCtx.drawImage(
          srcCanvas,
          0, numberTop, W, numberHeight,
          0, targetNumberY, W, numberHeight
        );

        // Step 3: Strictly PRESERVE the bottom 20% of the image ("Mera Aadhaar, Meri Pehchaan")
        dstCtx.drawImage(
          srcCanvas,
          0, taglineTop, W, taglineHeight,
          0, taglineTop, W, taglineHeight
        );

        const resultDataUrl = dstCanvas.toDataURL('image/png');
        resolve(resultDataUrl);
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image for canvas manipulation'));
    img.src = imageDataUrl;
  });
}
