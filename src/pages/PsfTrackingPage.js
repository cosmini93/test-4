import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Check, X, Clock, AlertTriangle, CheckCircle, XCircle, History, ChevronDown } from 'lucide-react';

const STATUS_MAP = {
  nou: { label: 'Nou', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Clock },
  in_analiza: { label: 'In analiza', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: AlertTriangle },
  aprobat: { label: 'Aprobat', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle },
  respins: { label: 'Respins', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
};

export default function PsfTrackingPage() {
  const { api, user } = useAuth();
  const [mods, setMods] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMods = async () => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const res = await api.get(`/psf-modifications${params}`);
      setMods(res.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchMods(); }, [filter]);

  const handleStatusChange = async (modId, newStatus) => {
    try {
      await api.put(`/psf-modifications/${modId}`, {
        status: newStatus,
        _action: newStatus === 'aprobat' ? 'aprobat' : newStatus === 'respins' ? 'respins' : 'status_schimbat',
      });
      fetchMods();
    } catch (e) { alert(e.response?.data?.detail || e.message); }
  };

  return (
    <div className="p-6" data-testid="psf-tracking-page">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 font-['Work_Sans']">Modificari PSF/PSC</h1>
          <p className="text-sm text-zinc-500 mt-1">Tracking cereri modificare, aprobare, istoricul schimbarilor</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 h-9 px-4 bg-orange-600 text-white text-sm rounded-sm hover:bg-orange-700 font-medium" data-testid="add-mod-btn">
          <Plus className="w-4 h-4" />Cerere noua
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4" data-testid="psf-filters">
        {['all', 'nou', 'in_analiza', 'aprobat', 'respins'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs font-medium rounded-sm border transition-colors ${
              filter === f ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
            }`}>
            {f === 'all' ? 'Toate' : STATUS_MAP[f]?.label || f}
          </button>
        ))}
        <span className="text-xs text-zinc-400 ml-2">{mods.length} inregistrari</span>
      </div>

      {/* Add Form */}
      {showForm && <AddModForm api={api} onDone={() => { setShowForm(false); fetchMods(); }} />}

      {/* Modifications List */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-8 text-zinc-400">Se incarca...</div>
        ) : mods.length === 0 ? (
          <div className="text-center py-8 text-zinc-400 border border-zinc-200 rounded-sm bg-white">Nicio modificare gasita.</div>
        ) : mods.map(mod => {
          const st = STATUS_MAP[mod.status] || STATUS_MAP.nou;
          const StIcon = st.icon;
          const isExpanded = expandedId === mod.id;

          return (
            <div key={mod.id} className="border border-zinc-200 rounded-sm bg-white" data-testid={`mod-item-${mod.id}`}>
              {/* Header row */}
              <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-zinc-50/50" onClick={() => setExpandedId(isExpanded ? null : mod.id)}>
                <StIcon className={`w-4 h-4 shrink-0 ${st.color.split(' ')[1]}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-900 font-mono">{mod.psf_nr}</span>
                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded-sm border ${st.color}`}>{st.label}</span>
                    <span className="text-xs text-zinc-500">{mod.client}</span>
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    {mod.descriere_material} &middot; {mod.tip_modificare} &middot; Creat: {mod.created_at?.slice(0, 10)}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {mod.cantitate_originala !== undefined && (
                    <div className="text-xs">
                      <span className="text-zinc-400">Cantitate:</span>{' '}
                      <span className="text-zinc-800">{mod.cantitate_originala}</span>
                      {mod.noua_cantitate != null && mod.noua_cantitate !== mod.cantitate_originala && (
                        <span className="text-orange-600 font-medium"> → {mod.noua_cantitate}</span>
                      )}
                    </div>
                  )}
                  {mod.data_originala && (
                    <div className="text-xs">
                      <span className="text-zinc-400">Data:</span>{' '}
                      <span className="text-zinc-800">{mod.data_originala}</span>
                      {mod.noua_data && mod.noua_data !== mod.data_originala && (
                        <span className="text-orange-600 font-medium"> → {mod.noua_data}</span>
                      )}
                    </div>
                  )}
                </div>
                <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="border-t border-zinc-100 px-4 py-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div><span className="text-zinc-400">Motiv:</span> <span className="text-zinc-800">{mod.motiv || '-'}</span></div>
                    <div><span className="text-zinc-400">Solicitat de:</span> <span className="text-zinc-800">{mod.created_by_name || mod.solicitat_de || '-'}</span></div>
                    <div><span className="text-zinc-400">Tip:</span> <span className="text-zinc-800">{mod.tip_modificare}</span></div>
                    <div><span className="text-zinc-400">Cod material:</span> <span className="text-zinc-800 font-mono">{mod.cod_material}</span></div>
                  </div>

                  {/* History */}
                  {mod.history && mod.history.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1 mb-1 text-[10px] uppercase tracking-widest font-bold text-zinc-500">
                        <History className="w-3 h-3" />Istoric
                      </div>
                      <div className="space-y-1">
                        {mod.history.map((h, i) => (
                          <div key={i} className="flex items-center gap-2 text-[11px]">
                            <span className="w-2 h-2 rounded-full bg-zinc-300 shrink-0" />
                            <span className="text-zinc-500">{h.at?.slice(0, 16).replace('T', ' ')}</span>
                            <span className="font-medium text-zinc-700">{h.action}</span>
                            <span className="text-zinc-400">de {h.by}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  {mod.status !== 'aprobat' && mod.status !== 'respins' && (
                    <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
                      {mod.status === 'nou' && (
                        <button onClick={() => handleStatusChange(mod.id, 'in_analiza')}
                          className="flex items-center gap-1 px-3 h-7 bg-amber-100 text-amber-700 text-xs rounded-sm hover:bg-amber-200 border border-amber-200">
                          <AlertTriangle className="w-3 h-3" />Preia in analiza
                        </button>
                      )}
                      <button onClick={() => handleStatusChange(mod.id, 'aprobat')}
                        className="flex items-center gap-1 px-3 h-7 bg-green-100 text-green-700 text-xs rounded-sm hover:bg-green-200 border border-green-200" data-testid={`approve-${mod.id}`}>
                        <CheckCircle className="w-3 h-3" />Aproba
                      </button>
                      <button onClick={() => handleStatusChange(mod.id, 'respins')}
                        className="flex items-center gap-1 px-3 h-7 bg-red-100 text-red-700 text-xs rounded-sm hover:bg-red-200 border border-red-200" data-testid={`reject-${mod.id}`}>
                        <XCircle className="w-3 h-3" />Respinge
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AddModForm({ api, onDone }) {
  const [form, setForm] = useState({ tip_modificare: 'modificare' });
  const [saving, setSaving] = useState(false);
  const [psInfo, setPsInfo] = useState(null);

  const searchPsf = async () => {
    if (!form.psf_nr) return;
    try {
      const res = await api.get('/orders/ps');
      const found = res.data.find(o => o.psf_nr === form.psf_nr);
      if (found) {
        setPsInfo(found);
        setForm(prev => ({
          ...prev,
          client: found.client,
          cod_material: found.cod_material,
          descriere_material: found.descriere_material,
          cantitate_originala: found.cantitate,
          data_originala: found.data_limita_punere_stoc,
        }));
      }
    } catch (e) { console.error(e); }
  };

  const handleSave = async () => {
    if (!form.psf_nr) return;
    setSaving(true);
    try {
      await api.post('/psf-modifications', form);
      onDone();
    } catch (e) { alert(e.response?.data?.detail || e.message); }
    setSaving(false);
  };

  return (
    <div className="border border-orange-200 bg-orange-50/30 rounded-sm p-4 mb-4" data-testid="add-mod-form">
      <h4 className="text-sm font-medium text-zinc-800 mb-3">Cerere noua de modificare PSF/PSC</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <div>
          <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">PSF/PSC NR <span className="text-red-500">*</span></label>
          <div className="flex gap-1">
            <input value={form.psf_nr || ''} onChange={e => setForm({...form, psf_nr: e.target.value})}
              className="flex-1 h-9 px-3 border border-zinc-200 rounded-sm text-sm bg-white" placeholder="PSF-K3-W-14-01" data-testid="mod-psf-nr" />
            <button onClick={searchPsf} className="px-2 h-9 bg-zinc-800 text-white text-xs rounded-sm hover:bg-zinc-700">Cauta</button>
          </div>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">Client</label>
          <input value={form.client || ''} onChange={e => setForm({...form, client: e.target.value})} className="w-full h-9 px-3 border border-zinc-200 rounded-sm text-sm bg-white" />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">Tip modificare</label>
          <select value={form.tip_modificare || 'modificare'} onChange={e => setForm({...form, tip_modificare: e.target.value})} className="w-full h-9 px-3 border border-zinc-200 rounded-sm text-sm bg-white">
            <option value="modificare">Modificare</option>
            <option value="decalaj">Decalaj</option>
            <option value="anulare">Anulare</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">Noua cantitate</label>
          <input type="number" value={form.noua_cantitate || ''} onChange={e => setForm({...form, noua_cantitate: parseFloat(e.target.value) || 0})} className="w-full h-9 px-3 border border-zinc-200 rounded-sm text-sm bg-white" />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">Noua data</label>
          <input type="date" value={form.noua_data || ''} onChange={e => setForm({...form, noua_data: e.target.value})} className="w-full h-9 px-3 border border-zinc-200 rounded-sm text-sm bg-white" />
        </div>
        <div className="col-span-2">
          <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">Motiv <span className="text-red-500">*</span></label>
          <input value={form.motiv || ''} onChange={e => setForm({...form, motiv: e.target.value})} className="w-full h-9 px-3 border border-zinc-200 rounded-sm text-sm bg-white" placeholder="Motiv modificare..." data-testid="mod-motiv" />
        </div>
      </div>
      {psInfo && (
        <div className="text-xs text-zinc-500 bg-zinc-50 rounded-sm p-2 mb-3">
          <strong>Info PSF:</strong> {psInfo.client} &middot; {psInfo.descriere_material} &middot; {psInfo.cantitate} paleti &middot; Data limita: {psInfo.data_limita_punere_stoc}
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 h-8 px-4 bg-orange-600 text-white text-sm rounded-sm hover:bg-orange-700 disabled:opacity-50" data-testid="save-mod-btn">
          <Check className="w-3.5 h-3.5" />Trimite cerere
        </button>
        <button onClick={onDone} className="h-8 px-4 border border-zinc-200 text-sm rounded-sm hover:bg-zinc-50">Anuleaza</button>
      </div>
    </div>
  );
}
