import React from 'react';
import { X, Check } from 'lucide-react';

const PRESETS = [
  { id: 'in_passport', name: 'Indian Passport / Police Clearance', widthMm: 35, heightMm: 45, desc: '3.5 x 4.5 cm (Standard)' },
  { id: 'in_pan', name: 'PAN Card / Voter ID', widthMm: 25, heightMm: 35, desc: '2.5 x 3.5 cm' },
  { id: 'us_visa', name: 'US / Schengen Visa', widthMm: 51, heightMm: 51, desc: '2 x 2 inches (5.1 x 5.1 cm)' },
  { id: 'stamp_size', name: 'Stamp Size Photo', widthMm: 20, heightMm: 25, desc: '2.0 x 2.5 cm' },
  { id: 'custom', name: 'Custom Dimension', widthMm: 35, heightMm: 45, desc: 'User defined size' }
];

export default function SizeModal({ isOpen, onClose, selectedSize, onSelectSize }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-800">Passport Photo Size</h3>
            <p className="text-xs text-slate-500">Choose official standard dimension</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Presets List */}
        <div className="p-5 space-y-2.5">
          {PRESETS.map((p) => {
            const isSelected = selectedSize?.id === p.id;
            return (
              <div
                key={p.id}
                onClick={() => {
                  onSelectSize(p);
                  onClose();
                }}
                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500 shadow-xs'
                    : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                }`}
              >
                <div>
                  <h4 className="text-xs font-bold text-slate-800">{p.name}</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">{p.desc}</p>
                </div>
                {isSelected && (
                  <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
