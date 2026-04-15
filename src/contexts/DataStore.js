/**
 * DataStore — single source of truth pentru toate datele aplicației
 * LocalStorage persistent, cu export/import JSON
 */
import * as XLSX from 'xlsx';

const STORE_KEY = 'pid_v1_store';
const BACKUP_KEY = 'pid_v1_backup';
const BACKUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const VERSION = 1;

// ── Linii de producție (master data fixă) ──────────────────────────────────
export const LINES = [
  { id: 'brutarie_cat',  cod: 'brutarie_cat',  nume: 'Brutărie Cataloi',        fabrica: 'Cataloi', color: '#d45b07' },
  { id: 'patiserie_cat', cod: 'patiserie_cat',  nume: 'Patiserie Cataloi',       fabrica: 'Cataloi', color: '#b34a06' },
  { id: 'rademaker',     cod: 'rademaker',      nume: 'Rademaker Mineri',        fabrica: 'Mineri',  color: '#2b5ea7' },
  { id: 'fritsch',       cod: 'fritsch',        nume: 'Fritsch Mineri',          fabrica: 'Mineri',  color: '#3a7dd4' },
  { id: 'chifle',        cod: 'chifle',         nume: 'Chifle Mineri',           fabrica: 'Mineri',  color: '#4e8b2f' },
  { id: 'covrigei',      cod: 'covrigei',       nume: 'Covrigei',                fabrica: 'Mineri',  color: '#6ba352' },
  { id: 'salam',         cod: 'salam',          nume: 'Salam biscuiți',          fabrica: 'Mineri',  color: '#c49200' },
  { id: 'brut_pat_min',  cod: 'brut_pat_min',   nume: 'Brut-Pat Mineri',         fabrica: 'Mineri',  color: '#9a7500' },
];

// ── Status colors ───────────────────────────────────────────────────────────
export const STATUS_CONFIG = {
  'Programat':    { label: 'Programat',    color: '#16a34a', bg: 'bg-green-100',  text: 'text-green-800'  },
  'Partial':      { label: 'Parțial',      color: '#d97706', bg: 'bg-amber-100',  text: 'text-amber-800'  },
  'Neprogramat':  { label: 'Neprogramat',  color: '#64748b', bg: 'bg-zinc-100',   text: 'text-zinc-700'   },
  'De Fabricat':  { label: 'De Fabricat',  color: '#ea580c', bg: 'bg-orange-100', text: 'text-orange-800' },
  'Fabricat':     { label: 'Fabricat',     color: '#2563eb', bg: 'bg-blue-100',   text: 'text-blue-800'   },
  'Dublat':       { label: 'Dublat',       color: '#7c3aed', bg: 'bg-violet-100', text: 'text-violet-800' },
  'ANULAT':       { label: 'Anulat',       color: '#dc2626', bg: 'bg-red-100',    text: 'text-red-800'    },
};

// ── Schema implicită store ─────────────────────────────────────────────────
function emptyStore() {
  return {
    version: VERSION,
    materiale: {},       // { [cod]: Material }
    comenzi: [],         // PSF/PSC orders
    prod: [],            // Comenzi producție (CP)
    events: [],          // Evenimente (mentenanță, igienizare, etc.)
    mnt: [],
    ig: [],
    ddd: [],
    cdi: [],
    overrides: {},       // { [lineId]: { inserts: [], durOv: {}, hiddenKeys: {} } }
    lastModified: null,
    changelog: [],       // audit log
  };
}

// ── Persistare ─────────────────────────────────────────────────────────────
export function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw);
    // Migrate if needed
    if (!parsed.materiale) parsed.materiale = parsed.mat || {};
    if (!parsed.overrides) parsed.overrides = {};
    if (!parsed.changelog) parsed.changelog = [];
    if (!parsed.mnt) parsed.mnt = [];
    if (!parsed.ig) parsed.ig = [];
    if (!parsed.ddd) parsed.ddd = [];
    if (!parsed.cdi) parsed.cdi = [];
    return parsed;
  } catch (e) {
    console.warn('DataStore load error:', e);
    return emptyStore();
  }
}

