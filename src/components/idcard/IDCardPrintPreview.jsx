import React, { useState, useEffect } from 'react';
import {
  Printer,
  Download,
  FileText,
  Sliders,
  Trash2,
  Layers,
  Sparkles,
  Loader2
} from 'lucide-react';

export default function IDCardPrintPreview({
  idCardQueue,
  onDeletePair,
  onClearQueue,
  layoutFormat,
  onChangeLayoutFormat,
  onExport,
  onDirectPrint,
  isExporting,
  exportingFormat,
  isPrinting,
  marginX,
  marginY,
  onChangeMarginX,
  onChangeMarginY,
  cardGap,
  onChangeCardGap,
  onUpdatePairOffset
}) {
  const [selectedCardIdx, setSelectedCardIdx] = useState('all');
  const [previewZoom, setPreviewZoom] = useState(1.0);

  useEffect(() => {
    if (typeof selectedCardIdx === 'number' && selectedCardIdx >= idCardQueue.length) {
      setSelectedCardIdx(idCardQueue.length > 0 ? idCardQueue.length - 1 : 'all');
    }
  }, [idCardQueue.length, selectedCardIdx]);

  return (
    <div id="right-panel" className="bg-white rounded-xl border border-slate-200 shadow-2xs p-3.5 flex flex-col justify-between h-full overflow-hidden">
      {/* 1. Header (Outside A4 Sheet, ignored during export & print) */}
      <div
        id="preview-header"
        data-html2canvas-ignore="true"
        className="flex items-center justify-between mb-2 px-1 no-print select-none"
      >
        <div className="flex items-center gap-2">
          <Printer className="w-4 h-4 text-slate-700" />
          <h3 className="text-xs font-bold text-slate-800 whitespace-nowrap">Print Preview</h3>

          {/* Zoom Control Feature: Zoom [ 100 ] % +/- */}
          <div className="flex items-center gap-1 bg-slate-100/90 border border-slate-200 rounded-lg px-1.5 py-0.5 shadow-2xs select-none">
            <span className="text-[10px] font-bold text-slate-700 select-none">
              Zoom:
            </span>
            <button
              type="button"
              onClick={() => setPreviewZoom((z) => Math.max(0.4, Math.round((z - 0.1) * 10) / 10))}
              className="w-4 h-4 flex items-center justify-center bg-white hover:bg-slate-200 text-slate-700 font-bold rounded cursor-pointer active:scale-95 text-xs transition-all shadow-2xs"
              title="Zoom Out (-10%)"
            >
              -
            </button>
            <input
              type="number"
              min="40"
              max="250"
              value={Math.round(previewZoom * 100)}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (!isNaN(val) && val > 0) setPreviewZoom(val / 100);
              }}
              className="w-9 bg-white border border-slate-300/80 rounded px-0.5 py-0 text-center font-bold text-slate-800 text-[10px] focus:outline-none focus:border-blue-500 shadow-2xs"
              title="Zoom Percentage"
            />
            <span className="text-slate-500 text-[10px] font-semibold select-none">%</span>
            <button
              type="button"
              onClick={() => setPreviewZoom((z) => Math.min(2.5, Math.round((z + 0.1) * 10) / 10))}
              className="w-4 h-4 flex items-center justify-center bg-white hover:bg-slate-200 text-slate-700 font-bold rounded cursor-pointer active:scale-95 text-xs transition-all shadow-2xs"
              title="Zoom In (+10%)"
            >
              +
            </button>
            {previewZoom !== 1.0 && (
              <button
                type="button"
                onClick={() => setPreviewZoom(1.0)}
                className="text-[9px] font-bold text-blue-600 hover:text-blue-800 ml-0.5 hover:underline cursor-pointer"
                title="Reset Zoom to 100%"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-semibold">
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              idCardQueue.length >= 5
                ? 'bg-red-100 text-red-700 border border-red-200'
                : 'bg-blue-50 text-blue-700 border border-blue-200'
            }`}
          >
            {idCardQueue.length >= 5 ? '5/5 Cards' : `${idCardQueue.length}/5 Cards`}
          </span>
          <div className="flex items-center gap-1 text-blue-600">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
            <span className="text-[10px]">Live</span>
          </div>
        </div>
      </div>

      {/* 2. Scrollable A4 Live Canvas Container */}
      <div
        id="idcard-print-scroll-container"
        data-html2canvas-ignore="true"
        className="flex-1 bg-slate-100/80 rounded-xl p-2.5 overflow-y-auto overflow-x-auto border border-slate-200/70 flex justify-center items-start shadow-inner min-h-[160px] max-h-[250px]"
      >
        <div
          className="flex items-start justify-center transition-transform duration-100"
          style={{
            width: previewZoom > 1 ? `${240 * previewZoom}px` : '100%',
            minWidth: previewZoom > 1 ? `${240 * previewZoom}px` : undefined,
            height: previewZoom > 1 ? `${340 * previewZoom}px` : 'auto',
            minHeight: previewZoom > 1 ? `${340 * previewZoom}px` : undefined
          }}
        >
          {/* Restored Full A4 Sheet Container Wrapper (Fixed A4 aspect ratio, white background, drop shadow) */}
          <div
            id="a4-idcard-sheet"
            className="a4-sheet bg-white rounded-xs shadow-md border border-slate-300 flex flex-col transition-all relative select-none"
            style={{
              paddingLeft: `${marginX}px`,
              paddingRight: `${marginX}px`,
              paddingTop: `${marginY}px`,
              paddingBottom: `${marginY}px`,
              aspectRatio: '210 / 297',
              width: '100%',
              maxWidth: '240px',
              transform: `scale(${previewZoom})`,
              transformOrigin: 'top center',
              '--print-margin-x': `${(((marginX ?? 16) / 240) * 210).toFixed(2)}mm`,
              '--print-margin-y': `${(((marginY ?? 24) / 340) * 297).toFixed(2)}mm`
            }}
          >
          {/* Subtle A4 corner mark (Ignored in export & print) */}
          <div
            data-html2canvas-ignore="true"
            className="absolute top-1.5 right-2 text-[8px] font-bold text-slate-300 tracking-wider no-print select-none"
          >
            A4 • ID SHEET
          </div>

          {idCardQueue.length === 0 ? (
            <div
              data-html2canvas-ignore="true"
              className="h-44 flex flex-col items-center justify-center text-slate-400 text-center p-3 no-print select-none"
            >
              <Layers className="w-8 h-8 mb-1.5 stroke-1 text-slate-300" />
              <p className="text-[11px] font-semibold text-slate-600">Print Sheet is Empty</p>
              <p className="text-[9px] text-slate-400 mt-0.5 max-w-[170px]">
                Add Front & Back ID card pairs from editor (Max 5 cards per A4 sheet).
              </p>
            </div>
          ) : (
            <div className="flex flex-col">
              {idCardQueue.map((pair, index) => {
                const isSelected = selectedCardIdx === index;
                const offsetX = pair.offsetX || 0;
                const offsetY = pair.offsetY || 0;
                const isLast = index === idCardQueue.length - 1;
                const offsetXMm = (offsetX / 240) * 210;
                const offsetYMm = (offsetY / 340) * 297;
                const cardGapMm = ((cardGap || 8) / 340) * 297;

                return (
                  <div
                    key={pair.id || index}
                    onClick={() => setSelectedCardIdx(index)}
                    className={`idcard-pair-wrapper group relative rounded-none bg-transparent transition-all p-0 m-0 cursor-pointer ${
                      isSelected ? 'ring-2 ring-blue-500 ring-offset-1 z-10' : ''
                    }`}
                    style={{
                      border: 'none',
                      outline: 'none',
                      boxShadow: 'none',
                      position: 'relative',
                      left: `${offsetX}px`,
                      top: `${offsetY}px`,
                      marginBottom: isLast ? 0 : `${cardGap || 8}px`,
                      '--card-offset-x-print': `${offsetXMm.toFixed(2)}mm`,
                      '--card-offset-y-print': `${offsetYMm.toFixed(2)}mm`,
                      '--card-gap-print': isLast ? '0mm' : `${cardGapMm.toFixed(2)}mm`
                    }}
                    title={`Click to adjust margins for ID #${index + 1}`}
                  >
                    {/* Pair Index & Delete Button on Hover (Ignored in export & print) */}
                    <div
                      data-html2canvas-ignore="true"
                      className="absolute -top-2.5 right-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-white border border-slate-200 rounded-full px-1.5 py-0.5 shadow-xs no-print select-none"
                    >
                      <span className="text-[9px] font-bold text-slate-600">
                        ID #{index + 1}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeletePair(index);
                        }}
                        className="text-red-500 hover:text-red-700 p-0.5 cursor-pointer"
                        title="Remove this ID card pair"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>

                    {/* Render either Full A4 Document (Docs Mode) or CR80 Front + Back Pair */}
                    {pair.isDoc ? (
                      <div
                        className="print-doc-page w-full aspect-[1/1.414] bg-white overflow-hidden relative shadow-2xs flex items-center justify-center p-0 m-0"
                        style={{ border: 'none', outline: 'none', boxShadow: 'none' }}
                      >
                        <img
                          src={pair.docImage || pair.front}
                          alt="Document"
                          style={{ objectFit: 'contain', width: '100%', height: '100%', display: 'block' }}
                          className="w-full h-full object-contain block"
                        />
                      </div>
                    ) : (
                      /* CR80 Front + Back Pair with STRICT 1px-2px FOLDING GAP */
                      <div className="flex items-center justify-center w-full p-0 m-0" style={{ border: 'none', outline: 'none' }}>
                        {/* Front Card */}
                        <div
                          className="print-id-side flex-1 aspect-[85.6/54] bg-white overflow-hidden relative"
                          style={{ border: 'none', outline: 'none', boxShadow: 'none' }}
                        >
                          {pair.front ? (
                            <img
                              src={pair.front}
                              alt="Front"
                              style={{ objectFit: 'fill', width: '100%', height: '100%', display: 'block' }}
                              className="w-full h-full object-fill block"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[7px] text-slate-400 font-bold">
                              FRONT
                            </div>
                          )}
                        </div>

                        {/* Strict 1px-2px Folding Line */}
                        <div className="w-[1.5px] h-full bg-slate-900 z-10 opacity-70" title="Physical Folding Line" />

                        {/* Back Card */}
                        <div
                          className="print-id-side flex-1 aspect-[85.6/54] bg-white overflow-hidden relative"
                          style={{ border: 'none', outline: 'none', boxShadow: 'none' }}
                        >
                          {pair.back ? (
                            <img
                              src={pair.back}
                              alt="Back"
                              style={{ objectFit: 'fill', width: '100%', height: '100%', display: 'block' }}
                              className="w-full h-full object-fill block"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[7px] text-slate-400 font-bold">
                              BACK
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>

      {/* 3. Output Controls Section (Outside A4 Sheet, ignored in export & print) */}
      <div
        id="output-controls"
        data-html2canvas-ignore="true"
        className="mt-2.5 pt-2 border-t border-slate-200 no-print select-none"
      >
        {/* Print Layout Dropdown */}
        <div className="flex items-center justify-between mb-2 text-xs">
          <span className="font-bold text-slate-700">Print Layout:</span>
          <select
            value={layoutFormat}
            onChange={(e) => onChangeLayoutFormat(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-2 py-0.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="PNG">PNG Only</option>
            <option value="PDF">PDF Layout</option>
            <option value="DOCX">Word .docx</option>
          </select>
        </div>

        {/* Multi-Export Buttons Row */}
        <div className="grid grid-cols-3 gap-1.5 mb-2">
          {/* PNG Button */}
          <button
            onClick={() => onExport('PNG')}
            disabled={isExporting || idCardQueue.length === 0}
            className="py-1.5 px-2 bg-[#1677ff] hover:bg-[#0958d9] disabled:opacity-50 text-white rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer"
          >
            {isExporting && exportingFormat === 'PNG' ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Download className="w-3 h-3" />
            )}
            <span>Export (PNG)</span>
          </button>

          {/* PDF Button */}
          <button
            onClick={() => onExport('PDF')}
            disabled={isExporting || idCardQueue.length === 0}
            className="py-1.5 px-2 bg-[#10b981] hover:bg-[#059669] disabled:opacity-50 text-white rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer"
          >
            {isExporting && exportingFormat === 'PDF' ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Download className="w-3 h-3" />
            )}
            <span>Export (PDF)</span>
          </button>

          {/* Word .docx Button */}
          <button
            onClick={() => onExport('DOCX')}
            disabled={isExporting || idCardQueue.length === 0}
            className="py-1.5 px-2 bg-[#1677ff] hover:bg-[#0958d9] disabled:opacity-50 text-white rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer"
          >
            {isExporting && exportingFormat === 'DOCX' ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <FileText className="w-3 h-3" />
            )}
            <span>Export (Word)</span>
          </button>
        </div>

        {/* Dynamic Margins (Global Page + Individual Card Controls) */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 mb-2">
          <div className="flex items-center justify-between mb-1.5 text-[11px] font-bold text-slate-700">
            <div className="flex items-center gap-1.5">
              <Sliders className="w-3 h-3 text-slate-500" />
              <span>Dynamic Margin Controls</span>
            </div>
            {typeof selectedCardIdx === 'number' && idCardQueue[selectedCardIdx] && (
              <button
                type="button"
                onClick={() =>
                  onUpdatePairOffset(selectedCardIdx, { offsetX: 0, offsetY: 0 })
                }
                className="text-[9px] text-blue-600 hover:text-blue-800 underline font-semibold cursor-pointer"
                title="Reset this card position"
              >
                Reset Position
              </button>
            )}
          </div>

          {/* Card Selection Selector Pills */}
          {idCardQueue.length > 0 && (
            <div className="flex items-center gap-1 overflow-x-auto pb-1 mb-1.5 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedCardIdx('all')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  selectedCardIdx === 'all'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                All (Sheet)
              </button>
              {idCardQueue.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedCardIdx(idx)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                    selectedCardIdx === idx
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Card #{idx + 1}
                </button>
              ))}
            </div>
          )}

          {/* Controls: If All / Sheet selected */}
          {selectedCardIdx === 'all' ? (
            <div className="grid grid-cols-3 gap-1.5 text-[10px]">
              {/* X-Axis Margin */}
              <div>
                <div className="flex justify-between text-slate-600 font-semibold mb-0.5">
                  <span>X-Axis Margin</span>
                  <span className="font-bold text-blue-600">{marginX}px</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="60"
                  value={marginX}
                  onChange={(e) => onChangeMarginX(parseInt(e.target.value, 10))}
                  className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  title="Horizontal margin on left and right sides"
                />
              </div>

              {/* Y-Axis Margin */}
              <div>
                <div className="flex justify-between text-slate-600 font-semibold mb-0.5">
                  <span>Y-Axis Margin</span>
                  <span className="font-bold text-blue-600">{marginY}px</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="80"
                  value={marginY}
                  onChange={(e) => onChangeMarginY(parseInt(e.target.value, 10))}
                  className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  title="Top margin from page header"
                />
              </div>

              {/* Vertical Gap between cards */}
              <div>
                <div className="flex justify-between text-slate-600 font-semibold mb-0.5">
                  <span>Card V-Gap</span>
                  <span className="font-bold text-blue-600">{cardGap || 8}px</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="35"
                  value={cardGap || 8}
                  onChange={(e) => onChangeCardGap(parseInt(e.target.value, 10))}
                  className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  title="Vertical space between multiple ID cards"
                />
              </div>
            </div>
          ) : (
            /* Controls: If Individual Card selected */
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div>
                <div className="flex justify-between text-slate-600 font-semibold mb-0.5">
                  <span>Card #{selectedCardIdx + 1} X-Offset</span>
                  <span className="font-bold text-blue-600">
                    {idCardQueue[selectedCardIdx]?.offsetX || 0}px
                  </span>
                </div>
                <input
                  type="range"
                  min="-35"
                  max="35"
                  value={idCardQueue[selectedCardIdx]?.offsetX || 0}
                  onChange={(e) =>
                    onUpdatePairOffset(selectedCardIdx, {
                      offsetX: parseInt(e.target.value, 10),
                      offsetY: idCardQueue[selectedCardIdx]?.offsetY || 0
                    })
                  }
                  className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  title={`Horizontal offset for Card #${selectedCardIdx + 1}`}
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-600 font-semibold mb-0.5">
                  <span>Card #{selectedCardIdx + 1} Y-Offset</span>
                  <span className="font-bold text-blue-600">
                    {idCardQueue[selectedCardIdx]?.offsetY || 0}px
                  </span>
                </div>
                <input
                  type="range"
                  min="-35"
                  max="35"
                  value={idCardQueue[selectedCardIdx]?.offsetY || 0}
                  onChange={(e) =>
                    onUpdatePairOffset(selectedCardIdx, {
                      offsetX: idCardQueue[selectedCardIdx]?.offsetX || 0,
                      offsetY: parseInt(e.target.value, 10)
                    })
                  }
                  className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  title={`Vertical offset for Card #${selectedCardIdx + 1}`}
                />
              </div>
            </div>
          )}
        </div>

        {/* Final Master Action Button */}
        <button
          onClick={onDirectPrint}
          disabled={isPrinting || idCardQueue.length === 0}
          className="w-full py-2 bg-[#10b981] hover:bg-[#059669] disabled:opacity-50 text-white font-bold text-xs sm:text-[13px] rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer active:scale-[0.99]"
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
  );
}
