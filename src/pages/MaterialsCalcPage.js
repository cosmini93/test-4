import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Calculator, Package, Search, ArrowRight, Truck, CheckCircle, Clock, AlertTriangle, Send, ChevronLeft } from 'lucide-react';

const SUPPLY_STATUSES = {
  netransmis: { label: 'Netransmis', color: 'bg-zinc-100 text-zinc-600', icon: Clock },
  transmis: { label: 'Transmis', color: 'bg-blue-100 text-blue-700', icon: Send },
  aprobat: { label: 'Aprobat Aproviz.', color: 'bg-amber-100 text-amber-700', icon: CheckCircle },
  comandat: { label: 'Comandat', color: 'bg-purple-100 text-purple-700', icon: Truck },
  transferat: { label: 'Transferat depozit', color: 'bg-green-100 text-green-700', icon: CheckCircle },
};

export default function MaterialsCalcPage() {
  const { api } = useAuth();
  const [tab, setTab] = useState('calculator');
  const [codMaterial, setCodMaterial] = useState('');
  const [cantPaleti, setCantPaleti] = useState(0);
  const [fabrica, setFabrica] = useState('');
  const [result, setResult] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [requirements, setRequirements] = useState([]);
  const [prodOrders, setProdOrders] = useState([]);

  useEffect(() => {
    api.get('/material-requirements').then(r => setRequirements(r.data)).catch(() => {});
    api.get('/production-orders').then(r => setProdOrders(r.data)).catch(() => {});
  }, [api]);

  const calculate = async () => {
    if (!codMaterial || cantPaleti <= 0) return;
    setCalculating(true);
    try {
      const res = await api.post('/calculate-materials', { cod_material: codMaterial, cantitate_paleti: cantPaleti, fabrica });
      setResult(res.data);
    } catch (e) { alert(e.response?.data?.detail || e.message); }
    setCalculating(false);
  };

  const saveRequirement = async () => {
    if (!result || !result.componente?.length) return;
    try {
      await api.post('/material-requirements', {
        cod_material: result.cod_material,
        descriere: result.descriere,
        cantitate_paleti: result.cantitate_paleti,
        cantitate_bucati: result.cantitate_bucati,
        fabrica,
        componente: result.componente,
        status: 'netransmis'
      });
      alert('Necesarul a fost salvat!');
      setResult(null);
      setCodMaterial('');
      setCantPaleti(0);
      api.get('/material-requirements').then(r => setRequirements(r.data)).catch(() => {});
    } catch (e) { alert(e.response?.data?.detail || e.message); }
  };

  const updateReqStatus = async (reqId, newStatus) => {
    try {
      await api.put(`/material-requirements/${reqId}`, { status: newStatus });
      api.get('/material-requirements').then(r => setRequirements(r.data)).catch(() => {});
    } catch (e) { alert(e.response?.data?.detail || e.message); }
  };

  return (
    <div className="p-6" data-testid="materials-calc-page">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 font-['Work_Sans']">Necesar Materiale</h1>
        <p className="text-sm text-zinc-500 mt-1">Calculator necesar pe baza retetelor SAP si tracking aprovizionare</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-200 mb-4 flex gap-0">
        <button onClick={() => setTab('calculator')} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'calculator' ? 'border-orange-600 text-orange-700 bg-orange-50/50' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`} data-testid="tab-calculator">
          <Calculator className="w-4 h-4" />Calculator
        </button>
        <button onClick={() => setTab('tracking')} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'tracking' ? 'border-orange-600 text-orange-700 bg-orange-50/50' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`} data-testid="tab-tracking">
          <Truck className="w-4 h-4" />Status Aprovizionare
          {requirements.filter(r => r.status !== 'transferat').length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-orange-600 text-white text-[10px] rounded-full">{requirements.filter(r => r.status !== 'transferat').length}</span>
          )}
        </button>
      </div>

      {tab === 'calculator' && (
        <div className="space-y-4">
          {/* Calculator Form */}
          <div className="border border-zinc-200 rounded-sm bg-white p-4">
            <h3 className="text-sm font-medium text-zinc-800 mb-3 flex items-center gap-2"><Calculator className="w-4 h-4 text-orange-600" />Calculeaza necesar materiale</h3>
            <div className="grid grid-cols-4 gap-3 mb-3">
              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">Cod Material Produs</label>
                <input value={codMaterial} onChange={e => setCodMaterial(e.target.value)} placeholder="ex: 6000201" className="w-full h-9 px-3 border border-zinc-200 rounded-sm text-sm" data-testid="calc-cod-material" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">Cantitate (Paleti)</label>
                <input type="number" value={cantPaleti} onChange={e => setCantPaleti(parseFloat(e.target.value) || 0)} className="w-full h-9 px-3 border border-zinc-200 rounded-sm text-sm" data-testid="calc-cantitate" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">Fabrica</label>
                <select value={fabrica} onChange={e => setFabrica(e.target.value)} className="w-full h-9 px-3 border border-zinc-200 rounded-sm text-sm">
                  <option value="">Selecteaza...</option>
                  <option value="Cataloi">Cataloi</option>
                  <option value="Mineri">Mineri</option>
                </select>
              </div>
              <div className="flex items-end">
                <button onClick={calculate} disabled={calculating || !codMaterial} className="h-9 px-6 bg-orange-600 text-white text-sm rounded-sm hover:bg-orange-700 disabled:opacity-50 font-medium" data-testid="calc-btn">
                  {calculating ? 'Se calculeaza...' : 'Calculeaza'}
                </button>
              </div>
            </div>
          </div>

          {/* Result */}
          {result && (
            <div className="border border-zinc-200 rounded-sm bg-white">
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 bg-zinc-50">
                <div>
                  <h3 className="text-sm font-medium text-zinc-900">{result.descriere || result.cod_material}</h3>
                  <p className="text-xs text-zinc-500">{result.cantitate_paleti} paleti &middot; {result.cantitate_bucati} bucati &middot; Factor: {result.factor}</p>
                </div>
                <button onClick={saveRequirement} className="flex items-center gap-2 h-8 px-4 bg-green-600 text-white text-sm rounded-sm hover:bg-green-700" data-testid="save-requirement-btn">
                  <Send className="w-3.5 h-3.5" />Salveaza necesar
                </button>
              </div>
              {result.error ? (
                <div className="p-4 text-sm text-red-600 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{result.error}</div>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="bg-zinc-50 border-b border-zinc-200">
                    <th className="px-3 py-2 text-left text-[10px] uppercase tracking-widest font-bold text-zinc-500">Cod MP</th>
                    <th className="px-3 py-2 text-left text-[10px] uppercase tracking-widest font-bold text-zinc-500">Descriere Material</th>
                    <th className="px-3 py-2 text-right text-[10px] uppercase tracking-widest font-bold text-zinc-500">Cant./Baza</th>
                    <th className="px-3 py-2 text-right text-[10px] uppercase tracking-widest font-bold text-zinc-500">Cantitate Necesara</th>
                    <th className="px-3 py-2 text-left text-[10px] uppercase tracking-widest font-bold text-zinc-500">UM</th>
                  </tr></thead>
                  <tbody>
                    {result.componente?.map((c, i) => (
                      <tr key={i} className="border-b border-zinc-100 hover:bg-zinc-50/50">
                        <td className="px-3 py-2 font-mono text-xs">{c.cod_mp}</td>
                        <td className="px-3 py-2">{c.descriere_mp}</td>
                        <td className="px-3 py-2 text-right text-zinc-500">{c.cantitate_per_baza}</td>
                        <td className="px-3 py-2 text-right font-medium text-orange-700">{c.cantitate_necesara}</td>
                        <td className="px-3 py-2">{c.um}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Production orders - quick access */}
          {prodOrders.length > 0 && (
            <div className="border border-zinc-200 rounded-sm bg-white p-4">
              <h3 className="text-sm font-medium text-zinc-800 mb-2 flex items-center gap-2"><Package className="w-4 h-4 text-zinc-400" />Comenzi productie recente</h3>
              <div className="space-y-1">
                {prodOrders.slice(0, 5).map(o => (
                  <div key={o.id} className="flex items-center justify-between py-1.5 px-2 rounded-sm hover:bg-zinc-50 text-xs cursor-pointer" onClick={() => { setCodMaterial(o.cod_material); setCantPaleti(o.cantitate_paleti); }}>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-zinc-500">{o.cod_comanda}</span>
                      <span className="font-medium">{o.descriere_material || o.cod_material}</span>
                      <span className="text-zinc-400">{o.data_start}</span>
                    </div>
                    <span className="text-zinc-400">{o.cantitate_paleti} paleti</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'tracking' && (
        <div className="space-y-2">
          {requirements.length === 0 ? (
            <div className="text-center py-8 text-zinc-400 border border-zinc-200 rounded-sm bg-white">Niciun necesar de materiale. Folositi Calculatorul pentru a genera necesare.</div>
          ) : requirements.map(req => {
            const st = SUPPLY_STATUSES[req.status] || SUPPLY_STATUSES.netransmis;
            const StIcon = st.icon;
            const nextStatuses = {
              netransmis: 'transmis',
              transmis: 'aprobat',
              aprobat: 'comandat',
              comandat: 'transferat',
            };
            const prevStatuses = {
              transmis: 'netransmis',
              aprobat: 'transmis',
              comandat: 'aprobat',
              transferat: 'comandat',
            };
            const nextStatus = nextStatuses[req.status];
            const prevStatus = prevStatuses[req.status];
            return (
              <div key={req.id} className="border border-zinc-200 rounded-sm bg-white" data-testid={`req-${req.id}`}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <StIcon className={`w-4 h-4 shrink-0 ${st.color.split(' ')[1]}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-900">{req.descriere || req.cod_material}</span>
                      <span className={`px-2 py-0.5 text-[10px] font-medium rounded-sm ${st.color}`}>{st.label}</span>
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      {req.cod_material} &middot; {req.cantitate_paleti} paleti &middot; {req.componente?.length || 0} componente &middot; {req.fabrica} &middot; {req.created_at?.slice(0, 10)}
                    </div>
                  </div>
                  {/* Progress */}
                  <div className="flex items-center gap-1 shrink-0">
                    {Object.keys(SUPPLY_STATUSES).map((s, i) => (
                      <React.Fragment key={s}>
                        <div className={`w-3 h-3 rounded-full border-2 ${Object.keys(SUPPLY_STATUSES).indexOf(req.status) >= i ? 'bg-orange-600 border-orange-600' : 'bg-white border-zinc-300'}`} title={SUPPLY_STATUSES[s].label} />
                        {i < Object.keys(SUPPLY_STATUSES).length - 1 && <div className={`w-4 h-0.5 ${Object.keys(SUPPLY_STATUSES).indexOf(req.status) > i ? 'bg-orange-600' : 'bg-zinc-200'}`} />}
                      </React.Fragment>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {prevStatus && (
                      <button onClick={() => updateReqStatus(req.id, prevStatus)}
                        className="flex items-center gap-1 px-2 h-7 text-xs rounded-sm bg-zinc-100 text-zinc-600 hover:bg-zinc-200 border border-zinc-200" title="Revert status">
                        <ChevronLeft className="w-3 h-3" />
                      </button>
                    )}
                    {nextStatus && (
                      <button onClick={() => updateReqStatus(req.id, nextStatus)}
                        className="flex items-center gap-1 px-3 h-7 text-xs rounded-sm bg-orange-100 text-orange-700 hover:bg-orange-200 border border-orange-200">
                        <ArrowRight className="w-3 h-3" />{SUPPLY_STATUSES[nextStatus]?.label}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
