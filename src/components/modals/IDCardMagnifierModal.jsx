import React, { useState, useRef, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Maximize2, Sparkles } from 'lucide-react';

export default function IDCardMagnifierModal({
  isOpen,
  onClose,
  imageSrc,
  title = 'Card Inspection Magnifier',
  onMinimizeInstructionBox
}) {
  const [scale, setScale] = useState(1.4);
  const backdropRef = useRef(null);

  // Reset scale and listen for Escape key
  useEffect(() => {
    if (isOpen) {
      setScale(1.4);
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen || !imageSrc) return null;

  // Handle backdrop click to close
  const handleBackdropClick = (e) => {
    if (e.target === backdropRef.current) {
      onClose();
    }
  };

  // Zoom controls
  const handleZoomIn = (e) => {
    e.stopPropagation();
    setScale((prev) => Math.min(prev + 0.25, 3.0));
  };

  const handleZoomOut = (e) => {
    e.stopPropagation();
    setScale((prev) => Math.max(prev - 0.25, 0.8));
  };

  const handleResetZoom = (e) => {
    e.stopPropagation();
    setScale(1.4);
  };

  // Mouse wheel zoom inside lightbox
  const handleWheel = (e) => {
    e.stopPropagation();
    if (e.deltaY < 0) {
      setScale((prev) => Math.min(prev + 0.15, 3.0));
    } else {
      setScale((prev) => Math.max(prev - 0.15, 0.8));
    }
  };

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-6 select-none transition-opacity duration-200"
    >
      <div
        className="relative bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-w-4xl max-h-[92vh] h-[85vh] w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="shrink-0 px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 text-white gap-2">
          <div className="flex items-center gap-2">
            <Maximize2 className="w-4 h-4 text-blue-400" />
            <h3 className="font-bold text-sm text-slate-100 tracking-wide">
              {title}
            </h3>
            <span className="text-[11px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
              Edit & Magnifier View
            </span>
          </div>

          {/* Tools: Minimize Instruction Box, Zoom controls & Close */}
          <div className="flex items-center gap-2">
            {onMinimizeInstructionBox && (
              <button
                type="button"
                onClick={onMinimizeInstructionBox}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                title="Slice upper-middle red instruction box and translate 12-digit UID number upwards"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-200" />
                <span>Minimize Instruction Box</span>
              </button>
            )}

            <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg p-0.5 text-xs font-semibold">
              <button
                onClick={handleZoomOut}
                className="p-1 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 font-mono text-[11px] text-blue-400 font-bold min-w-10 text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                className="p-1 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleResetZoom}
                className="px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors ml-0.5"
                title="Reset to Default"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close (or click outside / press Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Card Display Viewport */}
        <div
          onWheel={handleWheel}
          className="flex-1 min-h-0 bg-slate-950 p-4 flex items-center justify-center overflow-auto"
        >
          <div
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'center center',
              transition: 'transform 0.12s ease-out'
            }}
            className="shadow-2xl rounded-xl border border-slate-700/60 overflow-hidden inline-block bg-white"
          >
            <img
              src={imageSrc}
              alt="Magnified ID Card"
              className="max-h-[60vh] max-w-[80vw] object-contain block pointer-events-none rounded-xl"
              draggable={false}
            />
          </div>
        </div>

        {/* Footer info */}
        <div className="shrink-0 px-5 py-2.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>💡 Scroll mouse wheel to zoom • Click outside or press Esc to close</span>
          <button
            onClick={onClose}
            className="px-4 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
          >
            Close View
          </button>
        </div>
      </div>
    </div>
  );
}
