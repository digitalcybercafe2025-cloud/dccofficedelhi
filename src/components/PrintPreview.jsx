import React, { useState, useEffect } from 'react';
import { Printer, Trash2, CheckCircle2 } from 'lucide-react';

export default function PrintPreview({
  queueItems,
  onDeleteRow,
  marginX = 16,
  marginY = 24
}) {
  const [selectedRow, setSelectedRow] = useState(null);

  // Flatten queue items into individual photos for rendering on the A4 sheet
  const flatPhotos = [];
  queueItems.forEach((item) => {
    for (let i = 0; i < item.count; i++) {
      flatPhotos.push({
        id: item.id,
        code: item.code,
        image: item.image,
        globalIndex: flatPhotos.length
      });
    }
  });

  // Organize flat photos into rows of 6
  const COLS = 6;
  const rows = [];
  for (let r = 0; r < 6; r++) {
    const startIdx = r * COLS;
    const endIdx = startIdx + COLS;
    const rowPhotos = flatPhotos.slice(startIdx, endIdx);
    if (rowPhotos.length > 0) {
      rows.push({
        rowIndex: r,
        startIdx,
        endIdx,
        photos: rowPhotos
      });
    }
  }

  // Keyboard shortcut: Delete or Backspace key to remove selected row
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (selectedRow !== null && (e.key === 'Delete' || e.key === 'Backspace')) {
        // Prevent browser back navigation
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          onDeleteRow(selectedRow);
          setSelectedRow(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedRow, onDeleteRow]);

  const handleDeleteSelectedRow = (e, rowIndex) => {
    e.stopPropagation();
    onDeleteRow(rowIndex);
    if (selectedRow === rowIndex) {
      setSelectedRow(null);
    }
  };

  return (
    <div
      id="right-panel"
      className="flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-sm p-4 select-none overflow-hidden"
    >
      {/* Top Bar */}
      <div id="preview-header" className="flex items-center justify-between mb-3 no-print">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center text-blue-600">
            <Printer className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-sm font-bold text-slate-800 tracking-tight">
            Print Preview
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {selectedRow !== null && (
            <button
              onClick={(e) => handleDeleteSelectedRow(e, selectedRow)}
              className="flex items-center gap-1 px-2.5 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-bold shadow-xs transition-colors animate-pulse"
              title="Delete Selected Row (or press Delete key)"
            >
              <Trash2 className="w-3 h-3" />
              <span>Delete Row {selectedRow + 1}</span>
            </button>
          )}

          {/* Live View Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-[11px] font-semibold text-indigo-600">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            <span>Live View</span>
          </div>
        </div>
      </div>

      {/* Scrollable A4 Sheet Container */}
      <div
        id="print-preview-scroll-container"
        className="flex-1 overflow-y-auto bg-slate-100/70 rounded-xl p-3 border border-slate-200/80 flex flex-col items-center"
      >
        <div
          id="a4-print-sheet"
          className="relative bg-white shadow-xl rounded-sm border border-slate-300 w-full max-w-[420px] aspect-[210/297] min-h-[594px] flex flex-col transition-all cursor-default"
          style={{
            padding: `${marginY}px ${marginX}px`
          }}
          onClick={() => setSelectedRow(null)}
        >
          {/* Photos Grid Rows */}
          {rows.length > 0 ? (
            <div className="flex flex-col gap-2 w-full">
              {rows.map((row) => {
                const isSelected = selectedRow === row.rowIndex;
                return (
                  <div
                    key={row.rowIndex}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedRow(isSelected ? null : row.rowIndex);
                    }}
                    className={`relative p-1 rounded-lg border-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-400/40 shadow-xs'
                        : 'border-transparent hover:border-blue-300/60 hover:bg-slate-50/60'
                    }`}
                  >
                    {/* Row selection tag and action */}
                    {isSelected && (
                      <div className="absolute -top-3 left-2 bg-blue-600 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow-xs flex items-center gap-1.5 z-20 no-print">
                        <span>Row {row.rowIndex + 1}</span>
                        <button
                          onClick={(e) => handleDeleteSelectedRow(e, row.rowIndex)}
                          className="hover:text-red-200"
                          title="Delete this row"
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    {/* 6 Columns Grid for this Row */}
                    <div className="grid grid-cols-6 gap-1.5 w-full">
                      {row.photos.map((photo, pIdx) => (
                        <div
                          key={`${row.rowIndex}-${pIdx}`}
                          className={`group relative aspect-[3.5/4.5] bg-slate-100 rounded-xs overflow-hidden border border-[#CCCCCC] shadow-2xs transition-all ${
                            isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : ''
                          }`}
                          title={`${photo.code} (Row ${row.rowIndex + 1}, Col ${pIdx + 1})`}
                        >
                          <img
                            src={photo.image}
                            alt={photo.code}
                            className="w-full h-full object-cover pointer-events-none"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-6 text-center no-print">
              <Printer className="w-10 h-10 mb-2 stroke-1 text-slate-300" />
              <p className="text-xs font-semibold text-slate-600">
                A4 Print Sheet is Empty
              </p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-[220px]">
                Click <span className="text-blue-600 font-semibold">+ Add to Print Preview</span> to stack customer photos here.
              </p>
            </div>
          )}

          {/* A4 Watermark label at bottom right */}
          <span className="watermark-badge absolute bottom-2 right-2 text-[10px] font-bold text-slate-400 bg-slate-100/90 px-1.5 py-0.5 rounded border border-slate-200 no-print">
            A4
          </span>
        </div>
      </div>
    </div>
  );
}
