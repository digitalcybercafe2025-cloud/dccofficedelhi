export const API_BASE_URL = 'http://127.0.0.1:5005';
export const API_BASE = `${API_BASE_URL}/api`;

async function parseApiResponse(res, fallbackError = 'Request failed') {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error || `${fallbackError} (status ${res.status})`);
    }
    return data;
  }
  const text = await res.text();
  const cleanMsg = text.replace(/<[^>]*>?/gm, '').trim().slice(0, 120);
  throw new Error(`${fallbackError}: ${cleanMsg || res.statusText || res.status}`);
}

export async function checkBackendHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, {
      mode: 'cors',
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error('Health check failed');
    return await res.json();
  } catch (err) {
    return { status: 'offline', error: err.message };
  }
}

export async function removeBackground(imageBase64, bgColor = '#2b7fff') {
  try {
    const res = await fetch(`${API_BASE}/remove-bg`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ image: imageBase64, bgColor })
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Failed to remove background');
    return data.image;
  } catch (err) {
    console.error('removeBackground API error:', err);
    throw err;
  }
}

export async function enhancePhoto(imageBase64, fidelityWeight = 0.5) {
  try {
    const res = await fetch(`${API_BASE}/enhance-photo`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ image: imageBase64, weight: fidelityWeight })
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Failed to enhance photo');
    return data.image;
  } catch (err) {
    console.error('enhancePhoto API error:', err);
    throw err;
  }
}

export async function adjustImage(imageBase64, { brightness = 1.0, contrast = 1.0, sharpness = 1.0, color = 1.0 }) {
  try {
    const res = await fetch(`${API_BASE}/adjust`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        image: imageBase64,
        brightness,
        contrast,
        sharpness,
        color
      })
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Adjustment failed');
    return data.image;
  } catch (err) {
    console.error('adjustImage API error:', err);
    throw err;
  }
}

export async function generateA4Sheet(items, format = 'PNG', options = {}) {
  try {
    const res = await fetch(`${API_BASE}/generate-sheet`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        items,
        format,
        marginX: options.marginX || 16,
        marginY: options.marginY || 24,
        addBorder: options.addBorder !== false
      })
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Sheet generation failed');
    return data;
  } catch (err) {
    console.error('generateA4Sheet API error:', err);
    throw err;
  }
}

export async function exportSinglePhoto({ image, width = 350, height = 450, format = 'JPG', dpi = 300, addBorder = true, maxKb = null }) {
  try {
    const res = await fetch(`${API_BASE}/export-single-photo`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        image,
        width,
        height,
        format,
        dpi,
        addBorder,
        maxKb
      })
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Single photo export failed');
    return data;
  } catch (err) {
    console.error('exportSinglePhoto error:', err);
    throw err;
  }
}

export async function getPrinters() {
  try {
    const res = await fetch(`${API_BASE}/printers`, {
      mode: 'cors',
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error('Failed to query printers');
    return await res.json();
  } catch (err) {
    return {
      printers: [
        { name: 'Epson L3560', isDefault: true, status: 'Ready' },
        { name: 'HP Ink Tank 415', isDefault: false, status: 'Ready' }
      ],
      activePrinter: 'Epson L3560'
    };
  }
}

export async function exportIDCardSingle({ front, back, width = 1011, height = 638, dpi = 300, format = 'PNG', marginX = 0, marginY = 0 }) {
  try {
    const res = await fetch(`${API_BASE}/idcard/export-single`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        front,
        back,
        width,
        height,
        dpi,
        format,
        marginX,
        marginY
      })
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'ID Card single export failed');
    return data;
  } catch (err) {
    console.error('exportIDCardSingle error:', err);
    throw err;
  }
}

export async function generateIDCardSheet(items, format = 'PNG', options = {}) {
  try {
    const res = await fetch(`${API_BASE}/idcard/generate-sheet`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        items,
        format,
        marginX: options.marginX || 16,
        marginY: options.marginY || 24,
        cardGap: options.cardGap !== undefined ? options.cardGap : 10,
        previewWidth: options.previewWidth || 240
      })
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'ID Card sheet generation failed');
    return data;
  } catch (err) {
    console.error('generateIDCardSheet error:', err);
    throw err;
  }
}

