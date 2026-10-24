import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  RefreshCw,
  Download,
  Link2,
  Plus,
  Trash2,
  Crop,
  CheckCircle2,
  Loader2,
  Copy,
  Check,
  Sparkles,
  Maximize2,
  FileText,
  CreditCard,
  Scan,
  ArrowLeftRight,
  ArrowUpDown,
  RotateCcw
} from 'lucide-react';
import { Rnd } from 'react-rnd';
import { createWorker } from 'tesseract.js';
import ManualCropModal from '../modals/ManualCropModal';
import PerspectiveCropModal from '../modals/PerspectiveCropModal';
import IDCardMagnifierModal from '../modals/IDCardMagnifierModal';
import PdfPasswordModal from '../modals/PdfPasswordModal';
import { renderPdfWithPdfJs } from '../../utils/pdfHelper';
import { convertPdfToImage, autoCropIDCard, applyScanEffect } from '../../utils/api';
import { rearrangeAadhaarOnCanvas } from '../../utils/canvasAadhaarRearrange';

export default function IDCardEditorCanvas({
  selectedType = 'aadhaar',
  frontCropped,
  frontOriginal,
  backCropped,
  backOriginal,
  onUpdateCardImage,
  onUpdateBothSides,
  onUpdateCroppedImage,
  activeSide,
  onSelectSide,
  activeTool,
  adjustments,
  selectionBox,
  setSelectionBox,
  textOverlays,
  setTextOverlays,
  onDownloadSingle,
  onAddToPrintPreview,
  cr80Settings,
  setCr80Settings
}) {
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [isRearranging, setIsRearranging] = useState(false);

  // Active text overlay for drag & directional arrow navigation
  const [activeTextId, setActiveTextId] = useState(null);
  const [draggableTextId, setDraggableTextId] = useState(null);

  // Extracted mobile number state & copy indicator (defaults to 9876543210 demo number)
  const [extractedMobile, setExtractedMobile] = useState('9876543210');
  const [isCopied, setIsCopied] = useState(false);

  // Manual Crop Modal State
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [cropModalSide, setCropModalSide] = useState('front');
  const [cropModalImage, setCropModalImage] = useState(null);

  // Magnifier Lightbox Modal State
  const [magnifierState, setMagnifierState] = useState({
    isOpen: false,
    imageSrc: '',
    title: ''
  });

  // PDF Password Modal State
  const [pdfPasswordState, setPdfPasswordState] = useState({
    isOpen: false,
    fileName: '',
    dataUrl: null,
    targetMode: 'card', // 'card' | 'doc'
    side: 'front',
    errorMessage: '',
    isSubmitting: false
  });

  const frontInputRef = useRef(null);
  const backInputRef = useRef(null);
  const frontContainerRef = useRef(null);
  const backContainerRef = useRef(null);
  const outerCanvasRef = useRef(null);
  const docToolbarRef = useRef(null);
  const cachedGenderBoxRef = useRef(null);

  // Special Card: Sub-mode ('cards' | 'docs')
  const [specialMode, setSpecialMode] = useState('cards');
  const [docImage, setDocImage] = useState(null);
  const [docOriginal, setDocOriginal] = useState(null);
  const [perspectiveModalState, setPerspectiveModalState] = useState({
    isOpen: false,
    side: 'doc',
    imageSrc: null,
    preset: 'a4',
    title: ''
  });
  const [isDocPanning, setIsDocPanning] = useState(false);
  const [docPanStart, setDocPanStart] = useState({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  const [docScanMode, setDocScanMode] = useState('original');
  const [docRawCropped, setDocRawCropped] = useState(null);
  const [docZoom, setDocZoom] = useState(1.0);
  const [docScaleW, setDocScaleW] = useState(100);
  const [docScaleH, setDocScaleH] = useState(100);
  const [docNaturalSize, setDocNaturalSize] = useState({ width: 0, height: 0 });
  const [isApplyingScanEffect, setIsApplyingScanEffect] = useState(false);
  const [isDocSelected, setIsDocSelected] = useState(false);

  // Read natural pixel dimensions whenever docImage is loaded or changed
  useEffect(() => {
    if (!docImage) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setDocNaturalSize({
        width: img.naturalWidth || 1200,
        height: img.naturalHeight || 1600
      });
    };
    img.src = docImage;
  }, [docImage]);

  // Instant single-click outside detection to deselect document
  useEffect(() => {
    if (!isDocSelected) return;

    const handlePointerDownOutside = (e) => {
      // If clicked inside the document container or inside the scan mode toolbar, keep selected
      if (
        docContainerRef.current?.contains(e.target) ||
        docToolbarRef.current?.contains(e.target)
      ) {
        return;
      }
      setIsDocSelected(false);
    };

    document.addEventListener('pointerdown', handlePointerDownOutside);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDownOutside);
    };
  }, [isDocSelected]);

  // Helper to scale document image according to width & height adjustments for export / print preview
  const applyDimensionScaling = async (imageSrc, scaleW, scaleH) => {
    if (!imageSrc || (scaleW === 100 && scaleH === 100)) return imageSrc;
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const sw = scaleW / 100;
        const sh = scaleH / 100;
        const targetW = Math.max(10, Math.round(img.naturalWidth * sw));
        const targetH = Math.max(10, Math.round(img.naturalHeight * sh));
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetW, targetH);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(imageSrc);
      img.src = imageSrc;
    });
  };

  const handleToggleSpecialMode = (mode) => {
    setSpecialMode(mode);
    setIsDocSelected(false);
    if (mode === 'docs') {
      if (cr80Settings?.width === 85 && cr80Settings?.height === 54) {
        setCr80Settings?.((prev) => ({ ...prev, width: 210, height: 297, unit: 'mm' }));
      }
    } else {
      if (cr80Settings?.width === 210 && cr80Settings?.height === 297) {
        setCr80Settings?.((prev) => ({ ...prev, width: 85, height: 54, unit: 'mm' }));
      }
    }
  };

  const updateDocScaleW = (newVal) => {
    const val = Math.max(20, Math.min(250, newVal));
    setDocScaleW(val);
    if (selectedType === 'special' && specialMode === 'docs' && cr80Settings?.unit === 'mm') {
      setCr80Settings?.((prev) => ({ ...prev, width: Math.round((210 * val) / 100) }));
    }
  };

  const updateDocScaleH = (newVal) => {
    const val = Math.max(20, Math.min(250, newVal));
    setDocScaleH(val);
    if (selectedType === 'special' && specialMode === 'docs' && cr80Settings?.unit === 'mm') {
      setCr80Settings?.((prev) => ({ ...prev, height: Math.round((297 * val) / 100) }));
    }
  };

  const baseDocW = docNaturalSize.width || 1200;
  const baseDocH = docNaturalSize.height || 1600;
  const currentDocPxW = Math.round((baseDocW * docScaleW) / 100);
  const currentDocPxH = Math.round((baseDocH * docScaleH) / 100);

  const updateDocPxW = (newPx) => {
    const px = Math.max(50, Number(newPx) || 50);
    const newPercent = Math.round((px / baseDocW) * 100);
    updateDocScaleW(newPercent);
  };

  const updateDocPxH = (newPx) => {
    const px = Math.max(50, Number(newPx) || 50);
    const newPercent = Math.round((px / baseDocH) * 100);
    updateDocScaleH(newPercent);
  };

  const handleResetDocScale = () => {
    setDocScaleW(100);
    setDocScaleH(100);
    if (selectedType === 'special' && specialMode === 'docs' && cr80Settings?.unit === 'mm') {
      setCr80Settings?.((prev) => ({ ...prev, width: 210, height: 297 }));
    }
  };

  const docInputRef = useRef(null);
  const docContainerRef = useRef(null);

  // Drag-to-pan handlers for Docs Mode (holds left click to drag freely in all directions)
  const handleDocMouseDown = (e) => {
    const scrollTarget = outerCanvasRef.current || docContainerRef.current;
    if (!scrollTarget) return;
    if (e.button !== 0) return;
    setIsDocPanning(true);
    setDocPanStart({
      x: e.clientX,
      y: e.clientY,
      scrollLeft: scrollTarget.scrollLeft,
      scrollTop: scrollTarget.scrollTop
    });
  };

  const handleDocMouseMove = (e) => {
    const scrollTarget = outerCanvasRef.current || docContainerRef.current;
    if (!isDocPanning || !scrollTarget) return;
    const dx = e.clientX - docPanStart.x;
    const dy = e.clientY - docPanStart.y;
    scrollTarget.scrollLeft = docPanStart.scrollLeft - dx;
    scrollTarget.scrollTop = docPanStart.scrollTop - dy;
  };

  const handleDocMouseUp = () => {
    setIsDocPanning(false);
  };

  // Mouse wheel handler for Docs Mode: allows natural vertical scrolling, Ctrl+Wheel for zoom
  const handleDocWheel = (e) => {
    if (!docImage) return;
    if (e.ctrlKey) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      setDocZoom((z) => Math.max(0.5, Math.min(3.0, Math.round(z * factor * 100) / 100)));
    }
  };

  // Apply Document Scanner Effect (Original, Magic Color Scan, B&W Xerox)
  const handleApplyScanEffectToDoc = async (mode) => {
    if (!docImage || isApplyingScanEffect) return;
    setDocScanMode(mode);
    const baseToFilter = docRawCropped || docImage;
    if (!docRawCropped) setDocRawCropped(docImage);

    if (mode === 'original') {
      setDocImage(baseToFilter);
      return;
    }

    setIsApplyingScanEffect(true);
    try {
      const res = await applyScanEffect(baseToFilter, mode);
      if (res?.dataUrl) {
        setDocImage(res.dataUrl);
      }
    } catch (err) {
      alert('Failed to apply scan effect: ' + err.message);
    } finally {
      setIsApplyingScanEffect(false);
    }
  };

  // File upload for Docs Mode
  const handleDocFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        let imageDataUrl = event.target.result;
        if (isPdf) {
          setProcessingStatus('Converting PDF to 300 DPI image...');
          let pdfRes = null;
          try {
            pdfRes = await convertPdfToImage(imageDataUrl, 0, 300, null, 'special');
          } catch (pdfErr) {
            const isPassErr =
              pdfErr.message?.toLowerCase().includes('password') ||
              pdfErr.message?.includes('401');
            if (isPassErr) {
              setPdfPasswordState({
                isOpen: true,
                fileName: file.name,
                dataUrl: imageDataUrl,
                targetMode: 'doc',
                side: 'front',
                errorMessage: '',
                isSubmitting: false
              });
              setIsProcessingFile(false);
              setProcessingStatus('');
              return;
            } else {
              // Try client PDF.js fallback
              try {
                const jsRes = await renderPdfWithPdfJs(imageDataUrl, null);
                pdfRes = { dataUrl: jsRes.dataUrl, totalPages: jsRes.totalPages };
              } catch (jsErr) {
                if (jsErr.isPasswordRequired || jsErr.message?.toLowerCase().includes('password')) {
                  setPdfPasswordState({
                    isOpen: true,
                    fileName: file.name,
                    dataUrl: imageDataUrl,
                    targetMode: 'doc',
                    side: 'front',
                    errorMessage: '',
                    isSubmitting: false
                  });
                  setIsProcessingFile(false);
                  setProcessingStatus('');
                  return;
                }
                throw pdfErr;
              }
            }
          }
          if (!pdfRes?.dataUrl) throw new Error('PDF conversion returned no image');
          imageDataUrl = pdfRes.dataUrl;
        }
        setDocOriginal(imageDataUrl);
        setDocRawCropped(imageDataUrl);
        setDocScanMode('original');
        setDocZoom(1.0);
        setDocImage(imageDataUrl);
      } catch (err) {
        alert('Document upload failed: ' + err.message);
      } finally {
        setIsProcessingFile(false);
        setProcessingStatus('');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Detect gender text bounding box ("Male", "Female", "पुरुष", "महिला") on front card image
  const detectGenderBoundingBox = async (frontImgUrl) => {
    if (!frontImgUrl) return null;
    try {
      const worker = await createWorker('eng');
      const ret = await worker.recognize(frontImgUrl);
      await worker.terminate();

      const words = ret?.data?.words || [];
      const imgW = ret?.data?.image_width || 1000;
      const imgH = ret?.data?.image_height || 630;

      const genderTargets = ['female', 'male', 'महिला', 'पुरुष'];
      let targetWord = null;

      // 1. Exact match pass
      for (const w of words) {
        const clean = (w.text || '').toLowerCase().replace(/[^a-z\u0900-\u097F]/g, '');
        if (genderTargets.includes(clean)) {
          targetWord = w;
          break;
        }
      }

      // 2. Substring match pass (e.g. "Female/", "Male:", "महिला/Female")
      if (!targetWord) {
        for (const w of words) {
          const clean = (w.text || '').toLowerCase();
          if (clean.includes('female') || clean.includes('male') || clean.includes('महिला') || clean.includes('पुरुष')) {
            targetWord = w;
            break;
          }
        }
      }

      if (targetWord && targetWord.bbox) {
        const { x0, y0, x1, y1 } = targetWord.bbox;
        const box = {
          x: (x0 / imgW) * 100,
          y: (y0 / imgH) * 100,
          width: ((x1 - x0) / imgW) * 100,
          height: ((y1 - y0) / imgH) * 100,
          text: targetWord.text
        };
        cachedGenderBoxRef.current = box;
        return box;
      }
    } catch (err) {
      console.warn('Tesseract OCR gender bounding box detection error:', err);
    }
    return null;
  };

  /**
   * Computes Mobile Number position:
   * Sets Mobile Number Y-coordinate to exactly match genderBox's y value,
   * and X-coordinate right next to gender text with 4px gap.
   */
  const computeMobilePosition = (genderBox, targetSide = 'front') => {
    const container = targetSide === 'front' ? frontContainerRef.current : backContainerRef.current;
    const uiW = container?.clientWidth || 320;
    const uiH = container?.clientHeight || 202;

    const gBox = genderBox || cachedGenderBoxRef.current;
    if (gBox && typeof gBox.y === 'number') {
      const endPercentX = gBox.endX !== undefined ? gBox.endX : ((gBox.x || 38) + (gBox.width || 12));
      const boxUiEndX = (endPercentX / 100) * uiW;

      // Exactly align next to gender text on the exact same line:
      // X is right next to Male / Female text (+ 4px gap)
      // Y is exactly the gender line top baseline
      const targetPixelX = Math.round(boxUiEndX + 4);
      const targetPixelY = Math.round((gBox.y / 100) * uiH);

      const targetX = (targetPixelX / uiW) * 100;
      const targetY = (targetPixelY / uiH) * 100;

      return {
        x: Number(targetX.toFixed(2)),
        y: Number(targetY.toFixed(2)),
        pixelX: targetPixelX,
        pixelY: targetPixelY,
        fontSize: 7.5
      };
    }

    // Default standard Aadhaar alignment
    const initialX = 48.0;
    const initialY = 37.0;
    return {
      x: initialX,
      y: initialY,
      pixelX: Math.round((initialX / 100) * uiW),
      pixelY: Math.round((initialY / 100) * uiH),
      fontSize: 7.5
    };
  };

  // Fallback Tesseract.js OCR to scan 10-digit mobile number from image
  const scanMobileWithTesseract = async (imgDataUrl, frontImgUrl = null) => {
    try {
      const worker = await createWorker('eng');
      const ret = await worker.recognize(imgDataUrl);
      await worker.terminate();
      const text = ret?.data?.text || '';
      const match = text.match(/[6-9]\d{9}/);
      if (match && match[0]) {
        const found = match[0];
        setExtractedMobile(found);

        // Detect gender box on front card if available
        let gBox = cachedGenderBoxRef.current;
        if (!gBox && (frontImgUrl || frontCropped)) {
          gBox = await detectGenderBoundingBox(frontImgUrl || frontCropped);
        }

        const pos = computeMobilePosition(gBox, 'front');
        setTextOverlays((prev) => {
          if (prev.length === 0) {
            return [
              {
                id: `mob_${Date.now()}`,
                text: `Mobile : ${found}`,
                x: pos.x,
                y: pos.y,
                pixelX: pos.pixelX,
                pixelY: pos.pixelY,
                width: 95,
                height: 16,
                fontSize: pos.fontSize || 7.5,
                side: 'front'
              }
            ];
          }
          return prev;
        });
      }
    } catch (err) {
      console.warn('Tesseract OCR mobile scan error:', err);
    }
  };

  // Directional navigation helper for active text overlay
  const handleNudgeText = (id, dx, dy) => {
    setTextOverlays((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const container = (item.side || 'front') === 'front'
          ? frontContainerRef.current
          : backContainerRef.current;
        const parentW = container?.clientWidth || 320;
        const parentH = container?.clientHeight || 202;
        const curPixelX = item.x !== undefined ? (item.x / 100) * parentW : (item.pixelX || 0);
        const curPixelY = item.y !== undefined ? (item.y / 100) * parentH : (item.pixelY || 0);
        const newPixelX = Math.round(curPixelX + dx);
        const newPixelY = Math.round(curPixelY + dy);
        return {
          ...item,
          pixelX: newPixelX,
          pixelY: newPixelY,
          x: (newPixelX / parentW) * 100,
          y: (newPixelY / parentH) * 100
        };
      })
    );
  };

  // Keyboard navigation for active text overlay: Arrow keys (Left, Right, Up, Down), Delete, Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!activeTextId) return;

      const activeElement = document.activeElement;
      const isTyping =
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.isContentEditable);

      if (isTyping && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        return;
      }

      const step = e.shiftKey ? 5 : 1;
      let handled = false;

      if (e.key === 'ArrowUp') {
        handleNudgeText(activeTextId, 0, -step);
        handled = true;
      } else if (e.key === 'ArrowDown') {
        handleNudgeText(activeTextId, 0, step);
        handled = true;
      } else if (e.key === 'ArrowLeft') {
        handleNudgeText(activeTextId, -step, 0);
        handled = true;
      } else if (e.key === 'ArrowRight') {
        handleNudgeText(activeTextId, step, 0);
        handled = true;
      } else if (e.key === 'Escape') {
        setActiveTextId(null);
        setDraggableTextId(null);
        handled = true;
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !isTyping) {
        setTextOverlays((prev) => prev.filter((item) => item.id !== activeTextId));
        setActiveTextId(null);
        setDraggableTextId(null);
        handled = true;
      }

      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTextId]);

  // Process card image data with auto-crop, mobile extraction, and resident photo bounding
  const processCardImageData = async (imageDataUrl, side, pdfRes = null) => {
    let detectedMobile = pdfRes?.extractedMobile || null;
    const actualCardType = selectedType || pdfRes?.detectedDocType || 'aadhaar';

    // Auto-extracted 10-digit mobile number from PDF
    if (pdfRes?.extractedMobile) {
      detectedMobile = pdfRes.extractedMobile;
      setExtractedMobile(detectedMobile);
      if (side === 'front' && actualCardType === 'aadhaar') {
        if (pdfRes?.genderBox) {
          cachedGenderBoxRef.current = pdfRes.genderBox;
        }
        const pos = computeMobilePosition(pdfRes?.genderBox, 'front');
        setTextOverlays([
          {
            id: `mob_${Date.now()}`,
            text: `Mobile : ${detectedMobile}`,
            x: pos.x,
            y: pos.y,
            pixelX: pos.pixelX,
            pixelY: pos.pixelY,
            width: 95,
            height: 16,
            fontSize: pos.fontSize || 7.5,
            side: 'front'
          }
        ]);
      }
    }

    // If multi-page PDF (e.g. Ayushman 2-page document where Page 1 = Front, Page 2 = Back)
    if (pdfRes && pdfRes.totalPages >= 2 && pdfRes.pages?.length >= 2) {
      setProcessingStatus(`Auto-cropping ${side === 'front' ? 'Front' : 'Back'} Side from document...`);
      const targetPage = side === 'front' ? pdfRes.pages[0] : pdfRes.pages[1];
      const pageCropRes = await autoCropIDCard(targetPage, side, actualCardType);
      const cropped = pageCropRes.croppedImage || targetPage;
      onUpdateCardImage(side, cropped, targetPage);
      onSelectSide(side);

      // Auto-detect and select resident photo on Front card
      if (side === 'front' && pageCropRes?.photoBox) {
        setSelectionBox(pageCropRes.photoBox);
      }

      if (!detectedMobile && side === 'front') {
        scanMobileWithTesseract(pdfRes.pages[1] || targetPage, targetPage);
      }
      return;
    }

    // Restored strict crop coordinate variables for Front and Back card extraction from A4 PDF
    const enforceStrictAadhaarCrop = async (srcUrl, cardTypeParam, targetSide) => {
      return new Promise((resolve) => {
        if (!srcUrl) return resolve({ isDualCard: false, cropped: srcUrl });

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const W = img.naturalWidth || img.width;
          const H = img.naturalHeight || img.height;
          const isPortraitA4 = (H / W) > 1.15;

          // If not an A4 page, maintain original single card image
          if (!isPortraitA4) {
            return resolve({ isDualCard: false, cropped: srcUrl });
          }

          // Restored Crop Coordinate Variables
          // 1. Aadhaar Dual Cuttable Strip (Horizontal: Left = Front, Right = Back)
          const aadhaarFrontCoords = {
            x: Math.round(W * 0.072),
            y: Math.round(H * 0.722),
            width: Math.round(W * 0.428),
            height: Math.round(H * 0.212)
          };
          const aadhaarBackCoords = {
            x: Math.round(W * 0.500),
            y: Math.round(H * 0.722),
            width: Math.round(W * 0.428),
            height: Math.round(H * 0.212)
          };

          // 2. Designated Top Bounding Box (Front) and Bottom Bounding Box (Back)
          const topBoundingBox = {
            x: Math.round(W * 0.06),
            y: Math.round(H * 0.48),
            width: Math.round(W * 0.88),
            height: Math.round(H * 0.23)
          };
          const bottomBoundingBox = {
            x: Math.round(W * 0.06),
            y: Math.round(H * 0.72),
            width: Math.round(W * 0.88),
            height: Math.round(H * 0.23)
          };

          const isAadhaarType = !cardTypeParam || cardTypeParam.toLowerCase().includes('aadhaar');
          const frontBox = isAadhaarType ? aadhaarFrontCoords : topBoundingBox;
          const backBox = isAadhaarType ? aadhaarBackCoords : bottomBoundingBox;

          const cropToCanvas = (box) => {
            const scaleFactor = 3;
            const c = document.createElement('canvas');
            c.width = Math.round(box.width * scaleFactor);
            c.height = Math.round(box.height * scaleFactor);
            const ctx = c.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.scale(scaleFactor, scaleFactor);
            ctx.drawImage(img, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);
            return c.toDataURL('image/png');
          };

          const frontCropped = cropToCanvas(frontBox);
          const backCropped = cropToCanvas(backBox);

          resolve({
            isDualCard: true,
            front: frontCropped,
            back: backCropped,
            cropped: targetSide === 'front' ? frontCropped : backCropped
          });
        };
        img.onerror = () => resolve({ isDualCard: false, cropped: srcUrl });
        img.src = srcUrl;
      });
    };

    // Trigger Auto-Crop (OpenCV contour & projection detection)
    setProcessingStatus(`Detecting ${side === 'front' ? 'Front' : 'Back'} card bounds...`);
    let cropRes = null;
    try {
      cropRes = await autoCropIDCard(imageDataUrl, side, actualCardType);
    } catch (cropErr) {
      console.warn('Backend auto-crop failed, falling back to restored coordinate crop:', cropErr);
    }
    const original = imageDataUrl;

    if (cropRes && cropRes.isDualCard && cropRes.front?.croppedImage && cropRes.back?.croppedImage) {
      if (onUpdateBothSides) {
        onUpdateBothSides(cropRes.front.croppedImage, original, cropRes.back.croppedImage, original);
      } else {
        const chosenCropped = side === 'front' ? cropRes.front.croppedImage : cropRes.back.croppedImage;
        onUpdateCardImage(side, chosenCropped, original);
      }
      onSelectSide(side);
    } else {
      // RESTORED CROP COORDINATE ENFORCEMENT:
      // Strictly enforce drawing ONLY designated Front (top bounding box) and Back (bottom bounding box) onto target canvas
      const croppedCanvasData = await enforceStrictAadhaarCrop(imageDataUrl, actualCardType, side);
      if (croppedCanvasData.isDualCard && onUpdateBothSides) {
        onUpdateBothSides(croppedCanvasData.front, original, croppedCanvasData.back, original);
      } else {
        onUpdateCardImage(side, croppedCanvasData.cropped, original);
      }
      onSelectSide(side);
    }

    // Auto-detect and select resident photo on Front card
    if (side === 'front') {
      const pBox = cropRes?.front?.photoBox || cropRes?.photoBox;
      if (pBox) {
        setSelectionBox(pBox);
      }
    }

    // Background OCR gender detection (fallback only if vector genderBox was not already identified)
    if (actualCardType === 'aadhaar' && !cachedGenderBoxRef.current) {
      const frontCardImg = cropRes?.front?.croppedImage || (side === 'front' ? (cropRes?.croppedImage || imageDataUrl) : null);
      if (frontCardImg) {
        detectGenderBoundingBox(frontCardImg).then((gBox) => {
          if (gBox) {
            setTextOverlays((prev) =>
              prev.map((item) => {
                if (!item.id.startsWith('mob_')) return item;
                const pos = computeMobilePosition(gBox, item.side || 'front');
                return {
                  ...item,
                  x: pos.x,
                  y: pos.y,
                  pixelX: pos.pixelX,
                  pixelY: pos.pixelY
                };
              })
            );
          }
        });
      }
    }

    // If mobile number was not found in PDF, run Tesseract.js OCR in background (Aadhaar only)
    if (!detectedMobile && side === 'front' && actualCardType === 'aadhaar') {
      const frontImgForOCR = cropRes?.front?.croppedImage || cropRes?.croppedImage || imageDataUrl;
      scanMobileWithTesseract(cropRes?.back?.croppedImage || cropRes?.croppedImage || imageDataUrl, frontImgForOCR);
    }
  };

  // Password submission handler from PdfPasswordModal
  const handlePdfPasswordSubmit = async (password) => {
    setPdfPasswordState((prev) => ({ ...prev, isSubmitting: true, errorMessage: '' }));
    try {
      let pdfRes = null;
      try {
        pdfRes = await convertPdfToImage(
          pdfPasswordState.dataUrl,
          0,
          300,
          password,
          pdfPasswordState.targetMode === 'doc' ? 'special' : selectedType
        );
      } catch (backendErr) {
        if (
          backendErr.message?.toLowerCase().includes('password') ||
          backendErr.message?.includes('401')
        ) {
          throw backendErr;
        }
        // Fallback to client-side pdfjs
        try {
          const jsRes = await renderPdfWithPdfJs(pdfPasswordState.dataUrl, password);
          pdfRes = { dataUrl: jsRes.dataUrl, totalPages: jsRes.totalPages };
        } catch (jsErr) {
          throw jsErr;
        }
      }

      if (!pdfRes?.dataUrl) {
        throw new Error('Failed to render PDF page');
      }

      // Successful decryption! Close modal
      const savedTargetMode = pdfPasswordState.targetMode;
      const savedSide = pdfPasswordState.side;
      setPdfPasswordState({
        isOpen: false,
        fileName: '',
        dataUrl: null,
        targetMode: 'card',
        side: 'front',
        errorMessage: '',
        isSubmitting: false
      });

      if (savedTargetMode === 'doc') {
        setDocOriginal(pdfRes.dataUrl);
        setDocRawCropped(pdfRes.dataUrl);
        setDocScanMode('original');
        setDocZoom(1.0);
        setDocImage(pdfRes.dataUrl);
      } else {
        setIsProcessingFile(true);
        await processCardImageData(pdfRes.dataUrl, savedSide, pdfRes);
      }
    } catch (err) {
      console.warn('PDF password submission error:', err);
      const msg = err.message || '';
      const isPassErr =
        err.isPasswordRequired ||
        err.isIncorrectPassword ||
        msg.toLowerCase().includes('password') ||
        msg.includes('401');
      setPdfPasswordState((prev) => ({
        ...prev,
        isSubmitting: false,
        errorMessage: isPassErr
          ? 'Incorrect PDF password. Please verify and try again.'
          : (msg || 'Failed to unlock PDF.')
      }));
    } finally {
      setIsProcessingFile(false);
      setProcessingStatus('');
    }
  };

  const handlePdfPasswordCancel = () => {
    setPdfPasswordState({
      isOpen: false,
      fileName: '',
      dataUrl: null,
      targetMode: 'card',
      side: 'front',
      errorMessage: '',
      isSubmitting: false
    });
    setIsProcessingFile(false);
    setProcessingStatus('');
  };

  // Intercept file upload: convert PDF to image & trigger Auto-Crop + Aadhaar dual detection
  const handleFileChange = async (e, side) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    const isPdf =
      file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        let imageDataUrl = event.target.result;
        let pdfRes = null;

        // 1. Convert PDF to High-Res PNG if it's a PDF
        if (isPdf) {
          setProcessingStatus('Converting PDF to 300 DPI image...');
          try {
            pdfRes = await convertPdfToImage(imageDataUrl, 0, 300, null, selectedType);
          } catch (pdfErr) {
            const isPassErr =
              pdfErr.message?.toLowerCase().includes('password') ||
              pdfErr.message?.includes('401');
            if (isPassErr) {
              setPdfPasswordState({
                isOpen: true,
                fileName: file.name,
                dataUrl: imageDataUrl,
                targetMode: 'card',
                side: side,
                errorMessage: '',
                isSubmitting: false
              });
              setIsProcessingFile(false);
              setProcessingStatus('');
              return;
            } else {
              // Try client PDF.js fallback
              try {
                const jsRes = await renderPdfWithPdfJs(imageDataUrl, null);
                pdfRes = { dataUrl: jsRes.dataUrl, totalPages: jsRes.totalPages };
              } catch (jsErr) {
                if (jsErr.isPasswordRequired || jsErr.message?.toLowerCase().includes('password')) {
                  setPdfPasswordState({
                    isOpen: true,
                    fileName: file.name,
                    dataUrl: imageDataUrl,
                    targetMode: 'card',
                    side: side,
                    errorMessage: '',
                    isSubmitting: false
                  });
                  setIsProcessingFile(false);
                  setProcessingStatus('');
                  return;
                }
                throw pdfErr;
              }
            }
          }
          if (!pdfRes?.dataUrl) throw new Error('PDF conversion returned no image');
          imageDataUrl = pdfRes.dataUrl;
        }

        await processCardImageData(imageDataUrl, side, pdfRes);
      } catch (err) {
        alert('File upload failed: ' + err.message);
      } finally {
        setIsProcessingFile(false);
        setProcessingStatus('');
      }
    };

    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Open Perspective Crop Modal (360° Rotate + 4-Point Free Corner Handles) for Special Card
  const handleOpenPerspectiveCrop = (target = 'doc', forceCroppedOnly = false) => {
    if (target === 'front') {
      const img = forceCroppedOnly ? (frontCropped || frontOriginal) : (frontOriginal || frontCropped);
      if (img) {
        setPerspectiveModalState({
          isOpen: true,
          side: 'front',
          imageSrc: img,
          preset: 'card',
          title: `Special Card: Front Side (${forceCroppedOnly ? 'Micro-Crop' : 'Full Document'})`
        });
      }
    } else if (target === 'back') {
      const img = forceCroppedOnly ? (backCropped || backOriginal) : (backOriginal || backCropped);
      if (img) {
        setPerspectiveModalState({
          isOpen: true,
          side: 'back',
          imageSrc: img,
          preset: 'card',
          title: `Special Card: Back Side (${forceCroppedOnly ? 'Micro-Crop' : 'Full Document'})`
        });
      }
    } else {
      const img = forceCroppedOnly ? (docImage || docOriginal) : (docOriginal || docImage);
      if (img) {
        setPerspectiveModalState({
          isOpen: true,
          side: 'doc',
          imageSrc: img,
          preset: 'a4',
          title: 'Special Card: A4 Document'
        });
      }
    }
  };

  const handleApplyPerspectiveCrop = (croppedDataUrl) => {
    if (perspectiveModalState.side === 'front') {
      onUpdateCroppedImage('front', croppedDataUrl);
    } else if (perspectiveModalState.side === 'back') {
      onUpdateCroppedImage('back', croppedDataUrl);
    } else {
      setDocRawCropped(croppedDataUrl);
      setDocScanMode('original');
      setDocZoom(1.0);
      setDocImage(croppedDataUrl);
    }
    setPerspectiveModalState((prev) => ({ ...prev, isOpen: false, imageSrc: null }));
  };

  // Open manual crop modal (showing FULL uncropped original)
  const handleOpenCropModal = (side) => {
    if (selectedType === 'special') {
      handleOpenPerspectiveCrop(side, false);
      return;
    }
    const orig = side === 'front' ? frontOriginal || frontCropped : backOriginal || backCropped;
    if (orig) {
      setCropModalSide(side);
      setCropModalImage(orig);
      setIsCropModalOpen(true);
    }
  };

  // Mini-Crop: opens Manual Crop Modal passing ONLY currentlyCroppedImageData
  const handleOpenMiniCrop = (e, side) => {
    if (e) e.stopPropagation();
    if (selectedType === 'special') {
      handleOpenPerspectiveCrop(side, true); // true = Opens ONLY currently cropped image!
      return;
    }
    const cropped = side === 'front' ? frontCropped : backCropped;
    if (cropped) {
      setCropModalSide(side);
      setCropModalImage(cropped);
      setIsCropModalOpen(true);
    }
  };

  // Full Document Crop: opens Manual Crop Modal passing originalFile (Full PDF/Original Image)
  const handleOpenOriginalCrop = (side) => {
    if (selectedType === 'special') {
      handleOpenPerspectiveCrop(side, false); // false = Opens full original document!
      return;
    }
    const orig = side === 'front' ? frontOriginal || frontCropped : backOriginal || backCropped;
    if (orig) {
      setCropModalSide(side);
      setCropModalImage(orig);
      setIsCropModalOpen(true);
    }
  };

  // Open inspection magnifier modal (showing ONLY cropped/manipulated ID card segment)
  const handleOpenMagnifier = (side) => {
    const cropped = side === 'front' ? frontCropped : backCropped;
    if (cropped) {
      setMagnifierState({
        isOpen: true,
        imageSrc: cropped,
        title: `${side === 'front' ? 'Front Side' : 'Back Side'} (High-Res Edit & Magnify)`
      });
    }
  };

  // Single Click: Select active side
  const handleCardClick = (e, side) => {
    e.stopPropagation();
    setActiveTextId(null);
    setDraggableTextId(null);
    onSelectSide(side);
  };

  // HTML Canvas API - Programmatically slice image & alter actual pixel data
  const handleRearrangeAadhaar = async () => {
    const currentImg = activeSide === 'front' ? frontCropped : backCropped;
    if (!currentImg) {
      alert('Please select or upload an ID card image first.');
      return;
    }
    setIsRearranging(true);
    try {
      const alteredDataUrl = await rearrangeAadhaarOnCanvas(currentImg);
      if (alteredDataUrl) {
        onUpdateCroppedImage(activeSide, alteredDataUrl);
        // If magnifier modal is currently open, update its image preview too
        setMagnifierState((prev) => ({
          ...prev,
          imageSrc: alteredDataUrl
        }));
      }
    } catch (err) {
      alert('Canvas pixel rearrangement failed: ' + err.message);
    } finally {
      setIsRearranging(false);
    }
  };

  // Copy extracted mobile number
  const handleCopyMobile = (e) => {
    if (e) e.stopPropagation();
    const mobNum = extractedMobile || '9876543210';
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(mobNum);
    }
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Add extracted mobile number to canvas as text overlay (placed directly beside Male/Female)
  const handleAddMobileToCanvas = async (e) => {
    if (e) e.stopPropagation();
    const mobNum = extractedMobile || '9876543210';
    const targetSide = activeSide || 'front';
    const existing = textOverlays.find(
      (t) => (t.side || 'front') === targetSide && t.text.includes(mobNum)
    );

    if (existing) {
      setActiveTextId(existing.id);
      setDraggableTextId(existing.id);
      return;
    }

    let gBox = cachedGenderBoxRef.current;
    if (!gBox && targetSide === 'front' && frontCropped) {
      gBox = await detectGenderBoundingBox(frontCropped);
    }

    const newId = `mob_${Date.now()}`;
    const pos = computeMobilePosition(gBox, targetSide);

    setTextOverlays((prev) => [
      ...prev,
      {
        id: newId,
        side: targetSide,
        text: `Mobile : ${mobNum}`,
        width: 95,
        height: 16,
        x: pos.x,
        y: pos.y,
        pixelX: pos.pixelX,
        pixelY: pos.pixelY,
        fontSize: pos.fontSize || 7.5
      }
    ]);
    setActiveTextId(newId);
    setDraggableTextId(newId);
  };

  // Marquee mouse drag creation
  const [isDrawingMarquee, setIsDrawingMarquee] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleMouseDownOnCard = (e, side) => {
    if (activeTool !== 'select' || side !== activeSide) return;
    const targetRef = side === 'front' ? frontContainerRef : backContainerRef;
    const rect = targetRef.current?.getBoundingClientRect();
    if (!rect) return;

    const startX = ((e.clientX - rect.left) / rect.width) * 100;
    const startY = ((e.clientY - rect.top) / rect.height) * 100;

    setDragStart({ x: startX, y: startY });
    setIsDrawingMarquee(true);
    setSelectionBox({
      x: startX,
      y: startY,
      width: 0,
      height: 0
    });
  };

  const handleMouseMoveOnCard = (e) => {
    if (!isDrawingMarquee || activeTool !== 'select') return;
    const targetRef = activeSide === 'front' ? frontContainerRef : backContainerRef;
    const rect = targetRef.current?.getBoundingClientRect();
    if (!rect) return;

    const currentX = ((e.clientX - rect.left) / rect.width) * 100;
    const currentY = ((e.clientY - rect.top) / rect.height) * 100;

    const x = Math.min(dragStart.x, currentX);
    const y = Math.min(dragStart.y, currentY);
    const width = Math.abs(currentX - dragStart.x);
    const height = Math.abs(currentY - dragStart.y);

    setSelectionBox({
      x: Math.max(0, x),
      y: Math.max(0, y),
      width: Math.min(100 - x, width),
      height: Math.min(100 - y, height)
    });
  };

  const handleMouseUpOnCard = () => {
    if (isDrawingMarquee) {
      setIsDrawingMarquee(false);
      if (selectionBox && (selectionBox.width < 5 || selectionBox.height < 5)) {
        setSelectionBox(null);
      }
    }
  };

  return (
    <div
      className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-col justify-between h-full relative overflow-hidden select-none"
      onClick={() => {
        setIsDocSelected(false);
        setActiveTextId(null);
        setDraggableTextId(null);
      }}
      onMouseMove={handleMouseMoveOnCard}
      onMouseUp={handleMouseUpOnCard}
    >
      {/* File Processing Spinner Overlay */}
      {isProcessingFile && (
        <div className="absolute inset-0 z-50 bg-white/85 backdrop-blur-xs rounded-xl flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-xs font-bold text-slate-800">{processingStatus}</p>
          <p className="text-[10px] text-slate-500">Processing with high-precision engine...</p>
        </div>
      )}

      {/* 1. FIXED TOP HEADER SECTION: Keeps Container 1 (Cards/Docs Mode) & Container 2 (Edit Document/Mobile) pinned at top */}
      <div className="shrink-0 select-none">
        {/* Special Card Only: Sub-Navigation Toggle [ Cards Mode | Docs Mode ] */}
        {selectedType === 'special' && (
          <div className="flex items-center justify-center p-1 bg-slate-100 border border-slate-200 rounded-xl mb-2.5 shadow-2xs">
            <div className="grid grid-cols-2 gap-1.5 w-full">
              <button
                type="button"
                onClick={() => handleToggleSpecialMode('cards')}
                className={`py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none ${
                  specialMode === 'cards'
                    ? 'bg-white text-blue-600 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Cards Mode</span>
              </button>
              <button
                type="button"
                onClick={() => handleToggleSpecialMode('docs')}
                className={`py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none ${
                  specialMode === 'docs'
                    ? 'bg-white text-blue-600 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Docs Mode</span>
              </button>
            </div>
          </div>
        )}

        {/* Title, Tab Selector & Dedicated Toolbars (Fixed-height, zero layout-shift) */}
        <div className="flex flex-col gap-1.5 mb-2.5 bg-[#f8fafc] border border-slate-200/90 rounded-xl px-3 py-2 shadow-2xs">
          {/* Row 1: Title (Left) & Found Mobile Pill (Directly in the left empty space!) */}
          <div className="flex items-center gap-2.5 min-h-[28px]">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider select-none whitespace-nowrap leading-tight shrink-0">
              {selectedType === 'special' && specialMode === 'docs' ? 'Edit Document' : 'Edit ID Card'}
            </h3>

            {extractedMobile ? (
              <div className="flex items-center gap-1.5 bg-[#ecfdf5] border border-emerald-400 rounded-lg px-2.5 py-0.5 shadow-2xs shrink-0">
                <span className="text-[11px] font-bold text-emerald-900 tracking-tight whitespace-nowrap">
                  Found Mobile:
                </span>
                <button
                  type="button"
                  onClick={handleAddMobileToCanvas}
                  className="font-mono font-bold text-[11px] text-slate-900 bg-white hover:bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-400 transition-all cursor-pointer shadow-2xs"
                  title="Click to Activate & Move Mobile Number on Card"
                >
                  {extractedMobile}
                </button>
                <button
                  type="button"
                  onClick={handleCopyMobile}
                  className="p-1 hover:bg-emerald-200/70 rounded text-amber-800/80 hover:text-emerald-800 transition-colors cursor-pointer"
                  title="Copy to Clipboard"
                >
                  {isCopied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleAddMobileToCanvas}
                  className="px-2.5 py-0.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-md text-[11px] font-bold transition-colors cursor-pointer shadow-xs whitespace-nowrap"
                  title="Add Mobile to Card & Activate Controls"
                >
                  + Add Text
                </button>
              </div>
            ) : null}
          </div>

          {/* Row 2: Side Toggle (Left) & MOVE TEXT Toolbar (Beside it) */}
          <div className="flex items-center gap-2.5 min-h-[30px]">
            {selectedType === 'special' && specialMode === 'docs' ? (
              <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg shadow-2xs shrink-0">
                <span className="px-3 py-1 rounded-md text-xs font-bold bg-blue-600 text-white shadow-xs leading-none">
                  Full A4 Document
                </span>
              </div>
            ) : (
              <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg shadow-2xs shrink-0">
                <button
                  type="button"
                  onClick={() => onSelectSide('front')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer leading-none ${
                    activeSide === 'front'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Front Side
                </button>
                <button
                  type="button"
                  onClick={() => onSelectSide('back')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer leading-none ${
                    activeSide === 'back'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Back Side
                </button>
              </div>
            )}

            {/* MOVE TEXT Toolbar (Row 2, beside Side Toggle) */}
            <div
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className={`flex items-center gap-2 bg-[#f0f2eb] border border-slate-200/90 rounded-lg px-2.5 py-0.5 shadow-2xs transition-opacity duration-150 shrink-0 ${
                activeTextId ? 'opacity-100 pointer-events-auto' : 'invisible pointer-events-none'
              }`}
            >
              <span className="text-[11px] font-black text-slate-900 uppercase tracking-wider whitespace-nowrap select-none">
                MOVE TEXT:
              </span>

              {/* Navigation Arrows: « ▲ ▼ » */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNudgeText(activeTextId, -1, 0);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="w-5 h-5 flex items-center justify-center text-slate-800 hover:text-blue-600 hover:bg-slate-200/70 rounded font-black cursor-pointer active:scale-90 text-sm transition-all"
                  title="Move Left (1px) • [ArrowLeft]"
                >
                  «
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNudgeText(activeTextId, 0, -1);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="w-5 h-5 flex items-center justify-center text-slate-800 hover:text-blue-600 hover:bg-slate-200/70 rounded font-black cursor-pointer active:scale-90 text-xs transition-all"
                  title="Move Up (1px) • [ArrowUp]"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNudgeText(activeTextId, 0, 1);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="w-5 h-5 flex items-center justify-center text-slate-800 hover:text-blue-600 hover:bg-slate-200/70 rounded font-black cursor-pointer active:scale-90 text-xs transition-all"
                  title="Move Down (1px) • [ArrowDown]"
                >
                  ▼
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNudgeText(activeTextId, 1, 0);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="w-5 h-5 flex items-center justify-center text-slate-800 hover:text-blue-600 hover:bg-slate-200/70 rounded font-black cursor-pointer active:scale-90 text-sm transition-all"
                  title="Move Right (1px) • [ArrowRight]"
                >
                  »
                </button>
              </div>

              {/* Font Size Steppers: [ - 7.5px + ] */}
              <div className="flex items-center gap-1.5 bg-white rounded-md px-2 py-0.5 border border-slate-200 shadow-2xs">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTextOverlays((prev) =>
                      prev.map((item) =>
                        item.id === activeTextId
                          ? { ...item, fontSize: Math.max(5, (item.fontSize || 7.5) - 0.5) }
                          : item
                      )
                    );
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="w-4 h-4 flex items-center justify-center text-slate-700 hover:text-blue-600 font-black cursor-pointer text-sm leading-none"
                  title="Decrease Font Size (-0.5px)"
                >
                  -
                </button>
                <span className="font-mono text-xs text-slate-800 font-bold min-w-[34px] text-center select-none">
                  {textOverlays.find((t) => t.id === activeTextId)?.fontSize || 7.5}px
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTextOverlays((prev) =>
                      prev.map((item) =>
                        item.id === activeTextId
                          ? { ...item, fontSize: Math.min(24, (item.fontSize || 7.5) + 0.5) }
                          : item
                      )
                    );
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="w-4 h-4 flex items-center justify-center text-slate-700 hover:text-blue-600 font-black cursor-pointer text-sm leading-none"
                  title="Increase Font Size (+0.5px)"
                >
                  +
                </button>
              </div>

              {/* Delete Text Field Button (Trash Icon) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setTextOverlays((prev) => prev.filter((item) => item.id !== activeTextId));
                  setActiveTextId(null);
                  setDraggableTextId(null);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="p-1 text-slate-700 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                title="Delete Text Field (Del / Backspace)"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. SCROLLABLE BODY AREA: Document Previewer & Controls scroll underneath the fixed top containers */}
      <div
        ref={outerCanvasRef}
        className={`flex-1 flex flex-col min-h-0 ${
          selectedType === 'special' && specialMode === 'docs'
            ? isDocSelected
              ? 'overflow-hidden pr-1 justify-start'
              : 'overflow-y-auto docs-vertical-scrollbar pr-1 justify-start'
            : 'overflow-hidden justify-between'
        }`}
      >
        {/* Conditional View: Docs Mode (Single A4 Scrollable Container) vs Standard Dual Card Frames */}
        {selectedType === 'special' && specialMode === 'docs' ? (
          <div className="flex flex-col flex-1 mb-[2px] mt-[1px]">
            {/* Unified Document Scan Mode & Dimension Toolbar (Appears only when document is selected, by default disappeared) */}
            {docImage && isDocSelected && (
              <div
                ref={docToolbarRef}
                onClick={(e) => e.stopPropagation()}
                className="bg-[#eef2f6] border border-slate-200/90 rounded-xl p-2 sm:p-2.5 m-[5px] shadow-2xs flex flex-col gap-2 select-none animate-in fade-in duration-150"
              >
                {/* ROW 1: Scan Mode Selection & Red Reset Button */}
                <div className="flex items-center justify-between gap-2 w-full flex-nowrap">
                  <div className="flex items-center gap-1.5 flex-nowrap shrink-0 overflow-x-auto">
                    <span className="text-slate-800 text-xs font-bold tracking-tight select-none shrink-0 mr-0.5">
                      Scan Mode:
                    </span>

                    {/* Original */}
                    <button
                      type="button"
                      onClick={() => handleApplyScanEffectToDoc('original')}
                      disabled={isApplyingScanEffect}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                        docScanMode === 'original'
                          ? 'bg-white text-slate-900 shadow-2xs border border-slate-300'
                          : 'bg-slate-200/60 hover:bg-slate-200 text-slate-700 border border-slate-300/50'
                      }`}
                      title="Original Document Colors"
                    >
                      <span>📄</span>
                      <span>Original</span>
                    </button>

                    {/* Magic Color */}
                    <button
                      type="button"
                      onClick={() => handleApplyScanEffectToDoc('magic_color')}
                      disabled={isApplyingScanEffect}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                        docScanMode === 'magic_color'
                          ? 'bg-white text-slate-900 shadow-2xs border border-slate-300'
                          : 'bg-slate-200/60 hover:bg-slate-200 text-slate-700 border border-slate-300/50'
                      }`}
                      title="Magic Color: Cleans background, removes shadows and sharpens text"
                    >
                      <span>✨ 🎨</span>
                      <span>Magic Color</span>
                    </button>

                    {/* B&W */}
                    <button
                      type="button"
                      onClick={() => handleApplyScanEffectToDoc('bw')}
                      disabled={isApplyingScanEffect}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                        docScanMode === 'bw'
                          ? 'bg-white text-slate-900 shadow-2xs border border-slate-300'
                          : 'bg-slate-200/60 hover:bg-slate-200 text-slate-700 border border-slate-300/50'
                      }`}
                      title="B&W: Clear Black & White photocopy preserving natural photo grayscale"
                    >
                      <span>🖤</span>
                      <span>B&W</span>
                    </button>

                    {isApplyingScanEffect && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 ml-1 shrink-0" />
                    )}
                  </div>

                  {/* Red Reset Button */}
                  <button
                    type="button"
                    onClick={() => {
                      handleResetDocScale();
                      setDocZoom(1.0);
                      handleApplyScanEffectToDoc('original');
                    }}
                    className="px-3 py-1 bg-[#dc2626] hover:bg-[#b91c1c] active:scale-95 text-white font-semibold text-xs rounded-lg shadow-xs transition-all cursor-pointer flex items-center gap-1 shrink-0 ml-auto"
                    title="Reset Scan Mode, Dimensions and Zoom"
                  >
                    <RotateCcw className="w-3 h-3 text-white stroke-[2.5]" />
                    <span>Reset</span>
                  </button>
                </div>

                {/* ROW 2: Width (Px), Height (Px) and Zoom Controls */}
                <div className="flex items-center gap-2 w-full flex-nowrap overflow-x-auto">
                  {/* Box 1: Width Control in Px */}
                  <div className="flex items-center gap-1 bg-slate-200/50 border border-slate-300/60 rounded-lg px-2 py-1 shadow-2xs shrink-0">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-0.5 select-none">
                      <ArrowLeftRight className="w-3 h-3 text-slate-600" />
                      <span>W:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => updateDocPxW(currentDocPxW - 20)}
                      className="w-5 h-5 flex items-center justify-center bg-slate-300/70 hover:bg-slate-300 text-slate-700 font-bold rounded cursor-pointer active:scale-90 text-xs transition-all select-none"
                      title="Decrease Width (-20 Px)"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="50"
                      value={currentDocPxW}
                      onChange={(e) => updateDocPxW(e.target.value)}
                      className="w-16 bg-white border border-slate-300 rounded px-1 py-0.5 text-center font-bold text-slate-800 text-xs focus:outline-none focus:border-blue-500 shadow-2xs"
                      title="Document Width in Pixels (Px)"
                    />
                    <span className="text-slate-600 text-xs font-semibold select-none">Px</span>
                    <button
                      type="button"
                      onClick={() => updateDocPxW(currentDocPxW + 20)}
                      className="w-5 h-5 flex items-center justify-center bg-slate-300/70 hover:bg-slate-300 text-slate-700 font-bold rounded cursor-pointer active:scale-90 text-xs transition-all select-none"
                      title="Increase Width (+20 Px)"
                    >
                      +
                    </button>
                  </div>

                  {/* Box 2: Height Control in Px */}
                  <div className="flex items-center gap-1 bg-slate-200/50 border border-slate-300/60 rounded-lg px-2 py-1 shadow-2xs shrink-0">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-0.5 select-none">
                      <ArrowUpDown className="w-3 h-3 text-slate-600" />
                      <span>H:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => updateDocPxH(currentDocPxH - 20)}
                      className="w-5 h-5 flex items-center justify-center bg-slate-300/70 hover:bg-slate-300 text-slate-700 font-bold rounded cursor-pointer active:scale-90 text-xs transition-all select-none"
                      title="Decrease Height (-20 Px)"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="50"
                      value={currentDocPxH}
                      onChange={(e) => updateDocPxH(e.target.value)}
                      className="w-16 bg-white border border-slate-300 rounded px-1 py-0.5 text-center font-bold text-slate-800 text-xs focus:outline-none focus:border-blue-500 shadow-2xs"
                      title="Document Height in Pixels (Px)"
                    />
                    <span className="text-slate-600 text-xs font-semibold select-none">Px</span>
                    <button
                      type="button"
                      onClick={() => updateDocPxH(currentDocPxH + 20)}
                      className="w-5 h-5 flex items-center justify-center bg-slate-300/70 hover:bg-slate-300 text-slate-700 font-bold rounded cursor-pointer active:scale-90 text-xs transition-all select-none"
                      title="Increase Height (+20 Px)"
                    >
                      +
                    </button>
                  </div>

                  {/* Box 3: Zoom Control in % */}
                  <div className="flex items-center gap-1 bg-slate-200/50 border border-slate-300/60 rounded-lg px-2 py-1 shadow-2xs shrink-0">
                    <span className="text-xs font-bold text-slate-800 select-none">
                      Zoom:
                    </span>
                    <button
                      type="button"
                      onClick={() => setDocZoom((z) => Math.max(0.4, Math.round((z - 0.05) * 100) / 100))}
                      className="w-5 h-5 flex items-center justify-center bg-slate-300/70 hover:bg-slate-300 text-slate-700 font-bold rounded cursor-pointer active:scale-90 text-xs transition-all select-none"
                      title="Zoom Out (-5%)"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="40"
                      max="300"
                      value={Math.round(docZoom * 100)}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (!isNaN(val) && val > 0) setDocZoom(val / 100);
                      }}
                      className="w-12 bg-white border border-slate-300 rounded px-1 py-0.5 text-center font-bold text-slate-800 text-xs focus:outline-none focus:border-blue-500 shadow-2xs"
                      title="Zoom Percentage"
                    />
                    <span className="text-slate-600 text-xs font-semibold select-none">%</span>
                    <button
                      type="button"
                      onClick={() => setDocZoom((z) => Math.min(3.0, Math.round((z + 0.05) * 100) / 100))}
                      className="w-5 h-5 flex items-center justify-center bg-slate-300/70 hover:bg-slate-300 text-slate-700 font-bold rounded cursor-pointer active:scale-90 text-xs transition-all select-none"
                      title="Zoom In (+5%)"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Single A4-Sized Scrollable Viewport with Vertical Scrollbar */}
            <div
              id="idcard-doc-container"
              ref={docContainerRef}
              onClick={(e) => {
                e.stopPropagation();
                setIsDocSelected(true);
              }}
              onWheel={handleDocWheel}
              onDoubleClick={(e) => {
                e.stopPropagation();
                handleOpenPerspectiveCrop('doc', false); // Double-click opens FULL ORIGINAL image
              }}
              onMouseDown={handleDocMouseDown}
              onMouseMove={handleDocMouseMove}
              onMouseUp={handleDocMouseUp}
              onMouseLeave={handleDocMouseUp}
              style={{
                cursor: isDocPanning ? 'grabbing' : (docImage ? 'pointer' : 'default')
              }}
              className={`relative group w-full bg-slate-100/70 rounded-xl border-2 transition-all shadow-inner select-none p-3 mx-auto cursor-pointer ${
                isDocSelected
                  ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-sm h-[500px] max-h-[540px] overflow-y-auto overflow-x-hidden docs-vertical-scrollbar'
                  : 'border-dashed border-slate-300 hover:border-blue-300 overflow-hidden'
              }`}
            >
              {/* In-Card Corner Buttons */}
              {/* Top-Left: Manual Perspective Crop */}
              {docImage && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenPerspectiveCrop('doc', true); // true = opens currently cropped image
                  }}
                  className="sticky top-1 left-1 z-20 w-8 h-8 rounded-full bg-white/95 hover:bg-white text-slate-700 hover:text-blue-600 shadow-md border border-slate-200/80 flex items-center justify-center cursor-pointer transition-all opacity-0 group-hover:opacity-100 float-left"
                  title="Crop Current Image (Click) • Double-click image for 360° Full Crop"
                >
                  <Crop className="w-4 h-4" />
                </button>
              )}

              {/* Top-Right: Upload / Replace Document File */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  docInputRef.current?.click();
                }}
                className={`sticky top-1 right-1 z-20 w-8 h-8 rounded-full bg-white/95 hover:bg-white text-slate-700 hover:text-blue-600 shadow-md border border-slate-200/80 flex items-center justify-center cursor-pointer transition-all float-right ${
                  !docImage ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
                title="Upload Document or WhatsApp Photo"
              >
                <Upload className="w-4 h-4" />
              </button>

              <div className="clear-both" />

              {docImage ? (
                <div
                  style={{
                    transform: `scale(${docZoom}) scale(${docScaleW / 100}, ${docScaleH / 100})`,
                    transformOrigin: 'top center',
                    transition: isDocPanning ? 'none' : 'transform 0.1s ease-out'
                  }}
                  className="w-full max-w-[500px] mx-auto bg-white rounded-lg shadow-md border border-slate-200/90 overflow-hidden relative pointer-events-none mt-1"
                >
                  <img
                    src={docImage}
                    alt="Single Document"
                    className="w-full h-auto block select-none pointer-events-none"
                    draggable={false}
                  />
                </div>
              ) : (
                <div
                  onClick={() => docInputRef.current?.click()}
                  className="flex flex-col items-center justify-center text-slate-400 p-12 text-center cursor-pointer hover:text-blue-500 transition-colors select-none"
                >
                  <Upload className="w-12 h-12 mb-3 text-slate-400 stroke-1" />
                  <span className="text-sm font-bold text-slate-700">Upload A4 Document</span>
                  <span className="text-xs text-slate-400 mt-1 max-w-[240px]">
                    Supports WhatsApp photos, skewed page images, or PDF documents
                  </span>
                  <span className="mt-4 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold rounded-lg text-xs border border-blue-200 shadow-2xs transition-colors">
                    Choose Document File
                  </span>
                </div>
              )}
            </div>

            <input
              ref={docInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleDocFileChange}
              className="hidden"
            />
          </div>
        ) : (
          /* Dual Card Frames (Front & Back) */
          <div className="grid grid-cols-2 gap-3.5 mb-4">
          {/* 1. FRONT SIDE FRAME */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-1.5 px-0.5 min-h-[22px]">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-700">Front Side</span>
                {activeSide === 'front' && (
                  <span className="px-1.5 py-0.2 bg-blue-100 text-blue-700 rounded text-[9px] font-bold">
                    Active
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {selectedType === 'special' && (frontCropped || frontOriginal) && (
                  <button
                    type="button"
                    onClick={() => handleOpenPerspectiveCrop('front')}
                    className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md text-[10px] font-bold border border-blue-200 flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                    title="360° Rotate & 4-Point Free Perspective Crop"
                  >
                    <Crop className="w-3 h-3 text-blue-600" />
                    <span>Rotate & Crop</span>
                  </button>
                )}
                {selectionBox && activeSide === 'front' && (
                  <button
                    type="button"
                    onClick={() => setSelectionBox(null)}
                    className="text-[10px] text-red-500 hover:underline font-semibold cursor-pointer"
                  >
                    Clear Box
                  </button>
                )}
              </div>
            </div>

            <div
              id="idcard-front-container"
              ref={frontContainerRef}
              onClick={(e) => handleCardClick(e, 'front')}
              onDoubleClick={(e) => {
                e.stopPropagation();
                handleOpenOriginalCrop('front');
              }}
              onMouseDown={(e) => handleMouseDownOnCard(e, 'front')}
              style={{ padding: 0, margin: 0 }}
              className={`relative aspect-[85.6/54] rounded-xl border-2 transition-all overflow-hidden cursor-pointer group bg-slate-50 flex items-center justify-center select-none shadow-2xs p-0 m-0 ${
                activeSide === 'front'
                  ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-sm'
                  : 'border-dashed border-slate-300 hover:border-blue-300'
              } ${activeTool === 'select' && activeSide === 'front' ? 'cursor-crosshair' : ''}`}
            >
              {/* In-Card Corner Actions */}
              {/* Top-Left: Mini-Crop Adjust (only if cropped image exists) */}
              {frontCropped && (
                <button
                  type="button"
                  onClick={(e) => handleOpenMiniCrop(e, 'front')}
                  className="absolute top-2 left-2 z-20 w-7 h-7 rounded-full bg-white/90 hover:bg-white text-slate-700 hover:text-blue-600 shadow-md border border-slate-200/80 flex items-center justify-center cursor-pointer transition-all opacity-0 group-hover:opacity-100"
                  title="Micro-Crop Adjust (Adjust cropped card)"
                >
                  <Crop className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Top-Right: Upload / Replace File */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  frontInputRef.current?.click();
                }}
                className={`absolute top-2 right-2 z-20 w-7 h-7 rounded-full bg-white/90 hover:bg-white text-slate-700 hover:text-blue-600 shadow-md border border-slate-200/80 flex items-center justify-center cursor-pointer transition-all ${
                  !frontCropped ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
                title="Upload or Replace File"
              >
                <Upload className="w-3.5 h-3.5" />
              </button>
              {frontCropped ? (
                <>
                  <img
                    src={frontCropped}
                    alt="ID Front"
                    style={{ objectFit: 'fill', width: '100%', height: '100%', display: 'block' }}
                    className="w-full h-full block pointer-events-none rounded-none"
                  />

                  {/* Localized Enhanced Area (Marquee) on Front */}
                  {selectionBox && activeSide === 'front' && (
                    <div
                      style={{
                        left: `${selectionBox.x}%`,
                        top: `${selectionBox.y}%`,
                        width: `${selectionBox.width}%`,
                        height: `${selectionBox.height}%`
                      }}
                      className="absolute border-2 border-dashed border-blue-500 rounded pointer-events-none shadow-sm z-10 overflow-hidden"
                    >
                      <span className="absolute top-0 left-0 bg-blue-600 text-white text-[9px] font-bold px-1 py-0.5 rounded-br">
                        Selected
                      </span>
                      <img
                        src={frontCropped}
                        alt="Enhanced Area"
                        style={{
                          position: 'absolute',
                          left: `-${(selectionBox.x / selectionBox.width) * 100}%`,
                          top: `-${(selectionBox.y / selectionBox.height) * 100}%`,
                          width: `${(100 / selectionBox.width) * 100}%`,
                          height: `${(100 / selectionBox.height) * 100}%`,
                          maxWidth: 'none',
                          filter: `brightness(${adjustments?.brightness ?? 100}%) contrast(${adjustments?.contrast ?? 100}%) saturate(${adjustments?.saturation ?? 100}%)${adjustments?.beautify ? ' contrast(1.12) brightness(1.08) saturate(1.15)' : ''}${adjustments?.autoCorrect ? ' contrast(1.18) brightness(1.05)' : ''}`
                        }}
                        className="object-fill"
                      />
                    </div>
                  )}

                  {/* Transparent, Freely Draggable & Resizable Text Overlays via react-rnd */}
                  {textOverlays
                    .filter((t) => (t.side || 'front') === 'front')
                    .map((t) => {
                      const isActive = activeTextId === t.id;
                      const isDraggable = draggableTextId === t.id;
                      return (
                        <Rnd
                          key={t.id}
                          size={{ width: t.width || 95, height: t.height || 16 }}
                          position={{
                            x: t.x !== undefined ? Math.round((t.x / 100) * (frontContainerRef.current?.clientWidth || 320)) : (t.pixelX || 0),
                            y: t.y !== undefined ? Math.round((t.y / 100) * (frontContainerRef.current?.clientHeight || 202)) : (t.pixelY || 0)
                          }}
                          bounds="parent"
                          disableDragging={!isDraggable}
                          dragHandleClassName="rnd-border-handle"
                          className="z-30 group/rnd"
                          enableResizing={isDraggable ? {
                            top: true,
                            right: true,
                            bottom: true,
                            left: true,
                            topRight: true,
                            bottomRight: true,
                            bottomLeft: true,
                            topLeft: true
                          } : false}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            setActiveTextId(t.id);
                            setDraggableTextId(t.id);
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setActiveTextId(t.id);
                            setDraggableTextId(t.id);
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveTextId(t.id);
                            setDraggableTextId(t.id);
                          }}
                          onDragStart={() => {
                            setActiveTextId(t.id);
                            setDraggableTextId(t.id);
                          }}
                          onResize={(e, direction, ref) => {
                            const h = parseInt(ref.style.height, 10) || 16;
                            const dynamicFontSize = Math.max(6, Math.min(24, Math.round(h * 0.5)));
                            setTextOverlays((prev) =>
                              prev.map((item) => (item.id === t.id ? { ...item, fontSize: dynamicFontSize } : item))
                            );
                          }}
                          onDragStop={(e, d) => {
                            const parentW = frontContainerRef.current?.clientWidth || 320;
                            const parentH = frontContainerRef.current?.clientHeight || 202;
                            const newX = (d.x / parentW) * 100;
                            const newY = (d.y / parentH) * 100;
                            setTextOverlays((prev) =>
                              prev.map((item) =>
                                item.id === t.id
                                  ? {
                                      ...item,
                                      pixelX: d.x,
                                      pixelY: d.y,
                                      x: newX,
                                      y: newY
                                    }
                                  : item
                              )
                            );
                          }}
                          onResizeStop={(e, direction, ref, delta, position) => {
                            const newW = parseInt(ref.style.width, 10);
                            const newH = parseInt(ref.style.height, 10);
                            const dynamicFontSize = Math.max(6, Math.min(24, Math.round(newH * 0.5)));
                            const parentW = frontContainerRef.current?.clientWidth || 320;
                            const parentH = frontContainerRef.current?.clientHeight || 202;
                            const newX = (position.x / parentW) * 100;
                            const newY = (position.y / parentH) * 100;
                            setTextOverlays((prev) =>
                              prev.map((item) =>
                                item.id === t.id
                                  ? {
                                      ...item,
                                      width: newW,
                                      height: newH,
                                      pixelX: position.x,
                                      pixelY: position.y,
                                      x: newX,
                                      y: newY,
                                      fontSize: dynamicFontSize
                                    }
                                  : item
                              )
                            );
                          }}
                        >
                          <div
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              setActiveTextId(t.id);
                              setDraggableTextId(t.id);
                            }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setActiveTextId(t.id);
                              setDraggableTextId(t.id);
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveTextId(t.id);
                              setDraggableTextId(t.id);
                            }}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setActiveTextId(t.id);
                              setDraggableTextId(t.id);
                            }}
                            style={{
                              border: 'none',
                              outline: isActive ? '2px solid #2563eb' : 'none',
                              outlineOffset: '1px',
                              borderRadius: '2px',
                              background: isActive ? 'rgba(37, 99, 235, 0.04)' : 'transparent',
                              padding: 0,
                              margin: 0,
                              display: 'block',
                              lineHeight: 1,
                              verticalAlign: 'top',
                              boxSizing: 'border-box'
                            }}
                            className={`rnd-border-handle relative w-full h-full select-none transition-colors ${
                              isDraggable ? 'cursor-move' : 'cursor-default'
                            }`}
                            title="Click and drag to move • Use Move Text toolbar at top"
                          >

                            <div
                              contentEditable="true"
                              suppressContentEditableWarning={true}
                              onFocus={() => {
                                setActiveTextId(t.id);
                                setDraggableTextId(t.id);
                              }}
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                setActiveTextId(t.id);
                                setDraggableTextId(t.id);
                              }}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                setActiveTextId(t.id);
                                setDraggableTextId(t.id);
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveTextId(t.id);
                                setDraggableTextId(t.id);
                              }}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                setActiveTextId(t.id);
                                setDraggableTextId(t.id);
                              }}
                              onBlur={(e) => {
                                const val = e.currentTarget.innerText;
                                setTextOverlays((prev) =>
                                  prev.map((item) => (item.id === t.id ? { ...item, text: val } : item))
                                );
                              }}
                              style={{
                                background: 'transparent',
                                outline: 'none',
                                fontFamily: 'Arial, Helvetica, sans-serif',
                                fontWeight: 'bold',
                                color: '#111827',
                                fontSize: `${t.fontSize || 7.5}px`,
                                lineHeight: '1',
                                padding: 0,
                                margin: 0,
                                display: 'block',
                                verticalAlign: 'top',
                                boxSizing: 'border-box',
                                whiteSpace: 'nowrap',
                                cursor: 'text'
                              }}
                              className="rnd-text-editor select-text cursor-text"
                              title="Click to edit mobile number"
                            >
                              {t.text}
                            </div>
                          </div>
                        </Rnd>
                      );
                    })}
                </>
              ) : (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    frontInputRef.current?.click();
                  }}
                  className="flex flex-col items-center justify-center text-slate-400 p-4 text-center cursor-pointer hover:text-blue-500 transition-colors select-none"
                >
                  <Upload className="w-7 h-7 mb-1.5 text-slate-400" />
                  <span className="text-xs font-bold text-slate-600">Front Side (Empty)</span>
                  <span className="text-[10px] text-slate-400">
                    Click to Upload • Double-click to Crop PDF
                  </span>
                </div>
              )}
            </div>

            <input
              ref={frontInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => handleFileChange(e, 'front')}
              className="hidden"
            />
          </div>

          {/* 2. BACK SIDE FRAME */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-1.5 px-0.5 min-h-[22px]">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-700">Back Side</span>
                {activeSide === 'back' && (
                  <span className="px-1.5 py-0.2 bg-blue-100 text-blue-700 rounded text-[9px] font-bold">
                    Active
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {selectedType === 'special' && (backCropped || backOriginal) && (
                  <button
                    type="button"
                    onClick={() => handleOpenPerspectiveCrop('back')}
                    className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md text-[10px] font-bold border border-blue-200 flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                    title="360° Rotate & 4-Point Free Perspective Crop"
                  >
                    <Crop className="w-3 h-3 text-blue-600" />
                    <span>Rotate & Crop</span>
                  </button>
                )}
                {selectionBox && activeSide === 'back' && (
                  <button
                    type="button"
                    onClick={() => setSelectionBox(null)}
                    className="text-[10px] text-red-500 hover:underline font-semibold cursor-pointer"
                  >
                    Clear Box
                  </button>
                )}
              </div>
            </div>

            <div
              id="idcard-back-container"
              ref={backContainerRef}
              onClick={(e) => handleCardClick(e, 'back')}
              onDoubleClick={(e) => {
                e.stopPropagation();
                handleOpenOriginalCrop('back');
              }}
              onMouseDown={(e) => handleMouseDownOnCard(e, 'back')}
              style={{ padding: 0, margin: 0 }}
              className={`relative aspect-[85.6/54] rounded-xl border-2 transition-all overflow-hidden cursor-pointer group bg-slate-50 flex items-center justify-center select-none shadow-2xs p-0 m-0 ${
                activeSide === 'back'
                  ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-sm'
                  : 'border-dashed border-slate-300 hover:border-blue-300'
              } ${activeTool === 'select' && activeSide === 'back' ? 'cursor-crosshair' : ''}`}
            >
              {/* In-Card Corner Actions */}
              {/* Top-Left: Mini-Crop Adjust (only if cropped image exists) */}
              {backCropped && (
                <button
                  type="button"
                  onClick={(e) => handleOpenMiniCrop(e, 'back')}
                  className="absolute top-2 left-2 z-20 w-7 h-7 rounded-full bg-white/90 hover:bg-white text-slate-700 hover:text-blue-600 shadow-md border border-slate-200/80 flex items-center justify-center cursor-pointer transition-all opacity-0 group-hover:opacity-100"
                  title="Micro-Crop Adjust (Adjust cropped card)"
                >
                  <Crop className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Top-Right: Upload / Replace File */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  backInputRef.current?.click();
                }}
                className={`absolute top-2 right-2 z-20 w-7 h-7 rounded-full bg-white/90 hover:bg-white text-slate-700 hover:text-blue-600 shadow-md border border-slate-200/80 flex items-center justify-center cursor-pointer transition-all ${
                  !backCropped ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
                title="Upload or Replace File"
              >
                <Upload className="w-3.5 h-3.5" />
              </button>
              {backCropped ? (
                <>
                  <img
                    src={backCropped}
                    alt="ID Back"
                    style={{ objectFit: 'fill', width: '100%', height: '100%', display: 'block' }}
                    className="w-full h-full block pointer-events-none rounded-none"
                  />

                  {/* Localized Enhanced Area (Marquee) on Back */}
                  {selectionBox && activeSide === 'back' && (
                    <div
                      style={{
                        left: `${selectionBox.x}%`,
                        top: `${selectionBox.y}%`,
                        width: `${selectionBox.width}%`,
                        height: `${selectionBox.height}%`
                      }}
                      className="absolute border-2 border-dashed border-blue-500 rounded pointer-events-none shadow-sm z-10 overflow-hidden"
                    >
                      <span className="absolute top-0 left-0 bg-blue-600 text-white text-[9px] font-bold px-1 py-0.5 rounded-br">
                        Selected
                      </span>
                      <img
                        src={backCropped}
                        alt="Enhanced Area"
                        style={{
                          position: 'absolute',
                          left: `-${(selectionBox.x / selectionBox.width) * 100}%`,
                          top: `-${(selectionBox.y / selectionBox.height) * 100}%`,
                          width: `${(100 / selectionBox.width) * 100}%`,
                          height: `${(100 / selectionBox.height) * 100}%`,
                          maxWidth: 'none',
                          filter: `brightness(${adjustments?.brightness ?? 100}%) contrast(${adjustments?.contrast ?? 100}%) saturate(${adjustments?.saturation ?? 100}%)${adjustments?.beautify ? ' contrast(1.12) brightness(1.08) saturate(1.15)' : ''}${adjustments?.autoCorrect ? ' contrast(1.18) brightness(1.05)' : ''}`
                        }}
                        className="object-fill"
                      />
                    </div>
                  )}

                  {/* Transparent, Freely Draggable & Resizable Text Overlays via react-rnd */}
                  {textOverlays
                    .filter((t) => t.side === 'back')
                    .map((t) => {
                      const isActive = activeTextId === t.id;
                      const isDraggable = draggableTextId === t.id;
                      return (
                        <Rnd
                          key={t.id}
                          size={{ width: t.width || 95, height: t.height || 16 }}
                          position={{
                            x: t.x !== undefined ? Math.round((t.x / 100) * (backContainerRef.current?.clientWidth || 320)) : (t.pixelX || 0),
                            y: t.y !== undefined ? Math.round((t.y / 100) * (backContainerRef.current?.clientHeight || 202)) : (t.pixelY || 0)
                          }}
                          bounds="parent"
                          disableDragging={!isDraggable}
                          dragHandleClassName="rnd-border-handle"
                          className="z-30 group/rnd"
                          enableResizing={isDraggable ? {
                            top: true,
                            right: true,
                            bottom: true,
                            left: true,
                            topRight: true,
                            bottomRight: true,
                            bottomLeft: true,
                            topLeft: true
                          } : false}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            setActiveTextId(t.id);
                            setDraggableTextId(t.id);
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setActiveTextId(t.id);
                            setDraggableTextId(t.id);
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveTextId(t.id);
                            setDraggableTextId(t.id);
                          }}
                          onDragStart={() => {
                            setActiveTextId(t.id);
                            setDraggableTextId(t.id);
                          }}
                          onResize={(e, direction, ref) => {
                            const h = parseInt(ref.style.height, 10) || 16;
                            const dynamicFontSize = Math.max(6, Math.min(24, Math.round(h * 0.5)));
                            setTextOverlays((prev) =>
                              prev.map((item) => (item.id === t.id ? { ...item, fontSize: dynamicFontSize } : item))
                            );
                          }}
                          onDragStop={(e, d) => {
                            const parentW = backContainerRef.current?.clientWidth || 320;
                            const parentH = backContainerRef.current?.clientHeight || 202;
                            const newX = (d.x / parentW) * 100;
                            const newY = (d.y / parentH) * 100;
                            setTextOverlays((prev) =>
                              prev.map((item) =>
                                item.id === t.id
                                  ? {
                                      ...item,
                                      pixelX: d.x,
                                      pixelY: d.y,
                                      x: newX,
                                      y: newY
                                    }
                                  : item
                              )
                            );
                          }}
                          onResizeStop={(e, direction, ref, delta, position) => {
                            const newW = parseInt(ref.style.width, 10);
                            const newH = parseInt(ref.style.height, 10);
                            const dynamicFontSize = Math.max(6, Math.min(24, Math.round(newH * 0.5)));
                            const parentW = backContainerRef.current?.clientWidth || 320;
                            const parentH = backContainerRef.current?.clientHeight || 202;
                            const newX = (position.x / parentW) * 100;
                            const newY = (position.y / parentH) * 100;
                            setTextOverlays((prev) =>
                              prev.map((item) =>
                                item.id === t.id
                                  ? {
                                      ...item,
                                      width: newW,
                                      height: newH,
                                      pixelX: position.x,
                                      pixelY: position.y,
                                      x: newX,
                                      y: newY,
                                      fontSize: dynamicFontSize
                                    }
                                  : item
                              )
                            );
                          }}
                        >
                          <div
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              setActiveTextId(t.id);
                              setDraggableTextId(t.id);
                            }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setActiveTextId(t.id);
                              setDraggableTextId(t.id);
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveTextId(t.id);
                              setDraggableTextId(t.id);
                            }}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setActiveTextId(t.id);
                              setDraggableTextId(t.id);
                            }}
                            style={{
                              border: 'none',
                              outline: isActive ? '2px solid #2563eb' : 'none',
                              outlineOffset: '1px',
                              borderRadius: '2px',
                              background: isActive ? 'rgba(37, 99, 235, 0.04)' : 'transparent',
                              padding: 0,
                              margin: 0,
                              display: 'block',
                              lineHeight: 1,
                              verticalAlign: 'top',
                              boxSizing: 'border-box'
                            }}
                            className={`rnd-border-handle relative w-full h-full select-none transition-colors ${
                              isDraggable ? 'cursor-move' : 'cursor-default'
                            }`}
                            title="Click and drag to move • Use Move Text toolbar at top"
                          >

                            <div
                              contentEditable="true"
                              suppressContentEditableWarning={true}
                              onFocus={() => {
                                setActiveTextId(t.id);
                                setDraggableTextId(t.id);
                              }}
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                setActiveTextId(t.id);
                                setDraggableTextId(t.id);
                              }}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                setActiveTextId(t.id);
                                setDraggableTextId(t.id);
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveTextId(t.id);
                                setDraggableTextId(t.id);
                              }}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                setActiveTextId(t.id);
                                setDraggableTextId(t.id);
                              }}
                              onBlur={(e) => {
                                const val = e.currentTarget.innerText;
                                setTextOverlays((prev) =>
                                  prev.map((item) => (item.id === t.id ? { ...item, text: val } : item))
                                );
                              }}
                              style={{
                                background: 'transparent',
                                outline: 'none',
                                fontFamily: 'Arial, Helvetica, sans-serif',
                                fontWeight: 'bold',
                                color: '#111827',
                                fontSize: `${t.fontSize || 7.5}px`,
                                lineHeight: '1',
                                padding: 0,
                                margin: 0,
                                display: 'block',
                                verticalAlign: 'top',
                                boxSizing: 'border-box',
                                whiteSpace: 'nowrap',
                                cursor: 'text'
                              }}
                              className="rnd-text-editor select-text cursor-text"
                              title="Click to edit mobile number"
                            >
                              {t.text}
                            </div>
                          </div>
                        </Rnd>
                      );
                    })}
                </>
              ) : (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    backInputRef.current?.click();
                  }}
                  className="flex flex-col items-center justify-center text-slate-400 p-4 text-center cursor-pointer hover:text-blue-500 transition-colors select-none"
                >
                  <Upload className="w-7 h-7 mb-1.5 text-slate-400" />
                  <span className="text-xs font-bold text-slate-600">Back Side (Empty)</span>
                  <span className="text-[10px] text-slate-400">
                    Click to Upload • Double-click to Crop PDF
                  </span>
                </div>
              )}
            </div>

            <input
              ref={backInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => handleFileChange(e, 'back')}
              className="hidden"
            />
          </div>
        </div>
      )}

      {/* Manual Crop Modal Component (Double-click on card opens full uncropped PDF/Image; Mini-crop opens cropped image) */}
      <ManualCropModal
        isOpen={isCropModalOpen}
        onClose={() => {
          setIsCropModalOpen(false);
          setCropModalImage(null);
        }}
        imageSrc={cropModalImage || (cropModalSide === 'front' ? frontOriginal || frontCropped : backOriginal || backCropped)}
        sideName={`${cropModalSide === 'front' ? 'Front Side' : 'Back Side'} ${cropModalImage && cropModalImage === (cropModalSide === 'front' ? frontCropped : backCropped) ? '(Micro-Crop)' : '(Full Document)'}`}
        onApplyCrop={(croppedDataUrl) => {
          onUpdateCroppedImage(cropModalSide, croppedDataUrl);
          setIsCropModalOpen(false);
          setCropModalImage(null);
        }}
      />

      {/* 360° Rotate & 4-Point Free Perspective Crop Modal (Special Card) */}
      <PerspectiveCropModal
        isOpen={perspectiveModalState.isOpen}
        onClose={() => setPerspectiveModalState((prev) => ({ ...prev, isOpen: false, imageSrc: null }))}
        imageSrc={perspectiveModalState.imageSrc}
        preset={perspectiveModalState.preset}
        title={perspectiveModalState.title}
        onApplyCrop={handleApplyPerspectiveCrop}
      />

      {/* Inspection & Edit Magnifier Modal (Edit Card button opens high-res view) */}
      <IDCardMagnifierModal
        isOpen={magnifierState.isOpen}
        onClose={() => setMagnifierState((prev) => ({ ...prev, isOpen: false }))}
        imageSrc={magnifierState.imageSrc}
        title={magnifierState.title}
        onMinimizeInstructionBox={handleRearrangeAadhaar}
      />

      {/* Password-Protected PDF Prompt Modal */}
      <PdfPasswordModal
        isOpen={pdfPasswordState.isOpen}
        fileName={pdfPasswordState.fileName}
        errorMessage={pdfPasswordState.errorMessage}
        isSubmitting={pdfPasswordState.isSubmitting}
        onSubmit={handlePdfPasswordSubmit}
        onCancel={handlePdfPasswordCancel}
      />

      <div className={selectedType === 'special' && specialMode === 'docs' ? 'mt-2 mb-1 shrink-0' : ''}>
        {/* Single CR80 Export Control Bar */}
        <div className={`bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 ${
          selectedType === 'special' && specialMode === 'docs' ? 'mb-1.5' : 'mb-3'
        } flex items-center justify-between gap-1 text-[10px] shadow-2xs overflow-hidden`}>
          <div className="flex items-center gap-1 font-semibold text-slate-700 shrink-0">
            <span className="text-slate-400 font-bold text-[10px]">W:</span>
            <input
              type="number"
              value={cr80Settings.width}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0;
                setCr80Settings({ ...cr80Settings, width: val });
                if (selectedType === 'special' && specialMode === 'docs' && val > 0) {
                  setDocScaleW(Math.max(40, Math.min(160, Math.round((val / 210) * 100))));
                }
              }}
              className="w-10 bg-white border border-slate-300 rounded px-1 py-0.5 text-center text-slate-800 font-bold text-[10px] focus:outline-none focus:border-blue-500 shadow-2xs"
            />
            <span className="text-slate-400 font-bold text-[10px]">H:</span>
            <input
              type="number"
              value={cr80Settings.height}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0;
                setCr80Settings({ ...cr80Settings, height: val });
                if (selectedType === 'special' && specialMode === 'docs' && val > 0) {
                  setDocScaleH(Math.max(40, Math.min(160, Math.round((val / 297) * 100))));
                }
              }}
              className="w-10 bg-white border border-slate-300 rounded px-1 py-0.5 text-center text-slate-800 font-bold text-[10px] focus:outline-none focus:border-blue-500 shadow-2xs"
            />
            <select
              value={cr80Settings.unit}
              onChange={(e) => setCr80Settings({ ...cr80Settings, unit: e.target.value })}
              className="bg-white border border-slate-300 rounded px-1 py-0.5 font-bold text-slate-700 focus:outline-none cursor-pointer text-[10px] shadow-2xs"
            >
              <option value="mm">mm</option>
              <option value="cm">cm</option>
              <option value="px">px</option>
            </select>
          </div>

          <div className="h-3.5 w-[1px] bg-slate-300 mx-0.5 shrink-0" />

          <div className="flex items-center gap-1 font-semibold text-slate-700 shrink-0">
            <span className="text-slate-400 font-bold text-[10px]">DPI:</span>
            <input
              type="number"
              value={cr80Settings.dpi}
              onChange={(e) =>
                setCr80Settings({ ...cr80Settings, dpi: parseInt(e.target.value, 10) || 300 })
              }
              className="w-9 bg-white border border-slate-300 rounded px-0.5 py-0.5 text-center text-slate-800 font-bold text-[10px] focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="h-3.5 w-[1px] bg-slate-300 mx-0.5 shrink-0" />

          <div className="flex items-center gap-1 font-semibold text-slate-700 shrink-0">
            <span className="text-slate-400 font-bold text-[10px]">Format:</span>
            <select
              value={cr80Settings.format}
              onChange={(e) => setCr80Settings({ ...cr80Settings, format: e.target.value })}
              className="bg-white border border-slate-300 rounded px-1 py-0.5 font-bold text-slate-700 focus:outline-none cursor-pointer text-[10px]"
            >
              <option value="PNG">PNG</option>
              <option value="JPG">JPG</option>
            </select>
          </div>

          <button
            onClick={async () => {
              if (selectedType === 'special' && specialMode === 'docs') {
                if (!docImage) return;
                const scaledDoc = await applyDimensionScaling(docImage, docScaleW, docScaleH);
                onDownloadSingle?.({
                  isDoc: true,
                  docImage: scaledDoc
                });
              } else {
                onDownloadSingle?.({
                  frontContainer: frontContainerRef.current,
                  backContainer: backContainerRef.current
                });
              }
            }}
            disabled={
              selectedType === 'special' && specialMode === 'docs'
                ? !docImage
                : (!frontCropped && !backCropped)
            }
            className="px-2 py-1 bg-[#1677ff] hover:bg-[#0958d9] disabled:opacity-50 text-white font-bold rounded-md flex items-center justify-center gap-1 text-[10px] transition-colors whitespace-nowrap shadow-xs cursor-pointer active:scale-[0.98] shrink-0"
            title={selectedType === 'special' && specialMode === 'docs' ? 'Export edited document' : 'Export edited single CR80 ID Card pair'}
          >
            <Download className="w-3 h-3" />
            <span>{selectedType === 'special' && specialMode === 'docs' ? 'Download Doc' : 'Download'}</span>
          </button>
        </div>

        {/* Primary Stacking Action Button */}
        <button
          onClick={async () => {
            if (selectedType === 'special' && specialMode === 'docs') {
              if (!docImage) return;
              const scaledDoc = await applyDimensionScaling(docImage, docScaleW, docScaleH);
              onAddToPrintPreview?.({
                isDoc: true,
                docImage: scaledDoc,
                docContainer: docContainerRef.current
              });
            } else {
              onAddToPrintPreview?.({
                frontContainer: frontContainerRef.current,
                backContainer: backContainerRef.current
              });
            }
          }}
          disabled={
            selectedType === 'special' && specialMode === 'docs'
              ? !docImage
              : (!frontCropped && !backCropped)
          }
          className="w-full py-2.5 bg-[#1677ff] hover:bg-[#0958d9] disabled:opacity-50 text-white font-bold text-xs sm:text-[13px] rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer active:scale-[0.99]"
        >
          <Plus className="w-4 h-4" />
          <span>
            {selectedType === 'special' && specialMode === 'docs'
              ? '+ Add A4 Document to Print Preview'
              : '+ Add to Print Preview'}
          </span>
        </button>
      </div>
      </div>
    </div>
  );
}
