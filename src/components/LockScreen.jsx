import React, { useState } from 'react';
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
  X
} from 'lucide-react';

export default function LockScreen({
  licenseStatus,
  onClose,
  onUnlockSuccess,
  onRefreshStatus
}) {
  const [activationKey, setActivationKey] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const machineId = licenseStatus?.machineId || 'FETCHING-HARDWARE-ID...';
  const whatsappNumber = '+91 87663 24178';
  const cleanNumber = '918766324178';

  const isBlocked = licenseStatus?.isBlocked;
  const isOfflineCheckRequired = licenseStatus?.isOfflineCheckRequired;

  const handleCopy = () => {
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
      `Hello Digital Cyber Cafe, I want to activate my Passport Maker software.\n\nMy Machine ID: ${machineId}\n\nAttached is my payment screenshot.`
    );
    const url = `https://wa.me/${cleanNumber}?text=${text}`;
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
        // Fallback validation for browser mode
        setErrorMessage('Verification is supported in the Desktop Application.');
      }
    } catch (err) {
      setErrorMessage('Verification error: ' + err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-900 text-slate-100 select-none overflow-hidden font-sans">
      {/* Top Custom Frameless Header for Desktop Window Controls */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950/80 border-b border-slate-800/80 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center font-bold text-[11px] text-white shadow-xs">
            D
          </div>
          <span className="font-bold tracking-wide text-slate-200">
            Digital Cyber Cafe — License & Activation
          </span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
            v2.0.2 Locked
          </span>
        </div>

        {/* Window Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => window.electronAPI?.minimize?.()}
            className="w-7 h-6 flex items-center justify-center rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => window.electronAPI?.maximize?.()}
            className="w-7 h-6 flex items-center justify-center rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Maximize"
          >
            <Square className="w-3 h-3" />
          </button>
          <button
            onClick={() => {
              if (onClose) onClose();
              else window.electronAPI?.close?.();
            }}
            className="w-7 h-6 flex items-center justify-center rounded hover:bg-red-600 text-slate-400 hover:text-white transition-colors"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Lock Screen Card Area */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
        <div className="relative w-full max-w-xl bg-slate-800/90 border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-md p-7 sm:p-8 flex flex-col gap-6">
          
          {/* Individual Close / Cut Button for Popup */}
          <button
            type="button"
            onClick={() => {
              if (onClose) onClose();
              else if (window.electronAPI?.close) window.electronAPI.close();
            }}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-700/70 hover:bg-rose-600/90 border border-slate-600/70 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-md active:scale-95 group z-10"
            title="Close (कट / बंद करें)"
          >
            <X className="w-4 h-4 transition-transform group-hover:scale-110" />
          </button>
          
          {/* Header & Status Alert */}
          <div className="flex items-start gap-4">
            <div className="w-13 h-13 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0 text-amber-400 shadow-inner">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div className="flex-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30 mb-1.5">
                <Lock className="w-3 h-3" />
                <span>
                  {isBlocked
                    ? 'Access Suspended'
                    : isOfflineCheckRequired
                    ? 'Security Check'
                    : 'Trial Period Ended'}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug">
                {isBlocked
                  ? 'Software Access Suspended'
                  : isOfflineCheckRequired
                  ? 'Internet Verification Required'
                  : 'Your 21-Day Free Trial Has Expired'}
              </h1>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                {isBlocked
                  ? 'Your machine ID has been restricted by the administrator. Please contact support.'
                  : isOfflineCheckRequired
                  ? 'Your system has been offline for over 5 days. Please connect to the internet to verify your trial status, or enter an offline activation key.'
                  : 'Thank you for using Digital Cyber Cafe. To continue using Passport & ID Card Studio without interruption, please activate your software with a valid license key.'}
              </p>
            </div>
          </div>

          {/* Step 1: Hardware Machine ID Display */}
          <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-4 flex flex-col gap-2 shadow-inner">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
              <span className="tracking-wider uppercase flex items-center gap-1.5 text-indigo-400">
                <Sparkles className="w-3.5 h-3.5" />
                Your Unique Machine ID
              </span>
              <span className="text-[10px] text-slate-400 font-normal">
                (Hardware Bound)
              </span>
            </div>

            <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 rounded-lg p-2.5">
              <code className="flex-1 font-mono text-xs sm:text-sm font-bold text-emerald-400 select-all tracking-wider break-all">
                {machineId}
              </code>
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-all flex-shrink-0 active:scale-95"
                title="Copy Machine ID"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>Copy ID</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Step 2: WhatsApp Instructions & Quick Action */}
          <div className="bg-gradient-to-r from-emerald-950/40 to-slate-900/60 border border-emerald-800/40 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div className="text-xs">
                <p className="font-semibold text-slate-200 leading-snug">
                  Please send this Machine ID along with your payment screenshot to WhatsApp:
                </p>
                <p className="font-bold text-emerald-400 text-sm mt-0.5">
                  {whatsappNumber}
                </p>
              </div>
            </div>

            <button
              onClick={handleOpenWhatsApp}
              className="w-full sm:w-auto px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-900/40 transition-all flex-shrink-0 whitespace-nowrap"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Send via WhatsApp</span>
              <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
            </button>
          </div>

          {/* Step 3: Activation Key Input Form */}
          <form onSubmit={handleVerify} className="flex flex-col gap-3">
            <label className="text-xs font-bold text-slate-300 tracking-wide uppercase flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-blue-400" />
              <span>Enter Activation Key</span>
            </label>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={activationKey}
                onChange={(e) => {
                  setActivationKey(e.target.value.toUpperCase());
                  setErrorMessage('');
                }}
                placeholder="DCC-12M-XXXX-XXXX-XXXX-XXXX"
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold tracking-wider text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                autoComplete="off"
                spellCheck="false"
              />

              <button
                type="submit"
                disabled={isVerifying || !activationKey.trim()}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-900/40 transition-all whitespace-nowrap cursor-pointer"
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
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 active:scale-95 text-slate-300 hover:text-white text-xs font-bold transition-all whitespace-nowrap cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center gap-2 text-rose-400 text-xs animate-shake">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Success Message */}
            {successMessage && (
              <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center gap-2 text-emerald-400 text-xs">
                <Check className="w-4 h-4 flex-shrink-0" />
                <span>{successMessage} Unlocking workspace...</span>
              </div>
            )}
          </form>

          {/* Footer Info */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-3 border-t border-slate-700/60">
            <span>Official Offline Cryptographic Activation</span>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="hover:text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh licensing status from cloud"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
              <span>{isRefreshing ? 'Checking...' : 'Refresh Status'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
