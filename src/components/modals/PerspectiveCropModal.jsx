import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Check,
  Crop,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
  RefreshCw,
  Loader2,
  Maximize2,
  FileText,
  CreditCard,
  Maximize,
  Sun,
  Contrast as ContrastIcon,
  Sparkles,
  Scan,
  Hand,
  Zap
} from 'lucide-react';
import { perspectiveCropImage, detectDocumentCorners } from '../../utils/api';

/**
 * Rotate image via HTML5 Canvas
 */
function rotateImageCanvas(srcUrl, angleDeg) {
  return new Promise((resolve) => {
    if (!srcUrl) return resolve(null);
    const normalized = ((angleDeg % 360) + 360) % 360;
    if (normalized === 0) return resolve(srcUrl);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const rad = (normalized * Math.PI) / 180;
      const sin = Math.abs(Math.sin(rad));
      const cos = Math.abs(Math.cos(rad));
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;

      const newW = Math.round(w * cos + h * sin);
      const newH = Math.round(w * sin + h * cos);

      const canvas = document.createElement('canvas');
      canvas.width = newW;
      canvas.height = newH;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, newW, newH);

      ctx.translate(newW / 2, newH / 2);
      ctx.rotate(rad);
      ctx.drawImage(img, -w / 2, -h / 2);

      resolve(canvas.toDataURL('image/jpeg', 0.95));
    };
    img.onerror = () => resolve(srcUrl);
    img.src = srcUrl;
  });
}

/**
 * Apply Brightness, Contrast, Auto Beautify & Correction to image via Canvas
 */
function applyFiltersToCanvas(srcUrl, brightness, contrast, isAutoBeautify, isCorrection) {
  return new Promise((resolve) => {
    if (!srcUrl) return resolve(null);
    let effectiveB = brightness || 0;
    let effectiveC = contrast || 0;
    let effectiveS = 0;

    if (isAutoBeautify) {
      effectiveB += 3;
      effectiveC += 10;
      effectiveS += 6;
    } else if (isCorrection) {
      effectiveB += 2;
      effectiveC += 6;
    }

    if (effectiveB === 0 && effectiveC === 0 && effectiveS === 0) {
      return resolve(srcUrl);
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      const bRatio = Math.max(0.2, 1 + effectiveB / 100);
      const cRatio = Math.max(0.2, 1 + effectiveC / 100);
      const sRatio = Math.max(0.2, 1 + effectiveS / 100);
      ctx.filter = `brightness(${bRatio.toFixed(2)}) contrast(${cRatio.toFixed(2)}) saturate(${sRatio.toFixed(2)})`;
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.96));
    };
    img.onerror = () => resolve(srcUrl);
    img.src = srcUrl;
  });
}

/**
 * 4-Point Coordinate Rotation Helpers (Never reset handles on rotation!)
 * [0] = TL, [1] = TR, [2] = BR, [3] = BL
 */
function rotatePoints90Cw(pts) {
  return [
    { x: Math.round((100 - pts[3].y) * 10) / 10, y: Math.round(pts[3].x * 10) / 10 },
    { x: Math.round((100 - pts[0].y) * 10) / 10, y: Math.round(pts[0].x * 10) / 10 },
    { x: Math.round((100 - pts[1].y) * 10) / 10, y: Math.round(pts[1].x * 10) / 10 },
    { x: Math.round((100 - pts[2].y) * 10) / 10, y: Math.round(pts[2].x * 10) / 10 }
  ];
}

function rotatePoints90Ccw(pts) {
  return [
    { x: Math.round(pts[1].y * 10) / 10, y: Math.round((100 - pts[1].x) * 10) / 10 },
    { x: Math.round(pts[2].y * 10) / 10, y: Math.round((100 - pts[2].x) * 10) / 10 },
    { x: Math.round(pts[3].y * 10) / 10, y: Math.round((100 - pts[3].x) * 10) / 10 },
    { x: Math.round(pts[0].y * 10) / 10, y: Math.round((100 - pts[0].x) * 10) / 10 }
  ];
}

