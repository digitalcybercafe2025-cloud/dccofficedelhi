import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import LockScreen from './components/LockScreen';
import PhotoStudioWorkspace from './components/workspaces/PhotoStudioWorkspace';
import FileStorageHubWorkspace from './components/workspaces/FileStorageHubWorkspace';
import IDCardStudioWorkspace from './components/workspaces/IDCardStudioWorkspace';
import SizeModal from './components/modals/SizeModal';
import ColorAdjustModal from './components/modals/ColorAdjustModal';
import SettingsModal from './components/modals/SettingsModal';
import PrintHubWindow from './components/printhub/PrintHubWindow';
import sample1 from './assets/1000695901.png';
import sample2 from './assets/1000695908.png';
import sample3 from './assets/1000695907.png';
import { INITIAL_CUSTOMERS } from './utils/sampleData';
import { silentSyncWithSupabase, isMasterAdminId } from './utils/supabase';
import {
  checkBackendHealth,
  removeBackground,
  enhancePhoto,
  generateA4Sheet,
  getPrinters
} from './utils/api';
import { Loader2 } from 'lucide-react';

export default function App() {
  // Completely isolated sub-window routing for Print Hub
  const isPrintHubWindow = typeof window !== 'undefined' && (
    window.location.hash === '#print-hub' ||
    window.location.search.includes('print-hub')
  );

  if (isPrintHubWindow) {
    return <PrintHubWindow />;
  }

  const [licenseStatus, setLicenseStatus] = useState(null);
  const [isLicenseLoading, setIsLicenseLoading] = useState(true);
  const [showManualLockScreen, setShowManualLockScreen] = useState(false);

  const [activeModule, setActiveModule] = useState('PhotoStudio');
  const [customers, setCustomers] = useState([
    { id: 'c1', code: 'C1', name: 'Photo 1', copies: 6, image: sample1 },
    { id: 'c2', code: 'C2', name: 'Photo 2', copies: 6, image: sample2 },
    { id: 'c3', code: 'C3', name: 'Photo 3', copies: 6, image: sample3 }
  ]);
  const [activeCustomerId, setActiveCustomerId] = useState('c1');
  const [copies, setCopies] = useState(6);
  
  // Initial print queue matching screenshot (12 photos: 6 of C1, 6 of C2)
  const [printQueue, setPrintQueue] = useState([
    {
      id: 'c1',
      code: 'C1',
      image: sample1,
      count: 6
    },
    {
      id: 'c2',
      code: 'C2',
      image: sample2,
      count: 6
    }
  ]);

  const [shopName, setShopName] = useState(() => localStorage.getItem('shopName') || 'Digital Cyber Cafe');
  const [mobileNumber, setMobileNumber] = useState(() => localStorage.getItem('mobileNumber') || '');
  const [activePrinter, setActivePrinter] = useState(() => localStorage.getItem('activePrinter') || 'Epson L3560');
  const [printersList, setPrintersList] = useState([]);
  const [layoutFormat, setLayoutFormat] = useState('PNG');
  const [isProcessingBg, setIsProcessingBg] = useState(false);
  const [isEnhancingPhoto, setIsEnhancingPhoto] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Dynamic A4 Page Margins
  const [marginX, setMarginX] = useState(16);
  const [marginY, setMarginY] = useState(24);

  // Modals
  const [sizeModalOpen, setSizeModalOpen] = useState(false);
  const [colorModalOpen, setColorModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [selectedSize, setSelectedSize] = useState({ id: 'in_passport', name: 'Indian Passport', widthMm: 35, heightMm: 45 });
  const [activeTool, setActiveTool] = useState(null);

  // Undo / Redo history
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Active customer object
  const activeCustomer = customers.find((c) => c.id === activeCustomerId) || customers[0];

  // Fetch real OS hardware printers dynamically on mount
  useEffect(() => {
    async function initPrinters() {
      try {
        let rawPrinters = [];
        if (window.electronAPI?.getSystemPrinters) {
          rawPrinters = await window.electronAPI.getSystemPrinters();
        }
        if (!rawPrinters || rawPrinters.length === 0) {
          const pData = await getPrinters();
          rawPrinters = pData.printers || [];
        }

        if (rawPrinters && rawPrinters.length > 0) {
          // Filter out virtual/software printers (PDF, Fax, OneNote, XPS, Root Queue)
          const virtualFilter = /(pdf|xps|fax|onenote|root print queue|send to|document writer)/i;
          const realHardware = rawPrinters.filter((p) => !virtualFilter.test(p.name));
          const finalList = realHardware.length > 0 ? realHardware : rawPrinters;
          setPrintersList(finalList);

          const savedPrinter = localStorage.getItem('activePrinter');
          if (savedPrinter && finalList.some((p) => p.name === savedPrinter)) {
            setActivePrinter(savedPrinter);
          } else {
            const def = finalList.find((p) => p.isDefault) || finalList[0];
            if (def) {
              setActivePrinter(def.name);
              localStorage.setItem('activePrinter', def.name);
            }
          }
        }
      } catch (err) {
        console.error('Failed to init system printers:', err);
      }
    }
    initPrinters();
  }, []);

  // Fetch Hardware-Bound License & 21-Day Trial Status (Server-Time Validated)
  const checkLicense = async () => {
    try {
      let serverStatus = null;
      let mid = null;

      if (window.electronAPI?.getMachineId) {
        mid = await window.electronAPI.getMachineId();
      }

      // Master Admin Hardware Auto-Unlock (Primary PC + Second PC)
      if (isMasterAdminId(mid)) {
        const masterMerged = {
          isUnlocked: true,
          isMaster: true,
          isBlocked: false,
          isTrialExpired: false,
          daysLeft: 9999,
          machineId: mid,
          plan: 'MASTER_ADMIN',
          status: 'active',
          expiryDate: 'Lifetime Admin Access'
        };
        setLicenseStatus(masterMerged);
        return masterMerged;
      }

      if (window.electronAPI?.validateServerLicense) {
        serverStatus = await window.electronAPI.validateServerLicense();
        if (serverStatus?.status && serverStatus.status !== 'offline_fallback') {
          localStorage.setItem('lastOnlineSync', Date.now().toString());
        }
      }

      // Anti-clock spoofing: verify if offline for > 5 days during free trial
      const lastSync = parseInt(localStorage.getItem('lastOnlineSync') || '0', 10);
      const daysOffline = lastSync ? (Date.now() - lastSync) / (1000 * 60 * 60 * 24) : 0;
      const isOfflineCheckRequired =
        daysOffline > 5 &&
        serverStatus?.plan !== 'LIFETIME' &&
        serverStatus?.plan !== 'MASTER_ADMIN';

      if (window.electronAPI?.getLicenseStatus) {
        const localStatus = await window.electronAPI.getLicenseStatus();
        const merged = {
          ...localStatus,
          ...(serverStatus || {}),
          machineId: mid || localStatus?.machineId || 'DETECTING-HARDWARE-ID',
          // Server expiry and block take absolute precedence
          isBlocked: serverStatus?.isBlocked || false,
          isTrialExpired: isOfflineCheckRequired
            ? true
            : (serverStatus?.isTrialExpired ?? localStatus?.isTrialExpired ?? false),
          isOfflineCheckRequired,
          daysLeft: serverStatus?.daysLeft ?? localStatus?.daysLeft ?? 21,
          isUnlocked:
            !serverStatus?.isBlocked &&
            !serverStatus?.isTrialExpired &&
            !isOfflineCheckRequired &&
            (localStatus?.isUnlocked ?? true)
        };
        setLicenseStatus(merged);
        return merged;
      } else {
        // Fallback for browser mode
        const browserStatus = {
          isUnlocked: true,
          isTrialExpired: false,
          isActivated: false,
          daysLeft: 21,
          machineId: 'BROWSER-DEV-MODE',
          plan: 'TRIAL',
          expiryDate: 'N/A'
        };
        setLicenseStatus(browserStatus);
        return browserStatus;
      }
    } catch (err) {
      console.error('License check error:', err);
      const fallbackStatus = {
        isUnlocked: true,
        isTrialExpired: false,
        isActivated: false,
        daysLeft: 21,
        machineId: 'OFFLINE-MODE'
      };
      setLicenseStatus(fallbackStatus);
      return fallbackStatus;
    } finally {
      setIsLicenseLoading(false);
    }
  };

  useEffect(() => {
    checkLicense();
  }, []);

  // Silent Network-Aware Cloud Sync: Auto-sync whenever internet is detected
  useEffect(() => {
    const handleNetworkChange = async () => {
      if (navigator.onLine) {
        console.log('[Network] Internet connected. Executing silent background cloud sync...');
        const mid = licenseStatus?.machineId;
        if (mid && mid !== 'BROWSER-DEV-MODE' && mid !== 'OFFLINE-MODE') {
          await silentSyncWithSupabase(mid);
          await checkLicense();
        }
      }
    };

    window.addEventListener('online', handleNetworkChange);
    if (navigator.onLine && licenseStatus?.machineId) {
      handleNetworkChange();
    }

    return () => {
      window.removeEventListener('online', handleNetworkChange);
    };
  }, [licenseStatus?.machineId]);

  const handleSelectCustomer = (id) => {
    setActiveCustomerId(id);
    const selected = customers.find((c) => c.id === id);
    if (selected) {
      setCopies(selected.copies || 6);
      setHistory([selected.image]);
      setHistoryIndex(0);
    }
  };

  const handleAddCustomer = (imageDataUrl) => {
    const uniqueId = `cust_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const nextCodeNum = customers.length + 1;
    const defaultImg =
      typeof imageDataUrl === 'string' && imageDataUrl
        ? imageDataUrl
        : INITIAL_CUSTOMERS[(nextCodeNum - 1) % INITIAL_CUSTOMERS.length]?.image || INITIAL_CUSTOMERS[0].image;
    const newCustomer = {
      id: uniqueId,
      code: `C${nextCodeNum}`,
      name: `Customer ${nextCodeNum}`,
      copies: 6,
      image: defaultImg
    };
    setCustomers((prev) => [...prev, newCustomer]);
    // Exclusively activate the new customer
    setActiveCustomerId(uniqueId);
    setCopies(6);
    setHistory([defaultImg]);
    setHistoryIndex(0);
  };

  const handleDeleteCustomer = (idToDelete) => {
    if (customers.length <= 1) {
      alert('You must keep at least one customer in queue.');
      return;
    }
    setCustomers((prev) => {
      const remaining = prev.filter((c) => c.id !== idToDelete);
      if (activeCustomerId === idToDelete) {
        const nextActive = remaining[0];
        if (nextActive) {
          setActiveCustomerId(nextActive.id);
          setCopies(nextActive.copies || 6);
          setHistory([nextActive.image]);
          setHistoryIndex(0);
        }
      }
      return remaining;
    });
  };

  const handleUpdateCustomerPhoto = (newImageDataUrl) => {
    setCustomers((prev) =>
      prev.map((c) => (c.id === activeCustomerId ? { ...c, image: newImageDataUrl } : c))
    );
    // Push to undo history
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newImageDataUrl);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIdx = historyIndex - 1;
      setHistoryIndex(prevIdx);
      const prevImg = history[prevIdx];
      setCustomers((prev) =>
        prev.map((c) => (c.id === activeCustomerId ? { ...c, image: prevImg } : c))
      );
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      const nextImg = history[nextIdx];
      setCustomers((prev) =>
        prev.map((c) => (c.id === activeCustomerId ? { ...c, image: nextImg } : c))
      );
    }
  };

  const handleRemoveBackground = async () => {
    if (!activeCustomer?.image) return;
    setIsProcessingBg(true);
    try {
      const cutout = await removeBackground(activeCustomer.image, '#2b7fff');
      handleUpdateCustomerPhoto(cutout);
    } catch (err) {
      alert('Background removal failed: ' + err.message);
    } finally {
      setIsProcessingBg(false);
    }
  };

  const handleEnhancePhoto = async () => {
    if (!activeCustomer?.image) return;
    setIsEnhancingPhoto(true);
    try {
      const enhanced = await enhancePhoto(activeCustomer.image, 0.5);
      handleUpdateCustomerPhoto(enhanced);
    } catch (err) {
      alert('AI HD Clean failed: ' + err.message);
    } finally {
      setIsEnhancingPhoto(false);
    }
  };

  const handleAddToPrintPreview = (overrideImage) => {
    if (!activeCustomer) return;
    const imageToUse =
      typeof overrideImage === 'string' && overrideImage
        ? overrideImage
        : activeCustomer.image;
    setPrintQueue((prev) => {
      const existing = prev.find((item) => item.id === activeCustomer.id);
      if (existing) {
        return prev.map((item) =>
          item.id === activeCustomer.id
            ? { ...item, count: item.count + copies, image: imageToUse }
            : item
        );
      } else {
        return [
          ...prev,
          {
            id: activeCustomer.id,
            code: activeCustomer.code,
            image: imageToUse,
            count: copies
          }
        ];
      }
    });
  };

  // Row-wise deletion (removes exactly the 6 photos in the selected row)
  const handleDeleteRow = (rowIndex) => {
    const flat = [];
    printQueue.forEach((item) => {
      for (let i = 0; i < item.count; i++) {
        flat.push({ id: item.id, code: item.code, image: item.image });
      }
    });

    const start = rowIndex * 6;
    const end = start + 6;
    const remaining = flat.filter((_, idx) => idx < start || idx >= end);

    // Reconstruct queue
    const newQueue = [];
    remaining.forEach((p) => {
      const last = newQueue[newQueue.length - 1];
      if (last && last.id === p.id && last.image === p.image) {
        last.count += 1;
      } else {
        newQueue.push({ id: p.id, code: p.code, image: p.image, count: 1 });
      }
    });
    setPrintQueue(newQueue);
  };

  const [exportingFormat, setExportingFormat] = useState(null);

  const handleExport = async (format = 'PNG') => {
    if (printQueue.length === 0) return;
    setIsExporting(true);
    setExportingFormat(format);
    try {
      const result = await generateA4Sheet(printQueue, format, { marginX, marginY });
      if (result.dataUrl) {
        const ext = (result.format || format).toLowerCase();
        if (window.electronAPI?.saveFileDialog && window.electronAPI?.saveFile) {
          // Native Save Dialog
          const { canceled, filePath } = await window.electronAPI.saveFileDialog(
            `passport-print-sheet-${Date.now()}.${ext}`,
            ext
          );
          if (!canceled && filePath) {
            await window.electronAPI.saveFile(filePath, result.dataUrl);
            if (window.electronAPI.openPath) {
              window.electronAPI.openPath(filePath);
            }
          }
        } else {
          // Web download fallback
          const link = document.createElement('a');
          link.href = result.dataUrl;
          link.download = `passport-print-sheet.${ext}`;
          link.click();
        }
      }
    } catch (err) {
      alert('Export failed: ' + err.message);
    } finally {
      setIsExporting(false);
      setExportingFormat(null);
    }
  };

  const handleDirectPrint = async () => {
    if (printQueue.length === 0) return;
    setIsPrinting(true);
    try {
      let photoSnapshot = null;
      try {
        const sheetRes = await generateA4Sheet(printQueue, 'PNG', { marginX, marginY });
        if (sheetRes?.dataUrl) {
          photoSnapshot = sheetRes.dataUrl;
        }
      } catch (err) {
        console.warn('Photo sheet snapshot generation notice:', err);
      }

      if (window.ipcRenderer?.send) {
        window.ipcRenderer.send('open-print-window', {
          printQueue,
          type: 'photo',
          activePrinter,
          marginX,
          marginY,
          snapshot: photoSnapshot
        });
      } else if (window.electronAPI?.print) {
        await window.electronAPI.print({ deviceName: activePrinter });
      } else {
        window.print();
      }
    } catch (err) {
      alert('Print error: ' + err.message);
    } finally {
      setIsPrinting(false);
    }
  };

  // 1. Initial Loading Splash
  if (isLicenseLoading) {
    return (
      <div className="h-screen w-screen bg-slate-900 flex flex-col items-center justify-center text-white select-none">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center font-bold text-xl text-white shadow-lg mb-4 animate-pulse">
          D
        </div>
        <div className="flex items-center gap-2 text-slate-300 text-sm font-semibold">
          <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
          <span>Verifying Digital Cyber Cafe License...</span>
        </div>
      </div>
    );
  }

  // Check if mandatory onboarding is required (Shop Name + 10-digit WhatsApp Number)
  const isNeedsOnboarding =
    !localStorage.getItem('mobileNumber') ||
    !/^\d{10}$/.test(localStorage.getItem('mobileNumber') || '') ||
    !localStorage.getItem('shopName');

  // 2. Strict Lock Screen Enforcement: If trial is expired, software blocked, or not activated
  const isEnforceLock =
    licenseStatus?.isBlocked ||
    licenseStatus?.isTrialExpired ||
    (!licenseStatus?.isUnlocked && !licenseStatus?.isActivated) ||
    showManualLockScreen;

  if (isEnforceLock) {
    return (
      <LockScreen
        licenseStatus={licenseStatus}
        onClose={() => setShowManualLockScreen(false)}
        onUnlockSuccess={async () => {
          setShowManualLockScreen(false);
          await checkLicense();
        }}
        onRefreshStatus={checkLicense}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-[#f1f5f9] overflow-hidden text-slate-800">
      {/* 1. HEADER SECTION */}
      <Header
        shopName={shopName}
        activeModule={activeModule}
        onSelectModule={setActiveModule}
        activePrinter={activePrinter}
        onSelectPrinter={(name) => {
          setActivePrinter(name);
          localStorage.setItem('activePrinter', name);
        }}
        printers={printersList}
        onOpenSettings={() => setSettingsModalOpen(true)}
        licenseStatus={licenseStatus}
        onOpenActivation={() => setShowManualLockScreen(true)}
      />

      {/* 2. MODULAR WORKSPACES */}
      {activeModule === 'PhotoStudio' && (
        <PhotoStudioWorkspace
          customers={customers}
          activeCustomerId={activeCustomerId}
          onSelectCustomer={handleSelectCustomer}
          onDeleteCustomer={handleDeleteCustomer}
          onAddCustomer={handleAddCustomer}
          onEnhancePhoto={handleEnhancePhoto}
          isEnhancingPhoto={isEnhancingPhoto}
          copies={copies}
          onChangeCopies={setCopies}
          onAddToPrintPreview={handleAddToPrintPreview}
          onOpenSizeModal={() => setSizeModalOpen(true)}
          onOpenColorModal={() => setColorModalOpen(true)}
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          activeCustomer={activeCustomer}
          onUpdateCustomerPhoto={handleUpdateCustomerPhoto}
          onRemoveBackground={handleRemoveBackground}
          isProcessingBg={isProcessingBg}
          history={history}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={historyIndex > 0}
          canRedo={historyIndex < history.length - 1}
          printQueue={printQueue}
          onDeleteRow={handleDeleteRow}
          marginX={marginX}
          marginY={marginY}
          layoutFormat={layoutFormat}
          onChangeLayoutFormat={setLayoutFormat}
          onExport={handleExport}
          onDirectPrint={handleDirectPrint}
          isExporting={isExporting}
          exportingFormat={exportingFormat}
          isPrinting={isPrinting}
          onChangeMarginX={setMarginX}
          onChangeMarginY={setMarginY}
        />
      )}

      {activeModule === 'FileStorageHub' && <FileStorageHubWorkspace />}

      {activeModule === 'IDCardStudio' && (
        <IDCardStudioWorkspace activePrinter={activePrinter} />
      )}

      {/* Modals */}
      <SizeModal
        isOpen={sizeModalOpen}
        onClose={() => setSizeModalOpen(false)}
        selectedSize={selectedSize}
        onSelectSize={setSelectedSize}
      />

      <ColorAdjustModal
        isOpen={colorModalOpen}
        onClose={() => setColorModalOpen(false)}
        activeCustomer={activeCustomer}
        onUpdateImage={handleUpdateCustomerPhoto}
      />

      <SettingsModal
        isOpen={settingsModalOpen || isNeedsOnboarding}
        isMandatoryOnboarding={isNeedsOnboarding}
        onClose={() => setSettingsModalOpen(false)}
        shopName={shopName}
        onUpdateShopName={(newName) => {
          setShopName(newName);
          localStorage.setItem('shopName', newName);
        }}
        mobileNumber={mobileNumber}
        onUpdateMobileNumber={(newMobile) => {
          setMobileNumber(newMobile);
          localStorage.setItem('mobileNumber', newMobile);
          checkLicense();
        }}
        machineId={licenseStatus?.machineId}
        licenseStatus={licenseStatus}
      />
    </div>
  );
}
