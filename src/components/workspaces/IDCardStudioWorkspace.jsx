import React, { useState } from 'react';
import IDCardTypeSelector from '../idcard/IDCardTypeSelector';
import IDCardToolsPanel from '../idcard/IDCardToolsPanel';
import IDCardEditorCanvas from '../idcard/IDCardEditorCanvas';
import IDCardPrintPreview from '../idcard/IDCardPrintPreview';
import { DEFAULT_ID_CARDS } from '../../utils/sampleIdCards';
import { exportIDCardSingle, generateIDCardSheet } from '../../utils/api';
import { flattenTextToCanvas, compositeTextOverlays } from '../../utils/compositeTextOverlays';

export default function IDCardStudioWorkspace({ activePrinter = 'Epson L3560' }) {
  // 1. ID Card Type State
  const [selectedType, setSelectedType] = useState('aadhaar');

  // 2. Front & Back Images (both cropped display and original full document)
  const [frontCropped, setFrontCropped] = useState(DEFAULT_ID_CARDS.aadhaar.front);
  const [frontOriginal, setFrontOriginal] = useState(DEFAULT_ID_CARDS.aadhaar.front);
  const [backCropped, setBackCropped] = useState(DEFAULT_ID_CARDS.aadhaar.back);
  const [backOriginal, setBackOriginal] = useState(DEFAULT_ID_CARDS.aadhaar.back);
  const [activeSide, setActiveSide] = useState('front');

  // 3. Active Tool & Localized Marquee Selection (matching screenshot: 'select' is active)
  const [activeTool, setActiveTool] = useState('select');
  const [selectionBox, setSelectionBox] = useState({
    x: 6.6,
    y: 17,
    width: 20,
    height: 38
  });

  // 4. Localized Filters (matching screenshot slider levels)
  const [adjustments, setAdjustments] = useState({
    brightness: 125,
    contrast: 110,
    saturation: 100
  });

  // 5. Draggable Text Overlays (clean default, populated when mobile detected or user clicks + Add Text)
  const [textOverlays, setTextOverlays] = useState([]);

  // 6. CR80 Export Settings (Standard CR80: 85mm x 54mm)
  const [cr80Settings, setCr80Settings] = useState({
    width: 85,
    height: 54,
    unit: 'mm',
    dpi: 300,
    format: 'PNG'
  });

  // 7. Multi-Customer Print Queue (initialized with 1 stacked pair matching screenshot)
  const [idCardQueue, setIdCardQueue] = useState([
    {
      id: 'id_pair_init_1',
      front: DEFAULT_ID_CARDS.aadhaar.front,
      back: DEFAULT_ID_CARDS.aadhaar.back,
      offsetX: 0,
      offsetY: 0
    }
  ]);

  // 8. Output & Layout Controls
  const [layoutFormat, setLayoutFormat] = useState('PNG');
  const [marginX, setMarginX] = useState(16);
  const [marginY, setMarginY] = useState(24);
  const [cardGap, setCardGap] = useState(10);
  const [isExporting, setIsExporting] = useState(false);
  const [exportingFormat, setExportingFormat] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);

  // Switch ID Card Template
  const handleSelectType = (typeId) => {
    setSelectedType(typeId);
    const tmpl = DEFAULT_ID_CARDS[typeId] || DEFAULT_ID_CARDS.aadhaar;
    setFrontCropped(tmpl.front);
    setFrontOriginal(tmpl.front);
    setBackCropped(tmpl.back);
    setBackOriginal(tmpl.back);
    // Reset selection box to default face area
    setSelectionBox({
      x: 6.6,
      y: 17,
      width: 20,
      height: 38
    });
  };

  const handleUpdateCardImage = (side, cropped, original) => {
    if (side === 'front') {
      setFrontCropped(cropped);
      setFrontOriginal(original);
    } else {
      setBackCropped(cropped);
      setBackOriginal(original);
    }
  };

  const handleUpdateBothSides = (frontC, frontO, backC, backO) => {
    setFrontCropped(frontC);
    setFrontOriginal(frontO);
    setBackCropped(backC);
    setBackOriginal(backO);
  };

  const handleUpdateCroppedImage = (side, cropped) => {
    if (side === 'front') {
      setFrontCropped(cropped);
    } else {
      setBackCropped(cropped);
    }
  };

  // Add new Text Overlay targeted to active side (placed directly beside Male/MALE row)
  const handleAddText = (customText) => {
    const newId = `text_${Date.now()}`;
    const side = activeSide || 'front';
    const container = document.getElementById(`idcard-${side}-container`);
    const uiWidth = container?.clientWidth || 320;
    const uiHeight = container?.clientHeight || 202;
    const initialX = 46.0;
    const initialY = 36.2;

    const newText = {
      id: newId,
      text: typeof customText === 'string' && customText ? customText : 'Mobile : 8766324178',
      x: initialX,
      y: initialY,
      width: 95,
      height: 16,
      pixelX: Math.round((initialX / 100) * uiWidth),
      pixelY: Math.round((initialY / 100) * uiHeight),
      fontSize: 7.5,
      side: side
    };
    setTextOverlays((prev) => [...prev, newText]);
  };

  // Rotate images 90 degrees
  const handleRotate = () => {
    const targetImage = activeSide === 'front' ? frontCropped : backCropped;
    if (!targetImage) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext('2d');
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((90 * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      const rotated = canvas.toDataURL('image/png');
      if (activeSide === 'front') {
        setFrontCropped(rotated);
      } else {
        setBackCropped(rotated);
      }
    };
    img.src = targetImage;
  };

  // Stacking: Add to Print Preview (flattens DOM text overlays onto actual canvas image using exact aspect ratio scaling)
  const handleAddToPrintPreview = async (containers) => {
    // Condition: Strict maximum 5 cards on A4 sheet
    if (idCardQueue.length >= 5) {
      alert("⚠️ A4 Sheet Full! A4 Sheet par maximum 5 ID cards hi add kiye ja sakte hain. Naya card add karne ke liye pehle kisi purane card ko delete karein ya sheet clear karein.");
      return;
    }

    // Docs Mode (Single A4 Document from Special Card)
    if (containers?.isDoc && containers?.docImage) {
      const newDocItem = {
        id: `id_doc_${Date.now()}`,
        front: containers.docImage,
        back: null,
        docImage: containers.docImage,
        isDoc: true,
        type: 'special',
        offsetX: 0,
        offsetY: 0
      };
      setIdCardQueue((prev) => [...prev, newDocItem]);
      return;
    }

    if (!frontCropped && !backCropped) return;

    const frontContainer = containers?.frontContainer || document.getElementById('idcard-front-container');
    const backContainer = containers?.backContainer || document.getElementById('idcard-back-container');

    // Flatten DOM text overlays directly onto image canvas using ctx.fillText()
    const frontOverlays = textOverlays.filter((t) => (t.side || 'front') === 'front');
    const backOverlays = textOverlays.filter((t) => t.side === 'back');

    let finalFront = frontCropped;
    let finalBack = backCropped;

    const frontBox = activeSide === 'front' ? selectionBox : null;
    const backBox = activeSide === 'back' ? selectionBox : null;

    if (frontCropped) {
      finalFront = await flattenTextToCanvas(frontCropped, frontOverlays, frontContainer, frontBox, adjustments);
    }
    if (backCropped) {
      finalBack = await flattenTextToCanvas(backCropped, backOverlays, backContainer, backBox, adjustments);
    }

    const newPair = {
      id: `id_pair_${Date.now()}`,
      front: finalFront,
      back: finalBack,
      type: selectedType,
      offsetX: 0,
      offsetY: 0
    };

    setIdCardQueue((prev) => [...prev, newPair]);

    // Reset editor frames for next customer
    setFrontCropped(null);
    setFrontOriginal(null);
    setBackCropped(null);
    setBackOriginal(null);
    setSelectionBox(null);
    setTextOverlays([]);
  };

  // Delete pair from print queue
  const handleDeletePair = (indexToDelete) => {
    setIdCardQueue((prev) => prev.filter((_, idx) => idx !== indexToDelete));
  };

  // Update individual pair offsets (X-Axis and Y-Axis margins)
  const handleUpdatePairOffset = (index, updates) => {
    setIdCardQueue((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...updates } : item))
    );
  };

  // Export Single CR80 Card Pair (with text overlays flattened)
  const handleDownloadSingle = async (containers) => {
    // Docs Mode Single Export
    if (containers?.isDoc && containers?.docImage) {
      const ext = cr80Settings.format.toLowerCase();
      if (window.electronAPI?.saveFileDialog && window.electronAPI?.saveFile) {
        const { canceled, filePath } = await window.electronAPI.saveFileDialog(
          `special-doc-${Date.now()}.${ext}`,
          ext
        );
        if (!canceled && filePath) {
          await window.electronAPI.saveFile(filePath, containers.docImage);
          if (window.electronAPI.openPath) {
            window.electronAPI.openPath(filePath);
          }
        }
      } else {
        const link = document.createElement('a');
        link.href = containers.docImage;
        link.download = `special-doc-${Date.now()}.${ext}`;
        link.click();
      }
      return;
    }

    if (!frontCropped && !backCropped) return;
    try {
      const frontContainer = containers?.frontContainer || document.getElementById('idcard-front-container');
      const backContainer = containers?.backContainer || document.getElementById('idcard-back-container');

      const frontOverlays = textOverlays.filter((t) => (t.side || 'front') === 'front');
      const backOverlays = textOverlays.filter((t) => t.side === 'back');

      let finalFront = frontCropped;
      let finalBack = backCropped;

      const frontBox = activeSide === 'front' ? selectionBox : null;
      const backBox = activeSide === 'back' ? selectionBox : null;

      if (frontCropped) {
        finalFront = await flattenTextToCanvas(frontCropped, frontOverlays, frontContainer, frontBox, adjustments);
      }
      if (backCropped) {
        finalBack = await flattenTextToCanvas(backCropped, backOverlays, backContainer, backBox, adjustments);
      }

      const result = await exportIDCardSingle({
        front: finalFront,
        back: finalBack,
        width: 1011,
        height: 638,
        dpi: cr80Settings.dpi,
        format: cr80Settings.format,
        marginX,
        marginY
      });

      if (result.dataUrl) {
        const ext = cr80Settings.format.toLowerCase();
        if (window.electronAPI?.saveFileDialog && window.electronAPI?.saveFile) {
          const { canceled, filePath } = await window.electronAPI.saveFileDialog(
            `id-card-${selectedType}-${Date.now()}.${ext}`,
            ext
          );
          if (!canceled && filePath) {
            await window.electronAPI.saveFile(filePath, result.dataUrl);
            if (window.electronAPI.openPath) {
              window.electronAPI.openPath(filePath);
            }
          }
        } else {
          const link = document.createElement('a');
          link.href = result.dataUrl;
          link.download = `id-card-${selectedType}.${ext}`;
          link.click();
        }
      }
    } catch (err) {
      alert('Failed to export single ID card: ' + err.message);
    }
  };

  // Export Full A4 Sheet (PNG, PDF, DOCX)
  const handleExportSheet = async (format) => {
    if (idCardQueue.length === 0) return;
    setIsExporting(true);
    setExportingFormat(format);
    try {
      const result = await generateIDCardSheet(idCardQueue, format, {
        marginX,
        marginY,
        cardGap
      });

      if (result.dataUrl) {
        const ext = (result.format || format).toLowerCase();
        if (window.electronAPI?.saveFileDialog && window.electronAPI?.saveFile) {
          const { canceled, filePath } = await window.electronAPI.saveFileDialog(
            `id-cards-a4-sheet-${Date.now()}.${ext}`,
            ext
          );
          if (!canceled && filePath) {
            await window.electronAPI.saveFile(filePath, result.dataUrl);
            if (window.electronAPI.openPath) {
              window.electronAPI.openPath(filePath);
            }
          }
        } else {
          const link = document.createElement('a');
          link.href = result.dataUrl;
          link.download = `id-cards-a4-sheet.${ext}`;
          link.click();
        }
      }
    } catch (err) {
      alert('Export failed: ' + err.message);
    } finally {
      setIsExporting(false);
      setExportingFormat(null);
    }
  };

  // Captures the exact final rendered preview layout (combined canvas with applied margins, gaps, and exact scaling)
  const capturePreviewLayoutSnapshot = async (queue, mX = 16, mY = 24, cGap = 10) => {
    return new Promise(async (resolve) => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 2480;
        canvas.height = 3508;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const previewW = 240;
        const previewH = 340;
        const scaleX = canvas.width / previewW;
        const scaleY = canvas.height / previewH;

        const rawMarginX = Math.round(mX * scaleX);
        const startX = Math.max(50, rawMarginX);
        const rawMarginY = Math.round(mY * scaleY);
        const startY = Math.max(50, rawMarginY);

        const foldingGap = 4;
        const availableW = canvas.width - (startX * 2);
        const cardW = Math.floor((availableW - foldingGap) / 2);
        const cardH = Math.round(cardW * (54.0 / 85.6));

        const gapY = Math.max(4, Math.round(cGap * scaleY));
        let currY = startY;

        const loadImg = (src) =>
          new Promise((res) => {
            if (!src) return res(null);
            const i = new Image();
            i.crossOrigin = 'anonymous';
            i.onload = () => res(i);
            i.onerror = () => res(null);
            i.src = src;
          });

        for (const item of queue) {
          const offsetX = Math.round((item.offsetX || 0) * scaleX);
          const offsetY = Math.round((item.offsetY || 0) * scaleY);

          if (item.isDoc) {
            const docSrc = item.docImage || item.front;
            if (docSrc) {
              const dImg = await loadImg(docSrc);
              if (dImg) {
                const availW = canvas.width - (startX * 2);
                const availH = canvas.height - (startY * 2);
                let docW = availW;
                let docH = Math.round(docW * 1.414);
                if (docH > availH) {
                  docH = availH;
                  docW = Math.round(docH / 1.414);
                }
                const docX = startX + Math.floor((availW - docW) / 2) + offsetX;
                const docY = startY + Math.floor((availH - docH) / 2) + offsetY;
                ctx.drawImage(dImg, docX, docY, docW, docH);
              }
            }
            currY += canvas.height;
            continue;
          }

          const cardStartX = Math.max(0, Math.min(canvas.width - (cardW * 2 + foldingGap), startX + offsetX));
          const cardStartY = Math.max(0, Math.min(canvas.height - cardH, currY + offsetY));

          if (item.front) {
            const fImg = await loadImg(item.front);
            if (fImg) {
              ctx.drawImage(fImg, cardStartX, cardStartY, cardW, cardH);
              ctx.lineWidth = 1;
              ctx.strokeStyle = '#000000';
              ctx.strokeRect(cardStartX, cardStartY, cardW, cardH);
            }
          }

          if (item.back) {
            const bImg = await loadImg(item.back);
            if (bImg) {
              const backX = cardStartX + cardW + foldingGap;
              ctx.drawImage(bImg, backX, cardStartY, cardW, cardH);
              ctx.lineWidth = 1;
              ctx.strokeStyle = '#000000';
              ctx.strokeRect(backX, cardStartY, cardW, cardH);
            }
          }

          // Exact physical folding cut line between cards
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#000000';
          ctx.beginPath();
          ctx.moveTo(cardStartX + cardW + Math.floor(foldingGap / 2), cardStartY);
          ctx.lineTo(cardStartX + cardW + Math.floor(foldingGap / 2), cardStartY + cardH);
          ctx.stroke();

          currY += cardH + gapY;
        }

        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        console.warn('capturePreviewLayoutSnapshot error:', err);
        resolve(null);
      }
    });
  };

  // Direct Print A4 Sheet via Resizable Print Hub Sub-Window
  const handleDirectPrint = async () => {
    if (idCardQueue.length === 0) return;
    setIsPrinting(true);
    try {
      // Capture EXACT final rendered preview layout snapshot
      let sheetSnapshot = null;
      try {
        const sheetRes = await generateIDCardSheet(idCardQueue, 'PNG', {
          marginX,
          marginY,
          cardGap
        });
        if (sheetRes?.dataUrl) {
          sheetSnapshot = sheetRes.dataUrl;
        }
      } catch (sheetErr) {
        console.warn('Backend sheet generation for snapshot failed, falling back to client canvas:', sheetErr);
      }

      if (!sheetSnapshot) {
        sheetSnapshot = await capturePreviewLayoutSnapshot(idCardQueue, marginX, marginY, cardGap);
      }

      if (window.ipcRenderer?.send) {
        window.ipcRenderer.send('open-print-window', {
          idCardQueue,
          type: 'idcard',
          activePrinter,
          marginX,
          marginY,
          cardGap,
          snapshot: sheetSnapshot
        });
      } else if (window.electronAPI?.print) {
        await window.electronAPI.print({ deviceName: activePrinter });
      } else {
        window.print();
      }
    } catch (err) {
      alert('Direct print failed: ' + err.message);
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <main className="flex-1 p-3 grid grid-cols-12 gap-3 overflow-hidden">
      {/* COLUMN 1: LEFT PANEL (ID Card Type & Advanced Tools) */}
      <div className="col-span-3 flex flex-col justify-between overflow-y-auto no-print">
        <div>
          {/* ID Card Type Selector */}
          <IDCardTypeSelector
            selectedType={selectedType}
            onSelectType={handleSelectType}
          />

          {/* Advanced Tools & Localized Adjustments */}
          <IDCardToolsPanel
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            onAddText={handleAddText}
            onRotate={handleRotate}
            adjustments={adjustments}
            onChangeAdjustments={setAdjustments}
            hasSelection={!!selectionBox}
          />
        </div>
      </div>

      {/* COLUMN 2: CENTER PANEL (Core Editor Canvas) */}
      <div className="col-span-5 flex flex-col h-full overflow-hidden no-print">
        <IDCardEditorCanvas
          selectedType={selectedType}
          frontCropped={frontCropped}
          frontOriginal={frontOriginal}
          backCropped={backCropped}
          backOriginal={backOriginal}
          onUpdateCardImage={handleUpdateCardImage}
          onUpdateBothSides={handleUpdateBothSides}
          onUpdateCroppedImage={handleUpdateCroppedImage}
          activeSide={activeSide}
          onSelectSide={setActiveSide}
          activeTool={activeTool}
          adjustments={adjustments}
          selectionBox={selectionBox}
          setSelectionBox={setSelectionBox}
          textOverlays={textOverlays}
          setTextOverlays={setTextOverlays}
          onDownloadSingle={handleDownloadSingle}
          onAddToPrintPreview={handleAddToPrintPreview}
          cr80Settings={cr80Settings}
          setCr80Settings={setCr80Settings}
        />
      </div>

      {/* COLUMN 3: RIGHT PANEL (Print Preview & Output Controls) */}
      <div className="col-span-4 flex flex-col h-full overflow-hidden">
        <IDCardPrintPreview
          idCardQueue={idCardQueue}
          onDeletePair={handleDeletePair}
          onClearQueue={() => setIdCardQueue([])}
          layoutFormat={layoutFormat}
          onChangeLayoutFormat={setLayoutFormat}
          onExport={handleExportSheet}
          onDirectPrint={handleDirectPrint}
          isExporting={isExporting}
          exportingFormat={exportingFormat}
          isPrinting={isPrinting}
          marginX={marginX}
          marginY={marginY}
          onChangeMarginX={setMarginX}
          onChangeMarginY={setMarginY}
          cardGap={cardGap}
          onChangeCardGap={setCardGap}
          onUpdatePairOffset={handleUpdatePairOffset}
        />
      </div>
    </main>
  );
}
