import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Check,
  Crop,
  ZoomIn,
  ZoomOut,
  Move,
  Hand,
  RotateCcw
} from 'lucide-react';

export default function ManualCropModal({
  isOpen,
  onClose,
  imageSrc,
  sideName = 'Front Side',
  onApplyCrop
}) {
  // Freehand / unconstrained crop bounding box (in percentages 0-100 of image)
  const [cropBox, setCropBox] = useState({
    x: 8,
    y: 8,
    width: 84,
    height: 55
  });

  // Zoom & Pan state for scroll-to-zoom and dragging the PDF
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Tool Mode: 'crop' (adjust box) | 'pan' (drag document)
  const [toolMode, setToolMode] = useState('crop');
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);

  // Handle interaction state: dragging whole box or individual resize handle
  const [interaction, setInteraction] = useState(null);

  const containerRef = useRef(null);
  const viewportRef = useRef(null);
  const imgRef = useRef(null);

  // Reset crop and zoom state when modal opens or imageSrc changes
  useEffect(() => {
    if (isOpen) {
      setCropBox({
        x: 8,
        y: 8,
        width: 84,
        height: 55
      });
      setZoom(1.0);
      setPan({ x: 0, y: 0 });
      setIsPanning(false);
      setInteraction(null);
      setToolMode('crop');
    }
  }, [isOpen, imageSrc]);

  // Spacebar toggle for Pan mode (like Photoshop/Figma) & Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.code === 'Space' && !e.repeat && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        setIsSpaceHeld(true);
      }
    };
    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        setIsSpaceHeld(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isOpen, onClose]);

  // Global window mousemove & mouseup while dragging or panning
  useEffect(() => {
    if (!interaction && !isPanning) return;

    const onMouseMove = (e) => {
      // 1. Panning document
      if (isPanning) {
        setPan({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y
        });
        return;
      }

      // 2. Crop box dragging or handle resizing
      if (!interaction || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      // rect.width / rect.height are already scaled by zoom
      const dx = ((e.clientX - interaction.startX) / rect.width) * 100;
      const dy = ((e.clientY - interaction.startY) / rect.height) * 100;
      const { initBox, type, handle } = interaction;

      if (type === 'drag') {
        const newX = Math.max(0, Math.min(100 - initBox.width, initBox.x + dx));
        const newY = Math.max(0, Math.min(100 - initBox.height, initBox.y + dy));
        setCropBox({
          ...initBox,
          x: newX,
          y: newY
        });
      } else if (type === 'resize') {
        let { x, y, width, height } = initBox;

        // Freehand resizing: each edge and corner moves independently
        if (handle.includes('e')) {
          width = Math.max(2, Math.min(100 - x, initBox.width + dx));
        }
        if (handle.includes('s')) {
          height = Math.max(2, Math.min(100 - y, initBox.height + dy));
        }

        if (handle.includes('w')) {
          const potentialWidth = initBox.width - dx;
          if (potentialWidth >= 2 && initBox.x + dx >= 0) {
            x = initBox.x + dx;
            width = potentialWidth;
          }
        }

        if (handle.includes('n')) {
          const potentialHeight = initBox.height - dy;
          if (potentialHeight >= 2 && initBox.y + dy >= 0) {
            y = initBox.y + dy;
            height = potentialHeight;
          }
        }

        setCropBox({
          x: Math.max(0, x),
          y: Math.max(0, y),
          width: Math.min(100 - x, width),
          height: Math.min(100 - y, height)
        });
      }
    };

    const onMouseUp = () => {
      setIsPanning(false);
      setInteraction(null);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [interaction, isPanning, panStart]);

  if (!isOpen || !imageSrc) return null;

  // Scroll-to-Zoom handler on viewport
  const handleWheel = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    setZoom((prevZoom) => {
      const nextZoom = Math.min(Math.max(prevZoom * zoomFactor, 0.5), 5.0);
      return parseFloat(nextZoom.toFixed(2));
    });
  };

  // Start panning the document (triggered from background or darkened overlay or in Pan mode)
  const handleStartPan = (e) => {
    if (e.button !== 0 && e.button !== 1) return; // Left or Middle click
    e.preventDefault();
    e.stopPropagation();
    setIsPanning(true);
    setPanStart({
      x: e.clientX - pan.x,
      y: e.clientY - pan.y
    });
  };

  // Handle clicking on crop box or individual handles
  const handleMouseDownOnBox = (e, type, handle = null) => {
    // If user is holding Spacebar or in Pan mode or middle clicking, pan instead!
    if (isSpaceHeld || toolMode === 'pan' || e.button === 1) {
      handleStartPan(e);
      return;
    }

    e.stopPropagation();
    e.preventDefault();
    setInteraction({
      type,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      initBox: { ...cropBox }
    });
  };

  const handleZoomIn = () => {
    setZoom((prev) => parseFloat(Math.min(prev * 1.25, 5.0).toFixed(2)));
  };

  const handleZoomOut = () => {
    setZoom((prev) => parseFloat(Math.max(prev * 0.8, 0.5).toFixed(2)));
  };

  const handleResetZoomAndPan = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  // Render crop using offscreen canvas to extract crisp image
  const handleApply = () => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const natW = img.naturalWidth || img.width;
      const natH = img.naturalHeight || img.height;

      const cropPixelX = (cropBox.x / 100) * natW;
      const cropPixelY = (cropBox.y / 100) * natH;
      const cropPixelW = (cropBox.width / 100) * natW;
      const cropPixelH = (cropBox.height / 100) * natH;

      // 300 DPI High-Resolution Canvas Scaling (3x)
      const scaleFactor = 3;
      canvas.width = Math.round(cropPixelW * scaleFactor);
      canvas.height = Math.round(cropPixelH * scaleFactor);

      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.scale(scaleFactor, scaleFactor);

      ctx.drawImage(
        img,
        cropPixelX,
        cropPixelY,
        cropPixelW,
        cropPixelH,
        0,
        0,
        cropPixelW,
        cropPixelH
      );

      const croppedDataUrl = canvas.toDataURL('image/png');
      onApplyCrop(croppedDataUrl, cropBox);
      onClose();
    };
    img.src = imageSrc;
  };

  const isPanActive = isSpaceHeld || toolMode === 'pan';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 select-none">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden h-[92vh] max-h-[850px]">
        {/* Header Bar */}
        <div className="shrink-0 px-4 py-2.5 sm:px-5 sm:py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/95 gap-2 sm:gap-4 select-none">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold shrink-0">
              <Crop className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h3 className="font-bold text-slate-800 text-sm truncate">
                  Manual Crop • {sideName}
                </h3>
                <span className="hidden sm:inline-block px-1.5 py-0.5 bg-emerald-100 text-emerald-700 font-bold rounded text-[10px] shrink-0">
                  Freehand / Unconstrained
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate hidden xs:block">
                Scroll mouse wheel to zoom. Click & drag document to pan.
              </p>
            </div>
          </div>

          {/* Center Mode Controls: Crop vs Pan */}
          <div className="flex items-center bg-white border border-slate-200 p-0.5 rounded-xl shadow-2xs shrink-0">
            <button
              onClick={() => setToolMode('crop')}
              className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                toolMode === 'crop' && !isSpaceHeld
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Crop Mode: Adjust crop box handles"
            >
              <Crop className="w-3.5 h-3.5" />
              <span>Crop</span>
            </button>
            <button
              onClick={() => setToolMode('pan')}
              className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                toolMode === 'pan' || isSpaceHeld
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Pan Mode: Drag to move the zoomed document (or hold Spacebar)"
            >
              <Hand className="w-3.5 h-3.5" />
              <span>Pan / Drag PDF</span>
            </button>
          </div>

          {/* Right: Zoom controls, Quick Done & Close */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-center bg-white border border-slate-200 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-xl shadow-2xs">
              <button
                onClick={handleZoomOut}
                className="p-1 rounded text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                title="Zoom Out (or scroll wheel down)"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-bold text-slate-700 min-w-8 sm:min-w-10 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                className="p-1 rounded text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                title="Zoom In (or scroll wheel up)"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <div className="w-[1px] h-3.5 bg-slate-200 mx-0.5" />
              <button
                onClick={handleResetZoomAndPan}
                className="px-1.5 py-0.5 text-[10px] font-bold text-blue-600 hover:bg-blue-50 rounded cursor-pointer flex items-center gap-1"
                title="Reset Zoom and Pan to Center"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            </div>

            <button
              onClick={handleApply}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 shadow-sm transition-all cursor-pointer active:scale-95"
              title="Apply Crop & Finish"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Done</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
              title="Close without applying (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Viewport Body: Scroll-to-Zoom & Drag-to-Pan */}
        <div
          ref={viewportRef}
          onWheel={handleWheel}
          onMouseDown={handleStartPan}
          className={`flex-1 min-h-0 bg-slate-950 p-4 flex items-center justify-center overflow-hidden relative select-none ${
            isPanActive || isPanning ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
          }`}
          title="Scroll to zoom • Click & drag document to pan"
        >
          {/* Pan notification badge when active */}
          {isPanActive && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-blue-600/90 text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-lg pointer-events-none flex items-center gap-1.5 backdrop-blur-xs">
              <Hand className="w-3 h-3" />
              <span>Pan Mode Active • Drag anywhere to move PDF</span>
            </div>
          )}

          <div
            ref={containerRef}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              transition: isPanning ? 'none' : 'transform 0.05s ease-out'
            }}
            className="relative max-h-full max-w-full inline-block shadow-2xl"
          >
            {/* Full uncropped image */}
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Uncropped Document"
              style={{ maxHeight: 'calc(88vh - 150px)' }}
              className="max-w-full w-auto object-contain block pointer-events-none rounded select-none shadow-lg"
              draggable={false}
            />

            {/* Darkened overlay outside crop box - clicking here initiates PANNING! */}
            <div
              onMouseDown={handleStartPan}
              className={`absolute inset-0 bg-black/55 z-10 ${
                isPanActive || isPanning ? 'cursor-grabbing' : 'cursor-grab'
              }`}
              title="Drag to pan document"
            />

            {/* Active Freehand Crop Box */}
            <div
              style={{
                left: `${cropBox.x}%`,
                top: `${cropBox.y}%`,
                width: `${cropBox.width}%`,
                height: `${cropBox.height}%`,
                border: '1px solid #3b82f6'
              }}
              onMouseDown={(e) => handleMouseDownOnBox(e, 'drag')}
              className={`absolute bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] z-20 ${
                isPanActive ? 'cursor-grab active:cursor-grabbing' : 'cursor-move'
              }`}
            >
              {/* 3x3 Rule-of-thirds grid guidelines */}
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-30">
                <div className="border-r border-b border-blue-300" />
                <div className="border-r border-b border-blue-300" />
                <div className="border-b border-blue-300" />
                <div className="border-r border-b border-blue-300" />
                <div className="border-r border-b border-blue-300" />
                <div className="border-b border-blue-300" />
                <div className="border-r border-blue-300" />
                <div className="border-r border-blue-300" />
                <div />
              </div>

              {/* 8 Precise Control Handles (Corners & Edges) */}
              {!isPanActive && (
                <>
                  {/* Corners */}
                  <span
                    onMouseDown={(e) => handleMouseDownOnBox(e, 'resize', 'nw')}
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: 'white',
                      border: '1.5px solid #3b82f6',
                      top: 0,
                      left: 0,
                      transform: 'translate(-50%, -50%)'
                    }}
                    className="absolute cursor-nwse-resize z-30 shadow-xs hover:scale-150 transition-transform"
                    title="Resize Top-Left"
                  />
                  <span
                    onMouseDown={(e) => handleMouseDownOnBox(e, 'resize', 'ne')}
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: 'white',
                      border: '1.5px solid #3b82f6',
                      top: 0,
                      left: '100%',
                      transform: 'translate(-50%, -50%)'
                    }}
                    className="absolute cursor-nesw-resize z-30 shadow-xs hover:scale-150 transition-transform"
                    title="Resize Top-Right"
                  />
                  <span
                    onMouseDown={(e) => handleMouseDownOnBox(e, 'resize', 'sw')}
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: 'white',
                      border: '1.5px solid #3b82f6',
                      top: '100%',
                      left: 0,
                      transform: 'translate(-50%, -50%)'
                    }}
                    className="absolute cursor-nesw-resize z-30 shadow-xs hover:scale-150 transition-transform"
                    title="Resize Bottom-Left"
                  />
                  <span
                    onMouseDown={(e) => handleMouseDownOnBox(e, 'resize', 'se')}
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: 'white',
                      border: '1.5px solid #3b82f6',
                      top: '100%',
                      left: '100%',
                      transform: 'translate(-50%, -50%)'
                    }}
                    className="absolute cursor-nwse-resize z-30 shadow-xs hover:scale-150 transition-transform"
                    title="Resize Bottom-Right"
                  />

                  {/* Edges */}
                  <span
                    onMouseDown={(e) => handleMouseDownOnBox(e, 'resize', 'n')}
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: 'white',
                      border: '1.5px solid #3b82f6',
                      top: 0,
                      left: '50%',
                      transform: 'translate(-50%, -50%)'
                    }}
                    className="absolute cursor-ns-resize z-30 shadow-xs hover:scale-150 transition-transform"
                    title="Resize Top Edge"
                  />
                  <span
                    onMouseDown={(e) => handleMouseDownOnBox(e, 'resize', 's')}
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: 'white',
                      border: '1.5px solid #3b82f6',
                      top: '100%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)'
                    }}
                    className="absolute cursor-ns-resize z-30 shadow-xs hover:scale-150 transition-transform"
                    title="Resize Bottom Edge"
                  />
                  <span
                    onMouseDown={(e) => handleMouseDownOnBox(e, 'resize', 'w')}
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: 'white',
                      border: '1.5px solid #3b82f6',
                      top: '50%',
                      left: 0,
                      transform: 'translate(-50%, -50%)'
                    }}
                    className="absolute cursor-ew-resize z-30 shadow-xs hover:scale-150 transition-transform"
                    title="Resize Left Edge"
                  />
                  <span
                    onMouseDown={(e) => handleMouseDownOnBox(e, 'resize', 'e')}
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: 'white',
                      border: '1.5px solid #3b82f6',
                      top: '50%',
                      left: '100%',
                      transform: 'translate(-50%, -50%)'
                    }}
                    className="absolute cursor-ew-resize z-30 shadow-xs hover:scale-150 transition-transform"
                    title="Resize Right Edge"
                  />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="shrink-0 px-4 py-2.5 sm:px-5 sm:py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 select-none">
          <div className="flex items-center gap-2 text-xs text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap">
            <span className="flex items-center gap-1 font-semibold text-slate-700">
              <Hand className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="truncate">Pan: Drag outside box / Space</span>
            </span>
            <span className="hidden sm:inline">•</span>
            <span className="hidden sm:flex items-center gap-1 font-semibold text-slate-700">
              <ZoomIn className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Zoom: Scroll wheel</span>
            </span>
            <span className="hidden md:inline">•</span>
            <span className="hidden md:inline font-semibold text-slate-700">
              Crop: Drag corners & edges freely
            </span>
          </div>

          {/* Cancel & Apply Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setCropBox({ x: 8, y: 8, width: 84, height: 55 });
                handleResetZoomAndPan();
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-600 text-xs font-semibold hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer flex items-center gap-1"
              title="Reset Crop Box"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden sm:inline">Reset Box</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
            >
              <Check className="w-3.5 h-3.5" />
              <span>OK / Auto-Fit Crop</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
