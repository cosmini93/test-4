import React, { useState, useRef, useCallback } from 'react';
import { useDataContext } from '../contexts/DataContext';
import { LINES } from '../contexts/DataStore';
import { Plus, Trash2, Upload, Download, Search, Edit2, Check, X, FileSpreadsheet, AlertCircle } from 'lucide-react';

const COLS = [
  { key: 'cod',     label: 'Cod SAP',          w: 100, type: 'text',   required: true },
  { key: 'nm',      label: 'Denumire',          w: 200, type: 'text',   required: true },
  { key: 'sjh',     label: 'Sarje/h',           w: 75,  type: 'number'  },
  { key: 'cph',     label: 'Cap. pal/h',        w: 85,  type: 'number'  },
  { key: 'cpr',     label: 'Cap. reală pal/h',  w: 100, type: 'number'  },
  { key: 'buc',     label: 'Buc/palet',         w: 80,  type: 'number'  },
  { key: 'off',     label: 'Offset amb. (h)',   w: 90,  type: 'number'  },
  { key: 'lb',      label: 'Limbă',             w: 70,  type: 'text'    },
  { key: 'defLine', label: 'Linie implicită',   w: 140, type: 'select', options: ['', ...LINES.map(l => l.cod)] },
  { key: 'tipTava', label: 'Tip tavă',          w: 80,  type: 'text'    },
  { key: 'baxare',  label: 'Baxare',            w: 65,  type: 'number'  },
];

