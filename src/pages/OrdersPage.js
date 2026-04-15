import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Upload, Plus, Trash2, X, Check, Search, Filter, Calendar, ChevronDown } from 'lucide-react';

const TABS = [
  { key: 'ps', label: 'Comenzi PS', endpoint: '/orders/ps' },
  { key: 'maintenance', label: 'Mentenanta', endpoint: '/orders/maintenance' },
  { key: 'hygiene', label: 'Igienizare', endpoint: '/orders/hygiene' },
  { key: 'ddd', label: 'DDD', endpoint: '/orders/ddd' },
  { key: 'cdi', label: 'CDI', endpoint: '/orders/cdi' },
];

function getWeekNum(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return '';
    const oneJan = new Date(d.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((d - oneJan) / 86400000) + 1;
    return 'W' + Math.ceil((dayOfYear + oneJan.getDay()) / 7);
  } catch { return ''; }
}

const PS_COLS = [
  { key: 'client', label: 'Client', w: 130 },
  { key: 'cod_material', label: 'Cod Material', w: 85 },
  { key: 'descriere_material', label: 'Descriere', w: 160 },
  { key: 'psf_nr', label: 'PSF NR', w: 140 },
  { key: 'cantitate', label: 'Cant.', w: 55 },
  { key: 'saptamana', label: 'Sapt', w: 50 },
  { key: 'data_limita_punere_stoc', label: 'Data limita stoc', w: 100, isDate: true },
  { key: 'data_noua_punere_stoc', label: 'Data noua', w: 100, isDate: true },
  { key: 'status', label: 'Status', w: 80 },
  { key: 'linie_sugerata', label: 'Linie sugerata', w: 110 },
  { key: 'linie_planificata', label: 'Linie planif.', w: 100 },
  { key: 'data_planificata', label: 'Data planif.', w: 90, isDate: true },
];

const MNT_COLS = [
  { key: 'cod', label: 'COD', w: 130 },
  { key: 'intern_extern', label: 'Int/Ext', w: 70 },
  { key: 'fabrica', label: 'Fabrica', w: 80 },
  { key: 'linie_productie', label: 'Linie', w: 120 },
  { key: 'sub_ansamblu', label: 'Sub-ansamblu', w: 140 },
  { key: 'prioritate', label: 'Prioritate', w: 80 },
  { key: 'data', label: 'Data', w: 130, isDate: true },
  { key: 'timp_interventie_ore', label: 'Ore', w: 50 },
  { key: 'status', label: 'Status', w: 90 },
];

const HYG_COLS = [
  { key: 'cod', label: 'COD', w: 130 },
  { key: 'fabrica', label: 'Fabrica', w: 80 },
  { key: 'linie_productie', label: 'Linie', w: 120 },
  { key: 'sub_ansamblu_zona', label: 'Sub-ansamblu/Zona', w: 150 },
  { key: 'data', label: 'Data', w: 130, isDate: true },
  { key: 'status', label: 'Status', w: 90 },
];

const CDI_COLS = [
  { key: 'cod', label: 'COD', w: 100 },
  { key: 'proiect', label: 'Proiect', w: 120 },
  { key: 'descriere', label: 'Descriere', w: 180 },
  { key: 'linie_productie', label: 'Linie', w: 120 },
  { key: 'responsabil', label: 'Responsabil', w: 100 },
  { key: 'data_limita', label: 'Data limita', w: 130, isDate: true },
  { key: 'status', label: 'Status', w: 90 },
];

function getCols(tab) {
  if (tab === 'ps') return PS_COLS;
  if (tab === 'maintenance') return MNT_COLS;
  if (tab === 'hygiene' || tab === 'ddd') return HYG_COLS;
  if (tab === 'cdi') return CDI_COLS;
  return PS_COLS;
}

const STATUS_COLORS = {
  nou: 'bg-blue-100 text-blue-700',
  planificat: 'bg-green-100 text-green-700',
  partial_planificat: 'bg-amber-100 text-amber-700',
  in_lucru: 'bg-amber-100 text-amber-700',
  fabricat: 'bg-zinc-200 text-zinc-700',
  finalizat: 'bg-zinc-100 text-zinc-600',
  anulat: 'bg-red-100 text-red-700',
};

