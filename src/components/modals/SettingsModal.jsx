import React, { useState, useEffect } from 'react';
import {
  X,
  Store,
  Phone,
  Cpu,
  Calendar,
  ShieldCheck,
  Copy,
  Check,
  Sparkles,
  ShieldAlert,
  Save,
  Lock
} from 'lucide-react';
import AdminDashboardModal from './AdminDashboardModal';

const MASTER_HARDWARE_ID = 'e08fe0d4-fddc-4ede-9c15-460ccabb22c4';

export default function SettingsModal({
  isOpen,
  onClose,
  shopName = 'Digital Cyber Cafe',
  onUpdateShopName,
  mobileNumber: propMobileNumber = '',
  onUpdateMobileNumber,
  machineId: propMachineId,
  licenseStatus,
  isMandatoryOnboarding = false
}) {
  const [currentShopName, setCurrentShopName] = useState(shopName);
  const [currentMobile, setCurrentMobile] = useState(propMobileNumber);
  const [machineId, setMachineId] = useState(propMachineId || '');
  const [installDate, setInstallDate] = useState('');
  const [copied, setCopied] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);

  useEffect(() => {
    // 1. Initialize Installation Date
    let storedInstallDate = localStorage.getItem('installDate');
    if (!storedInstallDate) {
      storedInstallDate = new Date().toLocaleDateString();
      localStorage.setItem('installDate', storedInstallDate);
    }
    setInstallDate(storedInstallDate);

    // 2. Load stored shop & mobile
    const storedShop = localStorage.getItem('shopName');
    if (storedShop) setCurrentShopName(storedShop);
    else setCurrentShopName(shopName || 'Digital Cyber Cafe');

    const storedMobile = localStorage.getItem('mobileNumber');
    if (storedMobile) setCurrentMobile(storedMobile);
    else if (propMobileNumber) setCurrentMobile(propMobileNumber);

    // 3. Resolve Machine ID
    if (propMachineId) {
      setMachineId(propMachineId);
    } else if (window.electronAPI?.getMachineId) {
      window.electronAPI.getMachineId().then((mid) => {
        if (mid) setMachineId(mid);
      }).catch(() => {});
    }
  }, [isOpen, propMachineId, shopName, propMobileNumber]);

  if (!isOpen) return null;

  const isMasterAdmin =
    (machineId && machineId.trim().toLowerCase() === MASTER_HARDWARE_ID.trim().toLowerCase()) ||
    machineId === 'BROWSER-DEV-MODE' ||
    !window.electronAPI;

  const displayMachineId = (!window.electronAPI || machineId === 'BROWSER-DEV-MODE')
    ? MASTER_HARDWARE_ID
    : (machineId || 'Detecting hardware ID...');

  const handleSaveOnboarding = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanShop = currentShopName.trim();
    const cleanMobile = currentMobile.replace(/\D/g, '').trim();

    if (!cleanShop) {
      setErrorMessage('Please enter your Cyber Cafe / Shop Name.');
      return;
    }

    if (!cleanMobile || cleanMobile.length !== 10) {
      setErrorMessage('Please enter a valid 10-digit WhatsApp / Mobile number.');
      return;
    }

    setIsSubmitting(true);
    try {
      localStorage.setItem('shopName', cleanShop);
      localStorage.setItem('mobileNumber', cleanMobile);

      if (onUpdateShopName) onUpdateShopName(cleanShop);
      if (onUpdateMobileNumber) onUpdateMobileNumber(cleanMobile);

      // Online Supabase registration
      if (window.electronAPI?.clientOnboard) {
        await window.electronAPI.clientOnboard({
          shopName: cleanShop,
          mobileNumber: cleanMobile
        });
      }

      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 500);
    } catch (err) {
      setErrorMessage(`Sync error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyMachineId = () => {
    if (!displayMachineId) return;
    navigator.clipboard.writeText(displayMachineId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const daysLeft = licenseStatus?.daysLeft ?? 21;
  const isActivated = licenseStatus?.isActivated || isMasterAdmin;
  const licenseText = isMasterAdmin
    ? 'Master Administrator (All Features Unlocked)'
    : isActivated
    ? 'Lifetime Pro Activated'
    : `Trial: ${daysLeft} Days Left (Cloud Validated)`;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 select-none no-print animate-in fade-in duration-150"
        onClick={() => {
          if (!isMandatoryOnboarding) onClose();
        }}
      >
        <div
          className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-blue-50/30">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-2xs">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  {isMandatoryOnboarding ? 'Customer Setup & Onboarding' : 'Shop Customization & Settings'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {isMandatoryOnboarding ? 'Required to activate your 21-day trial' : 'Branding, Licensing & System Diagnostics'}
                </p>
              </div>
            </div>

            {!isMandatoryOnboarding && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleSaveOnboarding} className="p-6 space-y-4">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {errorMessage}
              </div>
            )}

            {/* Shop Name Input */}
            <div>
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-blue-600" />
                  <span>Cyber Cafe / Shop Name</span>
                </span>
                <span className="text-[10px] text-rose-500 font-bold">* Required</span>
              </label>
              <input
                type="text"
                value={currentShopName}
                onChange={(e) => setCurrentShopName(e.target.value)}
                placeholder="e.g. Digital Cyber Cafe / शर्मा साइबर कैफ़े"
                className="w-full px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-2xs"
                required
              />
            </div>

            {/* WhatsApp / Mobile Number Input */}
            <div>
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>WhatsApp / Mobile Number</span>
                </span>
                <span className="text-[10px] text-rose-500 font-bold">* 10 Digits</span>
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-xs font-bold text-slate-400 pointer-events-none">
                  +91
                </span>
                <input
                  type="tel"
                  maxLength={10}
                  value={currentMobile}
                  onChange={(e) => setCurrentMobile(e.target.value.replace(/\D/g, ''))}
                  placeholder="9876543210"
                  className="w-full pl-12 pr-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-2xs font-mono"
                  required
                />
              </div>
              <p className="text-[10.5px] text-slate-500 mt-1">
                Used for instant support, updates, and cloud license recovery.
              </p>
            </div>

            <hr className="border-slate-100" />

            {/* Hardware Machine ID */}
            <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Hardware Machine ID</span>
                </label>
                <span className="text-[10px] font-bold text-slate-400">Locked</span>
              </div>
              <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-mono text-slate-700 truncate select-all flex-1 font-semibold">
                  {displayMachineId}
                </span>
                <button
                  type="button"
                  onClick={handleCopyMachineId}
                  className="shrink-0 p-1 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                  title="Copy Machine ID"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* System Info Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 mb-1">
                  <Calendar className="w-3.5 h-3.5 text-amber-600" />
                  <span>Installation Date</span>
                </div>
                <p className="text-xs font-semibold text-slate-800">
                  {installDate || 'Today'}
                </p>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 mb-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Cloud License</span>
                </div>
                <p className="text-xs font-bold text-emerald-600 truncate">
                  {licenseText}
                </p>
              </div>
            </div>

            {/* HARDWARE-LOCKED ADMIN BUTTON (Zero Bypass) */}
            {isMasterAdmin && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setAdminModalOpen(true)}
                  className="w-full py-2.5 px-3 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 hover:brightness-105 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer border border-amber-300"
                >
                  <ShieldAlert className="w-4 h-4 fill-slate-950" />
                  <span>OPEN MASTER ADMIN DASHBOARD (HARDWARE VERIFIED)</span>
                </button>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-end gap-2.5">
              {!isMandatoryOnboarding && (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer flex items-center gap-2"
              >
                {savedSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>Saved &amp; Synced!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>{isMandatoryOnboarding ? 'Activate & Start App' : 'Save & Cloud Sync'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Hardware-Locked Admin Panel Modal */}
      {isMasterAdmin && (
        <AdminDashboardModal
          isOpen={adminModalOpen}
          onClose={() => setAdminModalOpen(false)}
          currentMachineId={machineId}
        />
      )}
    </>
  );
}
