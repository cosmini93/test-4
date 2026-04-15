import React, { useRef } from 'react';
import { useDataContext } from '../contexts/DataContext';
import { useNavigate } from 'react-router-dom';
import { Upload, FileSpreadsheet, Download, Package, ClipboardList, BarChart3, AlertCircle } from 'lucide-react';

export default function WelcomePage() {
  const { store, importXLSX, importJSON, exportJSON, hasData, getBackupInfo, restoreBackup } = useDataContext();
  const backupInfo = React.useMemo(() => getBackupInfo?.(), [store]);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const xlsxRef = useRef(null);
  const jsonRef = useRef(null);
  const navigate = useNavigate();

  const handleXLSX = async (file) => {
    if (!file) return;
    setUploading(true); setError(''); setSuccess('');
    try {
      await importXLSX(file, 'merge');
      setSuccess(`Import reușit din ${file.name}`);
    } catch(e) { setError('Eroare: ' + e.message); }
    setUploading(false);
  };

  const handleJSON = async (file) => {
    if (!file) return;
    setUploading(true); setError(''); setSuccess('');
    try {
      await importJSON(file);
      setSuccess('Backup restaurat cu succes');
    } catch(e) { setError('Eroare: ' + e.message); }
    setUploading(false);
  };

  const stats = store ? [
    { label: 'Comenzi PS/PSC', value: (store.comenzi||[]).length, icon: ClipboardList, color: 'orange' },
    { label: 'Date Material', value: Object.keys(store.materiale||{}).length, icon: Package, color: 'blue' },
    { label: 'Comenzi Producție', value: (store.prod||[]).length, icon: BarChart3, color: 'green' },
  ] : [];

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="bg-white border border-zinc-200 rounded-sm shadow-sm w-full max-w-2xl">
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-200">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-sm bg-orange-600 flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-lg font-['Work_Sans']">P</span>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-zinc-900 font-['Work_Sans']">PID Planificator</h1>
              <p className="text-xs text-zinc-400 uppercase tracking-widest">Planificare Integrată Dinamică</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Stats dacă există date */}
          {hasData && (
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3">Date existente în aplicație</div>
              <div className="grid grid-cols-3 gap-3">
                {stats.map(s => {
                  const Icon = s.icon;
                  const colorMap = { orange: 'border-orange-200 bg-orange-50', blue: 'border-blue-200 bg-blue-50', green: 'border-green-200 bg-green-50' };
                  const textMap = { orange: 'text-orange-700', blue: 'text-blue-700', green: 'text-green-700' };
                  return (
                    <div key={s.label} className={`border rounded-sm p-3 ${colorMap[s.color]}`}>
                      <div className={`text-2xl font-semibold ${textMap[s.color]} font-['Work_Sans']`}>{s.value}</div>
                      <div className="text-xs text-zinc-600 mt-0.5">{s.label}</div>
                    </div>
                  );
                })}
              </div>
              <button onClick={() => navigate('/dashboard')}
                className="mt-3 w-full h-10 bg-orange-600 text-white text-sm font-medium rounded-sm hover:bg-orange-700 flex items-center justify-center gap-2">
                Deschide aplicația →
              </button>
            </div>
          )}

          {/* Import XLSX */}
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Import din Excel</div>
            <div
              className="border-2 border-dashed border-zinc-200 rounded-sm p-6 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50/30 transition-colors"
              onClick={() => xlsxRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleXLSX(e.dataTransfer.files[0]); }}
            >
              <FileSpreadsheet className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm text-zinc-600 mb-1">Trage <code className="font-mono bg-zinc-100 px-1 rounded text-xs">Planificare_comenzi_PS.xlsx</code></p>
              <p className="text-xs text-zinc-400">sau click pentru selectare · Se importă: Comenzi, Materiale, Mentenanță, Igienizare, DDD, CDI</p>
              <input ref={xlsxRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => handleXLSX(e.target.files[0])} />
            </div>
          </div>

          {/* Restore backup */}
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Restaurare backup</div>
            <button onClick={() => jsonRef.current?.click()}
              className="w-full h-9 border border-zinc-200 text-sm text-zinc-600 rounded-sm hover:bg-zinc-50 flex items-center justify-center gap-2">
              <Upload className="w-4 h-4" /> Încarcă fișier .json backup
            </button>
            <input ref={jsonRef} type="file" accept=".json" className="hidden" onChange={e => handleJSON(e.target.files[0])} />
          </div>

          {/* Auto-backup disponibil */}
          {backupInfo && !hasData && (
            <div className="bg-amber-50 border border-amber-200 rounded-sm p-4">
              <div className="text-xs font-bold uppercase tracking-widest text-amber-700 mb-2">Backup automat disponibil</div>
              <p className="text-xs text-amber-700 mb-2">
                Ultimul backup: <strong>{new Date(backupInfo.savedAt).toLocaleString('ro-RO')}</strong>
                <br/>Conține: {backupInfo.comenzi} comenzi · {backupInfo.materiale} materiale
              </p>
              <button onClick={() => { restoreBackup(); navigate('/dashboard'); }}
                className="w-full h-9 bg-amber-600 text-white text-sm font-medium rounded-sm hover:bg-amber-700">
                ↩ Restaurează backup automat
              </button>
            </div>
          )}

          {/* Fără import */}
          {!hasData && (
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Sau pornește de la zero</div>
              <button onClick={() => navigate('/dashboard')}
                className="w-full h-9 border border-zinc-200 text-sm text-zinc-500 rounded-sm hover:bg-zinc-50">
                Deschide aplicația goală →
              </button>
            </div>
          )}

          {/* Feedback */}
          {uploading && (
            <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 border border-orange-200 rounded-sm px-3 py-2">
              <div className="w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin shrink-0" />
              Se procesează...
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-sm px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-sm px-3 py-2">
              ✓ {success}
              <button onClick={() => navigate('/dashboard')} className="ml-auto underline text-green-700 font-medium">Deschide →</button>
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-zinc-200 bg-zinc-50 text-xs text-zinc-400 flex items-center justify-between">
          <span>Datele sunt salvate local în browser (localStorage)</span>
          {hasData && <button onClick={exportJSON} className="flex items-center gap-1 text-zinc-500 hover:text-zinc-700"><Download className="w-3 h-3" /> Export backup</button>}
        </div>
      </div>
    </div>
  );
}
