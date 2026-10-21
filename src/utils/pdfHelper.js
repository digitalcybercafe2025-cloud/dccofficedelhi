import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  // Use unpkg CDN or bundled worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;
}

/**
 * Check if a PDF is encrypted / requires password and optionally render page to data URL
 * Returns { success: true, dataUrl, totalPages } or throws error with password requirement indication
 */
export async function renderPdfWithPdfJs(pdfDataUrlOrBytes, password = null, scale = 2.5) {
  try {
    let rawData;
    if (typeof pdfDataUrlOrBytes === 'string') {
      const b64 = pdfDataUrlOrBytes.includes(',')
        ? pdfDataUrlOrBytes.split(',')[1]
        : pdfDataUrlOrBytes;
      const binStr = atob(b64);
      rawData = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) {
        rawData[i] = binStr.charCodeAt(i);
      }
    } else {
      rawData = pdfDataUrlOrBytes;
    }

    const loadingTask = pdfjsLib.getDocument({
      data: rawData,
      password: password || undefined
    });

    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;

    const page = await pdfDoc.getPage(1);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');

    await page.render({
      canvasContext: ctx,
      viewport: viewport
    }).promise;

    const dataUrl = canvas.toDataURL('image/png');
    return {
      success: true,
      dataUrl,
      totalPages
    };
  } catch (err) {
    if (
      err.name === 'PasswordException' ||
      err.code === 1 || // PasswordResponses.NEED_PASSWORD
      err.code === 2 || // PasswordResponses.INCORRECT_PASSWORD
      err.message?.toLowerCase().includes('password')
    ) {
      const error = new Error('PDF is password protected');
      error.isPasswordRequired = true;
      error.isIncorrectPassword = err.code === 2;
      throw error;
    }
    throw err;
  }
}
