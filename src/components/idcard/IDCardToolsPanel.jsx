import React from 'react';
import { Scan, Type, RotateCw, SlidersHorizontal, Sparkles, Zap, RotateCcw } from 'lucide-react';

export default function IDCardToolsPanel({
  activeTool,
  setActiveTool,
  onAddText,
  onRotate,
  adjustments,
  onChangeAdjustments,
  hasSelection
}) {
  const handleSliderChange = (key, value) => {
    onChangeAdjustments({
      ...adjustments,
      [key]: parseFloat(value) || 0
    });
  };

  const handleStepChange = (key, delta) => {
    const min = key === 'saturation' ? 0 : 40;
    const max = key === 'saturation' ? 200 : 160;
    const current = adjustments[key] ?? 100;
    const next = Math.max(min, Math.min(max, current + delta));
    onChangeAdjustments({
      ...adjustments,
      [key]: next
    });
  };

  const handleApplyBeautify = () => {
    onChangeAdjustments({
      brightness: 118,
      contrast: 112,
      saturation: 110,
      beautify: true,
      autoCorrect: false
    });
  };

  const handleApplyAutoCorrect = () => {
    onChangeAdjustments({
      brightness: 112,
      contrast: 120,
      saturation: 105,
      beautify: false,
      autoCorrect: true
    });
  };

  const handleResetAdjustments = () => {
    onChangeAdjustments({
      brightness: 100,
      contrast: 100,
      saturation: 100,
      beautify: false,
      autoCorrect: false
    });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-3.5 flex flex-col justify-between">
      <div>
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5">
          Advanced Tools
        </h3>

        {/* Tools Button Row */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {/* Select Area Tool */}
          <button
            type="button"
            onClick={() => setActiveTool(activeTool === 'select' ? null : 'select')}
            className={`flex flex-col items-center justify-center p-2 rounded-md border transition-all cursor-pointer select-none ${
              activeTool === 'select'
                ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold shadow-2xs'
                : 'border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
            title="Draw marquee over ID photo for local enhancement"
          >
            <Scan className="w-4 h-4 mb-1" />
            <span className="text-xs font-semibold text-center leading-tight">
              Select Area
            </span>
          </button>

          {/* Add Text Tool */}
          <button
            type="button"
            onClick={onAddText}
            className="flex flex-col items-center justify-center p-2 rounded-md border border-slate-200 hover:border-blue-400 text-slate-700 hover:text-blue-600 hover:bg-slate-50 transition-all cursor-pointer select-none"
            title="Add draggable text like mobile number or UID"
          >
            <Type className="w-4 h-4 mb-1" />
            <span className="text-xs font-semibold text-center leading-tight">
              Add Text
            </span>
          </button>

          {/* Rotate Tool */}
          <button
            type="button"
            onClick={onRotate}
            className="flex flex-col items-center justify-center p-2 rounded-md border border-slate-200 hover:border-blue-400 text-slate-700 hover:text-blue-600 hover:bg-slate-50 transition-all cursor-pointer select-none"
            title="Rotate 90 degrees"
          >
            <RotateCw className="w-4 h-4 mb-1" />
            <span className="text-xs font-semibold text-center leading-tight">
              Rotate
            </span>
          </button>
        </div>

        {/* Selected Area Adjustments Section */}
        <div className="border border-blue-100 bg-blue-50/40 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-blue-700 flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3 text-blue-600" />
              Selected Photo Adjustments
            </span>
            <button
              type="button"
              onClick={handleResetAdjustments}
              className="text-[10px] text-blue-600 hover:underline font-semibold cursor-pointer"
            >
              Reset
            </button>
          </div>

          <p className="text-[10px] text-slate-500 mb-2.5 leading-tight">
            {hasSelection
              ? 'Filters apply strictly to the selected photo marquee.'
              : 'Draw a marquee box on card to isolate enhancement.'}
          </p>

          {/* 1-Click Quick Enhancements: Beautify & Auto Correct */}
          <div className="grid grid-cols-2 gap-1.5 mb-3">
            <button
              type="button"
              onClick={handleApplyBeautify}
              className={`px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 border transition-all cursor-pointer shadow-2xs ${
                adjustments.beautify
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-purple-500'
                  : 'bg-white text-purple-700 border-purple-200 hover:bg-purple-50'
              }`}
              title="Skin tone balance & face glow illumination"
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>✨ Beautify Photo</span>
            </button>

            <button
              type="button"
              onClick={handleApplyAutoCorrect}
              className={`px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 border transition-all cursor-pointer shadow-2xs ${
                adjustments.autoCorrect
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white border-blue-500'
                  : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
              }`}
              title="Auto contrast & clarity level correction"
            >
              <Zap className="w-3 h-3 text-amber-500" />
              <span>⚡ Auto Correct</span>
            </button>
          </div>

          {/* Brightness Slider with Steppers & Number */}
          <div className="mb-2.5">
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
                  {adjustments.brightness}%
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
              value={adjustments.brightness}
              onChange={(e) => handleSliderChange('brightness', e.target.value)}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          {/* Contrast Slider with Steppers & Number */}
          <div className="mb-2.5">
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
                  {adjustments.contrast}%
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
              value={adjustments.contrast}
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
                  {adjustments.saturation}%
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
              value={adjustments.saturation}
              onChange={(e) => handleSliderChange('saturation', e.target.value)}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
