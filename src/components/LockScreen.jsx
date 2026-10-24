import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  ShieldAlert,
  KeyRound,
  Copy,
  Check,
  MessageCircle,
  Lock,
  Sparkles,
  AlertCircle,
  Loader2,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Minus,
  Square,
  X,
  QrCode,
  Zap,
  CreditCard,
  CheckCircle2
} from 'lucide-react';

const SUBSCRIPTION_PLANS = [
  {
    id: '1m',
    code: '1M',
    name: '1 Month Plan',
    duration: '30 Days Access',
    price: 199,
    tag: 'Starter'
  },
  {
    id: '3m',
    code: '3M',
    name: '3 Months Plan',
    duration: '90 Days Access',
    price: 499,
    tag: 'Popular'
  },
  {
    id: '6m',
    code: '6M',
    name: '6 Months Plan',
    duration: '180 Days Access',
    price: 999,
    tag: 'Best Value'
  },
  {
    id: '12m',
    code: '12M',
    name: '1 Year Plan',
    duration: '365 Days Access',
    price: 1499,
    tag: 'Recommended (Save 38%)',
    featured: true
  }
];

const MERCHANT_UPI_ID = 'Q152175398@ybl';
const WHATSAPP_DISPLAY = '+91 99114 23881';
const WHATSAPP_CLEAN = '919911423881';

