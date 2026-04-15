import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useDataContext } from '../contexts/DataContext';
import { useNavigate } from 'react-router-dom';
import { STATUS_CONFIG, LINES } from '../contexts/DataStore';
import {
  Upload, FileSpreadsheet, Package, ClipboardList, BarChart3,
  AlertCircle, CheckCircle, Clock, TrendingUp, AlertTriangle,
  ChevronRight, Download, Plus
} from 'lucide-react';

export default function DashboardPage() {
  const { store, hasData, importXLSX, importJSON, exportJSON, getBackupInfo, restoreBackup } = useDataContext();
  const navigate = useNavigate();
  const xlsxRef = useRef(null);
  const jsonRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');

  const handleXLSX = async (file) => {
    if (!file) return;
    setImporting(true); setImportMsg('');
    try {
      await importXLSX(file, 'merge');
      const c = (store?.comenzi||[]).length;
      const m = Object.keys(store?.materiale||{}).length;
      setImportMsg(`✓ Import reușit: comenzi și materiale importate`);
    } catch(e) { setImportMsg('✗ Eroare: ' + e.message); }
    setImporting(false);
  };

  const handleJSON = async (file) => {
    if (!file) return;
    setImporting(true); setImportMsg('');
    try { await importJSON(file); setImportMsg('✓ Backup restaurat cu succes'); }
    catch(e) { setImportMsg('✗ Eroare: ' + e.message); }
    setImporting(false);
  };

  // Stats
  const stats = useMemo(() => {
    if (!store) return null;
    const comenzi = store.comenzi || [];
    const prod = store.prod || [];
    const mat = store.materiale || {};

    const byStatus = {};
    Object.keys(STATUS_CONFIG).forEach(s => {
      byStatus[s] = comenzi.filter(c => c.status === s).length;
    });

    const urgent = comenzi.filter(c => {
      if (c.status === 'ANULAT' || c.status === 'Fabricat') return false;
      const dlim = c.dlim || c.dagr;
      if (!dlim) return false;
      const diff = (new Date(dlim) - new Date()) / 86400000;
      return diff <= 7 && diff >= 0;
    });

    const overdue = comenzi.filter(c => {
      if (c.status === 'ANULAT' || c.status === 'Fabricat' || c.status === 'Programat') return false;
      const dlim = c.dlim || c.dagr;
      if (!dlim) return false;
      return new Date(dlim) < new Date();
    });

    const totalPal = prod.reduce((a, p) => a + (p.pal || 0), 0);

    return { comenzi: comenzi.length, byStatus, prod: prod.length, mat: Object.keys(mat).length, urgent, overdue, totalPal };
  }, [store]);

  // Empty state — no data
  if (!hasData) {
    const backupInfo = getBackupInfo?.();
    return (
      <div className="p-6 h-full overflow-auto">
        <div className="max-w-2xl mx-auto pt-8">
          {/* Logo + title */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-sm bg-orange-600 flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-bold text-2xl font-['Work_Sans']">P</span>
            </div>
            <h1 className="text-2xl font-semibold text-zinc-900 font-['Work_Sans']">PID Planificator</h1>
            <p className="text-zinc-500 mt-1">Nicio dată în aplicație. Importă pentru a începe.</p>
          </div>

          {/* Import options */}
          <div className="space-y-3">
            {/* XLSX import — primary */}
            <div
              className="border-2 border-dashed border-orange-200 rounded-sm p-6 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50/40 transition-colors"
              onClick={() => xlsxRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleXLSX(e.dataTransfer.files[0]); }}
            >
              <FileSpreadsheet className="w-10 h-10 text-orange-300 mx-auto mb-3" />
              <p className="text-base font-medium text-zinc-700 mb-1">Import din Excel</p>
              <p className="text-sm text-zinc-500">Trage fișierul <code className="bg-zinc-100 px-1 rounded font-mono text-xs">Planificare_comenzi_PS.xlsx</code> sau click</p>
              <p className="text-xs text-zinc-400 mt-2">Importă automat: Comenzi PS, Date Material, Mentenanță, Igienizare, DDD, CDI</p>
              <input ref={xlsxRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => handleXLSX(e.target.files[0])} />
            </div>

            {/* Backup restore */}
            {backupInfo && (
              <div className="bg-amber-50 border border-amber-200 rounded-sm p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-amber-800">Backup automat disponibil</p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    {new Date(backupInfo.savedAt).toLocaleString('ro-RO')} · {backupInfo.comenzi} comenzi · {backupInfo.materiale} materiale
                  </p>
                </div>
                <button onClick={() => { restoreBackup(); window.location.reload(); }}
                  className="ml-4 px-3 h-8 bg-amber-600 text-white text-xs font-medium rounded-sm hover:bg-amber-700 whitespace-nowrap">
                  Restaurează
                </button>
              </div>
            )}

            {/* JSON restore */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-zinc-200" />
              <span className="text-xs text-zinc-400">sau</span>
              <div className="flex-1 h-px bg-zinc-200" />
            </div>
            <button onClick={() => jsonRef.current?.click()}
              className="w-full h-10 border border-zinc-200 text-sm text-zinc-600 rounded-sm hover:bg-zinc-50 flex items-center justify-center gap-2">
              <Upload className="w-4 h-4" /> Restaurează din backup JSON
            </button>
            <input ref={jsonRef} type="file" accept=".json" className="hidden" onChange={e => handleJSON(e.target.files[0])} />

            {/* Start empty */}
            <button onClick={() => navigate('/materiale')}
              className="w-full h-10 border border-zinc-200 text-sm text-zinc-400 rounded-sm hover:bg-zinc-50">
              Pornește fără date (adaugă manual) →
            </button>
          </div>

          {/* Feedback */}
          {importing && (
            <div className="mt-4 flex items-center gap-2 text-sm text-orange-600 bg-orange-50 border border-orange-200 rounded-sm px-3 py-2">
              <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin shrink-0" />
              Se procesează fișierul...
            </div>
          )}
          {importMsg && (
            <div className={`mt-4 text-sm px-3 py-2 rounded-sm border ${importMsg.startsWith('✓') ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
              {importMsg}
              {importMsg.startsWith('✓') && (
                <button onClick={() => window.location.reload()} className="ml-2 underline font-medium">Reîncarcă pagina</button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Dashboard cu date ──────────────────────────────────────────────────────
  if (!stats) return null;

  const kpis = [
    { label: 'Comenzi PS/PSC',  value: stats.comenzi,     sub: `${stats.byStatus['Programat']||0} programate`, icon: ClipboardList, color: 'orange', path: '/comenzi' },
    { label: 'Date Material',    value: stats.mat,          sub: 'materiale definite',                           icon: Package,       color: 'blue',   path: '/materiale' },
    { label: 'Comenzi Producție',value: stats.prod,         sub: `${stats.totalPal} paleti planificați`,         icon: BarChart3,     color: 'green',  path: '/planning' },
    { label: 'Urgente (7 zile)', value: stats.urgent.length,sub: `${stats.overdue.length} depășite`,             icon: AlertTriangle, color: stats.urgent.length > 0 ? 'red' : 'zinc', path: '/comenzi' },
  ];

  const colorMap = {
    orange: { card: 'border-orange-200', top: 'bg-orange-600', val: 'text-orange-700', bg: 'bg-orange-50' },
    blue:   { card: 'border-blue-200',   top: 'bg-blue-600',   val: 'text-blue-700',   bg: 'bg-blue-50' },
    green:  { card: 'border-green-200',  top: 'bg-green-600',  val: 'text-green-700',  bg: 'bg-green-50' },
    red:    { card: 'border-red-200',    top: 'bg-red-600',    val: 'text-red-700',    bg: 'bg-red-50' },
    zinc:   { card: 'border-zinc-200',   top: 'bg-zinc-400',   val: 'text-zinc-700',   bg: 'bg-zinc-50' },
  };

  return (
    <div className="p-4 h-full overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 font-['Work_Sans']">Dashboard</h1>
          <p className="text-sm text-zinc-500">Situație generală planificare producție</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => xlsxRef.current?.click()} title="Import Excel"
            className="flex items-center gap-1.5 h-9 px-3 border border-zinc-200 text-sm text-zinc-600 rounded-sm hover:bg-zinc-50">
            <FileSpreadsheet className="w-4 h-4 text-green-600" /> Import Excel
          </button>
          <button onClick={exportJSON} title="Export backup JSON"
            className="flex items-center gap-1.5 h-9 px-3 border border-zinc-200 text-sm text-zinc-600 rounded-sm hover:bg-zinc-50">
            <Download className="w-4 h-4" /> Backup
          </button>
          <input ref={xlsxRef} type="file" accept=".xlsx,.xls" className="hidden"
            onChange={e => { handleXLSX(e.target.files[0]); e.target.value=''; }} />
        </div>
      </div>

      {/* Import feedback */}
      {(importing || importMsg) && (
        <div className={`mb-4 flex items-center gap-2 text-sm px-3 py-2 rounded-sm border ${importing ? 'bg-orange-50 border-orange-200 text-orange-600' : importMsg.startsWith('✓') ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {importing ? <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin shrink-0" /> : null}
          {importMsg || 'Se procesează...'}
          {importMsg && <button onClick={() => setImportMsg('')} className="ml-auto text-zinc-400 hover:text-zinc-600">✕</button>}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {kpis.map(kpi => {
          const Icon = kpi.icon;
          const c = colorMap[kpi.color];
          return (
            <div key={kpi.label} onClick={() => navigate(kpi.path)}
              className={`border ${c.card} rounded-sm bg-white cursor-pointer hover:shadow-sm transition-shadow overflow-hidden`}>
              <div className={`h-1 ${c.top}`} />
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <Icon className={`w-5 h-5 ${c.val}`} />
                  <ChevronRight className="w-4 h-4 text-zinc-300" />
                </div>
                <div className={`text-3xl font-light ${c.val} font-['Work_Sans']`}>{kpi.value}</div>
                <div className="text-xs font-medium text-zinc-700 mt-1">{kpi.label}</div>
                <div className="text-[10px] text-zinc-400 mt-0.5">{kpi.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status comenzi */}
        <div className="bg-white border border-zinc-200 rounded-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-900 font-['Work_Sans']">Status Comenzi PS/PSC</h2>
            <button onClick={() => navigate('/comenzi')} className="text-xs text-orange-600 hover:underline">Vezi toate →</button>
          </div>
          <div className="space-y-2">
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
              const cnt = stats.byStatus[key] || 0;
              if (!cnt) return null;
              const pct = stats.comenzi > 0 ? Math.round(cnt / stats.comenzi * 100) : 0;
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-xs text-zinc-600 w-28 shrink-0">{cfg.label}</span>
                  <div className="flex-1 bg-zinc-100 rounded-full h-2">
                    <div className="h-2 rounded-full transition-all" style={{ width: pct + '%', backgroundColor: cfg.color }} />
                  </div>
                  <span className="text-xs font-medium text-zinc-700 w-8 text-right">{cnt}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Linii producție */}
        <div className="bg-white border border-zinc-200 rounded-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-900 font-['Work_Sans']">Comenzi pe Linie</h2>
            <button onClick={() => navigate('/comenzi')} className="text-xs text-orange-600 hover:underline">Filtrează →</button>
          </div>
          <div className="space-y-2">
            {LINES.map(ln => {
              const cnt = (store?.comenzi || []).filter(c => c.linie === ln.cod || c.linie === ln.nume).length;
              if (!cnt) return null;
              return (
                <div key={ln.id} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ln.color }} />
                  <span className="text-xs text-zinc-700 flex-1 truncate">{ln.nume}</span>
                  <span className="text-xs font-semibold text-zinc-700">{cnt}</span>
                </div>
              );
            })}
            {(store?.comenzi || []).every(c => !c.linie) && (
              <p className="text-xs text-zinc-400 text-center py-2">Nu există comenzi cu linie atribuită</p>
            )}
          </div>
        </div>

        {/* Urgente */}
        {stats.urgent.length > 0 && (
          <div className="bg-white border border-amber-200 rounded-sm p-4 lg:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <h2 className="text-sm font-semibold text-zinc-900 font-['Work_Sans']">Urgente — termen în 7 zile</h2>
              <span className="ml-auto text-xs text-amber-600 font-medium">{stats.urgent.length} comenzi</span>
            </div>
            <div className="overflow-auto max-h-48">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-zinc-100">
                  <th className="text-left py-1 pr-3 font-bold text-zinc-500 text-[10px] uppercase tracking-wide">PSF NR</th>
                  <th className="text-left py-1 pr-3 font-bold text-zinc-500 text-[10px] uppercase tracking-wide">Client</th>
                  <th className="text-left py-1 pr-3 font-bold text-zinc-500 text-[10px] uppercase tracking-wide">Cod</th>
                  <th className="text-right py-1 font-bold text-zinc-500 text-[10px] uppercase tracking-wide">Data Limită</th>
                </tr></thead>
                <tbody>
                  {stats.urgent.slice(0, 10).map(c => {
                    const dlim = c.dlim || c.dagr;
                    const diff = Math.ceil((new Date(dlim) - new Date()) / 86400000);
                    return (
                      <tr key={c._id} className="border-b border-zinc-50 hover:bg-amber-50/30">
                        <td className="py-1 pr-3 font-mono text-zinc-800">{c.nrPS || '—'}</td>
                        <td className="py-1 pr-3 text-zinc-600">{c.client || '—'}</td>
                        <td className="py-1 pr-3 font-mono text-zinc-600">{c.cod || '—'}</td>
                        <td className="py-1 text-right">
                          <span className={`font-medium ${diff <= 2 ? 'text-red-600' : 'text-amber-600'}`}>
                            {new Date(dlim).toLocaleDateString('ro-RO')} ({diff}z)
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="bg-white border border-zinc-200 rounded-sm p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold text-zinc-900 font-['Work_Sans'] mb-3">Acțiuni rapide</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Date Material', sub: `${stats.mat} materiale`, icon: Package, path: '/materiale', color: 'bg-blue-50 border-blue-200 text-blue-700' },
              { label: 'Comenzi PS/PSC', sub: `${stats.comenzi} comenzi`, icon: ClipboardList, path: '/comenzi', color: 'bg-orange-50 border-orange-200 text-orange-700' },
              { label: 'Planificare', sub: `${stats.prod} CP create`, icon: BarChart3, path: '/planning', color: 'bg-green-50 border-green-200 text-green-700' },
              { label: 'Import Excel', sub: 'Actualizează datele', icon: FileSpreadsheet, action: () => xlsxRef.current?.click(), color: 'bg-zinc-50 border-zinc-200 text-zinc-700' },
            ].map(a => {
              const Icon = a.icon;
              return (
                <button key={a.label} onClick={a.action || (() => navigate(a.path))}
                  className={`flex items-start gap-2 p-3 border rounded-sm text-left hover:shadow-sm transition-shadow ${a.color}`}>
                  <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold">{a.label}</div>
                    <div className="text-[10px] opacity-70 mt-0.5">{a.sub}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
