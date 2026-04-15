import React, { useState, useRef, useMemo } from 'react';
import { useDataContext } from '../contexts/DataContext';
import { STATUS_CONFIG } from '../contexts/DataStore';
import { Plus, Trash2, Upload, Search, Edit2, Check, X, FileSpreadsheet, Filter, ChevronDown, AlertCircle } from 'lucide-react';

// Exact columns matching Excel structure
const COLS_VISIBLE = [
  { key: 'client',           label: 'Client',                              w: 130, type: 'text' },
  { key: 'cod',              label: 'Cod material',                        w: 90,  type: 'text', mono: true },
  { key: 'desc',             label: 'Descriere material',                  w: 180, type: 'text' },
  { key: 'nrPS',             label: 'PSF NR',                              w: 140, type: 'text' },
  { key: 'cant',             label: 'Cantitate',                           w: 75,  type: 'number' },
  { key: 'celMaiDevreme',    label: 'Cel mai devreme',                     w: 105, type: 'date' },
  { key: 'dlim',             label: 'Data limita punere pe Stoc',          w: 130, type: 'date' },
  { key: 'dagr',             label: 'Data agreata punere pe stoc/Anulare', w: 150, type: 'date' },
  { key: 'cagr',             label: 'Cantitate agreata',                   w: 100, type: 'number' },
  { key: 'cfab',             label: 'Cantitate fabricata',                 w: 100, type: 'number' },
  { key: 'dprog',            label: 'Data programat',                      w: 105, type: 'date' },
  { key: 'status',           label: 'Programat',                           w: 110, type: 'status' },
  { key: 'linie',            label: 'Linie productie',                     w: 140, type: 'text' },
];

const STATUS_OPTIONS = Object.keys(STATUS_CONFIG);

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { bg: 'bg-zinc-100', text: 'text-zinc-600' };
  return <span className={`inline-flex px-2 py-0.5 rounded-sm text-[10px] font-semibold ${cfg.bg} ${cfg.text}`}>{cfg.label || status}</span>;
}

function fmtDate(d) {
  if (!d) return '—';
  const x = new Date(d);
  if (isNaN(x)) return '—';
  const dd = String(x.getDate()).padStart(2,'0');
  const mm = String(x.getMonth()+1).padStart(2,'0');
  return `${dd}/${mm}/${x.getFullYear()}`;
}