function rotatePoints180(pts) {
  return [
    { x: Math.round((100 - pts[2].x) * 10) / 10, y: Math.round((100 - pts[2].y) * 10) / 10 },
    { x: Math.round((100 - pts[3].x) * 10) / 10, y: Math.round((100 - pts[3].y) * 10) / 10 },
    { x: Math.round((100 - pts[0].x) * 10) / 10, y: Math.round((100 - pts[0].y) * 10) / 10 },
    { x: Math.round((100 - pts[1].x) * 10) / 10, y: Math.round((100 - pts[1].y) * 10) / 10 }
  ];
}

export default function PerspectiveCropModal({
  isOpen,
  onClose,
  imageSrc,
  onApplyCrop,
  preset = 'a4', // 'a4' | 'card' | 'auto'
  title = 'Special Card: Rotate & Free Perspective Crop'
}) {
  const [workingImage, setWorkingImage] = useState(null);
  const [isRotating, setIsRotating] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);

  // Target aspect ratio preset: 'card' (54/85.6) | 'a4' (1.414) | 'auto' (0 = natural)
  const [activePreset, setActivePreset] = useState(preset);

  // Document Enhancement Controls: Brightness, Contrast, Correction, Auto Beautify
  const [brightness, setBrightness] = useState(0); // -40 to +40
  const [contrast, setContrast] = useState(0);     // -40 to +40
  const [isCorrection, setIsCorrection] = useState(false);
  const [isAutoBeautify, setIsAutoBeautify] = useState(false);

  // 4 Independent / Free Corner Points (Percentages 0-100% of working image):
  // [0] = TL (Top-Left), [1] = TR (Top-Right), [2] = BR (Bottom-Right), [3] = BL (Bottom-Left)
  const [points, setPoints] = useState([
    { x: 5, y: 5 },
    { x: 95, y: 5 },
    { x: 95, y: 95 },
    { x: 5, y: 95 }
  ]);

  const [activeCorner, setActiveCorner] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Zoom & Pan state
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const containerRef = useRef(null);
  const imgRef = useRef(null);

  // Auto-detect edges helper
  const runAutoDetect = useCallback(async (imgUrl) => {
    if (!imgUrl) return;
    setIsDetecting(true);
    try {
      const res = await detectDocumentCorners(imgUrl);
      if (res?.hasDetection && res?.points && res.points.length === 4) {
        setPoints(res.points);
      }
    } catch (err) {
      console.warn('Auto edge detection skipped:', err);
    } finally {
      setIsDetecting(false);
    }
  }, []);

  // Initialize or reset when modal opens
  useEffect(() => {
    if (isOpen && imageSrc) {
      setWorkingImage(imageSrc);
      setActivePreset(preset);
      setBrightness(0);
      setContrast(0);
      setIsCorrection(false);
      setIsAutoBeautify(false);
      setPoints([
        { x: 5, y: 5 },
        { x: 95, y: 5 },
        { x: 95, y: 95 },
        { x: 5, y: 95 }
      ]);
      setZoom(1.0);
      setPan({ x: 0, y: 0 });
      setActiveCorner(null);
      setIsProcessing(false);

      // Automatically attempt edge detection on first open
      runAutoDetect(imageSrc);
    }
  }, [isOpen, imageSrc, preset, runAutoDetect]);

  // Mouse wheel scroll to Zoom In / Zoom Out
  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
    setZoom((z) => Math.max(0.4, Math.min(3.5, Math.round(z * zoomFactor * 100) / 100)));
  };

  // Hold Left Click to Drag (Pan) freely in all directions
  const handleWorkspaceMouseDown = (e) => {
    if (activeCorner !== null) return;
    if (e.button !== 0) return; // Left button only
    setIsPanning(true);
    setPanStart({
      x: e.clientX - pan.x,
      y: e.clientY - pan.y
    });
  };

  const handleWorkspaceMouseMove = (e) => {
    if (!isPanning || activeCorner !== null) return;
    setPan({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y
    });
  };

  const handleWorkspaceMouseUp = () => {
    setIsPanning(false);
  };

  // Rotate 90° Clockwise WITHOUT losing corner positions!
  const handleRotateCw = async () => {
    if (!workingImage || isRotating) return;
    setIsRotating(true);
    try {
      const rotated = await rotateImageCanvas(workingImage, 90);
      setWorkingImage(rotated);
      setPoints((prev) => rotatePoints90Cw(prev));
    } catch (err) {
      console.error('Rotate CW error:', err);
    } finally {
      setIsRotating(false);
    }
  };

  // Rotate 90° Counter-Clockwise WITHOUT losing corner positions!
  const handleRotateCcw = async () => {
    if (!workingImage || isRotating) return;
    setIsRotating(true);
    try {
      const rotated = await rotateImageCanvas(workingImage, 270);
      setWorkingImage(rotated);
      setPoints((prev) => rotatePoints90Ccw(prev));
    } catch (err) {
      console.error('Rotate CCW error:', err);
    } finally {
      setIsRotating(false);
    }
  };

  // Flip 180° (Fix upside down WhatsApp docs) WITHOUT losing corner positions!
  const handleFlip180 = async () => {
    if (!workingImage || isRotating) return;
    setIsRotating(true);
    try {
      const rotated = await rotateImageCanvas(workingImage, 180);
      setWorkingImage(rotated);
      setPoints((prev) => rotatePoints180(prev));
    } catch (err) {
      console.error('Flip 180 error:', err);
    } finally {
      setIsRotating(false);
    }
  };

  // Handle Dragging Independent Corner Points (Compact pins, full 0-100% range)
  const handlePointerDown = (idx, e) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {}
    setActiveCorner(idx);
  };

  const handlePointerMove = useCallback((e) => {
    if (activeCorner === null || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const rawX = ((e.clientX - rect.left) / rect.width) * 100;
    const rawY = ((e.clientY - rect.top) / rect.height) * 100;

    const clampedX = Math.max(0, Math.min(100, Math.round(rawX * 10) / 10));
    const clampedY = Math.max(0, Math.min(100, Math.round(rawY * 10) / 10));

    setPoints((prev) => {
      const copy = [...prev];
      copy[activeCorner] = { x: clampedX, y: clampedY };
      return copy;
    });
  }, [activeCorner]);

  const handlePointerUp = useCallback((e) => {
    if (e && e.currentTarget && e.pointerId) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (err) {}
    }
    setActiveCorner(null);
  }, []);

  useEffect(() => {
    if (activeCorner !== null) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      return () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };
    }
  }, [activeCorner, handlePointerMove, handlePointerUp]);

  // Reset 4 corner handles to image bounds
  const handleResetCorners = () => {
    setPoints([
      { x: 5, y: 5 },
      { x: 95, y: 5 },
      { x: 95, y: 95 },
      { x: 5, y: 95 }
    ]);
  };

  // Determine numerical aspect ratio from preset
  const getTargetAspect = () => {
    if (activePreset === 'card') {
      return 54.0 / 85.6; // 0.6308: Standard CR80 landscape card
    }
    if (activePreset === 'a4') {
      return 1.414; // A4 portrait: 297 / 210
    }
    return 0; // 0 = Auto / Natural proportion
  };

  // Perform Perspective Crop & Apply Scanner Effects
  const handleApply = async () => {
    if (!workingImage) return;
    setIsProcessing(true);
    try {
      const filteredImage = await applyFiltersToCanvas(
        workingImage,
        brightness,
        contrast,
        isAutoBeautify,
        isCorrection
      );

      const targetAspect = getTargetAspect();
      const scanModeParam = isAutoBeautify ? 'auto_beautify' : (isCorrection ? 'correction' : 'original');
      const res = await perspectiveCropImage(filteredImage, points, targetAspect, 0, scanModeParam);
      if (res?.dataUrl) {
        onApplyCrop(res.dataUrl);
        onClose();
        return;
      }
      throw new Error('No image returned from server');
    } catch (err) {
      console.warn('Backend perspective crop fallback:', err);
      try {
        const filteredImage = await applyFiltersToCanvas(
          workingImage,
          brightness,
          contrast,
          isAutoBeautify,
          isCorrection
        );
        const canvasWarped = await clientSideWarp(filteredImage, points);
        onApplyCrop(canvasWarped);
        onClose();
      } catch (clientErr) {
        alert('Failed to crop perspective: ' + clientErr.message);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Fallback client-side bounding box crop
  const clientSideWarp = (srcUrl, pts) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const natW = img.naturalWidth || img.width;
        const natH = img.naturalHeight || img.height;

        const px = pts.map((p) => (p.x / 100) * natW);
        const py = pts.map((p) => (p.y / 100) * natH);

        const minX = Math.max(0, Math.min(...px));
        const maxX = Math.min(natW, Math.max(...px));
        const minY = Math.max(0, Math.min(...py));
        const maxY = Math.min(natH, Math.max(...py));

        const cropW = Math.max(100, maxX - minX);
        const cropH = Math.max(100, maxY - minY);

        const canvas = document.createElement('canvas');
        canvas.width = cropW;
        canvas.height = cropH;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = srcUrl;
    });
  };

  if (!isOpen) return null;

  // Sleek compact corner configurations (TL, TR, BR, BL)
  const cornerConfigs = [
    { label: 'TL', title: 'Top-Left', color: 'bg-blue-600', ring: 'ring-blue-400' },
    { label: 'TR', title: 'Top-Right', color: 'bg-emerald-600', ring: 'ring-emerald-400' },
    { label: 'BR', title: 'Bottom-Right', color: 'bg-purple-600', ring: 'ring-purple-400' },
    { label: 'BL', title: 'Bottom-Left', color: 'bg-amber-600', ring: 'ring-amber-400' }
  ];

  const polygonPointsStr = points.map((p) => `${p.x}%,${p.y}%`).join(' ');

  // Compute live CSS preview filter
  let effectiveB = brightness;
  let effectiveC = contrast;
  let effectiveS = 0;

  if (isAutoBeautify) {
    effectiveB += 3;
    effectiveC += 10;
    effectiveS += 6;
  } else if (isCorrection) {
    effectiveB += 2;
    effectiveC += 6;
  }

  const bRatio = Math.max(0.2, 1 + effectiveB / 100);
  const cRatio = Math.max(0.2, 1 + effectiveC / 100);
  const sRatio = Math.max(0.2, 1 + effectiveS / 100);

  const filterStyle = (effectiveB !== 0 || effectiveC !== 0 || effectiveS !== 0)
    ? `brightness(${bRatio.toFixed(2)}) contrast(${cRatio.toFixed(2)}) saturate(${sRatio.toFixed(2)})`
    : 'none';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/85 backdrop-blur-sm select-none">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl h-[92vh] max-h-[860px] flex flex-col overflow-hidden animate-in fade-in duration-150">
        
        {/* 1. MODAL TOP HEADER */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Crop className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <span>{title}</span>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-700">
                  Free Handles
                </span>
              </h2>
              <p className="text-[10px] text-slate-500">
                Mouse Wheel: Zoom In/Out • Hold Left Click: Pan freely in all directions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Auto Detect Edges Button */}
            <button
              type="button"
              onClick={() => runAutoDetect(workingImage)}
              disabled={isDetecting}
              className="px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
              title="Automatically detect card or document edges with OpenCV"
            >
              {isDetecting ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                  <span>Detecting...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3 text-blue-600" />
                  <span>✨ Auto Detect Edges</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleResetCorners}
              className="px-2 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
              title="Reset corners to outer frame"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. COMPACT TOOLBAR: 360° ROTATE + SCANNER MODES + ADJUSTMENTS + PRESETS */}
        <div className="px-5 py-2 bg-slate-100/90 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          
          {/* Section A: Quick 360° Rotate Controls */}
          <div className="flex items-center gap-1">
            <span className="font-bold text-slate-600 text-[11px] mr-0.5 flex items-center gap-1">
              <RotateCw className="w-3 h-3 text-blue-600" />
              Rotate:
            </span>

            <button
              type="button"
              onClick={handleRotateCcw}
              disabled={isRotating}
              className="px-2 py-1 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              title="Rotate 90° Counter-Clockwise (Keeps corner handles in place)"
            >
              <RotateCcw className="w-3 h-3 text-blue-600" />
              <span>↺ 90°</span>
            </button>

            <button
              type="button"
              onClick={handleRotateCw}
              disabled={isRotating}
              className="px-2 py-1 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              title="Rotate 90° Clockwise (Keeps corner handles in place)"
            >
              <RotateCw className="w-3 h-3 text-blue-600" />
              <span>↻ 90°</span>
            </button>

            <button
              type="button"
              onClick={handleFlip180}
              disabled={isRotating}
              className="px-2.5 py-1 bg-white hover:bg-indigo-50 active:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              title="Flip 180° (Fix Upside-Down WhatsApp Doc without resetting handles)"
            >
              <RefreshCw className="w-3 h-3 text-indigo-600" />
              <span>↻ 180° Flip</span>
            </button>
          </div>

          {/* Section B: Document Enhancement Controls (Brightness, Contrast, Correction, Auto Beautify) */}
          <div className="flex items-center gap-1.5 bg-white p-0.5 rounded-lg border border-slate-200 shadow-2xs">
            {/* 1. Brightness Slider with +/- 5 controls */}
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded-md" title="Adjust document brightness (-50 to +50 in steps of 5)">
              <Sun className="w-3 h-3 text-amber-500 shrink-0" />
              <span className="text-[10px] font-bold text-slate-700 select-none">Brightness</span>
              <button
                type="button"
                onClick={() => setBrightness((prev) => Math.max(-50, prev - 5))}
                className="w-4 h-4 flex items-center justify-center rounded bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-700 font-bold text-[11px] leading-none cursor-pointer transition-all select-none"
                title="Brightness -5"
              >
                -
              </button>
              <input
                type="range"
                min="-50"
                max="50"
                step="5"
                value={brightness}
                onChange={(e) => setBrightness(parseInt(e.target.value, 10))}
                className="w-12 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <button
                type="button"
                onClick={() => setBrightness((prev) => Math.min(50, prev + 5))}
                className="w-4 h-4 flex items-center justify-center rounded bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-700 font-bold text-[11px] leading-none cursor-pointer transition-all select-none"
                title="Brightness +5"
              >
                +
              </button>
              <span
                onDoubleClick={() => setBrightness(0)}
                className={`text-[9px] font-mono font-bold min-w-[22px] text-center select-none cursor-pointer ${
                  brightness !== 0 ? 'text-amber-600' : 'text-slate-400'
                }`}
                title="Double click to reset brightness to 0"
              >
                {brightness > 0 ? `+${brightness}` : brightness}
              </span>
            </div>

            {/* 2. Contrast Slider ("contracts") with +/- 5 controls */}
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded-md" title="Adjust document contrast / text sharpness (-50 to +50 in steps of 5)">
              <ContrastIcon className="w-3 h-3 text-blue-600 shrink-0" />
              <span className="text-[10px] font-bold text-slate-700 select-none">Contrast</span>
              <button
                type="button"
                onClick={() => setContrast((prev) => Math.max(-50, prev - 5))}
                className="w-4 h-4 flex items-center justify-center rounded bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-700 font-bold text-[11px] leading-none cursor-pointer transition-all select-none"
                title="Contrast -5"
              >
                -
              </button>
              <input
                type="range"
                min="-50"
                max="50"
                step="5"
                value={contrast}
                onChange={(e) => setContrast(parseInt(e.target.value, 10))}
                className="w-12 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <button
                type="button"
                onClick={() => setContrast((prev) => Math.min(50, prev + 5))}
                className="w-4 h-4 flex items-center justify-center rounded bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-700 font-bold text-[11px] leading-none cursor-pointer transition-all select-none"
                title="Contrast +5"
              >
                +
              </button>
              <span
                onDoubleClick={() => setContrast(0)}
                className={`text-[9px] font-mono font-bold min-w-[22px] text-center select-none cursor-pointer ${
                  contrast !== 0 ? 'text-blue-600' : 'text-slate-400'
                }`}
                title="Double click to reset contrast to 0"
              >
                {contrast > 0 ? `+${contrast}` : contrast}
              </span>
            </div>

            {/* 3. Correction 1-Click Toggle */}
            <button
              type="button"
              onClick={() => {
                setIsCorrection((prev) => {
                  const next = !prev;
                  if (next) setIsAutoBeautify(false);
                  return next;
                });
              }}
              className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                isCorrection
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-700 hover:text-blue-600 hover:bg-slate-100'
              }`}
              title="Auto Document Tone & Level Correction (CLAHE contrast stretch to fix faint text & grey paper)"
            >
              <Zap className={`w-3 h-3 ${isCorrection ? 'text-amber-300' : 'text-blue-600'}`} />
              <span>Correction</span>
            </button>

            {/* 4. Auto Beautify 1-Click Toggle */}
            <button
              type="button"
              onClick={() => {
                setIsAutoBeautify((prev) => {
                  const next = !prev;
                  if (next) setIsCorrection(false);
                  return next;
                });
              }}
              className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                isAutoBeautify
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-2xs'
                  : 'text-purple-700 hover:bg-purple-50'
              }`}
              title="Auto Beautify: High-Definition clean white paper, shadow removal, and text sharpening"
            >
              <Sparkles className={`w-3 h-3 ${isAutoBeautify ? 'text-amber-300' : 'text-purple-600'}`} />
              <span>Auto Beautify</span>
            </button>

            {/* Reset button if anything is adjusted */}
            {(brightness !== 0 || contrast !== 0 || isCorrection || isAutoBeautify) && (
              <button
                type="button"
                onClick={() => {
                  setBrightness(0);
                  setContrast(0);
                  setIsCorrection(false);
                  setIsAutoBeautify(false);
                }}
                className="text-[9px] text-slate-400 hover:text-red-500 font-bold px-1 transition-colors cursor-pointer"
                title="Reset all adjustments"
              >
                Reset
              </button>
            )}
          </div>

          {/* Section C: Target Aspect Ratio Selector */}
          <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 shadow-2xs">
            <button
              type="button"
              onClick={() => setActivePreset('card')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                activePreset === 'card'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Output as standard ID Card (CR80 ratio 85.6 x 54 mm)"
            >
              <CreditCard className="w-3 h-3" />
              <span>ID Card</span>
            </button>
            <button
              type="button"
              onClick={() => setActivePreset('a4')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                activePreset === 'a4'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Output as full A4 Document (1:1.414)"
            >
              <FileText className="w-3 h-3" />
              <span>A4 Doc</span>
            </button>
            <button
              type="button"
              onClick={() => setActivePreset('auto')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                activePreset === 'auto'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Output natural proportion from pinned points"
            >
              <Maximize className="w-3 h-3" />
              <span>Natural</span>
            </button>
          </div>
        </div>

        {/* 3. MAIN WORKSPACE VIEWPORT (Mouse Wheel Zoom & Free Hand Pan) */}
        <div
          ref={containerRef}
          onWheel={handleWheel}
          onMouseDown={handleWorkspaceMouseDown}
          onMouseMove={handleWorkspaceMouseMove}
          onMouseUp={handleWorkspaceMouseUp}
          onMouseLeave={handleWorkspaceMouseUp}
          style={{
            cursor: isPanning ? 'grabbing' : (zoom > 1 || pan.x !== 0 || pan.y !== 0 ? 'grab' : 'default')
          }}
          className="flex-1 bg-slate-950/95 relative overflow-hidden flex items-center justify-center p-8 pb-14"
        >
          {workingImage ? (
            <div
              className="relative inline-block select-none"
              style={{
                transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
                transformOrigin: 'center center',
                transition: isPanning || activeCorner !== null ? 'none' : 'transform 0.1s ease-out'
              }}
            >
              {/* Working Document Image with live preview filters */}
              <img
                ref={imgRef}
                src={workingImage}
                alt="Document Preview"
                style={{ filter: filterStyle }}
                className="max-h-[52vh] max-w-[72vw] w-auto h-auto object-contain rounded shadow-2xl block pointer-events-none transition-[filter] duration-150"
                draggable={false}
              />

              {/* 4-Point Polygon SVG Overlay */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-10"
                style={{ width: '100%', height: '100%' }}
              >
                <polygon
                  points={polygonPointsStr}
                  fill="rgba(59, 130, 246, 0.20)"
                  stroke="#3b82f6"
                  strokeWidth="2"
                  strokeDasharray="4,4"
                />

                {points.map((pt, i) => {
                  const nextPt = points[(i + 1) % 4];
                  return (
                    <line
                      key={`line-${i}`}
                      x1={`${pt.x}%`}
                      y1={`${pt.y}%`}
                      x2={`${nextPt.x}%`}
                      y2={`${nextPt.y}%`}
                      stroke="#60a5fa"
                      strokeWidth="1.5"
                    />
                  );
                })}
              </svg>

              {/* Precision Magnifier Loupe: 3x zoomed preview above active handle */}
              {activeCorner !== null && (
                <div
                  style={{
                    left: `${points[activeCorner].x}%`,
                    top: `${points[activeCorner].y}%`,
                    transform: 'translate(-50%, -135%)'
                  }}
                  className="absolute pointer-events-none z-50 w-20 h-20 rounded-full border-2 border-white shadow-2xl overflow-hidden ring-4 ring-blue-500/60 bg-slate-900"
                >
                  <div
                    style={{
                      width: '300%',
                      height: '300%',
                      transform: `translate(${-points[activeCorner].x}%, ${-points[activeCorner].y}%)`,
                      position: 'absolute',
                      left: '50%',
                      top: '50%'
                    }}
                  >
                    <img
                      src={workingImage}
                      style={{ filter: filterStyle }}
                      className="w-full h-full object-contain pointer-events-none"
                      alt="Corner Loupe"
                    />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-full h-[1px] bg-red-500/90 shadow-xs" />
                    <div className="h-full w-[1px] bg-red-500/90 shadow-xs absolute" />
                    <div className="w-1.5 h-1.5 rounded-full border border-red-500 bg-red-500/40" />
                  </div>
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-black/80 text-white font-mono text-[7px] font-bold px-1 rounded">
                    {cornerConfigs[activeCorner].label}
                  </span>
                </div>
              )}

              {/* 4 SLEEK COMPACT CORNER HANDLES */}
              {points.map((pt, idx) => {
                const isActive = activeCorner === idx;
                const config = cornerConfigs[idx];
                return (
                  <div
                    key={`corner-${idx}`}
                    onPointerDown={(e) => handlePointerDown(idx, e)}
                    style={{
                      left: `${pt.x}%`,
                      top: `${pt.y}%`,
                      transform: 'translate(-50%, -50%)'
                    }}
                    className={`absolute z-30 w-5 h-5 rounded-full cursor-grab active:cursor-grabbing flex items-center justify-center transition-transform ${
                      isActive ? 'scale-125' : 'hover:scale-115'
                    }`}
                    title={`${config.title} Corner (Drag to reposition)`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border-[1.5px] border-white flex items-center justify-center shadow-md transition-all ${
                        config.color
                      } ${isActive ? `ring-3 ${config.ring} scale-110` : 'ring-1 ring-black/40'}`}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-white shadow-xs" />
                    </div>

                    <span
                      className={`absolute -top-3.5 left-1/2 -translate-x-1/2 text-white text-[7.5px] font-bold px-1 py-0.1 rounded-full pointer-events-none whitespace-nowrap shadow-xs border border-white/20 ${config.color}`}
                    >
                      {config.label}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-slate-400 text-xs flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              <span>Loading document...</span>
            </div>
          )}

          {/* Zoom View Controls */}
          <div className="absolute bottom-3 right-4 z-40 bg-slate-900/85 backdrop-blur-md rounded-xl p-1 border border-slate-700 flex items-center gap-1 shadow-lg">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}
              className="w-6 h-6 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="text-[10px] font-mono font-bold text-slate-300 px-1 min-w-[32px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(3.5, z + 0.15))}
              className="w-6 h-6 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
            <div className="w-[1px] h-3.5 bg-slate-700 mx-0.5" />
            <button
              type="button"
              onClick={() => {
                setZoom(1.0);
                setPan({ x: 0, y: 0 });
              }}
              className="w-6 h-6 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
              title="Fit to Screen"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* 4. MODAL FOOTER ACTIONS */}
        <div className="flex items-center justify-between px-5 py-2.5 border-t border-slate-200 bg-slate-50">
          <div className="text-xs text-slate-600 font-medium flex items-center gap-2">
            <span>Target Output:</span>
            <span className="font-bold text-slate-800 px-2 py-0.5 rounded bg-slate-200 text-[11px]">
              {activePreset === 'card'
                ? 'CR80 ID Card (85.6 × 54 mm)'
                : activePreset === 'a4'
                ? 'A4 Full Document (210 × 297 mm)'
                : 'Natural Proportions'}
            </span>
            {isAutoBeautify && (
              <span className="text-[10px] text-purple-700 font-bold bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 text-purple-600" />
                Auto Beautify Active
              </span>
            )}
            {isCorrection && (
              <span className="text-[10px] text-blue-700 font-bold bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Zap className="w-2.5 h-2.5 text-blue-600" />
                Correction Active
              </span>
            )}
            {(brightness !== 0 || contrast !== 0) && (
              <span className="text-[10px] text-slate-700 font-bold bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                {brightness !== 0 && `B: ${brightness > 0 ? `+${brightness}` : brightness}`}
                {brightness !== 0 && contrast !== 0 && ' • '}
                {contrast !== 0 && `C: ${contrast > 0 ? `+${contrast}` : contrast}`}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleApply}
              disabled={isProcessing || !workingImage}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Warping & Straightening...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Apply Crop & Straighten</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
