import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Trash2, Edit2, Check, X, Users, Factory, Package, Upload, BookOpen } from 'lucide-react';

const ADMIN_TABS = [
  { key: 'users', label: 'Utilizatori', icon: Users },
  { key: 'lines', label: 'Linii Productie', icon: Factory },
  { key: 'materials', label: 'Materiale', icon: Package },
  { key: 'recipes', label: 'Retete SAP', icon: BookOpen },
];

const ROLES = ['admin', 'manager', 'planificator', 'kam', 'aprovizionare', 'planificator_mentenanta', 'planificator_igienizare', 'planificator_ddd'];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('users');

  return (
    <div className="p-6" data-testid="admin-page">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 font-['Work_Sans']">Configurare Admin</h1>
        <p className="text-sm text-zinc-500 mt-1">Gestionare utilizatori, linii de productie, materiale</p>
      </div>

      <div className="border-b border-zinc-200 mb-4 flex gap-0">
        {ADMIN_TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              data-testid={`admin-tab-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-orange-600 text-orange-700 bg-orange-50/50'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              <Icon className="w-4 h-4" />{tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'users' && <UsersAdmin />}
      {activeTab === 'lines' && <LinesAdmin />}
      {activeTab === 'materials' && <MaterialsAdmin />}
      {activeTab === 'recipes' && <RecipesAdmin />}
    </div>
  );
}

function RecipesAdmin() {
  const { api } = useAuth();
  const [recipes, setRecipes] = useState([]);
  const [expandedCod, setExpandedCod] = useState(null);
  const [expandedRecipe, setExpandedRecipe] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [fabrica, setFabrica] = useState('');
  const fileRef = React.useRef();

  const fetch_ = () => api.get('/recipes' + (fabrica ? `?fabrica=${fabrica}` : '')).then(r => setRecipes(r.data)).catch(console.error);
  React.useEffect(() => { fetch_(); }, [fabrica]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await api.post(`/recipes/upload?fabrica=${fabrica}`, fd);
      alert(`Import reusit: ${res.data.imported} retete, ${res.data.total_components} componente`);
      fetch_();
    } catch (err) {
      alert('Eroare: ' + (err.response?.data?.detail || err.message));
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleViewRecipe = async (cod) => {
    if (expandedCod === cod) { setExpandedCod(null); setExpandedRecipe(null); return; }
    try {
      const res = await api.get(`/recipes/${cod}` + (fabrica ? `?fabrica=${fabrica}` : ''));
      setExpandedRecipe(res.data);
      setExpandedCod(cod);
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (cod) => {
    if (!window.confirm(`Stergi reteta ${cod}?`)) return;
    await api.delete(`/recipes/${cod}` + (fabrica ? `?fabrica=${fabrica}` : ''));
    fetch_();
  };

  return (
    <div data-testid="recipes-admin">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-500">{recipes.length} retete</span>
          <select value={fabrica} onChange={e => setFabrica(e.target.value)} className="h-8 px-2 border border-zinc-200 rounded-sm text-sm" data-testid="recipe-fabrica-filter">
            <option value="">Toate fabricile</option>
            <option value="Cataloi">Cataloi</option>
            <option value="Mineri">Mineri</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleUpload} className="hidden" />
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="flex items-center gap-2 h-8 px-3 border border-zinc-200 text-sm rounded-sm hover:bg-zinc-50 disabled:opacity-50" data-testid="upload-recipes-btn">
            <Upload className="w-3.5 h-3.5" />{uploading ? 'Se importa...' : 'Import SAP Excel'}
          </button>
        </div>
      </div>

      <div className="text-xs text-zinc-400 mb-3 bg-zinc-50 border border-zinc-200 rounded-sm p-2">
        Format SAP: Material PF | Descriere Material PF | UnLg | UM | Cantitate de baza PF | UM | Componenta MP | Descriere Material MP | CIP | Cantitate | UM
      </div>

      <div className="border border-zinc-200 rounded-sm bg-white overflow-x-auto">
        <table className="w-full text-sm table-striped">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              {['Cod Material PF', 'Descriere', 'Fabrica', 'Cant. Baza', 'UM', 'Nr Componente', 'Actiuni'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-[10px] uppercase tracking-widest font-bold text-zinc-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recipes.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-zinc-400">Nicio reteta. Importati din butonul "Import SAP Excel".</td></tr>
            ) : recipes.map(r => (
              <React.Fragment key={`${r.cod_material_pf}_${r.fabrica}`}>
                <tr className="border-b border-zinc-100 hover:bg-zinc-50/50 cursor-pointer" onClick={() => handleViewRecipe(r.cod_material_pf)}>
                  <td className="px-3 py-2 font-mono text-xs font-medium">{r.cod_material_pf}</td>
                  <td className="px-3 py-2">{r.descriere_pf}</td>
                  <td className="px-3 py-2"><span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-sm text-xs">{r.fabrica || '-'}</span></td>
                  <td className="px-3 py-2">{r.cantitate_baza}</td>
                  <td className="px-3 py-2">{r.um_baza}</td>
                  <td className="px-3 py-2"><span className="px-2 py-0.5 bg-zinc-100 rounded-sm text-xs">{r.nr_componente}</span></td>
                  <td className="px-3 py-2">
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(r.cod_material_pf); }} className="p-1 text-zinc-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
                {expandedCod === r.cod_material_pf && expandedRecipe && (
                  <tr>
                    <td colSpan={7} className="bg-zinc-50 px-4 py-3">
                      <div className="text-xs font-medium text-zinc-500 mb-2 uppercase tracking-widest">Componente ({expandedRecipe.componente?.length || 0})</div>
                      <table className="w-full text-xs">
                        <thead><tr className="border-b border-zinc-200">
                          <th className="px-2 py-1 text-left text-zinc-500">Cod MP</th>
                          <th className="px-2 py-1 text-left text-zinc-500">Descriere</th>
                          <th className="px-2 py-1 text-right text-zinc-500">Cantitate</th>
                          <th className="px-2 py-1 text-left text-zinc-500">UM</th>
                        </tr></thead>
                        <tbody>
                          {expandedRecipe.componente?.map((c, i) => (
                            <tr key={i} className="border-b border-zinc-100">
                              <td className="px-2 py-1 font-mono">{c.cod_mp}</td>
                              <td className="px-2 py-1">{c.descriere_mp}</td>
                              <td className="px-2 py-1 text-right font-medium">{c.cantitate}</td>
                              <td className="px-2 py-1">{c.um}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UsersAdmin() {
  const { api } = useAuth();
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const fetch_ = () => api.get('/users').then(r => setUsers(r.data)).catch(console.error);
  useEffect(() => { fetch_(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/users', form);
      setShowForm(false);
      setForm({});
      fetch_();
    } catch (e) { alert(e.response?.data?.detail || e.message); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Stergi acest utilizator?')) return;
    await api.delete(`/users/${id}`);
    fetch_();
  };

  return (
    <div data-testid="users-admin">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-zinc-500">{users.length} utilizatori</span>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 h-8 px-3 bg-orange-600 text-white text-sm rounded-sm hover:bg-orange-700" data-testid="add-user-btn">
          <Plus className="w-3.5 h-3.5" />Adauga utilizator
        </button>
      </div>

      {showForm && (
        <div className="border border-orange-200 bg-orange-50/30 rounded-sm p-4 mb-4" data-testid="add-user-form">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">Cod Post <span className="text-red-500">*</span></label>
              <input data-testid="input-cod-post" value={form.cod_post_lucru || ''} onChange={e => setForm({...form, cod_post_lucru: e.target.value})} className="w-full h-9 px-3 border border-zinc-200 rounded-sm text-sm focus:ring-2 focus:ring-orange-600 bg-white" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">Nume Post</label>
              <input value={form.nume_post_lucru || ''} onChange={e => setForm({...form, nume_post_lucru: e.target.value})} className="w-full h-9 px-3 border border-zinc-200 rounded-sm text-sm bg-white" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">Nume <span className="text-red-500">*</span></label>
              <input value={form.nume || ''} onChange={e => setForm({...form, nume: e.target.value})} className="w-full h-9 px-3 border border-zinc-200 rounded-sm text-sm bg-white" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">Prenume <span className="text-red-500">*</span></label>
              <input value={form.prenume || ''} onChange={e => setForm({...form, prenume: e.target.value})} className="w-full h-9 px-3 border border-zinc-200 rounded-sm text-sm bg-white" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">Rol <span className="text-red-500">*</span></label>
              <select value={form.rol || ''} onChange={e => setForm({...form, rol: e.target.value})} className="w-full h-9 px-3 border border-zinc-200 rounded-sm text-sm bg-white">
                <option value="">Selecteaza...</option>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">PIN <span className="text-red-500">*</span></label>
              <input type="password" maxLength={6} inputMode="numeric" value={form.pin || ''} onChange={e => setForm({...form, pin: e.target.value})} className="w-full h-9 px-3 border border-zinc-200 rounded-sm text-sm bg-white" placeholder="1-6 cifre" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 h-8 px-4 bg-orange-600 text-white text-sm rounded-sm hover:bg-orange-700 disabled:opacity-50" data-testid="save-user-btn">
              <Check className="w-3.5 h-3.5" />Salveaza
            </button>
            <button onClick={() => { setShowForm(false); setForm({}); }} className="h-8 px-4 border border-zinc-200 text-sm rounded-sm hover:bg-zinc-50">Anuleaza</button>
          </div>
        </div>
      )}

      <div className="border border-zinc-200 rounded-sm bg-white overflow-x-auto">
        <table className="w-full text-sm table-striped">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              {['Cod Post', 'Nume Post', 'Nume', 'Prenume', 'Rol', 'Activ', 'Actiuni'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-[10px] uppercase tracking-widest font-bold text-zinc-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-zinc-100 hover:bg-zinc-50/50">
                <td className="px-3 py-2 font-mono text-xs">{u.cod_post_lucru}</td>
                <td className="px-3 py-2">{u.nume_post_lucru}</td>
                <td className="px-3 py-2 font-medium">{u.nume}</td>
                <td className="px-3 py-2">{u.prenume}</td>
                <td className="px-3 py-2"><span className="px-2 py-0.5 bg-zinc-100 rounded-sm text-xs">{u.rol}</span></td>
                <td className="px-3 py-2">{u.activ !== false ? <span className="text-green-600 text-xs">Activ</span> : <span className="text-red-500 text-xs">Inactiv</span>}</td>
                <td className="px-3 py-2">
                  <button onClick={() => handleDelete(u.id)} className="p-1 text-zinc-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LinesAdmin() {
  const { api } = useAuth();
  const [lines, setLines] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const fetch_ = () => api.get('/lines').then(r => setLines(r.data)).catch(console.error);
  useEffect(() => { fetch_(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/lines', form);
      setShowForm(false); setForm({}); fetch_();
    } catch (e) { alert(e.response?.data?.detail || e.message); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Stergi linia?')) return;
    await api.delete(`/lines/${id}`);
    fetch_();
  };

  return (
    <div data-testid="lines-admin">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-zinc-500">{lines.length} linii</span>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 h-8 px-3 bg-orange-600 text-white text-sm rounded-sm hover:bg-orange-700" data-testid="add-line-btn">
          <Plus className="w-3.5 h-3.5" />Adauga linie
        </button>
      </div>

      {showForm && (
        <div className="border border-orange-200 bg-orange-50/30 rounded-sm p-4 mb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            {[
              { key: 'cod', label: 'Cod' },
              { key: 'nume', label: 'Nume' },
              { key: 'fabrica', label: 'Fabrica' },
              { key: 'tip', label: 'Tip' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">{f.label}</label>
                <input value={form[f.key] || ''} onChange={e => setForm({...form, [f.key]: e.target.value})} className="w-full h-9 px-3 border border-zinc-200 rounded-sm text-sm bg-white" />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 h-8 px-4 bg-orange-600 text-white text-sm rounded-sm hover:bg-orange-700 disabled:opacity-50">
              <Check className="w-3.5 h-3.5" />Salveaza
            </button>
            <button onClick={() => { setShowForm(false); setForm({}); }} className="h-8 px-4 border border-zinc-200 text-sm rounded-sm hover:bg-zinc-50">Anuleaza</button>
          </div>
        </div>
      )}

      <div className="border border-zinc-200 rounded-sm bg-white overflow-x-auto">
        <table className="w-full text-sm table-striped">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              {['Cod', 'Nume', 'Fabrica', 'Tip', 'Capacitate ore/zi', 'Schimburi', 'Activ', 'Actiuni'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-[10px] uppercase tracking-widest font-bold text-zinc-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map(l => (
              <tr key={l.id} className="border-b border-zinc-100 hover:bg-zinc-50/50">
                <td className="px-3 py-2 font-mono text-xs">{l.cod}</td>
                <td className="px-3 py-2 font-medium">{l.nume}</td>
                <td className="px-3 py-2"><span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-sm text-xs">{l.fabrica}</span></td>
                <td className="px-3 py-2">{l.tip}</td>
                <td className="px-3 py-2">{l.capacitate_ore_zi}</td>
                <td className="px-3 py-2">{l.nr_schimburi}</td>
                <td className="px-3 py-2">{l.activ !== false ? <span className="text-green-600 text-xs">Activ</span> : <span className="text-red-500 text-xs">Inactiv</span>}</td>
                <td className="px-3 py-2">
                  <button onClick={() => handleDelete(l.id)} className="p-1 text-zinc-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MaterialsAdmin() {
  const { api } = useAuth();
  const [materials, setMaterials] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const fetch_ = () => api.get('/materials').then(r => setMaterials(r.data)).catch(console.error);
  useEffect(() => { fetch_(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/materials', form);
      setShowForm(false); setForm({}); fetch_();
    } catch (e) { alert(e.response?.data?.detail || e.message); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Stergi materialul?')) return;
    await api.delete(`/materials/${id}`);
    fetch_();
  };

  const filtered = materials.filter(m => {
    if (!search) return true;
    const s = search.toLowerCase();
    return m.cod_material?.toLowerCase().includes(s) || m.descriere?.toLowerCase().includes(s);
  });

  return (
    <div data-testid="materials-admin">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-500">{materials.length} materiale</span>
          <div className="relative">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cauta material..." className="h-8 pl-3 pr-3 border border-zinc-200 rounded-sm text-sm w-48" />
          </div>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 h-8 px-3 bg-orange-600 text-white text-sm rounded-sm hover:bg-orange-700" data-testid="add-material-btn">
          <Plus className="w-3.5 h-3.5" />Adauga material
        </button>
      </div>

      {showForm && (
        <div className="border border-orange-200 bg-orange-50/30 rounded-sm p-4 mb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            {[
              { key: 'cod_material', label: 'Cod Material' },
              { key: 'descriere', label: 'Descriere' },
              { key: 'fabrica', label: 'Fabrica' },
              { key: 'linie_productie', label: 'Linie productie' },
              { key: 'capacitate_sarje', label: 'Capacitate sarje', type: 'number' },
              { key: 'paleti_pe_ora', label: 'Paleti/ora', type: 'number' },
              { key: 'paleti_pe_sarja', label: 'Paleti/sarja', type: 'number' },
              { key: 'bucati_pe_palet', label: 'Bucati/palet', type: 'number' },
              { key: 'timp_flux_min', label: 'Timp flux (min)', type: 'number' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">{f.label}</label>
                <input type={f.type || 'text'} value={form[f.key] || ''} onChange={e => setForm({...form, [f.key]: f.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value})} className="w-full h-9 px-3 border border-zinc-200 rounded-sm text-sm bg-white" />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 h-8 px-4 bg-orange-600 text-white text-sm rounded-sm hover:bg-orange-700 disabled:opacity-50">
              <Check className="w-3.5 h-3.5" />Salveaza
            </button>
            <button onClick={() => { setShowForm(false); setForm({}); }} className="h-8 px-4 border border-zinc-200 text-sm rounded-sm hover:bg-zinc-50">Anuleaza</button>
          </div>
        </div>
      )}

      <div className="border border-zinc-200 rounded-sm bg-white overflow-x-auto">
        <table className="w-full text-sm table-striped">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              {['Cod', 'Descriere', 'Fabrica', 'Linie', 'Pal/ora', 'Pal/sarja', 'Timp flux', 'Actiuni'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-[10px] uppercase tracking-widest font-bold text-zinc-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-zinc-400">Niciun material. Adaugati din butonul de mai sus.</td></tr>
            ) : filtered.map(m => (
              <tr key={m.id} className="border-b border-zinc-100 hover:bg-zinc-50/50">
                <td className="px-3 py-2 font-mono text-xs">{m.cod_material}</td>
                <td className="px-3 py-2 font-medium">{m.descriere}</td>
                <td className="px-3 py-2"><span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-sm text-xs">{m.fabrica || '-'}</span></td>
                <td className="px-3 py-2 text-xs">{m.linie_productie || '-'}</td>
                <td className="px-3 py-2">{m.paleti_pe_ora}</td>
                <td className="px-3 py-2">{m.paleti_pe_sarja || '-'}</td>
                <td className="px-3 py-2">{m.timp_flux_min || 0} min</td>
                <td className="px-3 py-2">
                  <button onClick={() => handleDelete(m.id)} className="p-1 text-zinc-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
