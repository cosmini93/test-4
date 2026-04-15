import React, { useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { Upload, FileSpreadsheet, Trash2, AlertCircle } from 'lucide-react';

export default function UploadPage() {
  const { loadFile, clearData, uploading, uploadError, fileName, appData } = useData();
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) loadFile(f);
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="bg-white border border-zinc-200 rounded-sm shadow-sm w-full max-w-lg">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 flex items-center gap-3">
          <div className="w-9 h-9 rounded-sm bg-orange-600 flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-base font-['Work_Sans']">P</span>
          </div>
          <div>
            <h1 className="text-base font-semibold text-zinc-900 font-['Work_Sans']">PID Planificator</h1>
            <p className="text-[10px] text-zinc-400 uppercase tracking-widest">Planificare Integrata Dinamica</p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <h2 className="text-sm font-medium text-zinc-800 mb-1">Incarca fisierul Excel</h2>
            <p className="text-xs text-zinc-500">Selecteaza sau trage fisierul <code className="font-mono bg-zinc-100 px-1 rounded">Planificare_comenzi_PS.xlsx</code></p>
          </div>

          {/* Drop zone */}
          <div
            className="border-2 border-dashed border-zinc-200 rounded-sm p-8 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50/30 transition-colors"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <FileSpreadsheet className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
            <p className="text-sm text-zinc-500 mb-1">Trage fisierul .xlsx aici</p>
            <p className="text-xs text-zinc-400">sau click pentru selectare</p>
            <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => e.target.files[0] && loadFile(e.target.files[0])} />
          </div>

          {uploading && (
            <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 border border-orange-200 rounded-sm px-3 py-2">
              <div className="w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin shrink-0" />
              Se proceseaza fisierul...
            </div>
          )}

          {uploadError && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-sm px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {uploadError}
            </div>
          )}

          {appData && (
            <div className="bg-green-50 border border-green-200 rounded-sm p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">{fileName}</span>
                </div>
                <button onClick={clearData} className="p-1 hover:bg-green-100 rounded text-green-600" title="Sterge datele"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-green-700">
                <div className="bg-white border border-green-200 rounded-sm px-2 py-1 text-center">
                  <div className="font-semibold text-base text-green-800">{appData.comenzi.length}</div>
                  <div className="text-[10px] text-green-600 uppercase tracking-wide">Comenzi PS</div>
                </div>
                <div className="bg-white border border-green-200 rounded-sm px-2 py-1 text-center">
                  <div className="font-semibold text-base text-green-800">{appData.prod.length}</div>
                  <div className="text-[10px] text-green-600 uppercase tracking-wide">Comenzi CP</div>
                </div>
                <div className="bg-white border border-green-200 rounded-sm px-2 py-1 text-center">
                  <div className="font-semibold text-base text-green-800">{Object.keys(appData.mat).length}</div>
                  <div className="text-[10px] text-green-600 uppercase tracking-wide">Materiale</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between">
          <p className="text-[10px] text-zinc-400">Datele sunt salvate local in browser</p>
          {appData && (
            <a href="/dashboard" className="px-4 h-8 bg-orange-600 text-white text-sm rounded-sm hover:bg-orange-700 flex items-center gap-1.5 font-medium">
              Deschide aplicatia →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