export default function LockScreen({
  licenseStatus,
  onClose,
  onUnlockSuccess,
  onRefreshStatus
}) {
  const [selectedPlan, setSelectedPlan] = useState(SUBSCRIPTION_PLANS[3]); // default to 1 Year
  const [activationKey, setActivationKey] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);

  const handleCopyWhatsApp = (e) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(WHATSAPP_CLEAN);
    setCopiedWhatsApp(true);
    setTimeout(() => setCopiedWhatsApp(false), 2000);
  };

  const machineId = licenseStatus?.machineId || 'FETCHING-HARDWARE-ID...';
  const isBlocked = licenseStatus?.isBlocked;
  const isOfflineCheckRequired = licenseStatus?.isOfflineCheckRequired;

  // Dynamic UPI Deep Link
  const upiLink = `upi://pay?pa=${MERCHANT_UPI_ID}&pn=DigitalCyberCafe&am=${selectedPlan.price}&cu=INR&tn=DCC_${selectedPlan.code}_${machineId.replace(/[^A-Za-z0-9]/g, '').slice(0, 8)}`;

  const handleCopyMachineId = () => {
    navigator.clipboard.writeText(machineId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setErrorMessage('');
    try {
      if (onRefreshStatus) {
        const res = await onRefreshStatus();
        if (res?.isUnlocked || res?.status === 'active' || res?.status === 'lifetime') {
          setSuccessMessage('Cloud License Active! Unlocking workspace...');
          setTimeout(() => {
            if (onUnlockSuccess) onUnlockSuccess(res);
          }, 800);
          return;
        }
      }
    } catch (err) {
      setErrorMessage('Refresh error: ' + err.message);
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  const handleOpenWhatsApp = () => {
    const text = encodeURIComponent(
      `Hello Digital Cyber Cafe, I want to activate my Passport Maker software.\n\nSelected Plan: ${selectedPlan.name} (₹${selectedPlan.price})\nMachine ID: ${machineId}\n\nAttached is my payment screenshot.`
    );
    const url = `https://wa.me/${WHATSAPP_CLEAN}?text=${text}`;
    if (window.electronAPI?.openPath) {
      window.open(url, '_blank');
    } else {
      window.open(url, '_blank');
    }
  };

  const handleVerify = async (e) => {
    e?.preventDefault();
    if (!activationKey.trim()) {
      setErrorMessage('Please enter your activation key.');
      return;
    }

    setIsVerifying(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (window.electronAPI?.verifyActivationKey) {
        const result = await window.electronAPI.verifyActivationKey(activationKey.trim());
        if (result.success) {
          localStorage.setItem('licenseStatus', 'lifetime');
          localStorage.setItem('licenseKey', activationKey.trim());
          setSuccessMessage(result.message || 'License activated successfully!');
          setTimeout(() => {
            if (onUnlockSuccess) onUnlockSuccess(result);
          }, 1000);
        } else {
          setErrorMessage(result.error || 'Invalid activation key for this Machine ID.');
        }
      } else {
        setErrorMessage('Verification is supported in the Desktop Application.');
      }
    } catch (err) {
      setErrorMessage('Verification error: ' + err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 select-none overflow-hidden font-sans">
      {/* Top Custom Frameless Header for Desktop Window Controls */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-[11px] text-white shadow-xs">
            D
          </div>
          <span className="font-bold tracking-wide text-slate-200">
            Digital Cyber Cafe — Subscription & Activation Hub
          </span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
            v2.0.2 {isBlocked ? 'Blocked' : 'Trial Ended'}
          </span>
        </div>

        {/* Window Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => window.electronAPI?.minimize?.()}
            className="w-7 h-6 flex items-center justify-center rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => window.electronAPI?.maximize?.()}
            className="w-7 h-6 flex items-center justify-center rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Maximize"
          >
            <Square className="w-3 h-3" />
          </button>
          <button
            onClick={() => {
              if (onClose) onClose();
              else window.electronAPI?.close?.();
            }}
            className="w-7 h-6 flex items-center justify-center rounded hover:bg-rose-600 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Content Area / Modal Backdrop */}
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget && onClose) {
            onClose();
          }
        }}
        className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 flex items-center justify-center cursor-pointer"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-5xl bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl backdrop-blur-md overflow-hidden flex flex-col gap-6 p-6 sm:p-8 cursor-default"
        >
          
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0 text-amber-400 shadow-inner">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30 mb-1">
                  <Lock className="w-3 h-3" />
                  <span>
                    {isBlocked
                      ? 'Access Suspended'
                      : isOfflineCheckRequired
                      ? 'Security Sync Needed'
                      : '21-Day Free Trial Ended'}
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {isBlocked
                    ? 'Software Access Restricted'
                    : isOfflineCheckRequired
                    ? 'Online License Verification Required'
                    : 'Activate Your Digital Cyber Cafe Subscription'}
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Choose a subscription plan below, scan the PhonePe Merchant UPI QR to pay, and activate your license.
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                title="Query Supabase for real-time activation status"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
                <span>{isRefreshing ? 'Checking...' : 'Refresh Status'}</span>
              </button>
            </div>
          </div>

          {/* Grid Layout: Left Column (Plans + UPI QR) | Right Column (Hardware ID + Offline Key) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left 7 Columns: Subscription Plans + PhonePe Merchant QR */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-blue-400" />
                  1. Select Subscription Plan
                </span>
                <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5" /> Instant Activation
                </span>
              </div>

              {/* 4 Plan Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {SUBSCRIPTION_PLANS.map((plan) => {
                  const isSelected = selectedPlan.id === plan.id;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setSelectedPlan(plan)}
                      className={`relative p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-blue-600/15 border-blue-500 shadow-md shadow-blue-900/30 ring-1 ring-blue-500'
                          : 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800 hover:border-slate-600'
                      }`}
                    >
                      {plan.featured && (
                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-xs whitespace-nowrap">
                          Best Value
                        </span>
                      )}
                      <div>
                        <p className="text-[11px] font-bold text-slate-300 leading-tight">
                          {plan.name}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {plan.duration}
                        </p>
                      </div>
                      <div className="mt-3">
                        <span className="text-lg font-black text-white">₹{plan.price}</span>
                        {isSelected && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 inline-block ml-1.5" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Dynamic PhonePe Merchant UPI QR Box */}
              <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-5 shadow-inner">
                {/* QR Code Container */}
                <div className="bg-white p-3 rounded-2xl shadow-xl flex-shrink-0 flex flex-col items-center justify-center border-2 border-slate-200">
                  <QRCodeSVG
                    value={upiLink}
                    size={140}
                    level="H"
                    includeMargin={false}
                  />
                  <span className="text-[10px] font-black tracking-wider text-slate-800 mt-1.5 uppercase">
                    PhonePe / UPI QR
                  </span>
                </div>

                {/* QR Instructions & WhatsApp Call-to-Action */}
                <div className="flex-1 flex flex-col gap-2.5 text-center sm:text-left">
                  <div className="inline-flex items-center justify-center sm:justify-start gap-1.5 text-xs font-bold text-white">
                    <span>Scan & Pay:</span>
                    <span className="text-base font-black text-emerald-400">₹{selectedPlan.price}</span>
                    <span className="text-[11px] text-slate-400 font-normal">({selectedPlan.name})</span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    Scan using <strong>PhonePe, Google Pay, Paytm, or BHIM</strong> to complete payment. Merchant UPI ID: <code className="bg-slate-800 px-1.5 py-0.5 rounded text-[11px] font-mono text-amber-300">{MERCHANT_UPI_ID}</code>
                  </p>

                  <div className="pt-2 flex flex-col items-center sm:items-start gap-2">
                    {/* WhatsApp Number directly ABOVE the green button */}
                    <div
                      onClick={handleCopyWhatsApp}
                      title="Click to copy WhatsApp Number"
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white transition-all cursor-pointer select-all"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs font-mono font-bold text-emerald-400 tracking-wide">{WHATSAPP_DISPLAY}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-200 font-semibold flex items-center gap-1">
                        {copiedWhatsApp ? '✓ Copied' : '📋 Copy'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleOpenWhatsApp}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/40 transition-all cursor-pointer whitespace-nowrap"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Send Screenshot on WhatsApp</span>
                      <ExternalLink className="w-3 h-3 opacity-80" />
                    </button>
                  </div>
                </div>
              </div>

            </div>

            {/* Right 5 Columns: Machine ID + Offline Key Verification */}
            <div className="lg:col-span-5 flex flex-col justify-between gap-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 sm:p-5">
              
              <div className="space-y-3 -mt-1">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  2. Your Machine ID
                </span>

                {/* Machine ID Display */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col gap-1.5 shadow-sm">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Hardware Bound ID:</span>
                    <span className="text-[10px] text-slate-400 font-normal">(Provide to Admin)</span>
                  </div>

                  <div className="flex items-center gap-2 bg-slate-950 border border-slate-800/80 rounded-lg p-2">
                    <input
                      type="text"
                      readOnly
                      value={machineId}
                      className="flex-1 bg-transparent text-xs font-mono font-bold text-amber-300 focus:outline-none select-all"
                    />
                    <button
                      type="button"
                      onClick={handleCopyMachineId}
                      className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 hover:text-white transition-colors flex items-center gap-1 cursor-pointer flex-shrink-0"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400 text-[11px]">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-slate-400" />
                          <span className="text-[11px]">Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Step 3: Offline Activation Key Form */}
                <form onSubmit={handleVerify} className="space-y-3 pt-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-blue-400" />
                    3. Enter Activation Key
                  </label>

                  <input
                    type="text"
                    value={activationKey}
                    onChange={(e) => {
                      setActivationKey(e.target.value.toUpperCase());
                      setErrorMessage('');
                    }}
                    placeholder="DCC-1M-XXXX-XXXX-XXXX-XXXX"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold tracking-wider text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all uppercase"
                    autoComplete="off"
                    spellCheck="false"
                  />

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={isVerifying || !activationKey.trim()}
                      className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-900/40 transition-all cursor-pointer"
                    >
                      {isVerifying ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Verifying...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4" />
                          <span>Verify & Unlock</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (onClose) onClose();
                        else if (window.electronAPI?.close) window.electronAPI.close();
                      }}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
                    >
                      Close
                    </button>
                  </div>

                  {/* Feedback Alerts */}
                  {errorMessage && (
                    <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center gap-2 text-rose-400 text-xs animate-shake">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {successMessage && (
                    <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center gap-2 text-emerald-400 text-xs">
                      <Check className="w-4 h-4 flex-shrink-0" />
                      <span>{successMessage}</span>
                    </div>
                  )}
                </form>
              </div>

              {/* Footer Note */}
              <div className="text-[11px] text-slate-400 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <span>Instant Offline + Online Cloud Sync</span>
                <span className="text-blue-400 font-semibold">24x7 Helpdesk Active</span>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
