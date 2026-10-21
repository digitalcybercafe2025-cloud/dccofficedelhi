import React, { useState, useEffect, useRef } from 'react';
import { Lock, Eye, EyeOff, KeyRound, AlertCircle, X, ShieldAlert } from 'lucide-react';

export default function PdfPasswordModal({
  isOpen,
  onSubmit,
  onCancel,
  errorMessage = '',
  isSubmitting = false,
  fileName = ''
}) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setShowPassword(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!password.trim() || isSubmitting) return;
    onSubmit(password.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs select-none">
      <div
        className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pdf-modal-title"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center shadow-2xs">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 id="pdf-modal-title" className="text-sm font-bold text-slate-800">
                Password Protected PDF
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                {fileName ? fileName : 'Document is encrypted with a password'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Helpful Aadhaar/Document Tip */}
          <div className="p-3 bg-blue-50/80 border border-blue-200/80 rounded-lg flex items-start gap-2.5 text-xs text-blue-900">
            <KeyRound className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold text-blue-800">Aadhaar Card Password Format:</p>
              <p className="text-[11px] text-blue-700 leading-relaxed">
                First <strong>4 letters</strong> of your name in <strong>CAPITAL</strong> letters + <strong>Year of Birth</strong> (YYYY).
              </p>
              <p className="text-[10px] text-blue-600 font-mono">
                Example: Name: <span className="font-semibold">AMIT</span>, Year: <span className="font-semibold">1995</span> &rarr; Password: <span className="font-semibold text-blue-900 bg-blue-100/70 px-1 py-0.2 rounded">AMIT1995</span>
              </p>
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Enter PDF Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password (e.g. AMIT1995)"
                disabled={isSubmitting}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10 font-mono placeholder:font-sans placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 focus:outline-hidden"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span className="font-medium text-[11px]">{errorMessage}</span>
            </div>
          )}

          {/* Modal Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!password.trim() || isSubmitting}
              className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-xs flex items-center gap-1.5 transition-all"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Unlocking...</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Unlock & Open</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
