import React, { useRef } from 'react';
import { Trash2, Plus, Check } from 'lucide-react';

export default function CustomerQueue({
  customers,
  activeCustomerId,
  onSelectCustomer,
  onDeleteCustomer,
  onAddCustomer
}) {
  const fileInputRef = useRef(null);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      onAddCustomer(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAddNewSlot = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    } else if (onAddCustomer) {
      onAddCustomer();
    }
  };

  return (
    <div className="flex flex-col">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-1.5">
          <span>Customer Queue</span>
          <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
            {customers.length}
          </span>
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={handleAddNewSlot}
            title="Add Customer Photo (New +)"
            className="p-1 rounded text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => activeCustomerId && onDeleteCustomer(activeCustomerId)}
            title="Delete Active Customer"
            className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Grid: Exactly 4 columns per row */}
      <div className="grid grid-cols-4 gap-1.5 max-h-[300px] overflow-y-auto pr-0.5 pb-1">
        {customers.map((c, index) => {
          const isActive = c.id === activeCustomerId;
          return (
            <div
              key={c.id}
              onClick={() => onSelectCustomer(c.id)}
              className={`group relative flex flex-col items-center p-1 rounded-xl border-2 cursor-pointer transition-all ${
                isActive
                  ? 'bg-blue-50/90 border-[#1677ff] shadow-md ring-2 ring-blue-400/40'
                  : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50 shadow-xs'
              }`}
            >
              {/* Customer ID badge */}
              <span
                className={`absolute top-0.5 right-0.5 text-[8px] font-bold px-1 rounded shadow-xs ${
                  isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {c.code || `C${index + 1}`}
              </span>

              {/* Action buttons on hover */}
              <div className="absolute top-0.5 left-0.5 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity z-10">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteCustomer(c.id);
                  }}
                  title="Delete Customer"
                  className="p-0.5 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-xs transition-colors"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>

              {/* Photo Thumbnail */}
              <div
                className={`w-10 h-12 rounded-lg overflow-hidden bg-slate-100 border mb-1 flex items-center justify-center transition-all ${
                  isActive ? 'border-blue-500 ring-1 ring-blue-400' : 'border-slate-200'
                }`}
              >
                <img
                  src={c.image}
                  alt={c.name}
                  className="w-full h-full object-cover pointer-events-none"
                />
              </div>

              {/* Details */}
              <span
                className={`text-[9px] font-semibold leading-tight truncate w-full text-center ${
                  isActive ? 'text-blue-900 font-bold' : 'text-slate-700'
                }`}
              >
                Photo {index + 1}
              </span>
              <span className="text-[8px] text-slate-500 font-medium leading-tight">
                {c.copies} copies
              </span>

              {/* Small Active Checkmark */}
              {isActive && (
                <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <Check className="w-2 h-2 stroke-[3]" />
                </div>
              )}
            </div>
          );
        })}

        {/* 1 "New +" action button in the 4-column row */}
        <button
          onClick={handleAddNewSlot}
          className="flex flex-col items-center justify-center p-1 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/60 transition-all text-slate-500 hover:text-blue-600 min-h-[85px] group cursor-pointer"
          title="Add Customer Photo (New +)"
        >
          <div className="w-6 h-6 rounded-full bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center mb-1 transition-colors">
            <Plus className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-600" />
          </div>
          <span className="text-[10px] font-bold text-slate-700 group-hover:text-blue-600">New +</span>
        </button>
      </div>
    </div>
  );
}
