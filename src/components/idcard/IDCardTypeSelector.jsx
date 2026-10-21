import React from 'react';

export default function IDCardTypeSelector({ selectedType, onSelectType }) {
  const cardTypes = [
    { id: 'pan', label: 'PAN Card' },
    { id: 'aadhaar', label: 'Aadhaar Card' },
    { id: 'ayushman', label: 'Ayushman Card' },
    { id: 'dl', label: 'Driving License' },
    { id: 'ration', label: 'Ration Card' },
    { id: 'voter', label: 'Voter ID Card' },
    { id: 'other', label: 'Other ID Card' },
    { id: 'special', label: 'Special Card' }
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-3.5 mb-3">
      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5">
        ID Card Type
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {cardTypes.map((type, idx) => {
          const isSelected = selectedType === type.id;
          const isLastOdd = idx === cardTypes.length - 1 && cardTypes.length % 2 !== 0;
          return (
            <button
              key={type.id}
              type="button"
              onClick={() => onSelectType(type.id)}
              className={`p-2 text-xs font-semibold rounded-md border text-center transition-all cursor-pointer select-none ${
                isLastOdd ? 'col-span-2' : ''
              } ${
                isSelected
                  ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold shadow-2xs'
                  : 'border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {type.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