export function saveStore(store) {
  try {
    store.lastModified = new Date().toISOString();
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch (e) {
    console.warn('DataStore save error:', e);
    // Try to save without changelog if storage is full
    try {
      const compact = { ...store, changelog: store.changelog?.slice(-50) || [] };
      localStorage.setItem(STORE_KEY, JSON.stringify(compact));
    } catch { }
  }
}

export function clearStore() {
  localStorage.removeItem(STORE_KEY);
}

// ── Auto-backup ─────────────────────────────────────────────────────────────
export function saveBackup(store) {
  try {
    const backup = {
      savedAt: new Date().toISOString(),
      data: store,
    };
    localStorage.setItem(BACKUP_KEY, JSON.stringify(backup));
  } catch (e) {
    console.warn('Backup save failed', e);
  }
}

export function loadBackup() {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function clearBackup() {
  localStorage.removeItem(BACKUP_KEY);
}

// ── Export / Import JSON ────────────────────────────────────────────────────
export function exportStoreJSON(store) {
  const json = JSON.stringify(store, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pid_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importStoreJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        resolve(parsed);
      } catch (err) {
        reject(new Error('Fișier JSON invalid: ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('Eroare citire fișier'));
    reader.readAsText(file);
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────
export function p2(n) { return String(n).padStart(2, '0'); }
export function uid() { return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6); }
export function fmtDate(d) {
  if (!d) return null;
  const x = new Date(d);
  if (isNaN(x)) return null;
  return x.getFullYear() + '-' + p2(x.getMonth() + 1) + '-' + p2(x.getDate());
}
export function fmtDateDisplay(d) {
  if (!d) return '—';
  const x = new Date(d);
  if (isNaN(x)) return '—';
  return p2(x.getDate()) + '/' + p2(x.getMonth() + 1) + '/' + x.getFullYear();
}
export function round2(n) { return Math.round(n * 100) / 100; }

// ── Material helpers ─────────────────────────────────────────────────────────
export function calcCpMetrics(mat, qty) {
  if (!mat || !qty) return { pal: 0, sarje: 0, durHFram: 0, durHAmb: 0, durH: 0 };
  const buc = Number(mat.buc) || 1;
  const sjh = Number(mat.sjh) || 0;
  const cph = Number(mat.cpr || mat.cph) || 0;
  const off = Number(mat.off) || 3.5;
  const pal = round2(qty / buc);
  const sarje = sjh > 0 ? Math.ceil(pal / (sjh > 0 ? (sjh / (cph || 1)) : 1)) : Math.ceil(qty / buc);
  const durHFram = sjh > 0 ? round2(sarje / sjh) : 0;
  const durHAmb = cph > 0 ? round2(pal / cph) : 0;
  const durH = round2(Math.max(durHFram, durHAmb - off));
  return { pal, sarje, durHFram, durHAmb, durH, off };
}

export function genNrCP(startDate, materialCode) {
  const d = new Date(startDate);
  const day = p2(d.getDate());
  const year = d.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const weekNum = p2(Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7));
  return `${day}W${weekNum}${String(year).slice(-2)}-${materialCode}`;
}

export function calcTargetQty(c) {
  const agr = Number(c.cagr || 0);
  return agr > 0 ? agr : Number(c.cant || 0);
}

export function calcRemainingQty(c) {
  const target = calcTargetQty(c);
  const fab = Number(c.cfab || 0);
  return Math.max(0, round2(target - fab));
}

export function getEligibleForMaterial(comenzi, materialCode) {
  if (!materialCode) return [];
  return comenzi
    .filter(c => String(c.cod).trim() === String(materialCode).trim() && c.status !== 'ANULAT')
    .sort((a, b) => {
      const order = { 'Neprogramat': 0, 'De Fabricat': 1, 'Partial': 2, 'Programat': 3, 'Fabricat': 4, 'Dublat': 5 };
      return (order[a.status] ?? 9) - (order[b.status] ?? 9);
    });
}

// ── XLSX Parser ──────────────────────────────────────────────────────────────
function xlDate(v) {
  if (!v) return null;
  if (v instanceof Date) return fmtDate(v);
  if (typeof v === 'number') return fmtDate(new Date((v - 25569) * 86400000));
  if (typeof v === 'string') return v.slice(0, 10);
  return null;
}
function strVal(v) { return v != null ? String(v).trim() : ''; }
function numVal(v) { return typeof v === 'number' ? v : (parseFloat(v) || 0); }

export function parseXLSXToStore(buffer) {
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: false });
  const store = emptyStore();

  const sheetRows = (name) => {
    const s = wb.Sheets[name];
    if (!s) return [];
    return XLSX.utils.sheet_to_json(s, { defval: null });
  };

  // ── DATE DE MATERIAL ─────────────────────────────────────────────────────
  const rawMat = sheetRows('DATE DE MATERIAL');
  rawMat.forEach(r => {
    const cod = strVal(r['Cod SAP'] || r['cod'] || '');
    if (!cod) return;
    store.materiale[cod] = {
      cod,
      nm: strVal(r['Nume Produs'] || r['denumire'] || ''),
      sjh: numVal(r['Sarje/h'] || 0),
      cph: numVal(r['CAPACITATE PAL/H'] || r['cap_paleti_ora'] || 0),
      cpr: numVal(r['CAPACITATE REALA PAL/H'] || r['cap_reala'] || 0),
      buc: numVal(r['NR BUCATI/PALET'] || r['buc_palet'] || 0),
      lb: strVal(r['LIMBA ETICHETARE'] || ''),
      off: numVal(r['Decalaj, Ore neprevazute AVG 2 WEEK'] || 3.5),
      defLine: strVal(r['LINIE PRODUCTIE'] || r['Linie productie'] || ''),
      defFab: '',
      tipTava: strVal(r['TIP TAVA'] || ''),
      baxare: numVal(r['BAXARE'] || 0),
      tipPalet: strVal(r['TIP PALET'] || ''),
    };
  });

  // ── COMENZI PSF/PSC ──────────────────────────────────────────────────────
  // Headers on row 1 (0-indexed), data from row 2
  const wsComenzi = wb.Sheets['Comenzi'];
  if (wsComenzi) {
    const rawRows = XLSX.utils.sheet_to_json(wsComenzi, { header: 1, defval: null });
    const hdrs = rawRows[0] || [];
    const ci = {};
    hdrs.forEach((h, i) => { if (h) { ci[String(h).trim()] = i; ci[String(h)] = i; } });
    const get = (row, ...keys) => {
      for (const k of keys) {
        const idx = ci[k] !== undefined ? ci[k] : ci[k.trim()];
        if (idx !== undefined && row[idx] != null) return row[idx];
      }
      return null;
    };

    rawRows.slice(1).forEach((row, idx) => {
      if (!row || row.every(c => c == null)) return;
      const nrPS = strVal(get(row, 'PSF NR'));
      const cod = strVal(get(row, 'Cod material ', 'Cod material', 'Cod SAP'));
      if (!nrPS && !cod) return;
      const status = strVal(get(row, 'Programat') || 'Neprogramat');
      store.comenzi.push({
        _id: uid(),
        nrPS,
        cod,
        desc: strVal(get(row, 'Descriere material')),
        client: strVal(get(row, 'Client')),
        cant: numVal(get(row, 'Cantitate')),
        cagr: numVal(get(row, 'Cantitate agreata')),
        cfab: numVal(get(row, 'Cantitate fabricata')),
        celMaiDevreme: xlDate(get(row, 'Cel mai devreme')),
        dlim: xlDate(get(row, 'Data limita punere pe Stoc')),
        dagr: xlDate(get(row, 'Data agreata de punere pe stoc/Anulare')),
        dprog: xlDate(get(row, 'Data programat')),
        dataPunerePeStoc: xlDate(get(row, 'Data punere pe stoc 1')),
        oreProductie: numVal(get(row, 'Ore productie de programat')),
        cantNeprog: numVal(get(row, 'Cantitate neprogramata (din ajustare cda)')),
        cantFinala: numVal(get(row, 'Cantitate finala de pus pe stoc')),
        status,
        linie: strVal(get(row, 'Linie productie')),
        liniePlan: strVal(get(row, 'Linie productie')),
        fabricat: strVal(get(row, 'Fabricat')),
        importedAt: new Date().toISOString(),
      });
    });
  }

  // ── MENTENANȚĂ ───────────────────────────────────────────────────────────
  sheetRows('Comenzi Mentenanta').forEach(r => {
    store.mnt.push({
      _id: uid(), cod: strVal(r['Cod'] || ''), linie: strVal(r['Linie'] || ''),
      fabrica: strVal(r['Fabrica'] || ''), subAnsamblu: strVal(r['Sub-ansamblu'] || ''),
      prioritate: strVal(r['Prioritate'] || 'Normal'), data: xlDate(r['Data']),
      dataProg: xlDate(r['Data Prog']), ore: numVal(r['Ore'] || 0),
      prog: strVal(r['Programat'] || ''), status: 'Neprogramat',
    });
  });

  // ── IGIENIZARE ───────────────────────────────────────────────────────────
  sheetRows('Comenzi Igienizare').forEach(r => {
    store.ig.push({
      _id: uid(), nr: strVal(r['Nr'] || ''), linie: strVal(r['Linie'] || ''),
      prioritate: strVal(r['Prioritate'] || 'Normal'), data: xlDate(r['Data']),
      ore: numVal(r['Ore'] || 0), oraStart: strVal(r['Ora Start'] || '07:00'),
      prog: strVal(r['Programat'] || ''), tip: strVal(r['Tip'] || ''),
    });
  });

  // ── DDD ──────────────────────────────────────────────────────────────────
  sheetRows('Comenzi DDD').forEach(r => {
    store.ddd.push({
      _id: uid(), linie: strVal(r['Linie'] || ''), tip: strVal(r['Tip'] || ''),
      data: xlDate(r['Data']), dataProg: xlDate(r['Data Prog']),
      ore: numVal(r['Ore'] || 0), prog: strVal(r['Programat'] || ''),
    });
  });

  // ── CDI ──────────────────────────────────────────────────────────────────
  sheetRows('Comenzi CDI').forEach(r => {
    store.cdi.push({
      _id: uid(), linie: strVal(r['Linie'] || ''), prod: strVal(r['Produs'] || ''),
      resp: strVal(r['Responsabil'] || ''), dmin: xlDate(r['Data Min']),
      dmax: xlDate(r['Data Max']), ore: numVal(r['Ore'] || 0),
      dataProg: xlDate(r['Data Prog']), prog: strVal(r['Programat'] || ''),
    });
  });

  return store;
}

// ── Copy-paste parser ─────────────────────────────────────────────────────
// Parses TSV text (tab-separated, copied from Excel)

export function parsePasteMateriale(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (!lines.length) return { items: [], errors: [] };
  const items = [];
  const errors = [];

  // Detect if first line is header
  const firstCols = lines[0].split('\t').map(c => c.trim().toLowerCase());
  const hasHeader = firstCols.some(c => c.includes('cod') || c.includes('sap') || c.includes('material'));
  const dataLines = hasHeader ? lines.slice(1) : lines;

  // Flexible column mapping based on header or position
  let colMap = null;
  if (hasHeader) {
    const hdr = lines[0].split('\t').map(c => c.trim().toLowerCase());
    colMap = {
      cod: hdr.findIndex(h => h.includes('cod') || h.includes('sap')),
      nm: hdr.findIndex(h => h.includes('nume') || h.includes('descriere') || h.includes('produs')),
      sjh: hdr.findIndex(h => h.includes('sarj')),
      cph: hdr.findIndex(h => h.includes('cap') && h.includes('pal') && !h.includes('real')),
      cpr: hdr.findIndex(h => h.includes('real')),
      buc: hdr.findIndex(h => h.includes('buc')),
      lb: hdr.findIndex(h => h.includes('limb')),
      off: hdr.findIndex(h => h.includes('offset') || h.includes('decalaj')),
      defLine: hdr.findIndex(h => h.includes('linie')),
    };
  }

  dataLines.forEach((line, i) => {
    const cols = line.split('\t').map(c => c.trim());
    if (cols.length < 2 || cols.every(c => !c)) return;
    try {
      const get = (idx, fallback = '') => {
        if (idx == null || idx < 0) return fallback;
        return cols[idx] != null ? String(cols[idx]).trim() : fallback;
      };
      const getNum = (idx) => {
        const v = get(idx, '0').replace(',', '.');
        return parseFloat(v) || 0;
      };

      const cod = colMap ? get(colMap.cod) : cols[0];
      if (!cod) return;

      items.push({
        cod: cod.replace(/\s+/g, ''),
        nm: colMap ? get(colMap.nm) : (cols[1] || ''),
        sjh: colMap ? getNum(colMap.sjh) : (parseFloat(cols[2]) || 0),
        cph: colMap ? getNum(colMap.cph) : (parseFloat(cols[3]) || 0),
        cpr: colMap ? getNum(colMap.cpr) : (parseFloat(cols[4]) || 0),
        buc: colMap ? getNum(colMap.buc) : (parseFloat(cols[5]) || 0),
        lb: colMap ? get(colMap.lb) : (cols[6] || ''),
        off: colMap ? getNum(colMap.off) : (parseFloat(cols[7]) || 3.5),
        defLine: colMap ? get(colMap.defLine) : (cols[8] || ''),
        defFab: '',
      });
    } catch (e) {
      errors.push(`Rând ${i + 1}: ${e.message}`);
    }
  });

  return { items, errors };
}

export function parsePasteComenzi(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (!lines.length) return { items: [], errors: [] };
  const items = [];
  const errors = [];

  const firstCols = lines[0].split('\t').map(c => c.trim().toLowerCase());
  const hasHeader = firstCols.some(c =>
    c.includes('client') || c.includes('cod') || c.includes('psf') || c.includes('nr')
  );
  const dataLines = hasHeader ? lines.slice(1) : lines;

  // Exact Excel column names mapping (case-insensitive, trimmed)
  const EXACT_MAP = {
    client:  ['client'],
    cod:     ['cod material', 'cod material ', 'cod sap', 'cod'],
    desc:    ['descriere material', 'descriere'],
    nrPS:    ['psf nr', 'psc nr', 'nr ps', 'psf_nr', 'nr psf', 'nr psc'],
    cant:    ['cantitate'],
    celMaiDevreme: ['cel mai devreme'],
    dlim:    ['data limita punere pe stoc', 'data limita', 'data limita stoc'],
    dagr:    ['data agreata de punere pe stoc/anulare', 'data agreata', 'data agr'],
    cagr:    ['cantitate agreata'],
    cfab:    ['cantitate fabricata'],
    status:  ['programat', 'status'],
    linie:   ['linie productie', 'linie'],
    dprog:   ['data programat'],
    dataPunerePeStoc: ['data punere pe stoc 1'],
  };

  let colMap = null;
  if (hasHeader) {
    const hdr = lines[0].split('\t').map(c => c.trim().toLowerCase());
    colMap = {};
    Object.entries(EXACT_MAP).forEach(([field, names]) => {
      const idx = hdr.findIndex(h => names.some(n => h === n || h.startsWith(n)));
      colMap[field] = idx >= 0 ? idx : -1;
    });
  }

  dataLines.forEach((line, i) => {
    const cols = line.split('\t').map(c => c.trim());
    if (cols.length < 3 || cols.every(c => !c)) return;
    try {
      const get = (idx, fallback = '') => {
        if (idx == null || idx < 0) return fallback;
        return cols[idx] != null ? String(cols[idx]).trim() : fallback;
      };
      const getDate = (idx) => {
        const v = get(idx);
        if (!v) return null;
        // Try DD/MM/YYYY or YYYY-MM-DD
        const parts = v.split(/[\/\-\.]/);
        if (parts.length === 3) {
          if (parts[0].length === 4) return `${parts[0]}-${p2(parts[1])}-${p2(parts[2])}`;
          return `${parts[2]}-${p2(parts[1])}-${p2(parts[0])}`;
        }
        return null;
      };
      const getNum = (idx) => parseFloat(get(idx, '0').replace(',', '.')) || 0;

      const nrPS = colMap ? get(colMap.nrPS) : (cols[3] || '');
      const cod = colMap ? get(colMap.cod) : (cols[1] || '');
      if (!nrPS && !cod) return;

      items.push({
        _id: uid(),
        client: colMap ? get(colMap.client) : (cols[0] || ''),
        cod: (colMap ? get(colMap.cod) : (cols[1] || '')).replace(/\s+/g, ''),
        desc: colMap ? get(colMap.desc) : (cols[2] || ''),
        nrPS,
        cant: colMap ? getNum(colMap.cant) : (parseFloat(cols[4]) || 0),
        cagr: colMap ? getNum(colMap.cagr) : 0,
        cfab: colMap ? getNum(colMap.cfab) : 0,
        celMaiDevreme: colMap ? getDate(colMap.celMaiDevreme) : null,
        dlim: colMap ? getDate(colMap.dlim) : null,
        dagr: colMap ? getDate(colMap.dagr) : null,
        dprog: colMap ? getDate(colMap.dprog) : null,
        dataPunerePeStoc: colMap ? getDate(colMap.dataPunerePeStoc) : null,
        status: colMap ? (get(colMap.status) || 'Neprogramat') : 'Neprogramat',
        linie: colMap ? get(colMap.linie) : '',
        liniePlan: '',
        importedAt: new Date().toISOString(),
      });
    } catch (e) {
      errors.push(`Rând ${i + 1}: ${e.message}`);
    }
  });

  return { items, errors };
}
