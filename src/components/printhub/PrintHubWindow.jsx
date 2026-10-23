import React, { useState, useEffect } from 'react';
import {
  Printer,
  Minus,
  Plus,
  Lock,
  ChevronDown,
  X
} from 'lucide-react';

export default function PrintHubWindow() {
  const [printData, setPrintData] = useState(null);
  const [printers, setPrinters] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [copies, setCopies] = useState(1);
  const [paperSize, setPaperSize] = useState('A4 (Standard)');
  const [paperType, setPaperType] = useState('Premium Glossy');
  const [quality, setQuality] = useState('High Quality');
  const [colorMode, setColorMode] = useState('color'); // 'color' or 'grayscale'
  const [lockedMargins, setLockedMargins] = useState(true);
  const [directScale, setDirectScale] = useState(100);
  const [twoSided, setTwoSided] = useState('Off');
  const [zoom, setZoom] = useState(100);

  // Load print data & system printers on mount
  useEffect(() => {
    // 1. Initial IPC data fetch
    if (window.ipcRenderer?.invoke) {
      window.ipcRenderer.invoke('get-print-data').then((data) => {
        if (data) setPrintData(data);
      }).catch((err) => console.warn('get-print-data error:', err));

      window.ipcRenderer.invoke('get-system-printers').then((list) => {
        if (list && list.length > 0) {
          setPrinters(list);
          const defaultP = list.find((p) => p.isDefault) || list[0];
          setSelectedPrinter(defaultP.name || defaultP.displayName || 'EPSOND9CD10 (L3560 Series)');
        } else {
          // Fallback matching reference layout
          setSelectedPrinter('EPSOND9CD10 (L3560 Series)');
        }
      }).catch(() => {
        setSelectedPrinter('EPSOND9CD10 (L3560 Series)');
      });
    } else {
      setSelectedPrinter('EPSOND9CD10 (L3560 Series)');
    }

    // 2. Event listener for dynamic data updates
    const handleInitData = (data) => {
      if (data) setPrintData(data);
    };

    if (window.ipcRenderer?.on) {
      window.ipcRenderer.on('init-print-data', handleInitData);
    }

    return () => {
      if (window.ipcRenderer?.removeListener) {
        window.ipcRenderer.removeListener('init-print-data', handleInitData);
      }
    };
  }, []);

  // Update window title bar based on printer
  useEffect(() => {
    document.title = `Print Hub - ${selectedPrinter || 'EPSON L3560'}`;
  }, [selectedPrinter]);

  // Handle direct silent print
  const handleDirectPrint = () => {
    if (window.ipcRenderer?.send) {
      window.ipcRenderer.send('execute-direct-print', {
        printerName: selectedPrinter,
        copies,
        paperSize,
        paperType,
        quality,
        colorMode,
        directScale,
        snapshot: snapshot || printData?.snapshot
      });
    }
  };

  // Handle opening native OS/vendor printer preferences ONLY (Strictly NO print execution)
  const handleOpenPreferences = async () => {
    try {
      if (window.ipcRenderer?.invoke) {
        await window.ipcRenderer.invoke('open-printer-preferences', {
          printerName: selectedPrinter
        });
      } else {
        await fetch('http://127.0.0.1:5005/api/printer-preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ printer_name: selectedPrinter })
        });
      }
    } catch (err) {
      console.warn('Printer preferences notice:', err);
    }
  };

  // Close sub-window
  const handleCancel = () => {
    if (window.ipcRenderer?.send) {
      window.ipcRenderer.send('close-print-window');
    } else {
      window.close();
    }
  };

  // Extract ID card pairs or fallback samples
  const idCardQueue = printData?.idCardQueue || [];
  const photoQueue = printData?.printQueue || [];
  const snapshot = printData?.snapshot || null;
  const isIDCardMode = printData?.type === 'idcard' || idCardQueue.length > 0 || !printData;

  return (
    <div className="flex h-screen w-screen bg-[#f1f5f9] text-slate-800 font-sans select-none overflow-hidden">
      <style>{`
        @media print {
          @page {
            margin: 0;
            size: auto;
          }
          body {
            margin: 0;
            padding: 0 !important;
            background: #ffffff !important;
          }
          .no-print {
            display: none !important;
          }
          #print-hub-a4-sheet {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            transform: none !important;
          }
          #print-hub-a4-sheet img {
            width: 100% !important;
            height: 100% !important;
            object-fit: contain !important;
          }
        }
      `}</style>
      {/* LEFT PANEL: PRINT CONTROLS & HARDWARE SETTINGS */}
      <div 
        className="w-[310px] shrink-0 bg-[#f8fafc] border-r border-slate-200 flex flex-col justify-between p-4 overflow-y-auto no-print"
        style={{ maxHeight: '80vh', overflowY: 'auto' }}
      >
        <div className="space-y-3.5">
          {/* Printer Selection */}
          <div>
            <label className="block text-[13px] font-bold text-slate-700 mb-1">Printer</label>
            <div className="relative">
              <select
                value={selectedPrinter}
                onChange={(e) => setSelectedPrinter(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 appearance-none pr-8 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
              >
                {printers.length > 0 ? (
                  printers.map((p, idx) => (
                    <option key={idx} value={p.name}>
                      {p.displayName || p.name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="EPSOND9CD10 (L3560 Series)">EPSOND9CD10 (L3560 Series)</option>
                    <option value="EPSON L3250 Series">EPSON L3250 Series</option>
                    <option value="Canon G3010 series">Canon G3010 series</option>
                    <option value="Microsoft Print to PDF">Microsoft Print to PDF</option>
                  </>
                )}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            {/* Status indicator */}
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-emerald-700 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
              <span>Ready</span>
            </div>
          </div>

          {/* Copies */}
          <div>
            <label className="block text-[13px] font-bold text-slate-700 mb-1">Copies</label>
            <div className="flex items-center w-24 border border-slate-300 rounded-lg bg-white overflow-hidden shadow-2xs">
              <input
                type="number"
                min="1"
                max="99"
                value={copies}
                onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-14 px-2 py-1 text-xs font-bold text-slate-800 text-center focus:outline-none"
              />
              <div className="flex flex-col border-l border-slate-200">
                <button
                  type="button"
                  onClick={() => setCopies((c) => Math.min(99, c + 1))}
                  className="px-1.5 py-0.5 hover:bg-slate-100 text-[10px] text-slate-600 border-b border-slate-200 cursor-pointer"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => setCopies((c) => Math.max(1, c - 1))}
                  className="px-1.5 py-0.5 hover:bg-slate-100 text-[10px] text-slate-600 cursor-pointer"
                >
                  ▼
                </button>
              </div>
            </div>
          </div>

          {/* Paper Size */}
          <div>
            <label className="block text-[13px] font-bold text-slate-700 mb-1">Paper Size</label>
            <div className="relative">
              <select
                value={paperSize}
                onChange={(e) => setPaperSize(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 appearance-none pr-8 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
              >
                <option value="A4 (Standard)">A4 (Standard)</option>
                <option value="Letter">Letter</option>
                <option value="4x6 (Photo)">4x6 (Photo)</option>
                <option value="Legal">Legal</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Paper Type (UI fallback for physical glossy selection) */}
          <div>
            <label className="block text-[13px] font-bold text-slate-700 mb-1">Paper Type</label>
            <div className="relative">
              <select
                value={paperType}
                onChange={(e) => setPaperType(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 appearance-none pr-8 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
              >
                <option value="Premium Glossy">Premium Glossy</option>
                <option value="Plain Paper">Plain Paper</option>
                <option value="Photo Paper Glossy">Photo Paper Glossy</option>
                <option value="Matte">Matte</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Quality */}
          <div>
            <label className="block text-[13px] font-bold text-slate-700 mb-1">Quality</label>
            <div className="relative">
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 appearance-none pr-8 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
              >
                <option value="High Quality">High Quality</option>
                <option value="Standard">Standard</option>
                <option value="Draft">Draft</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Color Mode */}
          <div>
            <label className="block text-[13px] font-bold text-slate-700 mb-1.5">Color Mode</label>
            <div className="flex items-center gap-5 text-xs font-medium text-slate-700">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="colorMode"
                  value="color"
                  checked={colorMode === 'color'}
                  onChange={() => setColorMode('color')}
                  className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500"
                />
                <span>Color</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="colorMode"
                  value="grayscale"
                  checked={colorMode === 'grayscale'}
                  onChange={() => setColorMode('grayscale')}
                  className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500"
                />
                <span>B&W</span>
              </label>
            </div>
          </div>

          {/* Margins Checkbox with Lock */}
          <div>
            <label className="block text-[13px] font-bold text-slate-700 mb-1">Margins (10px Top/Sides)</label>
            <div className="flex items-start justify-between bg-white border border-slate-200/80 rounded-lg p-2 shadow-2xs">
              <label className="flex items-start gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={lockedMargins}
                  onChange={(e) => setLockedMargins(e.target.checked)}
                  className="mt-0.5 w-3.5 h-3.5 text-blue-600 rounded focus:ring-blue-500"
                />
                <div className="text-[11px] leading-tight text-slate-600">
                  <span className="font-semibold block text-slate-800">Default 10px Borders</span>
                  <span>Locked is for safety.</span>
                </div>
              </label>
              <Lock className="w-3.5 h-3.5 text-slate-500 mt-0.5" />
            </div>
          </div>

          {/* Direct Scale */}
          <div>
            <label className="block text-[13px] font-bold text-slate-700 mb-1">Direct Scale</label>
            <div className="flex items-center gap-2.5">
              <input
                type="range"
                min="50"
                max="150"
                value={directScale}
                onChange={(e) => setDirectScale(parseInt(e.target.value, 10))}
                className="flex-1 accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
              />
              <span className="w-12 text-center text-xs font-bold text-slate-800 bg-white border border-slate-300 py-0.5 rounded shadow-2xs">
                {directScale}%
              </span>
            </div>
          </div>

          {/* 2-Sided Printing */}
          <div>
            <label className="block text-[13px] font-bold text-slate-700 mb-1">2-Sided Printing</label>
            <div className="relative">
              <select
                value={twoSided}
                onChange={(e) => setTwoSided(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 appearance-none pr-8 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
              >
                <option value="Off">Off</option>
                <option value="Long-Edge">Flip on Long Edge</option>
                <option value="Short-Edge">Flip on Short Edge</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* BOTTOM ACTION BUTTONS */}
        <div className="pt-3 border-t border-slate-200 mt-3 space-y-2">
          {/* Primary Blue Direct Print Button */}
          <button
            type="button"
            onClick={handleDirectPrint}
            className="w-full py-2.5 bg-[#0066cc] hover:bg-[#0052a3] text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer active:scale-[0.99]"
            title="Fast direct silent print to selected printer"
          >
            <Printer className="w-4 h-4" />
            <span>Direct Print</span>
          </button>

          {/* Secondary Action Row: Cancel & Preferences... */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="w-full py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-300 rounded-lg shadow-2xs transition-colors cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleOpenPreferences}
              className="w-full py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-300 rounded-lg shadow-2xs transition-colors cursor-pointer text-center"
              title="Open native printer driver preferences dialog to configure Glossy Paper & driver settings"
            >
              Preferences...
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: A4 PAGE LIVE PREVIEW (A4 PORTRAIT) */}
      <div className="flex-1 flex flex-col h-full bg-[#cbd5e1]/40 overflow-hidden relative">
        {/* Top Header Bar */}
        <div className="h-11 px-5 flex items-center justify-between border-b border-slate-200/80 bg-white/70 backdrop-blur-xs shrink-0 no-print">
          <h2 className="text-sm font-bold text-slate-800">
            A4 Page Live Preview (A4 Portrait)
          </h2>
          <span className="bg-slate-600 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-2xs">
            1 of 1 pages
          </span>
        </div>

        {/* Live A4 Sheet Canvas Viewport */}
        <div className="flex-1 overflow-auto p-4 flex justify-center items-start">
          {/* A4 Sheet Container with WYSIWYG 10px Margins */}
          <div
            id="print-hub-a4-sheet"
            className="print-only-sheet bg-white shadow-xl relative transition-transform origin-top border border-slate-300/80"
            style={{
              width: '595px', // Standard 72 DPI A4 Portrait width in px (210mm)
              minHeight: '842px', // Standard 72 DPI A4 Portrait height in px (297mm)
              padding: lockedMargins ? '10px' : '0px',
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top center'
            }}
          >
            {/* 10px Margin Guidelines Overlay (Ignored in print) */}
            <div className="no-print absolute inset-[10px] pointer-events-none border border-red-300/60 z-10">
              <div className="absolute -top-3 left-1 text-[8px] font-mono text-red-400">10px margin</div>
            </div>

            {/* Print Content Area */}
            <div
              className="w-full h-full relative"
              style={{
                transform: directScale !== 100 ? `scale(${directScale / 100})` : 'none',
                transformOrigin: 'top left'
              }}
            >
              {snapshot ? (
                <div className="w-full h-full flex items-center justify-center">
                  <img
                    src={snapshot}
                    alt="WYSIWYG Print Layout"
                    className="w-full h-auto object-contain block m-0 p-0 shadow-xs"
                    style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }}
                  />
                </div>
              ) : isIDCardMode ? (
                <div className="space-y-4">
                  {idCardQueue.length > 0 ? (
                    idCardQueue.map((item, idx) => (
                      <div key={item.id || idx} className="space-y-1">
                        {/* Pair Row: Front Side + Back Side */}
                        <div className="flex items-center gap-1 justify-center">
                          {/* Front Side */}
                          <div className="flex-1 max-w-[275px] aspect-[85.6/54] bg-white border border-slate-200 rounded-sm overflow-hidden relative shadow-2xs">
                            {item.front ? (
                              <img
                                src={item.front}
                                alt="Front Side"
                                className="w-full h-full object-fill block"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs">
                                Front Side
                              </div>
                            )}
                          </div>

                          {/* Scissor cut guide line */}
                          <div className="w-[1px] h-32 border-r border-dashed border-slate-400 mx-0.5 relative flex items-center justify-center">
                            <span className="text-[9px] text-slate-400 transform -rotate-90">✂</span>
                          </div>

                          {/* Back Side */}
                          <div className="flex-1 max-w-[275px] aspect-[85.6/54] bg-white border border-slate-200 rounded-sm overflow-hidden relative shadow-2xs">
                            {item.back ? (
                              <img
                                src={item.back}
                                alt="Back Side"
                                className="w-full h-full object-fill block"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs">
                                Back Side
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Labels underneath: Front Side / Back Side */}
                        <div className="flex items-center justify-around text-xs font-bold text-slate-800 pt-0.5">
                          <span className="w-1/2 text-center">Front Side</span>
                          <span className="w-1/2 text-center">Back Side</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    // Default mockup view matching reference screenshot when queue is fresh
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 justify-center">
                        <div className="flex-1 max-w-[275px] aspect-[85.6/54] bg-slate-50 border border-slate-300 rounded-sm overflow-hidden relative flex items-center justify-center">
                          <span className="text-xs font-bold text-slate-400">Front Side Card Preview</span>
                        </div>
                        <div className="w-[1px] h-32 border-r border-dashed border-slate-400 mx-0.5 relative flex items-center justify-center">
                          <span className="text-[9px] text-slate-400 transform -rotate-90">✂</span>
                        </div>
                        <div className="flex-1 max-w-[275px] aspect-[85.6/54] bg-slate-50 border border-slate-300 rounded-sm overflow-hidden relative flex items-center justify-center">
                          <span className="text-xs font-bold text-slate-400">Back Side Card Preview</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-around text-xs font-bold text-slate-800 pt-0.5">
                        <span className="w-1/2 text-center">Front Side</span>
                        <span className="w-1/2 text-center">Back Side</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Photo Studio Mode fallback */
                photoQueue.length > 0 && (
                  <div className="grid grid-cols-6 gap-2">
                    {photoQueue.map((item, idx) => (
                      <div key={idx} className="aspect-[3.5/4.5] bg-white overflow-hidden" style={{ border: '1px solid #808080' }}>
                        <img src={item.image} alt="Photo" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        {/* BOTTOM FLOATING ZOOM CONTROLS */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-white/95 backdrop-blur-xs border border-slate-300 rounded-lg shadow-md px-2 py-1 flex items-center gap-3 no-print">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(50, z - 10))}
            className="w-5 h-5 flex items-center justify-center text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded cursor-pointer"
            title="Zoom Out"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-bold text-slate-700 min-w-10 text-center font-mono">
            {zoom}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(200, z + 10))}
            className="w-5 h-5 flex items-center justify-center text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded cursor-pointer"
            title="Zoom In"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
