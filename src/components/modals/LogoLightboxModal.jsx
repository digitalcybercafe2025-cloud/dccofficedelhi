import React from 'react';
import { X, Phone, MapPin, Check, Copy, ExternalLink, Sparkles, Monitor, Code, Globe, Smartphone, Wrench } from 'lucide-react';

export default function LogoLightboxModal({ isOpen, onClose }) {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  const handleCopyPhone = () => {
    navigator.clipboard.writeText('9911423881');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const services = [
    { icon: Monitor, label: 'Cyber Cafe Services', color: 'from-blue-500 to-cyan-500' },
    { icon: Code, label: 'Software Development', color: 'from-indigo-500 to-purple-500' },
    { icon: Globe, label: 'Website Development', color: 'from-emerald-500 to-teal-500' },
    { icon: Smartphone, label: 'Mobile App Development', color: 'from-amber-500 to-orange-500' },
    { icon: Wrench, label: 'Technical Support', color: 'from-rose-500 to-pink-500' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 select-none no-print"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-amber-400/30 rounded-3xl p-6 shadow-2xl shadow-blue-900/40 text-white overflow-hidden transform transition-all animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative Ambient Background Glows */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all cursor-pointer z-10"
          title="Close Lightbox (Esc)"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Center Enlarged Circular Neon Badge Logo */}
        <div className="flex flex-col items-center text-center">
          <div className="relative group p-1.5 rounded-full bg-gradient-to-tr from-amber-400 via-cyan-400 to-blue-600 shadow-xl shadow-amber-500/20 mb-4 animate-in zoom-in duration-300">
            <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-full overflow-hidden bg-slate-950 flex items-center justify-center border-2 border-slate-900">
              <img
                src="/1000692542.png"
                alt="Digital Cyber Cafe"
                className="w-full h-full object-contain transform transition-transform duration-300 group-hover:scale-105"
              />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 p-1.5 rounded-full shadow-lg">
              <Sparkles className="w-4 h-4 fill-slate-950" />
            </div>
          </div>

          {/* Company Title & Subtitle */}
          <h2 className="text-xl sm:text-2xl font-black tracking-wide bg-gradient-to-r from-amber-200 via-amber-400 to-cyan-300 bg-clip-text text-transparent">
            DIGITAL CYBER CAFE
          </h2>
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300/90 mt-0.5">
            Software Innovations &amp; Developments
          </p>

          {/* Contact Bar: Phone & Location */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5 w-full">
            <button
              onClick={handleCopyPhone}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600/30 to-blue-500/20 border border-blue-400/40 hover:border-blue-400 text-white font-bold text-sm shadow-md hover:bg-blue-600/40 transition-all cursor-pointer group"
              title="Click to copy contact number"
            >
              <Phone className="w-4 h-4 text-cyan-300 group-hover:rotate-12 transition-transform" />
              <span>+91 9911423881</span>
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400 ml-1" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-white ml-1" />
              )}
            </button>

            <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-200 font-semibold text-xs">
              <MapPin className="w-4 h-4 text-rose-400" />
              <span>New Delhi, India</span>
            </div>
          </div>

          {/* Service Offerings Grid */}
          <div className="w-full mt-5 pt-4 border-t border-white/10">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
              Professional IT &amp; Cyber Services
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-left">
              {services.map((s, idx) => {
                const IconComponent = s.icon;
                return (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/5 hover:border-white/20 transition-all"
                  >
                    <div className={`p-1.5 rounded-lg bg-gradient-to-br ${s.color} text-white shrink-0`}>
                      <IconComponent className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[11px] font-medium text-slate-200 leading-tight">
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Note */}
          <p className="text-[10px] text-slate-400 mt-4">
            Click anywhere outside this window to return to the application
          </p>
        </div>
      </div>
    </div>
  );
}
