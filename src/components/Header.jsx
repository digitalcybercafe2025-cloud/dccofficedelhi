import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Minus,
  Square,
  X,
  Printer,
  ChevronDown,
  Check,
  RefreshCw,
  ShieldCheck,
  Clock
} from 'lucide-react';
import LogoLightboxModal from './modals/LogoLightboxModal';
import companyLogo from '../assets/logo.png';

export default function Header({
  shopName = 'Digital Cyber Cafe',
  activeModule = 'PhotoStudio',
  onSelectModule,
  activePrinter = 'Epson L3560',
  onSelectPrinter,
  printers = [],
  onOpenSettings,
  licenseStatus,
  onOpenActivation
}) {
  const [logoModalOpen, setLogoModalOpen] = useState(false);
  const [printerDropdownOpen, setPrinterDropdownOpen] = useState(false);
  const [systemPrinters, setSystemPrinters] = useState(printers);
  const [isLoadingPrinters, setIsLoadingPrinters] = useState(false);
  const dropdownRef = useRef(null);

  const handleMinimize = () => {
    if (window.electronAPI?.minimize) window.electronAPI.minimize();
  };

  const handleMaximize = () => {
    if (window.electronAPI?.maximize) window.electronAPI.maximize();
  };

  const handleClose = () => {
    if (window.electronAPI?.close) window.electronAPI.close();
  };

  // Sync external printers prop
  useEffect(() => {
    if (printers && printers.length > 0) {
      setSystemPrinters(printers);
    }
  }, [printers]);

  // Click outside to close printer dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setPrinterDropdownOpen(false);
      }
    }
    if (printerDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [printerDropdownOpen]);

  // Fetch real installed Windows OS printers dynamically
  const fetchRealSystemPrinters = async () => {
    setIsLoadingPrinters(true);
    try {
      let rawList = [];
      if (window.electronAPI?.getSystemPrinters) {
        rawList = await window.electronAPI.getSystemPrinters();
      }

      // Filter out virtual/dummy printers like PDF, Fax, OneNote, etc.
      const virtualFilter = /(pdf|xps|fax|onenote|root print queue|send to|document writer)/i;
      const realHardware = (rawList || []).filter((p) => !virtualFilter.test(p.name));
      const finalList = realHardware.length > 0 ? realHardware : rawList;

      if (finalList && finalList.length > 0) {
        setSystemPrinters(finalList);
      }
    } catch (err) {
      console.warn('[Header] Failed to fetch system printers:', err);
    } finally {
      setIsLoadingPrinters(false);
    }
  };

  const handleTogglePrinterDropdown = () => {
    if (!printerDropdownOpen) {
      fetchRealSystemPrinters();
    }
    setPrinterDropdownOpen((prev) => !prev);
  };

  const handlePrinterSelect = (printerName) => {
    if (onSelectPrinter) {
      onSelectPrinter(printerName);
    }
    setPrinterDropdownOpen(false);
  };

  const modules = [
    { id: 'FileStorageHub', label: 'File Storage Hub' },
    { id: 'PhotoStudio', label: 'Photo Studio' },
    { id: 'IDCardStudio', label: 'ID Card Studio' }
  ];

  return (
    <>
      <header
        id="app-header"
        className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between titlebar-drag select-none shadow-xs z-30 no-print"
      >
        {/* Brand Left - Click to Enlarge Logo Lightbox & Dynamic Shop Name */}
        <div className="flex items-center gap-3 titlebar-nodrag">
          <button
            onClick={() => setLogoModalOpen(true)}
            title="Click to Enlarge Logo & Company Profile"
            className="group relative w-10 h-10 rounded-full p-0.5 bg-gradient-to-tr from-amber-400 via-cyan-400 to-blue-600 shadow-md shadow-blue-500/20 hover:shadow-cyan-500/40 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer flex items-center justify-center shrink-0"
          >
            <div className="w-full h-full rounded-full overflow-hidden bg-slate-950 flex items-center justify-center border border-slate-900">
              <img
                src={companyLogo}
                alt="Digital Cyber Cafe Logo"
                className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-200"
              />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></span>
          </button>

          <div
            onClick={() => setLogoModalOpen(true)}
            className="flex flex-col cursor-pointer group"
            title="Click to view company profile & contact"
          >
            <span className="font-bold text-slate-800 text-[14px] leading-tight tracking-tight group-hover:text-blue-600 transition-colors">
              {shopName || 'Digital Cyber Cafe'}
            </span>
            <span className="text-[11px] font-medium text-slate-500 leading-tight">
              Passport Photo Maker
            </span>
          </div>
        </div>

        {/* Center Segmented Control Switcher */}
        <div className="titlebar-nodrag flex items-center">
          <div className="border border-blue-300/80 bg-white/90 p-0.5 rounded-full flex items-center gap-0.5 shadow-2xs">
            {modules.map((m) => {
              const isActive = activeModule === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => onSelectModule && onSelectModule(m.id)}
                  className={`px-3.5 py-1 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-[#1677ff] text-white shadow-xs'
                      : 'text-slate-600 hover:text-blue-600 hover:bg-slate-100/70'
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Controls Right - Decoupled Settings & Dynamic OS Printer Pill */}
        <div className="flex items-center gap-3 titlebar-nodrag">
          {/* Dedicated ⚙️ Settings Button (Shop Customization & Machine ID) */}
          <button
            onClick={onOpenSettings}
            title="Shop Customization & System Settings"
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-800 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* System is Ready Indicator */}
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <span>System is Ready</span>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>

          {/* Dynamic OS Printer Pill with Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={handleTogglePrinterDropdown}
              title="Click to select installed Windows OS printer"
              className={`flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 px-3 py-1 rounded-full border transition-all cursor-pointer shadow-2xs ${
                printerDropdownOpen ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="max-w-[170px] truncate font-semibold">
                Printer: {activePrinter}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                  printerDropdownOpen ? 'rotate-180 text-blue-600' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu for Real OS Printers */}
            {printerDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-100 mb-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                    <Printer className="w-3.5 h-3.5 text-blue-600" />
                    <span>Installed Hardware Printers</span>
                  </div>
                  <button
                    onClick={fetchRealSystemPrinters}
                    title="Refresh Windows Printers"
                    className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-50 transition-colors"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingPrinters ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="max-h-56 overflow-y-auto space-y-1">
                  {systemPrinters && systemPrinters.length > 0 ? (
                    systemPrinters.map((p) => {
                      const isSelected = activePrinter === p.name;
                      return (
                        <div
                          key={p.name}
                          onClick={() => handlePrinterSelect(p.name)}
                          className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200'
                              : 'hover:bg-slate-50 text-slate-700 font-medium'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isSelected ? 'bg-blue-600' : 'bg-emerald-500'
                              }`}
                            />
                            <span className="text-xs truncate">{p.name}</span>
                          </div>
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 ml-1" />
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-3 text-center text-xs text-slate-400">
                      No hardware printers found
                    </div>
                  )}
                </div>

                <div className="pt-1.5 mt-1 border-t border-slate-100 px-2 text-[10px] text-slate-400 flex justify-between">
                  <span>Filtered Virtual Printers</span>
                  <span className="text-emerald-600 font-semibold">Windows Spooler Ready</span>
                </div>
              </div>
            )}
          </div>

          {/* License / Trial Badge */}
          {licenseStatus && (
            <button
              onClick={onOpenActivation}
              title={
                licenseStatus.isActivated
                  ? `Active Plan: ${licenseStatus.plan} (Expires: ${licenseStatus.expiryDate})`
                  : `Free Trial Active: ${licenseStatus.daysLeft} days remaining. Click to activate.`
              }
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border transition-all cursor-pointer ${
                licenseStatus.isActivated
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                  : 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
              }`}
            >
              {licenseStatus.isActivated ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    {licenseStatus.plan === 'LIFE' || licenseStatus.plan === 'LIFETIME'
                      ? 'PRO Lifetime'
                      : `PRO (${licenseStatus.daysLeft}d)`}
                  </span>
                </>
              ) : (
                <>
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Trial: {licenseStatus.daysLeft}d left</span>
                </>
              )}
            </button>
          )}

          {/* Window controls */}
          <div className="flex items-center gap-1 ml-1 border-l border-slate-200 pl-2.5">
            <button
              onClick={handleMinimize}
              className="w-7 h-7 flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
              title="Minimize"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleMaximize}
              className="w-7 h-7 flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
              title="Maximize"
            >
              <Square className="w-3 h-3" />
            </button>
            <button
              onClick={handleClose}
              className="w-7 h-7 flex items-center justify-center rounded text-slate-500 hover:bg-red-500 hover:text-white transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Lightbox / Modal for enlarged company logo & details */}
      <LogoLightboxModal
        isOpen={logoModalOpen}
        onClose={() => setLogoModalOpen(false)}
      />
    </>
  );
}
