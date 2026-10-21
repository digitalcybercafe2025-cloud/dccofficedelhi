import React, { useState } from 'react';
import { X, Sun, Contrast, Sparkles, RefreshCw, Loader2 } from 'lucide-react';
import { adjustImage, removeBackground } from '../../utils/api';

const BG_COLORS = [
  { name: 'Passport Blue', hex: '#2b7fff' },
  { name: 'Sky Blue', hex: '#38bdf8' },
  { name: 'Pure White', hex: '#ffffff' },
  { name: 'Studio Grey', hex: '#e2e8f0' },
  { name: 'Crimson Red', hex: '#dc2626' },
  { name: 'Transparent', hex: 'transparent' }
];

export default function ColorAdjustModal({
  isOpen,
  onClose,
  activeCustomer,
  onUpdateImage
}) {
  const [brightness, setBrightness] = useState(1.0);
  const [contrast, setContrast] = useState(1.0);
  const [sharpness, setSharpness] = useState(1.0);
  const [color, setColor] = useState(1.0);
  const [selectedBg, setSelectedBg] = useState('#2b7fff');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen || !activeCustomer) return null;

  const handleApplyColorChange = async (bgColor) => {
    setSelectedBg(bgColor);
    setIsProcessing(true);
    try {
      const result = await removeBackground(activeCustomer.image, bgColor);
      onUpdateImage(result);
    } catch (err) {
      alert('Error updating background: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyAdjustments = async () => {
    setIsProcessing(true);
    try {
      const result = await adjustImage(activeCustomer.image, {
        brightness,
        contrast,
        sharpness,
        color
      });
      onUpdateImage(result);
      onClose();
    } catch (err) {
      alert('Error adjusting image: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setBrightness(1.0);
    setContrast(1.0);
    setSharpness(1.0);
    setColor(1.0);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-800">Color & Retouch Adjustments</h3>
            <p className="text-xs text-slate-500">Fast photo enhancement for clear printing</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Background Color Picker */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-2">
              Background Color Preset
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {BG_COLORS.map((c) => (
                <button
                  key={c.name}
                  onClick={() => handleApplyColorChange(c.hex)}
                  disabled={isProcessing}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all ${
                    selectedBg === c.hex
                      ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-2xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-slate-300"
                    style={{
                      backgroundColor: c.hex === 'transparent' ? '#fff' : c.hex,
                      backgroundImage: c.hex === 'transparent' ? 'linear-gradient(45deg, #ddd 25%, transparent 25%, transparent 75%, #ddd 75%)' : 'none'
                    }}
                  />
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Sliders */}
          <div className="space-y-3">
            {/* Brightness */}
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span className="flex items-center gap-1"><Sun className="w-3.5 h-3.5 text-amber-500" /> Brightness</span>
                <span className="text-slate-500">{Math.round(brightness * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.05"
                value={brightness}
                onChange={(e) => setBrightness(parseFloat(e.target.value))}
                className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
              />
            </div>

            {/* Contrast */}
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span className="flex items-center gap-1"><Contrast className="w-3.5 h-3.5 text-slate-700" /> Contrast</span>
                <span className="text-slate-500">{Math.round(contrast * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.05"
                value={contrast}
                onChange={(e) => setContrast(parseFloat(e.target.value))}
                className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
              />
            </div>

            {/* Sharpness */}
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span className="flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 text-blue-500" /> Sharpness & Clarity</span>
                <span className="text-slate-500">{Math.round(sharpness * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={sharpness}
                onChange={(e) => setSharpness(parseFloat(e.target.value))}
                className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
              />
            </div>

            {/* Saturation */}
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span>Color Saturation</span>
                <span className="text-slate-500">{Math.round(color * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.05"
                value={color}
                onChange={(e) => setColor(parseFloat(e.target.value))}
                className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Sliders</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleApplyAdjustments}
              disabled={isProcessing}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm shadow-blue-500/20"
            >
              {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Apply Adjustments</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
