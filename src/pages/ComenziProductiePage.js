import React, { useState, useMemo, useCallback } from 'react';
import { useDataContext } from '../contexts/DataContext';
import {
  LINES, STATUS_CONFIG, uid, fmtDate, calcTargetQty, calcRemainingQty,
  calcCpMetrics, genNrCP, getEligibleForMaterial, round2, p2
} from '../contexts/DataStore';
import { Plus, Trash2, Edit2, Check, X, ChevronRight, AlertCircle, Clock, Package, Info } from 'lucide-react';

// ── Status CP ────────────────────────────────────────────────────────────────
const CP_STATUS = {
  Draft:        { label: 'Draft',        bg: 'bg-zinc-100',    text: 'text-zinc-600'   },
  Planificata:  { label: 'Planificată',  bg: 'bg-blue-100',    text: 'text-blue-700'   },
  'In productie':{ label: 'În producție',bg: 'bg-orange-100',  text: 'text-orange-700' },
  Finalizata:   { label: 'Finalizată',   bg: 'bg-green-100',   text: 'text-green-700'  },
  Anulata:      { label: 'Anulată',      bg: 'bg-red-100',     text: 'text-red-700'    },
};

function CPStatusBadge({ status }) {
  const cfg = CP_STATUS[status] || CP_STATUS.Draft;
  return <span className={`inline-flex px-2 py-0.5 rounded-sm text-[10px] font-semibold ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>;
}

function fmt(d) {
  if (!d) return '—';
  const x = new Date(d);
  if (isNaN(x)) return '—';
  return `${p2(x.getDate())}/${p2(x.getMonth()+1)}/${x.getFullYear()}`;
}
function fmtHour(d) {
  if (!d) return '';
  const x = new Date(d);
  if (isNaN(x)) return '';
  return `${p2(x.getHours())}:${p2(x.getMinutes())}`;
}
function lineNume(cod) {
  return LINES.find(l => l.id === cod || l.cod === cod)?.nume || cod || '—';
}

// ═══════════════════════════════════════════════════════
//  CP MODAL — creare / ajustare
// ═══════════════════════════════════════════════════════
function CPModal({ cp, onClose, onSave, store }) {
  const isEdit = !!cp?._id;
  const comenzi = store?.comenzi || [];
  const materiale = store?.materiale || {};

  const [form, setForm] = useState(() => {
    if (isEdit && cp) {
      return {
        cod: cp.cod || '',
        line: cp.line || LINES[0].id,
        date: cp.dstart ? fmtDate(cp.dstart) : fmtDate(new Date()),
        oraStart: cp.oraStart || '07:00',
        changeoverMin: cp.changeoverMin || 120,
        status: cp.status || 'Planificata',
        notes: cp.notes || '',
        sarjeManuale: '',
      };
    }
    return {
      cod: '', line: LINES[0].id,
      date: fmtDate(new Date()), oraStart: '07:00',
      changeoverMin: 120, status: 'Planificata', notes: '', sarjeManuale: '',
    };
  });

  // Tab: 'asociate' | 'neplanificate'
  const [tab, setTab] = useState('neplanificate');
  // selected: { [_id]: qty }
  const [selected, setSelected] = useState(() => {
    if (isEdit && cp?.srcRefs) {
      const sel = {};
      (cp.srcRefs || []).forEach(id => {
        const cmd = comenzi.find(c => c._id === id);
        if (cmd) sel[id] = calcRemainingQty(cmd);
      });
      return sel;
    }
    return {};
  });

  // Calcule automate din material
  const mat = materiale[form.cod];
  const eligibile = useMemo(() => getEligibleForMaterial(comenzi, form.cod), [comenzi, form.cod]);
  const asociate = useMemo(() => {
    if (!isEdit || !cp?.srcRefs) return [];
    return (cp.srcRefs || []).map(id => comenzi.find(c => c._id === id)).filter(Boolean);
  }, [isEdit, cp, comenzi]);

  const listCurenta = tab === 'asociate' ? asociate : eligibile.filter(c => !(cp?.srcRefs||[]).includes(c._id));

  const totalQty = useMemo(() =>
    Object.entries(selected).reduce((a, [, v]) => a + (Number(v) || 0), 0)
  , [selected]);

  const metrics = useMemo(() => {
    if (!mat || !totalQty) return null;
    const m = calcCpMetrics(mat, totalQty);
    // Sarje manuale override ±10%
    if (form.sarjeManuale) {
      const sMan = parseInt(form.sarjeManuale) || 0;
      const sAuto = m.sarje;
      if (sMan > 0 && Math.abs(sMan - sAuto) / Math.max(sAuto, 1) <= 0.1) {
        m.sarje = sMan;
        m.durHFram = mat.sjh > 0 ? round2(sMan / mat.sjh) : m.durHFram;
      }
    }
    return m;
  }, [mat, totalQty, form.sarjeManuale]);

  // Calcul ora start producție
  const dstart = useMemo(() => {
    if (!form.date || !form.oraStart) return null;
    const [hh, mm] = form.oraStart.split(':').map(Number);
    const d = new Date(form.date);
    d.setHours(hh, mm, 0, 0);
    return d;
  }, [form.date, form.oraStart]);

  // Calcul ora final producție
  const dfinal = useMemo(() => {
    if (!dstart || !metrics) return null;
    return new Date(dstart.getTime() + metrics.durH * 3600000);
  }, [dstart, metrics]);

  // Calcul ora schimb sortiment
  const dchangeover = useMemo(() => {
    if (!dfinal) return null;
    return new Date(dfinal.getTime());
  }, [dfinal]);

  // NrCP generat
  const nrCP = useMemo(() => {
    if (!dstart || !form.cod) return isEdit ? cp?.nrCP : '';
    return isEdit ? cp?.nrCP : genNrCP(dstart, form.cod);
  }, [dstart, form.cod, isEdit, cp]);

  const toggleSelect = (id, maxQty) => {
    setSelected(prev => {
      const next = { ...prev };
      if (next[id] !== undefined) delete next[id];
      else next[id] = maxQty;
      return next;
    });
  };

  const setQty = (id, val) => {
    const n = parseFloat(val) || 0;
    setSelected(prev => ({ ...prev, [id]: n }));
  };

  const handleSave = () => {
    if (!form.cod) { alert('Introdu codul de material.'); return; }
    if (!mat) { alert(`Materialul ${form.cod} nu există în Date Material. Adaugă-l mai întâi.`); return; }
    if (!Object.keys(selected).length) { alert('Selectează cel puțin un PSF/PSC.'); return; }
    if (!metrics) { alert('Nu s-au putut calcula metricile.'); return; }

    const srcRefs = Object.keys(selected);
    const srcPS = srcRefs.map(id => comenzi.find(c => c._id === id)?.nrPS).filter(Boolean);

    const cpData = {
      _id: isEdit ? cp._id : uid(),
      nrCP,
      cod: form.cod,
      desc: mat.nm || '',
      line: form.line,
      dstart,
      ddue: srcRefs.map(id => {
        const c = comenzi.find(x => x._id === id);
        return c?.dagr || c?.dlim;
      }).filter(Boolean).sort()[0] || null,
      oraStart: form.oraStart,
      pal: metrics.pal,
      sarje: metrics.sarje,
      durH: metrics.durH,
      durHFram: metrics.durHFram,
      durHAmb: metrics.durHAmb,
      changeoverMin: Number(form.changeoverMin) || 120,
      status: form.status,
      notes: form.notes,
      srcRefs,
      srcPS,
      srcQty: selected,
      manualTimeline: true,
    };

    onSave(cpData, isEdit);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-sm border border-zinc-200 w-full max-w-3xl max-h-[90vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200 bg-zinc-50 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 font-['Work_Sans']">
              {isEdit ? 'Ajustează Comandă Producție' : 'Comandă Producție Nouă'}
            </h2>
            {nrCP && <p className="text-xs text-zinc-500 mt-0.5 font-mono">{nrCP}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-200 rounded"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Rând 1: Cod + Linie + Data + Ora */}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">Cod Material *</label>
              <input value={form.cod} onChange={e => setForm(f => ({ ...f, cod: e.target.value.trim() }))}
                placeholder="ex: 6000201"
                disabled={isEdit}
                className="w-full h-9 px-3 border border-zinc-200 rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:bg-zinc-50 font-mono" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">Linie Producție *</label>
              <select value={form.line} onChange={e => setForm(f => ({ ...f, line: e.target.value }))}
                className="w-full h-9 px-2 border border-zinc-200 rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 bg-white">
                {LINES.map(l => <option key={l.id} value={l.id}>{l.nume}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">Data Start *</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full h-9 px-3 border border-zinc-200 rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-orange-500" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">Ora Start</label>
              <input type="time" value={form.oraStart} onChange={e => setForm(f => ({ ...f, oraStart: e.target.value }))}
                className="w-full h-9 px-3 border border-zinc-200 rounded-sm text-sm font-mono focus:outline-none focus:ring-1 focus:ring-orange-500" />
            </div>
          </div>

          {/* Material info */}
          {form.cod && (
            <div className={`rounded-sm p-3 text-xs flex items-start gap-3 ${mat ? 'bg-blue-50 border border-blue-200' : 'bg-red-50 border border-red-200'}`}>
              {mat ? (
                <>
                  <Package className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="font-semibold text-blue-800">{mat.nm}</span>
                    <div className="flex gap-4 mt-1 text-blue-700">
                      <span>Sarje/h: <strong>{mat.sjh}</strong></span>
                      <span>Cap. pal/h: <strong>{mat.cph}</strong></span>
                      <span>Cap. reală: <strong>{mat.cpr}</strong></span>
                      <span>Buc/palet: <strong>{mat.buc}</strong></span>
                      <span>Offset amb.: <strong>{mat.off}h</strong></span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span className="text-red-700">Codul <strong>{form.cod}</strong> nu există în Date Material. <a href="/materiale" className="underline">Adaugă-l →</a></span>
                </>
              )}
            </div>
          )}

          {/* PSF/PSC + Metrici side by side */}
          <div className="grid grid-cols-5 gap-4">
            {/* Stânga: PSF/PSC list */}
            <div className="col-span-3">
              {/* Taburi */}
              <div className="flex border-b border-zinc-200 mb-2">
                {[['neplanificate', 'Neprogramate'], ['asociate', 'Asociate CP']].map(([key, lbl]) => (
                  <button key={key} onClick={() => setTab(key)}
                    className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${tab === key ? 'border-orange-600 text-orange-700' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}>
                    {lbl}
                    {key === 'neplanificate' && <span className="ml-1 bg-zinc-100 text-zinc-600 rounded px-1">{eligibile.filter(c => !(cp?.srcRefs||[]).includes(c._id)).length}</span>}
                    {key === 'asociate' && <span className="ml-1 bg-orange-100 text-orange-700 rounded px-1">{Object.keys(selected).length}</span>}
                  </button>
                ))}
              </div>

              {!form.cod && (
                <div className="text-xs text-zinc-400 text-center py-6">Introdu codul de material pentru a vedea PSF/PSC eligibile</div>
              )}

              {form.cod && listCurenta.length === 0 && (
                <div className="text-xs text-zinc-400 text-center py-6">
                  {tab === 'asociate' ? 'Niciun PSF/PSC asociat.' : `Niciun PSF/PSC ${tab === 'neplanificate' ? 'neprogramat' : ''} pentru ${form.cod}.`}
                </div>
              )}

              {form.cod && listCurenta.length > 0 && (
                <div className="border border-zinc-200 rounded-sm overflow-auto max-h-52">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-zinc-50 border-b border-zinc-200 sticky top-0">
                      <th className="w-8 px-2 py-1.5"></th>
                      <th className="text-left px-2 py-1.5 font-bold text-zinc-500">PSF NR</th>
                      <th className="text-left px-2 py-1.5 font-bold text-zinc-500">Client</th>
                      <th className="text-right px-2 py-1.5 font-bold text-zinc-500">Rămas</th>
                      <th className="text-right px-2 py-1.5 font-bold text-zinc-500">Planificat</th>
                      <th className="text-left px-2 py-1.5 font-bold text-zinc-500">Limită</th>
                    </tr></thead>
                    <tbody>
                      {listCurenta.map(cmd => {
                        const rem = calcRemainingQty(cmd);
                        const isSel = selected[cmd._id] !== undefined;
                        const statusCfg = STATUS_CONFIG[cmd.status] || {};
                        return (
                          <tr key={cmd._id}
                            className={`border-b border-zinc-50 cursor-pointer transition-colors ${isSel ? 'bg-orange-50' : 'hover:bg-zinc-50'}`}
                            onClick={() => toggleSelect(cmd._id, rem)}>
                            <td className="px-2 py-1.5 text-center">
                              <input type="checkbox" checked={isSel} readOnly className="accent-orange-600" />
                            </td>
                            <td className="px-2 py-1.5 font-mono text-zinc-800">{cmd.nrPS || '—'}</td>
                            <td className="px-2 py-1.5 text-zinc-600 max-w-[100px] truncate">{cmd.client || '—'}</td>
                            <td className="px-2 py-1.5 text-right font-semibold text-zinc-800">{rem}</td>
                            <td className="px-2 py-1.5 text-right" onClick={e => e.stopPropagation()}>
                              {isSel && (
                                <input type="number" value={selected[cmd._id]} min="0" max={rem}
                                  onChange={e => setQty(cmd._id, e.target.value)}
                                  className="w-16 h-6 px-1 border border-orange-300 rounded text-right text-xs bg-orange-50 focus:outline-none" />
                              )}
                            </td>
                            <td className="px-2 py-1.5">
                              {cmd.dlim && <span className="text-zinc-500">{fmt(cmd.dlim)}</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Dreapta: Rezumat + Calcule */}
            <div className="col-span-2 space-y-3">
              {/* Cantitate și calcule */}
              <div className="bg-zinc-50 border border-zinc-200 rounded-sm p-3">
                <div className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-2">Rezumat Comandă</div>

                <div className="space-y-1.5 text-xs text-zinc-700">
                  <div className="flex justify-between">
                    <span>PSF/PSC selectate:</span>
                    <strong>{Object.keys(selected).length}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Total cantitate:</span>
                    <strong className="text-orange-700">{totalQty} buc</strong>
                  </div>
                </div>

                {metrics && (
                  <>
                    <div className="border-t border-zinc-200 my-2" />
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { l: 'Paleți', v: metrics.pal, c: 'text-orange-700' },
                        { l: 'Sarje', v: metrics.sarje, c: 'text-blue-700' },
                        { l: 'Ore frăm.', v: metrics.durHFram + 'h', c: 'text-zinc-700' },
                        { l: 'Ore amb.', v: metrics.durHAmb + 'h', c: 'text-zinc-700' },
                      ].map(m => (
                        <div key={m.l} className="bg-white border border-zinc-200 rounded-sm p-2 text-center">
                          <div className={`text-base font-semibold ${m.c} font-['Work_Sans']`}>{m.v}</div>
                          <div className="text-[9px] text-zinc-500 uppercase tracking-wide">{m.l}</div>
                        </div>
                      ))}
                    </div>

                    {/* Timeline */}
                    {dstart && dfinal && (
                      <div className="mt-2 space-y-1 text-[10px] text-zinc-600">
                        <div className="flex justify-between">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Start producție:</span>
                          <strong className="font-mono">{fmt(dstart)} {fmtHour(dstart)}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Final efectiv:</span>
                          <strong className="font-mono">{fmt(dfinal)} {fmtHour(dfinal)}</strong>
                        </div>
                        <div className="flex justify-between text-amber-700">
                          <span>Schimb sortiment:</span>
                          <strong className="font-mono">{fmt(dchangeover)} {fmtHour(dchangeover)} (+{form.changeoverMin}min)</strong>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {!metrics && totalQty > 0 && !mat && (
                  <div className="mt-2 text-xs text-red-600">Adaugă materialul în Date Material pentru calcule automate.</div>
                )}
              </div>

              {/* Câmpuri extra */}
              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">
                  Sarje manuale <span className="text-zinc-400 normal-case">(±10% față de auto)</span>
                </label>
                <input type="number" value={form.sarjeManuale} onChange={e => setForm(f => ({ ...f, sarjeManuale: e.target.value }))}
                  placeholder={metrics ? String(metrics.sarje) : 'Auto'}
                  className="w-full h-8 px-2 border border-zinc-200 rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">Schimb sortiment (min)</label>
                <input type="number" value={form.changeoverMin} onChange={e => setForm(f => ({ ...f, changeoverMin: e.target.value }))}
                  className="w-full h-8 px-2 border border-zinc-200 rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full h-8 px-2 border border-zinc-200 rounded-sm text-sm focus:outline-none bg-white">
                  {Object.entries(CP_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">Note</label>
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Observații opționale..."
              className="w-full h-8 px-3 border border-zinc-200 rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-orange-500" />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-zinc-200 shrink-0 bg-zinc-50">
          <button onClick={onClose} className="px-4 h-9 border border-zinc-200 text-sm rounded-sm hover:bg-zinc-100 text-zinc-700">
            Anulare
          </button>
          <button onClick={handleSave}
            className="flex items-center gap-2 px-5 h-9 bg-orange-600 text-white text-sm font-medium rounded-sm hover:bg-orange-700">
            <Check className="w-4 h-4" />
            {isEdit ? 'Salvează modificările' : 'Creează CP'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  PAGINA COMENZI PRODUCȚIE
// ═══════════════════════════════════════════════════════
export default function ComenziProductiePage() {
  const { store, addCP, updateCP, deleteCP, updateComanda } = useDataContext();
  const [modal, setModal] = useState(null); // null | { cp?: CP, mode: 'add'|'edit' }
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [lineFilter, setLineFilter] = useState('all');
  const [detailId, setDetailId] = useState(null);

  const prod = store?.prod || [];

  const filtered = useMemo(() => {
    return prod.filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (lineFilter !== 'all' && p.line !== lineFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!p.nrCP?.toLowerCase().includes(s) && !p.cod?.toLowerCase().includes(s) &&
            !p.desc?.toLowerCase().includes(s)) return false;
      }
      return true;
    }).sort((a, b) => {
      const da = a.dstart ? new Date(a.dstart).getTime() : 0;
      const db = b.dstart ? new Date(b.dstart).getTime() : 0;
      return db - da;
    });
  }, [prod, statusFilter, lineFilter, search]);

  const detailCP = detailId ? prod.find(p => p._id === detailId) : null;

  const handleSave = (cpData, isEdit) => {
    if (isEdit) {
      updateCP(cpData._id, cpData);
    } else {
      addCP(cpData);
    }
    // Update PS status
    const comenzi = store?.comenzi || [];
    (cpData.srcRefs || []).forEach(id => {
      const cmd = comenzi.find(c => c._id === id);
      if (cmd) {
        const rem = calcRemainingQty(cmd);
        const qty = cpData.srcQty?.[id] || 0;
        const newStatus = qty >= rem ? 'Programat' : 'Partial';
        updateComanda(id, { status: newStatus, dprog: cpData.dstart ? fmtDate(cpData.dstart) : cmd.dprog, liniePlan: cpData.line });
      }
    });
    setModal(null);
  };

  const handleDelete = (id) => {
    if (!window.confirm('Ștergi comanda de producție? Alocările PSF/PSC vor fi eliberate.')) return;
    const cp = prod.find(p => p._id === id);
    if (cp) {
      // Release PSF/PSC allocations
      (cp.srcRefs || []).forEach(srcId => {
        const cmd = store?.comenzi?.find(c => c._id === srcId);
        if (cmd && cmd.status === 'Programat') updateComanda(srcId, { status: 'Neprogramat', dprog: null });
      });
    }
    deleteCP(id);
    if (detailId === id) setDetailId(null);
  };

  return (
    <div className="p-4 h-full flex flex-col" data-testid="cp-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 font-['Work_Sans']">Comenzi Producție</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{filtered.length} din {prod.length} comenzi</p>
        </div>
        <button onClick={() => setModal({ mode: 'add' })}
          className="flex items-center gap-2 h-9 px-4 bg-orange-600 text-white text-sm font-medium rounded-sm hover:bg-orange-700">
          <Plus className="w-4 h-4" /> Comandă nouă
        </button>
      </div>

      {/* Filtre */}
      <div className="flex items-center gap-2 mb-3 shrink-0 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Caută Nr CP, cod material..."
          className="h-9 px-3 border border-zinc-200 rounded-sm text-sm w-56 focus:outline-none focus:ring-1 focus:ring-orange-500" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="h-9 px-2 border border-zinc-200 rounded-sm text-sm text-zinc-700 focus:outline-none bg-white">
          <option value="all">Toate statusurile</option>
          {Object.entries(CP_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={lineFilter} onChange={e => setLineFilter(e.target.value)}
          className="h-9 px-2 border border-zinc-200 rounded-sm text-sm text-zinc-700 focus:outline-none bg-white">
          <option value="all">Toate liniile</option>
          {LINES.map(l => <option key={l.id} value={l.id}>{l.nume}</option>)}
        </select>
        {(search || statusFilter !== 'all' || lineFilter !== 'all') && (
          <button onClick={() => { setSearch(''); setStatusFilter('all'); setLineFilter('all'); }}
            className="h-9 px-2 border border-zinc-200 text-xs text-zinc-500 rounded-sm hover:bg-zinc-50 flex items-center gap-1">
            <X className="w-3 h-3" /> Reset
          </button>
        )}
      </div>

      {/* Layout: tabel + detaliu */}
      <div className="flex-1 flex gap-3 min-h-0">
        {/* Tabel */}
        <div className="flex-1 border border-zinc-200 rounded-sm bg-white overflow-auto">
          <table className="w-full border-collapse text-sm min-w-[700px]">
            <thead className="sticky top-0 z-10 bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-zinc-500 w-40">Nr CP</th>
                <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-zinc-500">Material</th>
                <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-zinc-500">Linie</th>
                <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-zinc-500">Start</th>
                <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-zinc-500">Pal</th>
                <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-zinc-500">Sj</th>
                <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-zinc-500">Ore</th>
                <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-zinc-500">Status</th>
                <th className="px-3 py-2 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="text-center py-12 text-zinc-400 text-sm">
                  {prod.length === 0 ? 'Nicio comandă de producție. Click "+ Comandă nouă" pentru a crea.' : 'Niciun rezultat.'}
                </td></tr>
              )}
              {filtered.map(cp => {
                const ln = LINES.find(l => l.id === cp.line);
                const isSelected = detailId === cp._id;
                return (
                  <tr key={cp._id}
                    className={`border-b border-zinc-100 cursor-pointer transition-colors ${isSelected ? 'bg-orange-50' : 'hover:bg-zinc-50'}`}
                    onClick={() => setDetailId(isSelected ? null : cp._id)}>
                    <td className="px-3 py-2 font-mono text-xs text-zinc-800">{cp.nrCP || '—'}</td>
                    <td className="px-3 py-2">
                      <div className="text-xs font-medium text-zinc-800">{cp.desc || cp.cod || '—'}</div>
                      <div className="text-[10px] text-zinc-400 font-mono">{cp.cod}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        {ln && <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ln.color }} />}
                        <span className="text-xs text-zinc-700 truncate max-w-[120px]">{lineNume(cp.line)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-600 whitespace-nowrap font-mono">
                      {fmt(cp.dstart)}{cp.oraStart ? ` ${cp.oraStart}` : ''}
                    </td>
                    <td className="px-3 py-2 text-right text-xs font-semibold text-zinc-800">{cp.pal || 0}</td>
                    <td className="px-3 py-2 text-right text-xs text-zinc-600">{cp.sarje || 0}</td>
                    <td className="px-3 py-2 text-right text-xs text-zinc-600">{round2(cp.durH || 0)}h</td>
                    <td className="px-3 py-2"><CPStatusBadge status={cp.status} /></td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setModal({ mode: 'edit', cp })}
                          className="p-1.5 border border-zinc-200 text-zinc-500 rounded-sm hover:bg-zinc-100">
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button onClick={() => handleDelete(cp._id)}
                          className="p-1.5 border border-red-200 text-red-500 rounded-sm hover:bg-red-50">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Panou detaliu */}
        {detailCP && (
          <div className="w-72 border border-zinc-200 rounded-sm bg-white overflow-auto shrink-0">
            <div className="px-4 py-3 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-900 font-['Work_Sans'] truncate">{detailCP.nrCP}</h3>
              <button onClick={() => setDetailId(null)} className="p-1 hover:bg-zinc-200 rounded"><X className="w-3.5 h-3.5" /></button>
            </div>
            <div className="p-4 space-y-4 text-xs">
              {/* Material */}
              <div>
                <div className="text-[9px] uppercase tracking-widest font-bold text-zinc-400 mb-1">Material</div>
                <div className="font-medium text-zinc-800">{detailCP.desc || detailCP.cod}</div>
                <div className="font-mono text-zinc-500">{detailCP.cod}</div>
              </div>
              {/* Metrici */}
              <div className="grid grid-cols-3 gap-2">
                {[['Paleți', detailCP.pal||0, 'text-orange-700'], ['Sarje', detailCP.sarje||0, 'text-blue-700'], ['Ore', round2(detailCP.durH||0)+'h', 'text-zinc-700']].map(([l,v,c]) => (
                  <div key={l} className="bg-zinc-50 border border-zinc-200 rounded-sm p-2 text-center">
                    <div className={`text-sm font-semibold ${c} font-['Work_Sans']`}>{v}</div>
                    <div className="text-[9px] text-zinc-500 uppercase">{l}</div>
                  </div>
                ))}
              </div>
              {/* Timeline */}
              <div>
                <div className="text-[9px] uppercase tracking-widest font-bold text-zinc-400 mb-1">Timeline</div>
                <div className="space-y-1">
                  {[['Start', detailCP.dstart], ['Termen', detailCP.ddue]].map(([l,d]) => d && (
                    <div key={l} className="flex justify-between">
                      <span className="text-zinc-500">{l}:</span>
                      <span className="font-mono font-medium text-zinc-700">{fmt(d)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between">
                    <span className="text-amber-600">Sch. sort.:</span>
                    <span className="text-amber-700 font-medium">{detailCP.changeoverMin||120} min</span>
                  </div>
                </div>
              </div>
              {/* PSF/PSC Surse */}
              {detailCP.srcPS?.length > 0 && (
                <div>
                  <div className="text-[9px] uppercase tracking-widest font-bold text-zinc-400 mb-1">Surse PSF/PSC ({detailCP.srcPS.length})</div>
                  <div className="space-y-1">
                    {detailCP.srcPS.map((nr, i) => {
                      const id = detailCP.srcRefs?.[i];
                      const cmd = id ? store?.comenzi?.find(c => c._id === id) : null;
                      return (
                        <div key={nr} className="flex items-center justify-between bg-zinc-50 rounded px-2 py-1">
                          <span className="font-mono text-zinc-700">{nr}</span>
                          {cmd && <span className="text-zinc-500">{detailCP.srcQty?.[id]||0} buc</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* Acțiuni */}
              <div className="space-y-1.5 pt-1">
                <button onClick={() => setModal({ mode: 'edit', cp: detailCP })}
                  className="w-full h-8 border border-zinc-200 text-xs text-zinc-700 rounded-sm hover:bg-zinc-50 flex items-center justify-center gap-1.5">
                  <Edit2 className="w-3 h-3" /> Ajustează CP
                </button>
                <button onClick={() => handleDelete(detailCP._id)}
                  className="w-full h-8 border border-red-200 text-xs text-red-600 rounded-sm hover:bg-red-50 flex items-center justify-center gap-1.5">
                  <Trash2 className="w-3 h-3" /> Șterge CP
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal CP */}
      {modal && (
        <CPModal
          cp={modal.cp}
          onClose={() => setModal(null)}
          onSave={handleSave}
          store={store}
        />
      )}
    </div>
  );
}