export default function MaterialePage() {
  const { store, addMaterial, updateMaterial, deleteMaterial, importMateriale, importXLSX, parsePasteMateriale } = useDataContext();
  const [search, setSearch] = useState('');
  const [editId, setEditId] = useState(null);
  const [editVals, setEditVals] = useState({});
  const [pasteModal, setPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteMode, setPasteMode] = useState('merge');
  const [pastePreview, setPastePreview] = useState(null);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const xlsxRef = useRef(null);
  const jsonRef = useRef(null);

  const mats = Object.values(store?.materiale || {})
    .filter(m => !search || m.cod?.toLowerCase().includes(search.toLowerCase()) || m.nm?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => String(a.cod).localeCompare(String(b.cod)));

  const startEdit = (mat) => {
    setEditId(mat.cod);
    setEditVals({ ...mat });
  };

  const saveEdit = () => {
    if (!editVals.cod) return;
    updateMaterial(editId, editVals);
    setEditId(null);
  };

  const cancelEdit = () => setEditId(null);

  const addRow = () => {
    const newCod = 'MAT_' + Date.now().toString(36).toUpperCase();
    addMaterial({ cod: newCod, nm: '', sjh: 0, cph: 0, cpr: 0, buc: 0, off: 3.5, lb: '', defLine: '', defFab: '', tipTava: '', baxare: 0 });
    setEditId(newCod);
    setEditVals({ cod: newCod, nm: '', sjh: 0, cph: 0, cpr: 0, buc: 0, off: 3.5, lb: '', defLine: '', defFab: '', tipTava: '', baxare: 0 });
  };

  const handleXLSX = async (file) => {
    if (!file) return;
    setImporting(true); setError('');
    try {
      await importXLSX(file, 'merge');
    } catch(e) { setError('Eroare import: ' + e.message); }
    setImporting(false);
  };

  const handlePastePreview = () => {
    const result = parsePasteMateriale(pasteText);
    setPastePreview(result);
  };

  const handlePasteImport = () => {
    if (!pastePreview) return;
    importMateriale(pastePreview.items, pasteMode);
    setPasteModal(false);
    setPasteText('');
    setPastePreview(null);
  };

  const lineNume = (cod) => LINES.find(l => l.cod === cod)?.nume || cod || '—';

  return (
    <div className="p-4 h-full flex flex-col" data-testid="materiale-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 font-['Work_Sans']">Date Material</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Baza de calcul pentru comenzi producție · {mats.length} materiale</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setPasteModal(true)}
            className="flex items-center gap-2 h-9 px-3 border border-zinc-200 text-sm text-zinc-600 rounded-sm hover:bg-zinc-50">
            <FileSpreadsheet className="w-4 h-4" /> Copy-paste din Excel
          </button>
          <button onClick={() => xlsxRef.current?.click()}
            className="flex items-center gap-2 h-9 px-3 border border-zinc-200 text-sm text-zinc-600 rounded-sm hover:bg-zinc-50">
            <Upload className="w-4 h-4" /> Import .xlsx
          </button>
          <input ref={xlsxRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => handleXLSX(e.target.files[0])} />
          <button onClick={addRow}
            className="flex items-center gap-2 h-9 px-3 bg-orange-600 text-white text-sm rounded-sm hover:bg-orange-700">
            <Plus className="w-4 h-4" /> Material nou
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-3 shrink-0 w-72">
        <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-zinc-400 pointer-events-none" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Caută cod sau denumire..."
          className="w-full h-9 pl-8 pr-3 border border-zinc-200 rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-orange-500" />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-sm px-3 py-2 mb-3 shrink-0">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 border border-zinc-200 rounded-sm bg-white overflow-auto">
        <table className="w-full border-collapse text-sm" style={{ minWidth: COLS.reduce((a,c) => a+c.w, 0) + 80 }}>
          <thead className="sticky top-0 z-10 bg-zinc-50 border-b border-zinc-200">
            <tr>
              {COLS.map(col => (
                <th key={col.key} className="px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-zinc-500 whitespace-nowrap" style={{ minWidth: col.w }}>
                  {col.label}
                </th>
              ))}
              <th className="px-2 py-2 w-20 text-right text-[10px] font-bold uppercase tracking-wider text-zinc-500">Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {mats.length === 0 && (
              <tr><td colSpan={COLS.length + 1} className="text-center py-12 text-zinc-400 text-sm">
                Niciun material. Adaugă manual sau importă din Excel.
              </td></tr>
            )}
            {mats.map(mat => {
              const isEditing = editId === mat.cod;
              return (
                <tr key={mat.cod} className={`border-b border-zinc-100 ${isEditing ? 'bg-orange-50' : 'hover:bg-zinc-50'}`}>
                  {COLS.map(col => (
                    <td key={col.key} className="px-2 py-1.5" style={{ minWidth: col.w }}>
                      {isEditing ? (
                        col.type === 'select' ? (
                          <select value={editVals[col.key] || ''} onChange={e => setEditVals(v => ({ ...v, [col.key]: e.target.value }))}
                            className="w-full h-7 px-1.5 border border-orange-300 rounded-sm text-xs bg-white focus:outline-none focus:ring-1 focus:ring-orange-500">
                            {col.options.map(o => <option key={o} value={o}>{o ? lineNume(o) : '—'}</option>)}
                          </select>
                        ) : (
                          <input type={col.type} value={editVals[col.key] ?? ''}
                            onChange={e => setEditVals(v => ({ ...v, [col.key]: col.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }))}
                            disabled={col.key === 'cod'}
                            className="w-full h-7 px-1.5 border border-orange-300 rounded-sm text-xs focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:bg-zinc-100" />
                        )
                      ) : (
                        <span className={`text-xs ${col.key === 'cod' ? 'font-mono font-medium' : ''} text-zinc-700`}>
                          {col.key === 'defLine' ? lineNume(mat[col.key]) : (mat[col.key] ?? '—')}
                        </span>
                      )}
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
                          <button onClick={() => startEdit(mat)} className="p-1.5 border border-zinc-200 text-zinc-500 rounded-sm hover:bg-zinc-100"><Edit2 className="w-3 h-3" /></button>
                          <button onClick={() => { if(window.confirm(`Ștergi materialul ${mat.cod}?`)) deleteMaterial(mat.cod); }}
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

      {/* Copy-paste Modal */}
      {pasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-sm border border-zinc-200 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-lg">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-zinc-50">
              <div>
                <h3 className="text-base font-medium text-zinc-900 font-['Work_Sans']">Import Copy-Paste din Excel</h3>
                <p className="text-xs text-zinc-500">Selectează rândurile din Excel (inclusiv header) și lipește mai jos</p>
              </div>
              <button onClick={() => { setPasteModal(false); setPastePreview(null); setPasteText(''); }} className="p-1 hover:bg-zinc-200 rounded"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              {/* Format hint */}
              <div className="bg-blue-50 border border-blue-200 rounded-sm p-3 text-xs text-blue-700">
                <strong>Format așteptat (coloane):</strong> Cod SAP | Denumire | Sarje/h | Cap. pal/h | Cap. reală | Buc/palet | Limbă | Offset h | Linie
                <br/>Prima linie cu header este detectată automat.
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">Lipește datele din Excel (Ctrl+V)</label>
                <textarea value={pasteText} onChange={e => { setPasteText(e.target.value); setPastePreview(null); }}
                  placeholder="Lipește aici tabelul copiat din Excel..."
                  className="w-full h-40 px-3 py-2 border border-zinc-200 rounded-sm text-xs font-mono focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none" />
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <label className="text-xs font-medium text-zinc-600">Mod import:</label>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input type="radio" value="merge" checked={pasteMode === 'merge'} onChange={() => setPasteMode('merge')} className="accent-orange-600" />
                    Adaugă/actualizează
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
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-zinc-700">{pastePreview.items.length} rânduri detectate</span>
                    {pastePreview.errors.length > 0 && (
                      <span className="text-xs text-red-600">{pastePreview.errors.length} erori</span>
                    )}
                  </div>
                  <div className="border border-zinc-200 rounded-sm max-h-48 overflow-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="bg-zinc-50 border-b border-zinc-200 sticky top-0">
                        <th className="px-2 py-1 text-left font-bold text-zinc-500">Cod</th>
                        <th className="px-2 py-1 text-left font-bold text-zinc-500">Denumire</th>
                        <th className="px-2 py-1 text-right font-bold text-zinc-500">Sj/h</th>
                        <th className="px-2 py-1 text-right font-bold text-zinc-500">Cap.</th>
                        <th className="px-2 py-1 text-right font-bold text-zinc-500">Buc</th>
                      </tr></thead>
                      <tbody>
                        {pastePreview.items.map((item, i) => (
                          <tr key={i} className="border-b border-zinc-100">
                            <td className="px-2 py-1 font-mono">{item.cod}</td>
                            <td className="px-2 py-1">{item.nm || '—'}</td>
                            <td className="px-2 py-1 text-right">{item.sjh}</td>
                            <td className="px-2 py-1 text-right">{item.cph}</td>
                            <td className="px-2 py-1 text-right">{item.buc}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 px-4 py-3 border-t border-zinc-200 shrink-0">
              <button onClick={() => { setPasteModal(false); setPastePreview(null); setPasteText(''); }}
                className="px-4 h-9 border border-zinc-200 text-sm rounded-sm hover:bg-zinc-50">Anulare</button>
              <button onClick={handlePasteImport} disabled={!pastePreview || !pastePreview.items.length}
                className="flex items-center gap-2 px-4 h-9 bg-orange-600 text-white text-sm rounded-sm hover:bg-orange-700 disabled:opacity-40">
                <Check className="w-4 h-4" /> Importă {pastePreview?.items.length || 0} materiale
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