export default function ComenziPage() {
  const { store, addComanda, updateComanda, deleteComanda, importComenzi, importXLSX, parsePasteComenzi } = useDataContext();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [linieFilter, setLinieFilter] = useState('all');
  const [editId, setEditId] = useState(null);
  const [editVals, setEditVals] = useState({});
  const [pasteModal, setPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteMode, setPasteMode] = useState('merge');
  const [pastePreview, setPastePreview] = useState(null);
  const [newRow, setNewRow] = useState(null);
  const [error, setError] = useState('');
  const xlsxRef = useRef(null);

  const comenzi = store?.comenzi || [];

  const linii = useMemo(() => {
    const set = new Set(comenzi.map(c => c.linie).filter(Boolean));
    return [...set].sort();
  }, [comenzi]);

  const filtered = useMemo(() => {
    return comenzi.filter(c => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (linieFilter !== 'all' && c.linie !== linieFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!c.nrPS?.toLowerCase().includes(s) && !c.cod?.toLowerCase().includes(s) &&
            !c.client?.toLowerCase().includes(s) && !c.desc?.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [comenzi, statusFilter, linieFilter, search]);

  // Stats
  const stats = useMemo(() => {
    const total = comenzi.length;
    const byStatus = {};
    STATUS_OPTIONS.forEach(s => { byStatus[s] = comenzi.filter(c => c.status === s).length; });
    return { total, byStatus };
  }, [comenzi]);

  const startEdit = (cmd) => { setEditId(cmd._id); setEditVals({ ...cmd }); };
  const saveEdit = () => { updateComanda(editId, editVals); setEditId(null); };
  const cancelEdit = () => setEditId(null);

  const addRow = () => {
    const { uid } = require('../contexts/DataStore');
    const id = uid();
    const empty = { _id: id, nrPS: '', client: '', cod: '', desc: '', cant: 0, cagr: 0, cfab: 0, dlim: '', dagr: '', dprog: '', status: 'Neprogramat', linie: '' };
    addComanda(empty);
    setEditId(id);
    setEditVals(empty);
  };

  const handleXLSX = async (file) => {
    if (!file) return;
    setError('');
    try { await importXLSX(file, 'merge'); }
    catch(e) { setError('Eroare: ' + e.message); }
  };

  const handlePastePreview = () => setPastePreview(parsePasteComenzi(pasteText));
  const handlePasteImport = () => {
    if (!pastePreview?.items.length) return;
    importComenzi(pastePreview.items, pasteMode);
    setPasteModal(false); setPasteText(''); setPastePreview(null);
  };

  const renderCell = (cmd, col) => {
    const isEditing = editId === cmd._id;
    const val = isEditing ? editVals[col.key] : cmd[col.key];

    if (isEditing) {
      if (col.type === 'status') {
        return (
          <select value={editVals[col.key] || ''} onChange={e => setEditVals(v => ({ ...v, [col.key]: e.target.value }))}
            className="w-full h-7 px-1 border border-orange-300 rounded-sm text-xs bg-white focus:outline-none">
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>)}
          </select>
        );
      }
      return (
        <input type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
          value={val ?? ''}
          onChange={e => setEditVals(v => ({ ...v, [col.key]: col.type === 'number' ? parseFloat(e.target.value)||0 : e.target.value }))}
          className="w-full h-7 px-1.5 border border-orange-300 rounded-sm text-xs focus:outline-none focus:ring-1 focus:ring-orange-500" />
      );
    }

    if (col.type === 'status') return <StatusBadge status={cmd.status} />;
    if (col.type === 'date') return <span className="text-xs text-zinc-600">{fmtDate(val)}</span>;
    if (col.type === 'number') return <span className="text-xs font-medium text-zinc-700 tabular-nums">{val || 0}</span>;
    return <span className={`text-xs text-zinc-700 ${col.mono ? 'font-mono' : ''}`}>{val || '—'}</span>;
  };

  return (
    <div className="p-4 h-full flex flex-col" data-testid="comenzi-page">
      {/* Header */}
      <div className="flex items-start justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 font-['Work_Sans']">Comenzi PS / PSC</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Administrare comenzi de planificare · {filtered.length} din {comenzi.length}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button onClick={() => setPasteModal(true)}
            className="flex items-center gap-1.5 h-9 px-3 border border-zinc-200 text-sm text-zinc-600 rounded-sm hover:bg-zinc-50">
            <FileSpreadsheet className="w-4 h-4" /> Copy-paste
          </button>
          <button onClick={() => xlsxRef.current?.click()}
            className="flex items-center gap-1.5 h-9 px-3 border border-zinc-200 text-sm text-zinc-600 rounded-sm hover:bg-zinc-50">
            <Upload className="w-4 h-4" /> Import .xlsx
          </button>
          <input ref={xlsxRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => handleXLSX(e.target.files[0])} />
          <button onClick={addRow}
            className="flex items-center gap-1.5 h-9 px-3 bg-orange-600 text-white text-sm rounded-sm hover:bg-orange-700">
            <Plus className="w-4 h-4" /> Adaugă
          </button>
        </div>
      </div>

      {/* Status pills */}
      <div className="flex gap-2 mb-3 shrink-0 flex-wrap">
        <button onClick={() => setStatusFilter('all')}
          className={`px-2.5 py-1 rounded-sm text-xs font-medium border transition-colors ${statusFilter === 'all' ? 'bg-zinc-800 text-white border-zinc-800' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}>
          Toate ({stats.total})
        </button>
        {STATUS_OPTIONS.filter(s => s !== 'ANULAT').map(s => {
          const cfg = STATUS_CONFIG[s];
          const cnt = stats.byStatus[s] || 0;
          if (!cnt) return null;
          return (
            <button key={s} onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
              className={`px-2.5 py-1 rounded-sm text-xs font-medium border transition-colors ${statusFilter === s ? `${cfg.bg} ${cfg.text} border-current` : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}>
              {cfg.label} ({cnt})
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-3 shrink-0">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-zinc-400 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Caută PSF NR, cod, client..."
            className="h-9 pl-8 pr-3 border border-zinc-200 rounded-sm text-sm w-60 focus:outline-none focus:ring-1 focus:ring-orange-500" />
        </div>
        <select value={linieFilter} onChange={e => setLinieFilter(e.target.value)}
          className="h-9 px-2 border border-zinc-200 rounded-sm text-sm text-zinc-700 focus:outline-none bg-white">
          <option value="all">Toate liniile</option>
          {linii.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        {(statusFilter !== 'all' || linieFilter !== 'all' || search) && (
          <button onClick={() => { setStatusFilter('all'); setLinieFilter('all'); setSearch(''); }}
            className="h-9 px-2 border border-zinc-200 text-xs text-zinc-500 rounded-sm hover:bg-zinc-50 flex items-center gap-1">
            <X className="w-3 h-3" /> Resetare filtre
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-sm px-3 py-2 mb-3 shrink-0">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 border border-zinc-200 rounded-sm bg-white overflow-auto">
        <table className="w-full border-collapse" style={{ minWidth: COLS_VISIBLE.reduce((a,c)=>a+c.w,0)+80 }}>
          <thead className="sticky top-0 z-10 bg-zinc-50 border-b border-zinc-200">
            <tr>
              {COLS_VISIBLE.map(col => (
                <th key={col.key} style={{ minWidth: col.w }} className="px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-zinc-500 whitespace-nowrap">
                  {col.label}
                </th>
              ))}
              <th className="px-2 py-2 w-20 text-right text-[10px] font-bold uppercase tracking-wider text-zinc-500">Act.</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={COLS_VISIBLE.length+1} className="text-center py-12 text-zinc-400 text-sm">
                {comenzi.length === 0 ? 'Nicio comandă. Importă din Excel sau adaugă manual.' : 'Niciun rezultat pentru filtrele selectate.'}
              </td></tr>
            )}
            {filtered.map(cmd => {
              const isEditing = editId === cmd._id;
              return (
                <tr key={cmd._id} className={`border-b border-zinc-100 ${isEditing ? 'bg-orange-50' : 'hover:bg-zinc-50'}`}>
                  {COLS_VISIBLE.map(col => (
                    <td key={col.key} className="px-2 py-1.5" style={{ minWidth: col.w }}>
                      {renderCell(cmd, col)}
                    </td>
                  ))}
                  <td className="px-2 py-1.5">
                    <div className="flex items-center justify-end gap-1">
                      {isEditing ? (
                        <>
                          <button onClick={saveEdit} className="p-1.5 bg-green-600 text-white rounded-sm hover:bg-green-700"><Check className="w-3 h-3" /></button>
                          <button onClick={cancelEdit} className="p-1.5 border border-zinc-200 text-zinc-500 rounded-sm hover:bg-zinc-100"><X className="w-3 h-3" /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(cmd)} className="p-1.5 border border-zinc-200 text-zinc-500 rounded-sm hover:bg-zinc-100"><Edit2 className="w-3 h-3" /></button>
                          <button onClick={() => { if(window.confirm('Ștergi comanda?')) deleteComanda(cmd._id); }}
                            className="p-1.5 border border-red-200 text-red-500 rounded-sm hover:bg-red-50"><Trash2 className="w-3 h-3" /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Paste Modal */}
      {pasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-sm border border-zinc-200 w-full max-w-3xl max-h-[85vh] flex flex-col shadow-lg">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-zinc-50 shrink-0">
              <div>
                <h3 className="text-base font-medium text-zinc-900 font-['Work_Sans']">Import Copy-Paste Comenzi PS/PSC</h3>
                <p className="text-xs text-zinc-500">Copiază tabelul din Excel (inclusiv header) și lipește mai jos</p>
              </div>
              <button onClick={() => { setPasteModal(false); setPastePreview(null); setPasteText(''); }} className="p-1 hover:bg-zinc-200 rounded"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-sm p-3 text-xs text-blue-700">
                <strong>Coloane detectate automat:</strong> Client | Cod material | Descriere | PSF NR | Cantitate | Data Limită | Data Agreată | Cantitate Agreată | Fabricat | Status | Linie
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">Datele copiate din Excel</label>
                <textarea value={pasteText} onChange={e => { setPasteText(e.target.value); setPastePreview(null); }}
                  placeholder="Lipește aici (Ctrl+V) tabelul copiat din Excel..."
                  className="w-full h-44 px-3 py-2 border border-zinc-200 rounded-sm text-xs font-mono focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none" />
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-zinc-600">Mod:</span>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input type="radio" value="merge" checked={pasteMode === 'merge'} onChange={() => setPasteMode('merge')} className="accent-orange-600" />
                    Adaugă/actualizează (după PSF NR)
                  </label>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input type="radio" value="replace" checked={pasteMode === 'replace'} onChange={() => setPasteMode('replace')} className="accent-red-600" />
                    <span className="text-red-600">Înlocuiește tot</span>
                  </label>
                </div>
                <button onClick={handlePastePreview} disabled={!pasteText.trim()}
                  className="ml-auto px-3 h-8 bg-zinc-800 text-white text-xs rounded-sm hover:bg-zinc-900 disabled:opacity-40">
                  Previzualizare
                </button>
              </div>

              {pastePreview && (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-zinc-700">{pastePreview.items.length} comenzi detectate</span>
                    {pastePreview.errors.length > 0 && <span className="text-xs text-red-600">{pastePreview.errors.length} erori</span>}
                  </div>
                  <div className="border border-zinc-200 rounded-sm max-h-56 overflow-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="bg-zinc-50 border-b border-zinc-200 sticky top-0">
                        <th className="px-2 py-1 text-left font-bold text-zinc-500">PSF NR</th>
                        <th className="px-2 py-1 text-left font-bold text-zinc-500">Client</th>
                        <th className="px-2 py-1 text-left font-bold text-zinc-500">Cod</th>
                        <th className="px-2 py-1 text-right font-bold text-zinc-500">Cant.</th>
                        <th className="px-2 py-1 text-left font-bold text-zinc-500">Data Limită</th>
                        <th className="px-2 py-1 text-left font-bold text-zinc-500">Status</th>
                      </tr></thead>
                      <tbody>
                        {pastePreview.items.map((item, i) => (
                          <tr key={i} className="border-b border-zinc-100">
                            <td className="px-2 py-1 font-mono">{item.nrPS || '—'}</td>
                            <td className="px-2 py-1">{item.client || '—'}</td>
                            <td className="px-2 py-1 font-mono">{item.cod || '—'}</td>
                            <td className="px-2 py-1 text-right">{item.cant || 0}</td>
                            <td className="px-2 py-1">{item.dlim || '—'}</td>
                            <td className="px-2 py-1"><StatusBadge status={item.status || 'Neprogramat'} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 px-4 py-3 border-t shrink-0">
              <button onClick={() => { setPasteModal(false); setPastePreview(null); setPasteText(''); }}
                className="px-4 h-9 border border-zinc-200 text-sm rounded-sm hover:bg-zinc-50">Anulare</button>
              <button onClick={handlePasteImport} disabled={!pastePreview?.items.length}
                className="flex items-center gap-2 px-4 h-9 bg-orange-600 text-white text-sm rounded-sm hover:bg-orange-700 disabled:opacity-40">
                <Check className="w-4 h-4" /> Importă {pastePreview?.items.length || 0} comenzi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
