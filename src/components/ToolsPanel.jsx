import React, { useState } from 'react';
import {
  Ruler,
  Crop,
  Palette,
  Sliders,
  FileText,
  AlignJustify,
  Type,
  Layers,
  Plus,
  HelpCircle
} from 'lucide-react';

export default function ToolsPanel({
  copies,
  onChangeCopies,
  onAddToPrintPreview,
  onOpenSizeModal,
  onOpenColorModal,
  onOpenSpacingModal,
  onToggleGuide,
  activeTool,
  setActiveTool
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

  return (
    <div className="flex flex-col mt-3 pt-3 border-t border-slate-200">
      {/* Title */}
      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
        Tools & Adjustments
      </h3>

      {/* 2x4 Tools Grid */}
      <div className="grid grid-cols-4 gap-1.5 mb-3">
        {/* Size */}
        <button
          onClick={onOpenSizeModal}
          className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg border text-[11px] font-medium transition-all ${
            activeTool === 'size'
              ? 'bg-blue-50 border-blue-500 text-blue-600'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Ruler className="w-4 h-4 mb-1 text-slate-600" />
          <span>Size</span>
        </button>

        {/* Position */}
        <button
          onClick={() => setActiveTool(activeTool === 'position' ? null : 'position')}
          className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg border text-[11px] font-medium transition-all ${
            activeTool === 'position'
              ? 'bg-blue-50 border-blue-500 text-blue-600'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Crop className="w-4 h-4 mb-1 text-slate-600" />
          <span>Position</span>
        </button>

        {/* Color */}
        <button
          onClick={onOpenColorModal}
          className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg border text-[11px] font-medium transition-all ${
            activeTool === 'color'
              ? 'bg-blue-50 border-blue-500 text-blue-600'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Palette className="w-4 h-4 mb-1 text-slate-600" />
          <span>Color</span>
        </button>

        {/* Retouch */}
        <button
          onClick={onOpenColorModal}
          className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg border text-[11px] font-medium transition-all ${
            activeTool === 'retouch'
              ? 'bg-blue-50 border-blue-500 text-blue-600'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Sliders className="w-4 h-4 mb-1 text-slate-600" />
          <span>Retouch</span>
        </button>

        {/* Sheet */}
        <button
          onClick={onOpenSpacingModal}
          className="flex flex-col items-center justify-center py-2 px-1 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-[11px] font-medium transition-all"
        >
          <FileText className="w-4 h-4 mb-1 text-slate-600" />
          <span>Sheet</span>
        </button>

        {/* Spacing */}
        <button
          onClick={onOpenSpacingModal}
          className="flex flex-col items-center justify-center py-2 px-1 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-[11px] font-medium transition-all"
        >
          <AlignJustify className="w-4 h-4 mb-1 text-slate-600" />
          <span>Spacing</span>
        </button>

        {/* Identify */}
        <button
          onClick={onToggleGuide}
          className="flex flex-col items-center justify-center py-2 px-1 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-[11px] font-medium transition-all"
        >
          <Type className="w-4 h-4 mb-1 text-slate-600" />
          <span>Identify</span>
        </button>

        {/* Multi-Photo */}
        <button
          onClick={() => {}}
          className="flex flex-col items-center justify-center py-2 px-1 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-[11px] font-medium transition-all"
        >
          <Layers className="w-4 h-4 mb-1 text-slate-600" />
          <span>Multi-Photo</span>
        </button>
      </div>

      {/* Main Action Button */}
      <button
        onClick={onAddToPrintPreview}
        className="w-full py-2.5 px-3 bg-[#1677ff] hover:bg-[#0958d9] text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 shadow-sm shadow-blue-500/20 active:scale-[0.99] transition-all mb-4"
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
              onClick={() => {
                setShowCustomInput(false);
                onChangeCopies(val);
              }}
              className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
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
          onClick={() => setShowCustomInput(true)}
          className={`w-16 py-1 text-xs font-medium rounded-lg border transition-all ${
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
            className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => setShowCustomInput(false)}
            className="text-xs text-slate-400 hover:text-slate-600 px-1"
          >
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}
