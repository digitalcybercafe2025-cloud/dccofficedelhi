import React from 'react';
import { Download, Printer, FileText, SlidersHorizontal, Loader2 } from 'lucide-react';

export default function OutputControls({
  layoutFormat,
  onChangeLayoutFormat,
  onExport,
  onDirectPrint,
  isExporting,
  exportingFormat,
  isPrinting,
  hasPhotos,
  marginX,
  marginY,
  onChangeMarginX,
  onChangeMarginY
}) {
  return (
    <div id="output-controls" className="flex flex-col mt-3 pt-3 border-t border-slate-200 select-none no-print">
      {/* Three Export Buttons Side-by-Side (matching screenshot) */}
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        {/* Export PNG */}
        <button
          onClick={() => onExport('PNG')}
          disabled={!hasPhotos || isExporting}
          className="py-2 px-2 bg-[#1677ff] hover:bg-[#0958d9] disabled:opacity-50 text-white text-[11px] font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm shadow-blue-500/10 transition-colors"
        >
          {isExporting && exportingFormat === 'PNG' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
          <span>Export (PNG)</span>
        </button>

        {/* Export PDF */}
        <button
          onClick={() => onExport('PDF')}
          disabled={!hasPhotos || isExporting}
          className="py-2 px-2 bg-[#10b981] hover:bg-[#059669] disabled:opacity-50 text-white text-[11px] font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-500/10 transition-colors"
        >
          {isExporting && exportingFormat === 'PDF' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
          <span>Export (PDF)</span>
        </button>

        {/* Export Word (.docx) */}
        <button
          onClick={() => onExport('DOCX')}
          disabled={!hasPhotos || isExporting}
          className="py-2 px-2 bg-[#1677ff] hover:bg-[#0958d9] disabled:opacity-50 text-white text-[11px] font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm shadow-blue-500/10 transition-colors"
        >
          {isExporting && exportingFormat === 'DOCX' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <FileText className="w-3.5 h-3.5" />
          )}
          <span className="truncate">Export (Word .docx)</span>
        </button>
      </div>

      {/* Row 3: Split Layout - Left: Dynamic Page Margins, Right: Direct Print (A4) */}
      <div className="grid grid-cols-12 gap-2 items-stretch">
        {/* Left: Dynamic Page Margins */}
        <div className="col-span-7 bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 mb-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
            <span>Dynamic Page Margins</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* X Margin */}
            <div>
              <div className="flex justify-between text-[10px] font-medium text-slate-600 mb-0.5">
                <span>X Margin [{marginX}]</span>
              </div>
              <input
                type="range"
                min="6"
                max="36"
                value={marginX}
                onChange={(e) => onChangeMarginX(parseInt(e.target.value, 10))}
                className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
              />
            </div>

            {/* Y Margin */}
            <div>
              <div className="flex justify-between text-[10px] font-medium text-slate-600 mb-0.5">
                <span>Y Margin [{marginY}]</span>
              </div>
              <input
                type="range"
                min="10"
                max="50"
                value={marginY}
                onChange={(e) => onChangeMarginY(parseInt(e.target.value, 10))}
                className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Right: Direct Print (A4) - Tall Emerald Green Button */}
        <div className="col-span-5 flex">
          <button
            onClick={onDirectPrint}
            disabled={!hasPhotos || isPrinting}
            className="w-full py-2.5 px-3 bg-[#10b981] hover:bg-[#059669] disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm shadow-emerald-500/15 transition-all active:scale-[0.99]"
          >
            {isPrinting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Printer className="w-4 h-4" />
            )}
            <span>Direct Print (A4)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
