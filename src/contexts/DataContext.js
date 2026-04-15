import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import {
  loadStore, saveStore, clearStore, exportStoreJSON, importStoreJSON,
  saveBackup, loadBackup,
  parseXLSXToStore, parsePasteMateriale, parsePasteComenzi,
  uid, fmtDate, calcTargetQty, calcRemainingQty, p2,
  LINES, STATUS_CONFIG
} from './DataStore';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const storeRef = useRef(null);
  const backupTimerRef = useRef(null);

  useEffect(() => {
    const s = loadStore();
    storeRef.current = s;
    setStore(s);
    setLoading(false);
  }, []);

  // Periodic backup every 5 min
  useEffect(() => {
    const interval = setInterval(() => {
      if (storeRef.current) saveBackup(storeRef.current);
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const update = useCallback((updater) => {
    setStore(prev => {
      const next = typeof updater === 'function' ? updater({ ...prev }) : { ...prev, ...updater };
      storeRef.current = next;
      saveStore(next);
      // Debounced backup 5s after last change
      if (backupTimerRef.current) clearTimeout(backupTimerRef.current);
      backupTimerRef.current = setTimeout(() => saveBackup(next), 5000);
      return next;
    });
  }, []);

  // ── MATERIALE ────────────────────────────────────────────────────────────
  const addMaterial = useCallback((mat) => {
    update(s => { s.materiale = { ...s.materiale, [mat.cod]: mat }; return s; });
  }, [update]);

  const updateMaterial = useCallback((cod, changes) => {
    update(s => {
      if (!s.materiale[cod]) return s;
      s.materiale = { ...s.materiale, [cod]: { ...s.materiale[cod], ...changes } };
      return s;
    });
  }, [update]);

  const deleteMaterial = useCallback((cod) => {
    update(s => { const m = { ...s.materiale }; delete m[cod]; s.materiale = m; return s; });
  }, [update]);

  const importMateriale = useCallback((items, mode = 'merge') => {
    update(s => {
      const m = mode === 'replace' ? {} : { ...s.materiale };
      items.forEach(item => { if (item.cod) m[item.cod] = { ...m[item.cod], ...item }; });
      s.materiale = m;
      return s;
    });
  }, [update]);

  // ── COMENZI PSF/PSC ──────────────────────────────────────────────────────
  const addComanda = useCallback((cmd) => {
    update(s => { s.comenzi = [{ _id: uid(), ...cmd }, ...s.comenzi]; return s; });
  }, [update]);

  const updateComanda = useCallback((id, changes) => {
    update(s => { s.comenzi = s.comenzi.map(c => c._id === id ? { ...c, ...changes } : c); return s; });
  }, [update]);

  const deleteComanda = useCallback((id) => {
    update(s => { s.comenzi = s.comenzi.filter(c => c._id !== id); return s; });
  }, [update]);

  const importComenzi = useCallback((items, mode = 'merge') => {
    update(s => {
      if (mode === 'replace') { s.comenzi = items; return s; }
      const byNrPS = {};
      s.comenzi.forEach(c => { if (c.nrPS) byNrPS[c.nrPS] = c; });
      const toAdd = [];
      items.forEach(item => {
        if (item.nrPS && byNrPS[item.nrPS]) {
          byNrPS[item.nrPS] = { ...byNrPS[item.nrPS], ...item, _id: byNrPS[item.nrPS]._id };
        } else {
          toAdd.push(item);
        }
      });
      s.comenzi = [...Object.values(byNrPS), ...s.comenzi.filter(c => !c.nrPS), ...toAdd];
      return s;
    });
  }, [update]);

  // ── COMENZI PRODUCȚIE (CP) ───────────────────────────────────────────────
  const addCP = useCallback((cp) => {
    update(s => { s.prod = [{ _id: uid(), ...cp }, ...(s.prod || [])]; return s; });
  }, [update]);

  const updateCP = useCallback((id, changes) => {
    update(s => { s.prod = (s.prod || []).map(p => p._id === id ? { ...p, ...changes } : p); return s; });
  }, [update]);

  const deleteCP = useCallback((id) => {
    update(s => { s.prod = (s.prod || []).filter(p => p._id !== id); return s; });
  }, [update]);

  // ── EVENTS ───────────────────────────────────────────────────────────────
  const addEvent = useCallback((evt, listKey = 'events') => {
    update(s => { s[listKey] = [{ _id: uid(), ...evt }, ...(s[listKey] || [])]; return s; });
  }, [update]);

  const deleteEvent = useCallback((id, listKey = 'events') => {
    update(s => { s[listKey] = (s[listKey] || []).filter(e => e._id !== id); return s; });
  }, [update]);

  // ── IMPORT / EXPORT ──────────────────────────────────────────────────────
  const exportJSON = useCallback(() => {
    if (store) exportStoreJSON(store);
  }, [store]);

  const importJSON = useCallback(async (file) => {
    const parsed = await importStoreJSON(file);
    storeRef.current = parsed;
    setStore(parsed);
    saveStore(parsed);
  }, []);

  const importXLSX = useCallback(async (file, mode = 'merge') => {
    const buf = await file.arrayBuffer();
    const parsed = parseXLSXToStore(buf);
    update(s => {
      if (mode === 'replace') return { ...s, ...parsed };
      // Merge materiale
      Object.entries(parsed.materiale || {}).forEach(([k, v]) => { s.materiale[k] = v; });
      // Merge comenzi by nrPS
      const byNrPS = {};
      s.comenzi.forEach(c => { if (c.nrPS) byNrPS[c.nrPS] = c; });
      (parsed.comenzi || []).forEach(c => {
        if (c.nrPS && byNrPS[c.nrPS]) byNrPS[c.nrPS] = { ...byNrPS[c.nrPS], ...c, _id: byNrPS[c.nrPS]._id };
        else s.comenzi.push(c);
      });
      if (parsed.mnt?.length) s.mnt = [...(s.mnt || []), ...parsed.mnt];
      if (parsed.ig?.length) s.ig = [...(s.ig || []), ...parsed.ig];
      if (parsed.ddd?.length) s.ddd = [...(s.ddd || []), ...parsed.ddd];
      if (parsed.cdi?.length) s.cdi = [...(s.cdi || []), ...parsed.cdi];
      return s;
    });
  }, [update]);

  const resetStore = useCallback(() => {
    clearStore();
    const empty = loadStore();
    storeRef.current = empty;
    setStore(empty);
  }, []);

  const getBackupInfo = useCallback(() => {
    const b = loadBackup();
    if (!b) return null;
    return { savedAt: b.savedAt, comenzi: (b.data?.comenzi || []).length, materiale: Object.keys(b.data?.materiale || {}).length };
  }, []);

  const restoreBackup = useCallback(() => {
    const b = loadBackup();
    if (!b?.data) return false;
    storeRef.current = b.data;
    setStore(b.data);
    saveStore(b.data);
    return true;
  }, []);

  // ── API compat layer ──────────────────────────────────────────────────────
  const api = {
    get: (url) => new Promise((resolve) => {
      const s = storeRef.current || loadStore();
      if (url.startsWith('/lines')) {
        return resolve({ data: LINES.map(l => ({ ...l, activ: true, capacitate_ore_zi: 24 })) });
      }
      if (url.startsWith('/dashboard/stats')) {
        return resolve({ data: buildStats(s) });
      }
      if (url.startsWith('/orders/ps')) {
        return resolve({ data: (s.comenzi || []).map(mapComandaForUI) });
      }
      if (url.includes('/production-orders/unplanned/')) {
        const cod = url.split('/').pop();
        const eligible = (s.comenzi || [])
          .filter(c => String(c.cod).trim() === String(cod).trim() && c.status !== 'ANULAT')
          .sort((a, b) => {
            const order = { Neprogramat: 0, 'De Fabricat': 1, Partial: 2, Programat: 3, Fabricat: 4 };
            return (order[a.status] ?? 9) - (order[b.status] ?? 9);
          });
        return resolve({ data: eligible.map(c => ({
          id: c._id, psf_nr: c.nrPS, client: c.client,
          cantitate: c.cant, cantitate_ramasa: calcRemainingQty(c),
          data_limita_punere_stoc: c.dlim, descriere_material: c.desc
        })) });
      }
      if (url.startsWith('/production-orders')) {
        let orders = (s.prod || []).map(mapCPForUI);
        const qs = url.split('?')[1] || '';
        const params = Object.fromEntries(qs.split('&').filter(Boolean).map(p => p.split('=')));
        if (params.data_start) orders = orders.filter(o => o.data_start >= params.data_start);
        if (params.data_end) orders = orders.filter(o => o.data_start <= params.data_end);
        return resolve({ data: orders });
      }
      if (url.includes('/materials/by-code/')) {
        const cod = url.split('/').pop();
        const mat = s.materiale[cod];
        if (mat) return resolve({ data: { found: true, ...mat, descriere: mat.nm, paleti_pe_ora: mat.cph, paleti_pe_sarja: mat.buc } });
        return resolve({ data: { found: false } });
      }
      if (url.startsWith('/materials')) return resolve({ data: Object.values(s.materiale || {}) });
      if (url.startsWith('/orders/maintenance')) return resolve({ data: (s.mnt || []).map(m => ({ ...m, id: m._id, linie_productie: m.linie, _type: 'maintenance', _color: '#9333EA', timp_interventie_ore: m.ore })) });
      if (url.startsWith('/orders/hygiene'))     return resolve({ data: (s.ig || []).map(m => ({ ...m, id: m._id, linie_productie: m.linie, _type: 'hygiene', _color: '#2563EB', timp_interventie_ore: m.ore })) });
      if (url.startsWith('/orders/ddd'))         return resolve({ data: (s.ddd || []).map(m => ({ ...m, id: m._id, linie_productie: m.linie, _type: 'ddd', _color: '#16A34A', timp_interventie_ore: m.ore })) });
      if (url.startsWith('/orders/cdi'))         return resolve({ data: (s.cdi || []).map(m => ({ ...m, id: m._id, linie_productie: m.linie, _type: 'cdi', _color: '#D97706', timp_interventie_ore: m.ore })) });
      if (url.startsWith('/exception-events'))   return resolve({ data: (s.events || []).filter(e => e.type === 'exception') });
      if (url.startsWith('/users'))              return resolve({ data: [{ id: 1, nume: 'Planner', prenume: '', rol: 'planificator' }] });
      if (url.startsWith('/recipes'))            return resolve({ data: [] });
      resolve({ data: [] });
    }),
    post: (url, body) => new Promise((resolve) => {
      const newItem = { ...body, id: Date.now(), _id: uid() };
      if (url === '/production-orders') {
        update(s => { s.prod = [{ ...newItem, cod: newItem.cod_material || newItem.cod, line: newItem.linie_productie, pal: newItem.cantitate_paleti, sarje: newItem.cantitate_sarje, durH: newItem.ore_productie, dstart: newItem.data_start, oraStart: newItem.ora_start }, ...(s.prod || [])]; return s; });
      } else if (url === '/exception-events') {
        update(s => { s.events = [...(s.events || []), { ...newItem, type: 'exception' }]; return s; });
      } else if (url === '/orders/maintenance') {
        update(s => { s.mnt = [...(s.mnt || []), newItem]; return s; });
      } else if (url === '/orders/hygiene') {
        update(s => { s.ig = [...(s.ig || []), newItem]; return s; });
      } else if (url === '/orders/ddd') {
        update(s => { s.ddd = [...(s.ddd || []), newItem]; return s; });
      } else if (url === '/orders/cdi') {
        update(s => { s.cdi = [...(s.cdi || []), newItem]; return s; });
      }
      resolve({ data: newItem });
    }),
    put: (url, body) => new Promise((resolve) => {
      const id = url.split('/').pop();
      if (url.includes('/production-orders/')) {
        update(s => { s.prod = (s.prod || []).map(p => String(p._id) === id || String(p.id) === id ? { ...p, ...body, cod: body.cod_material || p.cod, line: body.linie_productie || p.line, pal: body.cantitate_paleti ?? p.pal, sarje: body.cantitate_sarje ?? p.sarje, durH: body.ore_productie ?? p.durH, dstart: body.data_start || p.dstart, oraStart: body.ora_start || p.oraStart } : p); return s; });
      } else if (url.includes('/exception-events/')) {
        update(s => { s.events = (s.events || []).map(e => String(e._id) === id ? { ...e, ...body } : e); return s; });
      }
      resolve({ data: {} });
    }),
    delete: (url) => new Promise((resolve) => {
      const id = url.split('/').pop();
      if (url.includes('/production-orders/')) update(s => { s.prod = (s.prod || []).filter(p => String(p._id) !== id && String(p.id) !== id); return s; });
      else if (url.includes('/exception-events/')) update(s => { s.events = (s.events || []).filter(e => String(e._id) !== id); return s; });
      else if (url.includes('/orders/maintenance/')) update(s => { s.mnt = (s.mnt || []).filter(m => String(m._id) !== id); return s; });
      else if (url.includes('/orders/hygiene/')) update(s => { s.ig = (s.ig || []).filter(i => String(i._id) !== id); return s; });
      resolve({});
    }),
  };

  const hasData = !!(store && (
    Object.keys(store.materiale || {}).length > 0 ||
    (store.comenzi || []).length > 0 ||
    (store.prod || []).length > 0
  ));

  return (
    <DataContext.Provider value={{
      store, loading, hasData, update,
      addMaterial, updateMaterial, deleteMaterial, importMateriale,
      addComanda, updateComanda, deleteComanda, importComenzi,
      addCP, updateCP, deleteCP,
      addEvent, deleteEvent,
      exportJSON, importJSON, importXLSX, resetStore,
      getBackupInfo, restoreBackup,
      parsePasteMateriale, parsePasteComenzi,
      api, LINES,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useDataContext() {
  return useContext(DataContext);
}

function mapComandaForUI(c) {
  const tgt = calcTargetQty(c);
  const rem = calcRemainingQty(c);
  return {
    ...c, id: c._id,
    psf_nr: c.nrPS, cod_material: c.cod, descriere_material: c.desc,
    cantitate: c.cant, cantitate_ramasa: rem,
    data_limita_punere_stoc: c.dlim, data_noua_punere_stoc: c.dagr,
    data_planificata: c.dprog, linie_sugerata: c.linie, linie_planificata: c.liniePlan,
    saptamana: c.dlim ? 'W' + Math.ceil(((new Date(c.dlim) - new Date(new Date(c.dlim).getFullYear(), 0, 1)) / 86400000 + 1) / 7) : '',
  };
}

function mapCPForUI(p) {
  return {
    ...p, id: p._id || p.id,
    cod_material: p.cod, descriere_material: p.desc,
    linie_productie: p.line || p.linie_productie,
    data_start: p.dstart ? fmtDate(p.dstart) : null,
    ora_start: p.oraStart || '07:00',
    schimb: p.schimb || 1,
    cantitate_paleti: p.pal || 0,
    cantitate_sarje: p.sarje || 0,
    ore_productie: p.durH || 0,
    durata_changeover: p.changeoverMin || 120,
  };
}

function buildStats(s) {
  const ps = s.comenzi || [];
  return {
    orders_ps: { total: ps.length, planificat: ps.filter(c => c.status === 'Programat').length, nou: ps.filter(c => c.status === 'Neprogramat').length },
    orders_maintenance: { total: (s.mnt || []).length, planificat: (s.mnt || []).filter(m => m.prog === 'PROGRAMAT').length },
    orders_hygiene: { total: (s.ig || []).length, planificat: (s.ig || []).filter(i => i.prog === 'PROGRAMAT').length },
    orders_ddd: { total: (s.ddd || []).length, planificat: (s.ddd || []).filter(d => d.prog === 'PROGRAMAT').length },
    orders_cdi: { total: (s.cdi || []).length, planificat: (s.cdi || []).filter(c => c.prog === 'PROGRAMAT').length },
  };
}
