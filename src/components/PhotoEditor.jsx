import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  Image as ImageIcon,
  FolderOpen,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCw,
  Crop,
  Loader2,
  Move,
  Target,
  Sparkles,
  Link2,
  Download,
  Check,
  Type,
  X
} from 'lucide-react';
import { exportSinglePhoto } from '../utils/api';

const PhotoEditor = forwardRef(function PhotoEditor({
  activeCustomer,
  onUpdateCustomerPhoto,
  onRemoveBackground,
  isProcessingBg,
  history,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  adjustments = { brightness: 100, contrast: 100, saturation: 100, beauty: false },
  nameDobBox = { enabled: false, name: '', dob: '' },
  onChangeNameDobBox
}, ref) {
  // Photo layer state (comfortable default zoom to prevent clipping)
  const [zoom, setZoom] = useState(0.85);
  const [rotation, setRotation] = useState(0);
  const [photoPos, setPhotoPos] = useState({ x: 0, y: 0 });

  // Guideline layer state (well-proportioned standard passport aspect ratio)
  const [guide, setGuide] = useState({
    x: 0,
    y: 0,
    width: 220,
    height: 285
  });

  // Single photo export states
  const [singleUnit, setSingleUnit] = useState('px'); // 'px' | 'cm' | 'mm'
  const [singleWidth, setSingleWidth] = useState(350);
  const [singleHeight, setSingleHeight] = useState(450);
  const [singleMaxKb, setSingleMaxKb] = useState(100);
  const [singleFormat, setSingleFormat] = useState('JPG');
  const [singleDpi, setSingleDpi] = useState(300);
  const [isRatioLocked, setIsRatioLocked] = useState(true);
  const [isExportingSingle, setIsExportingSingle] = useState(false);

  // Interaction tracking & crop state
  const [activeLayer, setActiveLayer] = useState('photo'); // 'photo' | 'guide'
  const [interaction, setInteraction] = useState(null);
  const [showGuide, setShowGuide] = useState(true);
  const [isDirtyCrop, setIsDirtyCrop] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [justCropped, setJustCropped] = useState(false);

  const fileInputRef = useRef(null);
  const containerRef = useRef(null);
  const imgRef = useRef(null);

  // Crops the photo to the exact region defined by the guideline box relative to photo
  const cropImageToGuide = () => {
    if (!activeCustomer?.image || !imgRef.current) return null;
    const img = imgRef.current;
    if (!img.complete || img.naturalWidth === 0) return null;

    const dispW = img.offsetWidth || img.naturalWidth;
    const dispH = img.offsetHeight || img.naturalHeight;

    const naturalScale = (img.naturalWidth / Math.max(1, dispW)) / Math.max(0.1, zoom);
    // Passport target width: at least 700px (standard 35mm at 500+ DPI / retina) or natural resolution (capped at 2400px for speed)
    const targetW = Math.min(Math.max(Math.round(guide.width * naturalScale), 700), 2400);
    const scaleFactor = targetW / Math.max(1, guide.width);

    const outW = Math.round(guide.width * scaleFactor);
    const outH = Math.round(guide.height * scaleFactor);

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Move to canvas center
    ctx.translate(outW / 2, outH / 2);

    // Offset from guide center to photo center:
    // Relative to guide center, photo center is located at (photoPos.x - guide.x, photoPos.y - guide.y)
    const offsetX = (photoPos.x - guide.x) * scaleFactor;
    const offsetY = (photoPos.y - guide.y) * scaleFactor;
    ctx.translate(offsetX, offsetY);

    // Rotate photo around its center
    if (rotation !== 0) {
      ctx.rotate((rotation * Math.PI) / 180);
    }

    // Scaled dimensions of the image on the canvas
    const drawW = dispW * zoom * scaleFactor;
    const drawH = dispH * zoom * scaleFactor;

    // Apply brightness, contrast, saturation & beauty filters
    const b = adjustments?.brightness ?? 100;
    const c = adjustments?.contrast ?? 100;
    const s = adjustments?.saturation ?? 100;
    const beautyBoost = adjustments?.beauty ? ' contrast(108%) brightness(105%) saturate(106%)' : '';
    ctx.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%)${beautyBoost}`;

    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);

    // Reset filter
    ctx.filter = 'none';

    // If Name & DOB white bounding box is enabled, burn it onto the bottom of the photo
    if (nameDobBox?.enabled && (nameDobBox.name || nameDobBox.dob)) {
      // Reset translation back to top-left of canvas
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      const boxHeight = Math.max(Math.round(outH * 0.16), 46);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, outH - boxHeight, outW, boxHeight);

      // Top separator line
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = Math.max(2, Math.round(outW * 0.005));
      ctx.beginPath();
      ctx.moveTo(0, outH - boxHeight);
      ctx.lineTo(outW, outH - boxHeight);
      ctx.stroke();

      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const fontSize = Math.max(12, Math.round(boxHeight * 0.28));
      ctx.font = `bold ${fontSize}px sans-serif`;

      if (nameDobBox.name && nameDobBox.dob) {
        ctx.fillText(nameDobBox.name.toUpperCase(), outW / 2, outH - boxHeight + (boxHeight * 0.32));
        ctx.fillText(`DOB: ${nameDobBox.dob}`, outW / 2, outH - boxHeight + (boxHeight * 0.72));
      } else if (nameDobBox.name) {
        ctx.fillText(nameDobBox.name.toUpperCase(), outW / 2, outH - (boxHeight / 2));
      } else if (nameDobBox.dob) {
        ctx.fillText(`DOB: ${nameDobBox.dob}`, outW / 2, outH - (boxHeight / 2));
      }
    }

    return canvas.toDataURL('image/png');
  };

  const handleApplyCrop = () => {
    if (!activeCustomer?.image) return;
    setIsCropping(true);
    try {
      const croppedDataUrl = cropImageToGuide();
      if (croppedDataUrl) {
        onUpdateCustomerPhoto(croppedDataUrl);
        setPhotoPos({ x: 0, y: 0 });
        setZoom(0.85);
        setRotation(0);
        setGuide({ x: 0, y: 0, width: 220, height: 285 });
        setIsDirtyCrop(false);
        setJustCropped(true);
        setTimeout(() => setJustCropped(false), 1600);
      }
    } catch (err) {
      console.error('Crop error:', err);
    } finally {
      setIsCropping(false);
    }
  };

  useImperativeHandle(ref, () => ({
    getCroppedPhoto: () => {
      if (isDirtyCrop) {
        return cropImageToGuide();
      }
      return null;
    },
    handleApplyCrop
  }));

  // Keyboard shortcut: Press Enter to execute crop
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.target.tagName === 'INPUT' ||
        e.target.tagName === 'SELECT' ||
        e.target.tagName === 'TEXTAREA'
      ) {
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        handleApplyCrop();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeCustomer?.image, guide, photoPos, zoom, rotation, isDirtyCrop]);

  // Helper to convert dimensions to pixels for backend
  const getPixelDimensions = (w, h, unit, dpi) => {
    const numW = parseFloat(w) || 0;
    const numH = parseFloat(h) || 0;
    const dpiVal = parseInt(dpi, 10) || 300;
    if (unit === 'cm') {
      return {
        width: Math.max(1, Math.round((numW / 2.54) * dpiVal)),
        height: Math.max(1, Math.round((numH / 2.54) * dpiVal))
      };
    }
    if (unit === 'mm') {
      return {
        width: Math.max(1, Math.round((numW / 25.4) * dpiVal)),
        height: Math.max(1, Math.round((numH / 25.4) * dpiVal))
      };
    }
    return {
      width: Math.max(1, Math.round(numW)),
      height: Math.max(1, Math.round(numH))
    };
  };

  // Unit converter when user switches px, cm, mm
  const handleUnitChange = (newUnit) => {
    if (newUnit === singleUnit) return;
    const currentDpi = parseInt(singleDpi, 10) || 300;
    const { width: pxW, height: pxH } = getPixelDimensions(singleWidth, singleHeight, singleUnit, currentDpi);

    if (newUnit === 'cm') {
      if (singleUnit === 'px' && singleWidth === 350 && singleHeight === 450) {
        setSingleWidth(3.5);
        setSingleHeight(4.5);
      } else {
        setSingleWidth(Number(((pxW * 2.54) / currentDpi).toFixed(2)));
        setSingleHeight(Number(((pxH * 2.54) / currentDpi).toFixed(2)));
      }
    } else if (newUnit === 'mm') {
      if (singleUnit === 'px' && singleWidth === 350 && singleHeight === 450) {
        setSingleWidth(35);
        setSingleHeight(45);
      } else {
        setSingleWidth(Number(((pxW * 25.4) / currentDpi).toFixed(1)));
        setSingleHeight(Number(((pxH * 25.4) / currentDpi).toFixed(1)));
      }
    } else {
      // newUnit === 'px'
      if (
        (singleUnit === 'cm' && singleWidth === 3.5 && singleHeight === 4.5) ||
        (singleUnit === 'mm' && singleWidth === 35 && singleHeight === 45)
      ) {
        setSingleWidth(350);
        setSingleHeight(450);
      } else {
        setSingleWidth(pxW);
        setSingleHeight(pxH);
      }
    }
    setSingleUnit(newUnit);
  };

  // Sync and reset view whenever active customer changes
  useEffect(() => {
    setZoom(0.85);
    setRotation(0);
    setPhotoPos({ x: 0, y: 0 });
    setGuide({ x: 0, y: 0, width: 220, height: 285 });
    setIsDirtyCrop(true);
  }, [activeCustomer?.id]);

  const handleWidthChange = (e) => {
    const val = e.target.value;
    setSingleWidth(val);
    const num = parseFloat(val);
    if (isRatioLocked && !isNaN(num) && num > 0) {
      if (singleUnit === 'px') {
        setSingleHeight(Math.round((num * 450) / 350));
      } else if (singleUnit === 'cm') {
        setSingleHeight(Number((num * (4.5 / 3.5)).toFixed(2)));
      } else if (singleUnit === 'mm') {
        setSingleHeight(Number((num * (45 / 35)).toFixed(1)));
      }
    }
  };

  const handleHeightChange = (e) => {
    const val = e.target.value;
    setSingleHeight(val);
    const num = parseFloat(val);
    if (isRatioLocked && !isNaN(num) && num > 0) {
      if (singleUnit === 'px') {
        setSingleWidth(Math.round((num * 350) / 450));
      } else if (singleUnit === 'cm') {
        setSingleWidth(Number((num * (3.5 / 4.5)).toFixed(2)));
      } else if (singleUnit === 'mm') {
        setSingleWidth(Number((num * (35 / 45)).toFixed(1)));
      }
    }
  };

  const handleDownloadSingle = async () => {
    if (!activeCustomer?.image) return;
    setIsExportingSingle(true);
    try {
      let imageToExport = activeCustomer.image;
      if (isDirtyCrop) {
        const cropped = cropImageToGuide();
        if (cropped) {
          imageToExport = cropped;
          onUpdateCustomerPhoto(cropped);
          setIsDirtyCrop(false);
        }
      }

      const { width: exportW, height: exportH } = getPixelDimensions(
        singleWidth,
        singleHeight,
        singleUnit,
        singleDpi
      );

      const result = await exportSinglePhoto({
        image: imageToExport,
        width: exportW,
        height: exportH,
        format: singleFormat,
        dpi: parseInt(singleDpi, 10) || 300,
        addBorder: true,
        maxKb: singleMaxKb ? parseInt(singleMaxKb, 10) : null
      });

      if (result.dataUrl) {
        const ext = singleFormat.toLowerCase();
        if (window.electronAPI?.saveFileDialog && window.electronAPI?.saveFile) {
          const { canceled, filePath } = await window.electronAPI.saveFileDialog(
            `passport-single-${activeCustomer.code || 'photo'}.${ext}`,
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
          link.download = `passport-single-${activeCustomer.code || 'photo'}.${ext}`;
          link.click();
        }
      }
    } catch (err) {
      alert('Failed to export single photo: ' + err.message);
    } finally {
      setIsExportingSingle(false);
    }
  };

  // Handle Mouse Down on Photo Canvas (outside guide handles)
  const handleCanvasMouseDown = (e) => {
    if (e.target.closest('.guide-handle') || e.target.closest('.guide-box')) return;
    setActiveLayer('photo');
    setInteraction({
      type: 'drag-photo',
      startX: e.clientX,
      startY: e.clientY,
      initPhoto: { ...photoPos }
    });
  };

  // Handle Mouse Down on Guideline Box (for moving guideline)
  const handleGuideMouseDown = (e) => {
    e.stopPropagation();
    setActiveLayer('guide');
    setInteraction({
      type: 'drag-guide',
      startX: e.clientX,
      startY: e.clientY,
      initGuide: { ...guide }
    });
  };

  // Handle Mouse Down on Guideline Resize Handle
  const handleHandleMouseDown = (e, handle) => {
    e.stopPropagation();
    setActiveLayer('guide');
    setInteraction({
      type: 'resize-guide',
      handle,
      startX: e.clientX,
      startY: e.clientY,
      initGuide: { ...guide }
    });
  };

  // Unified Mouse Move with safe boundaries
  const handleMouseMove = (e) => {
    if (!interaction) return;

    const dx = e.clientX - interaction.startX;
    const dy = e.clientY - interaction.startY;

    if (interaction.type === 'drag-photo') {
      setIsDirtyCrop(true);
      setPhotoPos({
        x: interaction.initPhoto.x + dx,
        y: interaction.initPhoto.y + dy
      });
    } else if (interaction.type === 'drag-guide') {
      setIsDirtyCrop(true);
      const newX = Math.max(-130, Math.min(130, interaction.initGuide.x + dx));
      const newY = Math.max(-90, Math.min(90, interaction.initGuide.y + dy));
      setGuide((prev) => ({
        ...prev,
        x: newX,
        y: newY
      }));
    } else if (interaction.type === 'resize-guide') {
      setIsDirtyCrop(true);
      const { handle, initGuide } = interaction;
      let newW = initGuide.width;
      let newH = initGuide.height;
      let newX = initGuide.x;
      let newY = initGuide.y;

      if (handle.includes('e')) newW = Math.max(140, Math.min(310, initGuide.width + dx * 2));
      if (handle.includes('w')) newW = Math.max(140, Math.min(310, initGuide.width - dx * 2));
      if (handle.includes('s')) newH = Math.max(180, Math.min(360, initGuide.height + dy * 2));
      if (handle.includes('n')) newH = Math.max(180, Math.min(360, initGuide.height - dy * 2));

      setGuide({
        x: newX,
        y: newY,
        width: newW,
        height: newH
      });
    }
  };

  const handleMouseUp = () => {
    setInteraction(null);
  };

  // Wheel to zoom photo
  const handleWheel = (e) => {
    e.preventDefault();
    setIsDirtyCrop(true);
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    setZoom((prev) => Math.min(Math.max(prev + delta, 0.4), 2.5));
  };

  const handleZoomIn = () => {
    setIsDirtyCrop(true);
    setZoom((prev) => Math.min(prev + 0.1, 2.5));
  };
  const handleZoomOut = () => {
    setIsDirtyCrop(true);
    setZoom((prev) => Math.max(prev - 0.1, 0.4));
  };
  const handleReset = () => {
    setZoom(0.85);
    setRotation(0);
    setPhotoPos({ x: 0, y: 0 });
    setGuide({ x: 0, y: 0, width: 220, height: 285 });
  };
  const handleRotate = () => {
    setIsDirtyCrop(true);
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      onUpdateCustomerPhoto(event.target.result);
      handleReset();
      setIsDirtyCrop(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div
      id="center-editor"
      className="flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-sm p-4 select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center text-blue-600">
            <Crop className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-sm font-bold text-slate-800 tracking-tight">
            Edit Photo
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Active Layer Indicator */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px] font-semibold">
            <button
              onClick={() => setActiveLayer('photo')}
              className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-all ${
                activeLayer === 'photo'
                  ? 'bg-white text-blue-600 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Move className="w-3 h-3" />
              <span>Photo</span>
            </button>
            <button
              onClick={() => setActiveLayer('guide')}
              className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-all ${
                activeLayer === 'guide'
                  ? 'bg-white text-indigo-600 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Target className="w-3 h-3" />
              <span>Guideline</span>
            </button>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
          >
            <FolderOpen className="w-3.5 h-3.5 text-blue-600" />
            <span>Replace Photo</span>
          </button>

          {/* Dedicated Crop Photo Button */}
          <button
            onClick={handleApplyCrop}
            disabled={!activeCustomer?.image || isCropping}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer ${
              justCropped
                ? 'bg-emerald-600 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white disabled:opacity-50'
            }`}
            title="Crop photo to marked guideline area (Enter)"
          >
            {justCropped ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Cropped!</span>
              </>
            ) : isCropping ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Cropping...</span>
              </>
            ) : (
              <>
                <Crop className="w-3.5 h-3.5" />
                <span>Crop Photo</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Canvas Area - Padded to prevent clipping handles */}
      <div
        ref={containerRef}
        onMouseDown={handleCanvasMouseDown}
        onWheel={handleWheel}
        className="relative flex-1 rounded-xl overflow-hidden border-2 border-slate-300 checkerboard-bg flex items-center justify-center p-6 cursor-grab active:cursor-grabbing"
      >
        {/* Layer 1: Photo Container */}
        {activeCustomer?.image ? (
          <div
            className="transition-transform duration-75 origin-center w-full h-full flex items-center justify-center pointer-events-none"
            style={{
              transform: `translate(${photoPos.x}px, ${photoPos.y}px) scale(${zoom}) rotate(${rotation}deg)`
            }}
          >
            <img
              ref={imgRef}
              src={activeCustomer.image}
              alt="Active customer"
              className="max-h-[310px] max-w-full object-contain drop-shadow-md select-none pointer-events-none transition-[filter]"
              style={{
                filter: `brightness(${adjustments?.brightness ?? 100}%) contrast(${adjustments?.contrast ?? 100}%) saturate(${adjustments?.saturation ?? 100}%)${adjustments?.beauty ? ' contrast(108%) brightness(105%) saturate(106%)' : ''}`
              }}
              draggable={false}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-400">
            <ImageIcon className="w-12 h-12 mb-2 stroke-1" />
            <span className="text-xs font-medium">Select or upload a customer photo</span>
          </div>
        )}

        {/* Layer 2: Independently Interactive Guidelines Overlay */}
        {showGuide && activeCustomer?.image && (
          <div
            className="guide-box absolute pointer-events-auto flex items-center justify-center select-none"
            onDoubleClick={handleApplyCrop}
            title="Double-click to apply crop"
            style={{
              transform: `translate(${guide.x}px, ${guide.y}px)`,
              width: `${guide.width}px`,
              height: `${guide.height}px`
            }}
          >
            {/* Top Active Photo Tag (draggable) */}
            <div
              onMouseDown={handleGuideMouseDown}
              className="absolute -top-4 bg-slate-800 text-white text-[10px] font-semibold px-2.5 py-0.5 rounded-full shadow-md cursor-move flex items-center gap-1 z-30 hover:bg-blue-700 transition-colors"
              title="Click and drag to move guidelines"
            >
              <Target className="w-3 h-3 text-indigo-300" />
              <span>HAIRLINE</span>
            </div>

            {/* Bottom Quick Crop Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleApplyCrop();
              }}
              className="absolute -bottom-5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-md cursor-pointer flex items-center gap-1 z-30 transition-all hover:scale-105 active:scale-95"
              title="Click to crop photo to this frame"
            >
              <Crop className="w-3 h-3" />
              <span>{justCropped ? 'Cropped!' : 'Apply Crop'}</span>
            </button>

            {/* Guideline Box Frame with 8 Interactive Handles */}
            <div
              onMouseDown={handleGuideMouseDown}
              className={`relative w-full h-full border-2 rounded-sm cursor-move transition-colors ${
                activeLayer === 'guide'
                  ? 'border-indigo-500 shadow-sm'
                  : 'border-blue-400/80'
              }`}
            >
              {/* Corner Handles */}
              <span
                onMouseDown={(e) => handleHandleMouseDown(e, 'nw')}
                className="guide-handle absolute -top-2 -left-2 w-4 h-4 bg-blue-600 border-2 border-white rounded-xs shadow-md cursor-nwse-resize z-30 hover:scale-125 transition-transform"
                title="Resize Top-Left"
              />
              <span
                onMouseDown={(e) => handleHandleMouseDown(e, 'ne')}
                className="guide-handle absolute -top-2 -right-2 w-4 h-4 bg-blue-600 border-2 border-white rounded-xs shadow-md cursor-nesw-resize z-30 hover:scale-125 transition-transform"
                title="Resize Top-Right"
              />
              <span
                onMouseDown={(e) => handleHandleMouseDown(e, 'sw')}
                className="guide-handle absolute -bottom-2 -left-2 w-4 h-4 bg-blue-600 border-2 border-white rounded-xs shadow-md cursor-nesw-resize z-30 hover:scale-125 transition-transform"
                title="Resize Bottom-Left"
              />
              <span
                onMouseDown={(e) => handleHandleMouseDown(e, 'se')}
                className="guide-handle absolute -bottom-2 -right-2 w-4 h-4 bg-blue-600 border-2 border-white rounded-xs shadow-md cursor-nwse-resize z-30 hover:scale-125 transition-transform"
                title="Resize Bottom-Right"
              />

              {/* Edge Handles */}
              <span
                onMouseDown={(e) => handleHandleMouseDown(e, 'n')}
                className="guide-handle absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-blue-600 border-2 border-white rounded-xs shadow-md cursor-ns-resize z-30 hover:scale-125 transition-transform"
                title="Resize Height (Top)"
              />
              <span
                onMouseDown={(e) => handleHandleMouseDown(e, 's')}
                className="guide-handle absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-blue-600 border-2 border-white rounded-xs shadow-md cursor-ns-resize z-30 hover:scale-125 transition-transform"
                title="Resize Height (Bottom)"
              />
              <span
                onMouseDown={(e) => handleHandleMouseDown(e, 'w')}
                className="guide-handle absolute top-1/2 -left-2 -translate-y-1/2 w-4 h-4 bg-blue-600 border-2 border-white rounded-xs shadow-md cursor-ew-resize z-30 hover:scale-125 transition-transform"
                title="Resize Width (Left)"
              />
              <span
                onMouseDown={(e) => handleHandleMouseDown(e, 'e')}
                className="guide-handle absolute top-1/2 -right-2 -translate-y-1/2 w-4 h-4 bg-blue-600 border-2 border-white rounded-xs shadow-md cursor-ew-resize z-30 hover:scale-125 transition-transform"
                title="Resize Width (Right)"
              />

              {/* Dynamic SVG Oval & Crosshairs */}
              <svg className="w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                {/* Hairline marker curve */}
                <path
                  d="M 38 12 Q 50 9 62 12"
                  stroke="#818cf8"
                  strokeWidth="1.4"
                  fill="none"
                />

                {/* Face Oval Guideline */}
                <ellipse
                  cx="50"
                  cy="46"
                  rx="36"
                  ry="38"
                  fill="none"
                  stroke="#818cf8"
                  strokeWidth="1.2"
                  strokeDasharray="3 1.5"
                />

                {/* Horizontal Eye Level Line */}
                <line
                  x1="10"
                  y1="46"
                  x2="90"
                  y2="46"
                  stroke="#818cf8"
                  strokeWidth="0.9"
                  strokeDasharray="2 1.5"
                />

                {/* Chin Guideline */}
                <path
                  d="M 40 82 L 60 82"
                  stroke="#818cf8"
                  strokeWidth="1.4"
                />
                <text
                  x="50"
                  y="88"
                  textAnchor="middle"
                  fill="#818cf8"
                  fontSize="5"
                  fontWeight="bold"
                  letterSpacing="0.5"
                >
                  CHIN
                </text>
              </svg>

              {/* Feature: Add Text White Bounding Box at bottom for Name & DOB */}
              {nameDobBox?.enabled && (
                <div
                  onMouseDown={(e) => e.stopPropagation()}
                  className="absolute bottom-0 inset-x-0 bg-white/95 border-t-2 border-slate-500 p-1.5 shadow-lg flex flex-col gap-1 z-30 pointer-events-auto rounded-b-xs"
                >
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-700 px-0.5">
                    <span className="flex items-center gap-1 text-blue-600">
                      <Type className="w-3 h-3" />
                      Bottom Text Strip (Name / DOB)
                    </span>
                    {onChangeNameDobBox && (
                      <button
                        type="button"
                        onClick={() => onChangeNameDobBox({ ...nameDobBox, enabled: false })}
                        className="text-slate-400 hover:text-rose-600 font-bold p-0.5 rounded cursor-pointer"
                        title="Remove text box"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5">
                      <span className="text-[10px] font-bold text-slate-500">Name:</span>
                      <input
                        type="text"
                        value={nameDobBox.name || ''}
                        onChange={(e) => onChangeNameDobBox && onChangeNameDobBox({ ...nameDobBox, name: e.target.value })}
                        placeholder="NAME"
                        className="w-full bg-transparent text-[11px] font-bold text-slate-800 uppercase focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5">
                      <span className="text-[10px] font-bold text-slate-500">DOB:</span>
                      <input
                        type="text"
                        value={nameDobBox.dob || ''}
                        onChange={(e) => onChangeNameDobBox && onChangeNameDobBox({ ...nameDobBox, dob: e.target.value })}
                        placeholder="DD/MM/YYYY"
                        className="w-full bg-transparent text-[11px] font-bold text-slate-800 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Top Single Photo Export Settings (W, H, Unit, DPI, Size KB, Format) */}
      <div className="mt-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-1 shadow-2xs text-[11px]">
        {/* Dimensions: W, Lock, H, Unit (px/cm/mm) - Widened W & H boxes */}
        <div className="flex items-center gap-1.5 font-semibold text-slate-700 flex-shrink-0">
          <span className="text-slate-500 font-bold text-[10.5px]">W:</span>
          <input
            type="number"
            step={singleUnit === 'px' ? '1' : '0.1'}
            value={singleWidth}
            onChange={handleWidthChange}
            title={`Width in ${singleUnit}`}
            placeholder={singleUnit === 'px' ? '350' : singleUnit === 'cm' ? '3.5' : '35'}
            className="w-14 bg-white border border-slate-300 rounded px-1 py-0.5 text-center text-slate-800 font-bold text-[11px] focus:border-blue-500 focus:outline-none shadow-2xs"
          />
          <button
            onClick={() => setIsRatioLocked(!isRatioLocked)}
            title={isRatioLocked ? 'Aspect ratio locked (3.5 : 4.5)' : 'Aspect ratio unlocked'}
            className={`p-0.5 rounded transition-colors flex-shrink-0 ${
              isRatioLocked
                ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
          </button>
          <span className="text-slate-500 font-bold text-[10.5px]">H:</span>
          <input
            type="number"
            step={singleUnit === 'px' ? '1' : '0.1'}
            value={singleHeight}
            onChange={handleHeightChange}
            title={`Height in ${singleUnit}`}
            placeholder={singleUnit === 'px' ? '450' : singleUnit === 'cm' ? '4.5' : '45'}
            className="w-14 bg-white border border-slate-300 rounded px-1 py-0.5 text-center text-slate-800 font-bold text-[11px] focus:border-blue-500 focus:outline-none shadow-2xs"
          />
          <select
            value={singleUnit}
            onChange={(e) => handleUnitChange(e.target.value)}
            title="Measurement Unit (px, cm, mm)"
            className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px] font-bold text-slate-700 focus:border-blue-500 focus:outline-none cursor-pointer shadow-2xs"
          >
            <option value="px">px</option>
            <option value="cm">cm</option>
            <option value="mm">mm</option>
          </select>
        </div>

        <div className="h-3.5 w-[1px] bg-slate-300 mx-0.5 flex-shrink-0" />

        {/* DPI Dropdown */}
        <div className="flex items-center gap-1 font-semibold text-slate-700 flex-shrink-0">
          <span className="text-slate-400 font-bold text-[10px]">DPI:</span>
          <select
            value={singleDpi}
            onChange={(e) => setSingleDpi(e.target.value)}
            title="Resolution DPI"
            className="bg-white border border-slate-300 rounded px-1 py-0.5 text-[10.5px] font-bold text-slate-700 focus:border-blue-500 focus:outline-none cursor-pointer"
          >
            {[100, 150, 200, 250, 300, 350, 400, 500, 600].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className="h-3.5 w-[1px] bg-slate-300 mx-0.5 flex-shrink-0" />

        {/* Manual KB Size Input */}
        <div className="flex items-center gap-1 font-semibold text-slate-700 flex-shrink-0">
          <span className="text-slate-400 font-bold text-[10px]">Size:</span>
          <input
            type="number"
            value={singleMaxKb}
            onChange={(e) => setSingleMaxKb(e.target.value)}
            title="Target File Size in KB"
            placeholder="100"
            className="w-10 bg-white border border-slate-300 rounded px-0.5 py-0.5 text-center text-slate-800 font-bold text-[10.5px] focus:border-blue-500 focus:outline-none"
          />
          <span className="text-[10px] text-slate-400 font-bold">KB</span>
        </div>

        <div className="h-3.5 w-[1px] bg-slate-300 mx-0.5 flex-shrink-0" />

        {/* Format Dropdown (JPG, JPEG, PNG) */}
        <div className="flex items-center gap-1 font-semibold text-slate-700 flex-shrink-0">
          <span className="text-slate-400 font-bold text-[10px]">Fmt:</span>
          <select
            value={singleFormat}
            onChange={(e) => setSingleFormat(e.target.value)}
            title="Image Format (JPG, JPEG, PNG)"
            className="bg-white border border-slate-300 rounded px-1 py-0.5 text-[10.5px] font-bold text-slate-700 focus:border-blue-500 focus:outline-none cursor-pointer"
          >
            <option value="JPG">JPG</option>
            <option value="JPEG">JPEG</option>
            <option value="PNG">PNG</option>
          </select>
        </div>
      </div>

      {/* Bottom Action & Canvas Toolbar */}
      <div className="mt-2 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 flex items-center justify-between gap-1 shadow-2xs">
        {/* Left: Compact AI Background Removed Button */}
        <button
          onClick={onRemoveBackground}
          disabled={isProcessingBg || !activeCustomer}
          className={`px-2.5 py-1.5 bg-[#10b981] hover:bg-[#059669] disabled:opacity-50 text-white rounded-md flex items-center justify-center gap-1.5 shadow-xs transition-all flex-shrink-0 text-[11px] font-bold active:scale-[0.98] ${
            isProcessingBg ? 'cursor-wait opacity-80 pointer-events-none' : ''
          }`}
          title="Remove background using offline AI"
        >
          {isProcessingBg ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              <span className="whitespace-nowrap">Removing BG...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-emerald-100" />
              <span className="whitespace-nowrap">Remove BG</span>
            </>
          )}
        </button>

        {/* Center: Canvas Controls (Undo, Redo, Zoom, Fit, Rotate, Guides) */}
        <div className="flex items-center justify-center gap-0.5 sm:gap-1">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo"
            className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo"
            className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
          <div className="w-[1px] h-3.5 bg-slate-300 mx-0.5" />
          <button
            onClick={handleZoomIn}
            title="Zoom In"
            className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleZoomOut}
            title="Zoom Out"
            className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleReset}
            title="Reset View & Guidelines"
            className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <div className="w-[1px] h-3.5 bg-slate-300 mx-0.5" />
          <button
            onClick={handleRotate}
            title="Rotate 90°"
            className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowGuide(!showGuide)}
            title="Toggle Face Guidelines"
            className={`p-1 rounded transition-colors ${
              showGuide
                ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleApplyCrop}
            title="Crop Photo to Guidelines (Enter)"
            className="p-1 rounded text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 transition-colors"
          >
            <Crop className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Compact Download Button */}
        <button
          onClick={handleDownloadSingle}
          disabled={isExportingSingle || !activeCustomer}
          className="px-2 py-1 bg-[#1677ff] hover:bg-[#0958d9] disabled:opacity-50 text-white text-[11px] font-bold rounded-md flex items-center justify-center gap-1 shadow-xs transition-colors whitespace-nowrap flex-shrink-0 active:scale-[0.98]"
          title="Download Image"
        >
          {isExportingSingle ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Download className="w-3 h-3" />
          )}
          <span>Download</span>
        </button>
      </div>
    </div>
  );
});

export default PhotoEditor;