export default function OrdersPage() {
  const { api } = useAuth();
  const [activeTab, setActiveTab] = useState('ps');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const fileRef = useRef();

  const currentTab = TABS.find(t => t.key === activeTab);
  const cols = getCols(activeTab);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get(currentTab.endpoint);
      setOrders(res.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, [activeTab]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await api.post(`${currentTab.endpoint}/upload`, fd);
      alert(`Import reusit: ${res.data.imported} inregistrari`);
      fetchOrders();
    } catch (err) {
      alert('Eroare: ' + (err.response?.data?.detail || err.message));
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Stergi aceasta comanda?')) return;
    await api.delete(`${currentTab.endpoint}/${id}`);
    fetchOrders();
  };

  // Column filtering
  const filtered = useMemo(() => {
    return orders.filter(o => {
      for (const [colKey, filterVal] of Object.entries(filters)) {
        if (!filterVal) continue;
        const val = String(o[colKey] || '').toLowerCase();
        if (!val.includes(filterVal.toLowerCase())) return false;
      }
      return true;
    });
  }, [orders, filters]);

  const updateFilter = (colKey, val) => {
    setFilters(prev => ({ ...prev, [colKey]: val }));
  };

  const getCellValue = (order, col) => {
    if (col.key === '_planning_info') {
      if (order.status === 'planificat' || order.status === 'partial_planificat') {
        return `${order.linie_planificata || '-'} ${order.data_planificata || ''}`;
      }
      return '-';
    }
    return order[col.key];
  };

  return (
    <div className="p-6" data-testid="orders-page">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 font-['Work_Sans']">Comenzi Input</h1>
        <p className="text-sm text-zinc-500 mt-1">Gestionare comenzi cu filtre pe coloane si programare rapida</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-200 mb-4 flex gap-0" data-testid="orders-tabs">
        {TABS.map(tab => (
          <button key={tab.key} data-testid={`tab-${tab.key}`}
            onClick={() => { setActiveTab(tab.key); setFilters({}); setShowForm(false); }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? 'border-orange-600 text-orange-700 bg-orange-50/50' : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 mb-3">
        <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleUpload} className="hidden" />
        <button data-testid="upload-btn" onClick={() => fileRef.current?.click()} disabled={uploading}
          className="flex items-center gap-2 h-8 px-3 border border-zinc-200 rounded-sm text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">
          <Upload className="w-3.5 h-3.5" />{uploading ? 'Se uploadeaza...' : 'Upload Excel'}
        </button>
        <button data-testid="add-order-btn" onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 h-8 px-3 bg-orange-600 hover:bg-orange-700 text-white rounded-sm text-xs font-medium">
          <Plus className="w-3.5 h-3.5" />Adauga
        </button>
        {selectedIds.length > 0 && (
          <button onClick={() => setShowBatchModal(true)} data-testid="batch-plan-btn"
            className="flex items-center gap-2 h-8 px-3 bg-green-600 hover:bg-green-700 text-white rounded-sm text-xs font-medium">
            <Calendar className="w-3.5 h-3.5" />Planifica rapid ({selectedIds.length})
          </button>
        )}
        {Object.values(filters).some(Boolean) && (
          <button onClick={() => setFilters({})} className="flex items-center gap-1 h-8 px-3 text-xs text-red-600 hover:bg-red-50 rounded-sm border border-red-200">
            <X className="w-3 h-3" />Sterge filtre
          </button>
        )}
        <span className="text-xs text-zinc-400 ml-auto">{filtered.length} / {orders.length} inregistrari</span>
      </div>

      {showForm && <AddOrderForm tab={activeTab} api={api} onDone={() => { setShowForm(false); fetchOrders(); }} />}

      {/* Table with column filters */}
      <div className="border border-zinc-200 rounded-sm bg-white overflow-x-auto">
        <table className="w-full text-xs" data-testid="orders-table">
          <thead>
            {/* Header row */}
            <tr className="bg-zinc-50 border-b border-zinc-200">
              <th className="px-2 py-1.5 text-center w-8">
                <input type="checkbox" onChange={e => { if (e.target.checked) setSelectedIds(filtered.map(o => o.id)); else setSelectedIds([]); }} className="accent-orange-600" />
              </th>
              <th className="px-2 py-1.5 text-left text-[9px] uppercase tracking-widest font-bold text-zinc-500 w-6">#</th>
              {cols.map(c => (
                <th key={c.key} className="px-2 py-1.5 text-left text-[9px] uppercase tracking-widest font-bold text-zinc-500" style={{ minWidth: c.w }}>
                  {c.isDate && <span className="text-orange-500 mr-0.5">W</span>}
                  {c.label}
                </th>
              ))}
              <th className="px-2 py-1.5 w-10"></th>
            </tr>
            {/* Filter row */}
            <tr className="bg-zinc-50/50 border-b border-zinc-200">
              <td></td>
              <td className="px-2 py-1"><Filter className="w-3 h-3 text-zinc-300" /></td>
              {cols.map(c => (
                <td key={c.key} className="px-1 py-1">
                  {!c.computed && (
                    <input type="text" placeholder="Filtru..." value={filters[c.key] || ''}
                      onChange={e => updateFilter(c.key, e.target.value)}
                      className="w-full h-6 px-1.5 border border-zinc-200 rounded-sm text-[10px] focus:ring-1 focus:ring-orange-500 bg-white"
                      data-testid={`filter-${c.key}`} />
                  )}
                </td>
              ))}
              <td></td>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={cols.length + 2} className="px-3 py-6 text-center text-zinc-400 text-xs">Se incarca...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={cols.length + 2} className="px-3 py-6 text-center text-zinc-400 text-xs">Nicio comanda gasita.</td></tr>
            ) : filtered.map((o, i) => (
              <tr key={o.id} className={`border-b border-zinc-100 hover:bg-zinc-50/50 ${selectedIds.includes(o.id) ? 'bg-orange-50/30' : ''}`}>
                <td className="px-2 py-1.5 text-center">
                  <input type="checkbox" checked={selectedIds.includes(o.id)} onChange={e => {
                    if (e.target.checked) setSelectedIds(p => [...p, o.id]);
                    else setSelectedIds(p => p.filter(id => id !== o.id));
                  }} className="accent-orange-600" />
                </td>
                <td className="px-2 py-1.5 text-zinc-400 font-mono text-[10px]">{i + 1}</td>
                {cols.map(c => {
                  const val = getCellValue(o, c);
                  return (
                    <td key={c.key} className="px-2 py-1.5 text-zinc-800 truncate" style={{ maxWidth: c.w }}>
                      {c.key === 'status' ? (
                        <span className={`inline-flex px-1.5 py-0.5 rounded-sm text-[10px] font-medium ${STATUS_COLORS[val] || 'bg-zinc-100 text-zinc-600'}`}>{val || '-'}</span>
                      ) : c.isDate ? (
                        <span className="flex items-center gap-1">
                          {val ? <span className="text-orange-600 font-mono text-[9px] bg-orange-50 px-1 rounded">{getWeekNum(val)}</span> : null}
                          <span>{val || '-'}</span>
                        </span>
                      ) : c.computed ? (
                        <span className="text-[10px] text-zinc-500">{val}</span>
                      ) : (
                        <span className="truncate block">{val ?? '-'}</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-2 py-1.5 text-right">
                  <button onClick={() => handleDelete(o.id)} className="p-0.5 text-zinc-400 hover:text-red-600">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showBatchModal && (
        <BatchPlanModal api={api} tab={activeTab} selectedOrders={filtered.filter(o => selectedIds.includes(o.id))}
          onClose={() => setShowBatchModal(false)} onDone={() => { setShowBatchModal(false); setSelectedIds([]); fetchOrders(); }} />
      )}
    </div>
  );
}

function BatchPlanModal({ api, tab, selectedOrders, onClose, onDone }) {
  const [lines, setLines] = useState([]);
  const [saving, setSaving] = useState(false);
  const [globalLine, setGlobalLine] = useState('');
  const [globalDate, setGlobalDate] = useState('');
  const [globalShift, setGlobalShift] = useState(1);

  useEffect(() => { api.get('/lines').then(r => setLines(r.data.filter(l => l.activ !== false))); }, [api]);

  const handleBatchCreate = async () => {
    if (!globalLine || !globalDate) { alert('Selectati linia si data!'); return; }
    setSaving(true);
    let created = 0;
    for (const order of selectedOrders) {
      try {
        if (tab === 'ps') {
          const d = new Date(globalDate);
          const wk = String(Math.ceil(((d - new Date(d.getFullYear(), 0, 1)) / 86400000 + 1) / 7)).padStart(2, '0');
          await api.post('/production-orders', {
            cod_comanda: `${String(d.getDate()).padStart(2, '0')}${wk}${d.getFullYear().toString().slice(-2)}${order.cod_material}`,
            cod_material: order.cod_material, descriere_material: order.descriere_material || '',
            linie_productie: globalLine, data_start: globalDate, schimb: globalShift,
            ora_start: globalShift === 1 ? '07:00' : globalShift === 2 ? '15:00' : '23:00',
            cantitate_paleti: order.cantitate || 0, psf_psc_refs: [order.psf_nr],
            durata_changeover: 120, status: 'planificat'
          });
        } else {
          const endpoint = tab === 'maintenance' ? 'maintenance' : tab === 'hygiene' ? 'hygiene' : tab === 'ddd' ? 'ddd' : 'cdi';
          await api.put(`/orders/${endpoint}/${order.id}`, { status: 'planificat', data: globalDate, schimb: globalShift });
        }
        created++;
      } catch (e) { console.error(e); }
    }
    alert(`${created} comenzi planificate cu succes!`);
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" data-testid="batch-plan-modal">
      <div className="bg-white rounded-sm border border-zinc-200 w-full max-w-xl shadow-lg">
        <div className="px-4 py-3 border-b bg-green-600 text-white flex items-center justify-between">
          <h3 className="text-sm font-medium">Planificare Rapida - {selectedOrders.length} comenzi</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Linie productie</label>
              <select value={globalLine} onChange={e => setGlobalLine(e.target.value)} className="w-full h-9 px-2 border border-zinc-200 rounded-sm text-sm">
                <option value="">Selecteaza...</option>
                {lines.map(l => <option key={l.cod} value={l.cod}>{l.nume}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Data</label>
              <input type="date" value={globalDate} onChange={e => setGlobalDate(e.target.value)} className="w-full h-9 px-2 border border-zinc-200 rounded-sm text-sm" />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Schimb</label>
              <select value={globalShift} onChange={e => setGlobalShift(parseInt(e.target.value))} className="w-full h-9 px-2 border border-zinc-200 rounded-sm text-sm">
                <option value={1}>S1 (07-15)</option><option value={2}>S2 (15-23)</option><option value={3}>S3 (23-07)</option>
              </select>
            </div>
          </div>
          <div className="border border-zinc-200 rounded-sm max-h-48 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-zinc-50"><tr className="border-b">
                <th className="px-2 py-1 text-left">#</th><th className="px-2 py-1 text-left">{tab === 'ps' ? 'PSF' : 'Cod'}</th><th className="px-2 py-1 text-left">Descriere</th><th className="px-2 py-1 text-right">Cant.</th>
              </tr></thead>
              <tbody>{selectedOrders.map((o, i) => (
                <tr key={o.id} className="border-b border-zinc-100">
                  <td className="px-2 py-1">{i+1}</td>
                  <td className="px-2 py-1 font-mono">{tab === 'ps' ? o.psf_nr : o.cod}</td>
                  <td className="px-2 py-1 truncate max-w-[200px]">{o.descriere_material || o.descriere || o.sub_ansamblu || '-'}</td>
                  <td className="px-2 py-1 text-right">{o.cantitate || '-'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t">
          <button onClick={onClose} className="px-4 h-9 border border-zinc-200 text-sm rounded-sm hover:bg-zinc-50">Anuleaza</button>
          <button onClick={handleBatchCreate} disabled={saving || !globalLine || !globalDate}
            className="flex items-center gap-2 px-4 h-9 bg-green-600 text-white text-sm rounded-sm hover:bg-green-700 disabled:opacity-50 font-medium" data-testid="batch-create-btn">
            <Check className="w-4 h-4" />{saving ? '...' : `Planifica ${selectedOrders.length}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddOrderForm({ tab, api, onDone }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const fields = tab === 'ps'
    ? [
        { key: 'client', label: 'Client', required: true },
        { key: 'cod_material', label: 'Cod Material', required: true },
        { key: 'descriere_material', label: 'Descriere Material' },
        { key: 'psf_nr', label: 'PSF NR', required: true },
        { key: 'cantitate', label: 'Cantitate (paleti)', type: 'number', required: true },
        { key: 'cel_mai_devreme', label: 'Cel mai devreme', type: 'date' },
        { key: 'data_limita_punere_stoc', label: 'Data limita punere stoc', type: 'date', required: true },
      ]
    : tab === 'maintenance'
    ? [
        { key: 'cod', label: 'COD', required: true },
        { key: 'intern_extern', label: 'Intern/Extern' },
        { key: 'fabrica', label: 'Fabrica', required: true },
        { key: 'linie_productie', label: 'Linie Productie', required: true },
        { key: 'sub_ansamblu', label: 'Sub-ansamblu Linie' },
        { key: 'prioritate', label: 'Prioritate' },
        { key: 'data', label: 'Data', type: 'date' },
        { key: 'timp_interventie_min', label: 'Timp (min)', type: 'number' },
      ]
    : tab === 'cdi'
    ? [
        { key: 'cod', label: 'COD' },
        { key: 'proiect', label: 'Proiect' },
        { key: 'descriere', label: 'Descriere' },
        { key: 'linie_productie', label: 'Linie' },
        { key: 'fabrica', label: 'Fabrica' },
        { key: 'responsabil', label: 'Responsabil' },
        { key: 'data_limita', label: 'Data Limita', type: 'date' },
      ]
    : [
        { key: 'cod', label: 'COD' },
        { key: 'fabrica', label: 'Fabrica', required: true },
        { key: 'linie_productie', label: 'Linie', required: true },
        { key: 'sub_ansamblu_zona', label: 'Sub-ansamblu/Zona' },
        { key: 'data', label: 'Data', type: 'date' },
      ];

  const endpoint = TABS.find(t => t.key === tab)?.endpoint;
  const handleSave = async () => {
    setSaving(true);
    try { await api.post(endpoint, form); onDone(); } catch (e) { alert(e.response?.data?.detail || e.message); }
    setSaving(false);
  };

  return (
    <div className="border border-orange-200 bg-orange-50/30 rounded-sm p-3 mb-3" data-testid="add-order-form">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
        {fields.map(f => (
          <div key={f.key}>
            <label className="block text-[9px] uppercase tracking-widest font-bold text-zinc-500 mb-0.5">{f.label}</label>
            <input data-testid={`input-${f.key}`} type={f.type || 'text'} value={form[f.key] || ''}
              onChange={e => setForm({ ...form, [f.key]: f.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value })}
              className="w-full h-8 px-2 border border-zinc-200 rounded-sm text-xs focus:ring-1 focus:ring-orange-600 bg-white" />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-1 h-7 px-3 bg-orange-600 text-white text-xs rounded-sm hover:bg-orange-700 disabled:opacity-50" data-testid="save-order-btn">
          <Check className="w-3 h-3" />Salveaza
        </button>
        <button onClick={onDone} className="h-7 px-3 border border-zinc-200 text-xs rounded-sm hover:bg-zinc-50">Anuleaza</button>
      </div>
    </div>
  );
}