export async function convertPdfToImage(pdfData, pageNumber = 0, dpi = 300, password = null, cardType = 'aadhaar') {
  try {
    const res = await fetch(`${API_BASE}/idcard/convert-pdf`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        pdfData,
        pageNumber,
        dpi,
        password,
        cardType
      })
    });
    return await parseApiResponse(res, 'PDF conversion failed');
  } catch (err) {
    console.error('convertPdfToImage error:', err);
    throw err;
  }
}

export async function autoCropIDCard(imageDataUrl, side = 'front', cardType = 'aadhaar') {
  try {
    const res = await fetch(`${API_BASE}/idcard/auto-crop`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        image: imageDataUrl,
        side,
        cardType
      })
    });
    return await parseApiResponse(res, 'Auto crop failed');
  } catch (err) {
    console.warn('autoCropIDCard fallback to original:', err);
    return {
      success: true,
      croppedImage: imageDataUrl,
      originalImage: imageDataUrl,
      detected: false
    };
  }
}

export async function rearrangeAadhaarCard(imageBase64) {
  try {
    const res = await fetch(`${API_BASE}/idcard/rearrange-aadhaar`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ image: imageBase64 })
    });
    const data = await parseApiResponse(res, 'Aadhaar rearrangement failed');
    return data.image;
  } catch (err) {
    console.error('rearrangeAadhaarCard error:', err);
    throw err;
  }
}

export async function perspectiveCropImage(imageDataUrl, points, targetAspect = 1.414, rotation = 0, scanMode = 'original') {
  try {
    const res = await fetch(`${API_BASE}/idcard/perspective-crop`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        image: imageDataUrl,
        points,
        targetAspect,
        rotation,
        scanMode,
        isPercent: true
      })
    });
    return await parseApiResponse(res, 'Perspective crop failed');
  } catch (err) {
    console.error('perspectiveCropImage error:', err);
    throw err;
  }
}

export async function detectDocumentCorners(imageDataUrl) {
  try {
    const res = await fetch(`${API_BASE}/idcard/detect-corners`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ image: imageDataUrl })
    });
    return await parseApiResponse(res, 'Failed to detect corners');
  } catch (err) {
    console.warn('detectDocumentCorners error:', err);
    return { hasDetection: false, points: null };
  }
}

function clientSideScanEffect(srcUrl, mode) {
  return new Promise((resolve) => {
    if (!srcUrl || mode === 'original') return resolve(srcUrl);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');

      if (mode === 'bw' || mode === 'black_white') {
        // High-contrast clean black and white document scan
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, w, h);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          const val = gray > 140 ? 255 : (gray < 80 ? 0 : (gray - 80) * (255 / 60));
          const finalVal = val > 160 ? 255 : 0;
          d[i] = finalVal;
          d[i + 1] = finalVal;
          d[i + 2] = finalVal;
        }
        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } else if (mode === 'magic_color' || mode === 'color_scan') {
        // Magic color scan: removes yellowing and shadows, brightens white paper
        ctx.filter = 'brightness(1.18) contrast(1.35) saturate(1.12)';
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } else if (mode === 'grayscale') {
        ctx.filter = 'grayscale(1) brightness(1.1) contrast(1.25)';
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } else {
        resolve(srcUrl);
      }
    };
    img.onerror = () => resolve(srcUrl);
    img.src = srcUrl;
  });
}

export async function applyScanEffect(imageDataUrl, mode = 'magic_color') {
  try {
    const res = await fetch(`${API_BASE}/idcard/apply-scan-effect`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ image: imageDataUrl, mode })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Backend apply-scan-effect unavailable, falling back to client canvas:', err);
  }

  // Guaranteed client-side fallback (works offline / during reload)
  try {
    const fallbackDataUrl = await clientSideScanEffect(imageDataUrl, mode);
    return { success: true, dataUrl: fallbackDataUrl, mode };
  } catch (clientErr) {
    console.error('Client scan effect error:', clientErr);
    return { success: true, dataUrl: imageDataUrl, mode };
  }
}



