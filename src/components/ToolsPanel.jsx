import React, { useState } from 'react';
import {
  Ruler,
  Palette,
  Type,
  Plus,
  HelpCircle,
  Sparkles,
  SlidersHorizontal,
  RotateCcw
} from 'lucide-react';

export default function ToolsPanel({
  copies,
  onChangeCopies,
  onAddToPrintPreview,
  onOpenSizeModal,
  onOpenColorModal,
  onToggleAddText,
  isAddTextActive = false,
  adjustments = { brightness: 100, contrast: 100, saturation: 100, beauty: false },
  onChangeAdjustments
}) {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customValue, setCustomValue] = useState(copies);

  const presetSizes = [6, 12, 18, 24];

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    const val = parseInt(customValue, 10);
    if (!isNaN(val) && val > 0 && val <= 36) {
      onChangeCopies(val);
      setShowCustomInput(false);
    }
  };

  const handleSliderChange = (key, value) => {
    if (onChangeAdjustments) {
      onChangeAdjustments({
        ...adjustments,
        [key]: parseFloat(value) || 0
      });
    }
  };

  const handleStepChange = (key, delta) => {
    if (!onChangeAdjustments) return;
    const min = key === 'saturation' ? 0 : 40;
    const max = key === 'saturation' ? 200 : 160;
    const current = adjustments[key] ?? 100;
    const next = Math.max(min, Math.min(max, current + delta));
    onChangeAdjustments({
      ...adjustments,
      [key]: next
    });
  };

  const handleToggleBeauty = () => {
    if (!onChangeAdjustments) return;
    onChangeAdjustments({
      ...adjustments,
      beauty: !adjustments.beauty
    });
  };

  const handleResetAdjustments = () => {
    if (!onChangeAdjustments) return;
    onChangeAdjustments({
      brightness: 100,
      contrast: 100,
      saturation: 100,
      beauty: false
    });
  };

  return (
    <div className="flex flex-col mt-2.5 pt-2.5 border-t border-slate-200">
      {/* Title */}
      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
        Tools & Adjustments
      </h3>

      {/* Primary Tools: Size, Color, Add Text (Retouch, Sheet, Spacing, Multi-photo, Position removed) */}
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        {/* Size */}
        <button
          type="button"
          onClick={onOpenSizeModal}
          className="flex flex-col items-center justify-center py-2 px-1 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 text-[11px] font-semibold transition-all cursor-pointer shadow-2xs"
          title="Passport / Stamp / Custom Size"
        >
          <Ruler className="w-4 h-4 mb-1 text-blue-600" />
          <span>Size</span>
        </button>

        {/* Color */}
        <button
          type="button"
          onClick={onOpenColorModal}
          className="flex flex-col items-center justify-center py-2 px-1 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 text-[11px] font-semibold transition-all cursor-pointer shadow-2xs"
          title="Background & Color Calibration"
        >
          <Palette className="w-4 h-4 mb-1 text-indigo-600" />
          <span>Color</span>
        </button>

        {/* Add Text (Renamed from Identify) */}
        <button
          type="button"
          onClick={onToggleAddText}
          className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer shadow-2xs ${
            isAddTextActive
              ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold ring-1 ring-blue-400'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300'
          }`}
          title="Append Name and DOB bottom box to photo"
        >
          <Type className={`w-4 h-4 mb-1 ${isAddTextActive ? 'text-blue-600' : 'text-slate-600'}`} />
          <span>Add Text</span>
        </button>
      </div>

      {/* Adjustments Section (Brightness, Contrast, Saturation sliders & Beauty toggle) */}
      <div className="border border-slate-200 bg-slate-50/70 rounded-xl p-2.5 mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
            <SlidersHorizontal className="w-3 h-3 text-blue-600" />
            Photo Adjustments
          </span>
          <button
            type="button"
            onClick={handleResetAdjustments}
            className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer flex items-center gap-0.5"
            title="Reset brightness, contrast and saturation to 100%"
          >
            <RotateCcw className="w-2.5 h-2.5" />
            <span>Reset</span>
          </button>
        </div>

        {/* Beauty Toggle Button */}
        <button
          type="button"
          onClick={handleToggleBeauty}
          className={`w-full py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer shadow-2xs mb-2.5 ${
            adjustments.beauty
              ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 text-white border-purple-500 shadow-md ring-1 ring-purple-300'
              : 'bg-white text-purple-700 border-purple-200 hover:bg-purple-50'
          }`}
          title="Toggle Beauty skin tone & facial illumination"
        >
          <Sparkles className={`w-3.5 h-3.5 ${adjustments.beauty ? 'text-amber-300 animate-pulse' : 'text-amber-500'}`} />
          <span>{adjustments.beauty ? '✨ Beauty Active' : '✨ Beauty'}</span>
        </button>

        {/* Brightness Slider with Steppers & Number */}
        <div className="mb-2">
          <div className="flex justify-between items-center text-[10px] font-bold text-slate-600 mb-1">
            <span>Brightness</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleStepChange('brightness', -2)}
                className="w-4 h-4 flex items-center justify-center bg-white border border-slate-200 hover:bg-blue-50 rounded text-slate-700 cursor-pointer active:scale-95 text-[10px]"
              >
                -
              </button>
              <span className="text-blue-600 font-mono w-9 text-center">
                {adjustments.brightness ?? 100}%
              </span>
              <button
                type="button"
                onClick={() => handleStepChange('brightness', 2)}
                className="w-4 h-4 flex items-center justify-center bg-white border border-slate-200 hover:bg-blue-50 rounded text-slate-700 cursor-pointer active:scale-95 text-[10px]"
              >
                +
              </button>
            </div>
          </div>
          <input
            type="range"
            min="40"
            max="160"
            value={adjustments.brightness ?? 100}
            onChange={(e) => handleSliderChange('brightness', e.target.value)}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>

        {/* Contrast Slider with Steppers & Number */}
        <div className="mb-2">
          <div className="flex justify-between items-center text-[10px] font-bold text-slate-600 mb-1">
            <span>Contrast</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleStepChange('contrast', -2)}
                className="w-4 h-4 flex items-center justify-center bg-white border border-slate-200 hover:bg-blue-50 rounded text-slate-700 cursor-pointer active:scale-95 text-[10px]"
              >
                -
              </button>
              <span className="text-blue-600 font-mono w-9 text-center">
                {adjustments.contrast ?? 100}%
              </span>
              <button
                type="button"
                onClick={() => handleStepChange('contrast', 2)}
                className="w-4 h-4 flex items-center justify-center bg-white border border-slate-200 hover:bg-blue-50 rounded text-slate-700 cursor-pointer active:scale-95 text-[10px]"
              >
                +
              </button>
            </div>
          </div>
          <input
            type="range"
            min="40"
            max="160"
            value={adjustments.contrast ?? 100}
            onChange={(e) => handleSliderChange('contrast', e.target.value)}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>

        {/* Saturation Slider with Steppers & Number */}
        <div>
          <div className="flex justify-between items-center text-[10px] font-bold text-slate-600 mb-1">
            <span>Saturation</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleStepChange('saturation', -5)}
                className="w-4 h-4 flex items-center justify-center bg-white border border-slate-200 hover:bg-blue-50 rounded text-slate-700 cursor-pointer active:scale-95 text-[10px]"
              >
                -
              </button>
              <span className="text-blue-600 font-mono w-9 text-center">
                {adjustments.saturation ?? 100}%
              </span>
              <button
                type="button"
                onClick={() => handleStepChange('saturation', 5)}
                className="w-4 h-4 flex items-center justify-center bg-white border border-slate-200 hover:bg-blue-50 rounded text-slate-700 cursor-pointer active:scale-95 text-[10px]"
              >
                +
              </button>
            </div>
          </div>
          <input
            type="range"
            min="0"
            max="200"
            value={adjustments.saturation ?? 100}
            onChange={(e) => handleSliderChange('saturation', e.target.value)}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>
      </div>

      {/* Main Action Button */}
      <button
        type="button"
        onClick={onAddToPrintPreview}
        className="w-full py-2.5 px-3 bg-[#1677ff] hover:bg-[#0958d9] text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 shadow-sm shadow-blue-500/20 active:scale-[0.99] transition-all mb-3.5 cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        <span>+ Add to Print Preview</span>
      </button>

      {/* SIZE TO APPLY */}
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Size to Apply
        </span>
        <button
          type="button"
          title="Number of passport photo copies to add onto sheet"
          className="text-slate-400 hover:text-slate-600"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Preset Pill Grid: 6, 12, 18, 24 */}
      <div className="grid grid-cols-4 gap-1.5 mb-2">
        {presetSizes.map((val) => {
          const isSelected = copies === val && !showCustomInput;
          return (
            <button
              key={val}
              type="button"
              onClick={() => {
                setShowCustomInput(false);
                onChangeCopies(val);
              }}
              className={`py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#1677ff] border-[#1677ff] text-white shadow-xs'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
              }`}
            >
              {val}
            </button>
          );
        })}
      </div>

      {/* Custom Button */}
      {!showCustomInput ? (
        <button
          type="button"
          onClick={() => setShowCustomInput(true)}
          className={`w-16 py-1 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
            !presetSizes.includes(copies)
              ? 'bg-[#1677ff] border-[#1677ff] text-white font-bold'
              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
          }`}
        >
          {!presetSizes.includes(copies) ? `${copies} pcs` : 'Custom'}
        </button>
      ) : (
        <form onSubmit={handleCustomSubmit} className="flex items-center gap-1.5">
          <input
            type="number"
            min="1"
            max="36"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            className="w-16 px-2 py-1 text-xs border border-blue-500 rounded-lg text-slate-800 font-bold focus:outline-none"
            placeholder="Qty"
            autoFocus
          />
          <button
            type="submit"
            className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 cursor-pointer"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => setShowCustomInput(false)}
            className="text-xs text-slate-400 hover:text-slate-600 px-1 cursor-pointer"
          >
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}
