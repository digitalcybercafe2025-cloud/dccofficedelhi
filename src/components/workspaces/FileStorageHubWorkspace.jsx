import React from 'react';
import { FolderArchive } from 'lucide-react';

export default function FileStorageHubWorkspace() {
  return (
    <main className="flex-1 p-6 flex flex-col items-center justify-center overflow-hidden no-print">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl p-8 sm:p-12 flex flex-col items-center text-center shadow-xs">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-4 shadow-xs">
          <FolderArchive className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-1">File Storage Hub</h2>
        <p className="text-sm text-slate-500 max-w-sm mb-6 leading-relaxed">
          Centralized customer document repository, cloud archiving, and print queue management.
        </p>
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 text-xs font-semibold text-slate-600 border border-slate-200">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          Workspace Ready • In Development
        </div>
      </div>
    </main>
  );
}
