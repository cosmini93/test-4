import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, ChevronLeft, ChevronRight, Plus, X, Check, Clock, Edit2, Trash2, Wrench, Droplets, Bug, FlaskConical, GripVertical } from 'lucide-react';

const SHIFT_HOURS = [
  { id: 1, label: 'S1', start: 7, end: 15 },
  { id: 2, label: 'S2', start: 15, end: 23 },
  { id: 3, label: 'S3', start: 23, end: 31 }, // 31=7 next day
];
const DAY_START = 7;
const TOTAL_HOURS = 24;
const SLOT_PX = 30; // pixels per 30min slot
const SLOTS_PER_HOUR = 2;
const TOTAL_SLOTS = TOTAL_HOURS * SLOTS_PER_HOUR; // 48
const TIMELINE_W = TOTAL_SLOTS * SLOT_PX; // 1440px
const LINE_LABEL_W = 150;

const PROD_COLORS = ['#FB923C', '#60A5FA', '#4ADE80', '#A78BFA', '#FBBF24', '#22D3EE', '#F87171'];
const SUPPORT_COLORS = { maintenance: '#9333EA', hygiene: '#2563EB', ddd: '#16A34A', cdi: '#D97706' };

function formatDate(d) { return d.toISOString().split('T')[0]; }
function getWeekDates(ref) {
  const d = new Date(ref); const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  return Array.from({ length: 7 }, (_, i) => { const dt = new Date(mon); dt.setDate(mon.getDate() + i); return dt; });
}

function hourToSlot(h) { return ((h - DAY_START + 24) % 24) * SLOTS_PER_HOUR; }
function shiftStartSlot(shiftId) { return hourToSlot(SHIFT_HOURS.find(s => s.id === shiftId).start); }

export default function PlanningPage() {
  const { api } = useAuth();
  const [lines, setLines] = useState([]);
  const [prodOrders, setProdOrders] = useState([]);
  const [supportOrders, setSupportOrders] = useState([]);
  const [refDate, setRefDate] = useState(new Date());
  const [view, setView] = useState('day');
  const [selDay, setSelDay] = useState(new Date());
  const [modal, setModal] = useState(null); // {mode:'add'|'edit', line, date, shift, order?, supportType?}
  const [supportModal, setSupportModal] = useState(null);
  const [exceptionEvents, setExceptionEvents] = useState([]);
  const [showExceptionForm, setShowExceptionForm] = useState(null); // {line, date}
  const [dragOrder, setDragOrder] = useState(null);
  const weekDates = useMemo(() => getWeekDates(refDate), [refDate]);

  const fetchAll = useCallback(() => {
    api.get('/lines').then(r => setLines(r.data.filter(l => l.activ !== false)));
    const s = formatDate(weekDates[0]), e = formatDate(weekDates[6]);
    api.get(`/production-orders?data_start=${s}&data_end=${e}`).then(r => setProdOrders(r.data));
    api.get(`/exception-events?data_start=${s}&data_end=${e}`).then(r => setExceptionEvents(r.data)).catch(() => {});
    Promise.all([
      api.get('/orders/maintenance'), api.get('/orders/hygiene'),
      api.get('/orders/ddd'), api.get('/orders/cdi')
    ]).then(([mnt, hyg, ddd, cdi]) => {
      const all = [
        ...mnt.data.map(o => ({ ...o, _type: 'maintenance', _color: SUPPORT_COLORS.maintenance })),
        ...hyg.data.map(o => ({ ...o, _type: 'hygiene', _color: SUPPORT_COLORS.hygiene })),
        ...ddd.data.map(o => ({ ...o, _type: 'ddd', _color: SUPPORT_COLORS.ddd })),
        ...cdi.data.map(o => ({ ...o, _type: 'cdi', _color: SUPPORT_COLORS.cdi })),
      ];
      setSupportOrders(all);
    });
  }, [api, weekDates]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openAdd = (lineCode, date, shiftId) => setModal({ mode: 'add', line: lineCode, date: formatDate(date), shift: shiftId });
  const openEdit = (order) => setModal({ mode: 'edit', line: order.linie_productie, date: order.data_start, shift: order.schimb, order });
  const handleDelete = async (id) => { if (window.confirm('Stergi comanda?')) { await api.delete(`/production-orders/${id}`); fetchAll(); } };

  const handleDrop = async (orderId, newLine, newDate, xPos) => {
    // Calculate exact time from X position on timeline
    const slotIndex = Math.round(xPos / SLOT_PX);
    const minutesFromStart = slotIndex * 30; // each slot = 30min
    const totalMinutes = (DAY_START * 60 + minutesFromStart) % (24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const mins = Math.round((totalMinutes % 60) / 5) * 5; // round to 5min
    const oraStart = `${String(hours).padStart(2,'0')}:${String(mins).padStart(2,'0')}`;
    const shiftId = hours >= 7 && hours < 15 ? 1 : hours >= 15 && hours < 23 ? 2 : 3;
    await api.put(`/production-orders/${orderId}`, { linie_productie: newLine, data_start: newDate, schimb: shiftId, ora_start: oraStart });
    fetchAll();
  };

  return (
    <div className="p-4 h-full flex flex-col" data-testid="planning-page">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 font-['Work_Sans']">Planificare Productie</h1>
          <p className="text-sm text-zinc-500">Gantt cu distributie sarje/paleti pe schimburi - drag & drop</p>
        </div>
        <div className="flex border border-zinc-200 rounded-sm overflow-hidden">
          <button onClick={() => setView('week')} className={`px-3 py-1.5 text-xs font-medium ${view === 'week' ? 'bg-orange-600 text-white' : 'bg-white text-zinc-600'}`} data-testid="view-week-btn">Saptamana</button>
          <button onClick={() => setView('day')} className={`px-3 py-1.5 text-xs font-medium ${view === 'day' ? 'bg-orange-600 text-white' : 'bg-white text-zinc-600'}`} data-testid="view-day-btn">Zi</button>
        </div>
      </div>

      {view === 'day' ? (
        <DayTimeline lines={lines} day={selDay} prodOrders={prodOrders} supportOrders={supportOrders}
          exceptionEvents={exceptionEvents} api={api}
          onNav={d => { const nd = new Date(selDay); nd.setDate(nd.getDate() + d); setSelDay(nd); }}
          onAdd={openAdd} onEdit={openEdit} onDelete={handleDelete} onDrop={handleDrop} dragOrder={dragOrder} setDragOrder={setDragOrder}
          onAddSupport={(type, lineCode, date, shiftId) => setSupportModal({ type, line: lineCode, date: formatDate(date), shift: shiftId })}
          onAddException={(lineCode, date) => setShowExceptionForm({ line: lineCode, date: formatDate(date) })}
          onRefresh={fetchAll} />
      ) : (
        <WeekView lines={lines} weekDates={weekDates} prodOrders={prodOrders}
          onNavWeek={d => { const nd = new Date(refDate); nd.setDate(nd.getDate() + d * 7); setRefDate(nd); }}
          onDayClick={d => { setSelDay(d); setView('day'); }} onEdit={openEdit} />
      )}

      {modal && (
        <ProdOrderModal api={api} lines={lines} modal={modal}
          onClose={() => setModal(null)} onSaved={() => { setModal(null); fetchAll(); }} />
      )}

      {supportModal && (
        <SupportOrderModal api={api} modal={supportModal} lines={lines}
          onClose={() => setSupportModal(null)} onSaved={() => { setSupportModal(null); fetchAll(); }} />
      )}

      {showExceptionForm && (
        <ExceptionEventModal api={api} line={showExceptionForm.line} date={showExceptionForm.date} lines={lines}
          onClose={() => setShowExceptionForm(null)} onSaved={() => { setShowExceptionForm(null); fetchAll(); }} />
      )}
    </div>
  );
}

/* ─── Exception Event Modal ─── */
function ExceptionEventModal({ api, line, date, lines, onClose, onSaved }) {
  const [form, setForm] = useState({ linie_productie: line, data: date, ora_start: '07:00', durata_min: 60, tip: 'defectiune', descriere: '', decaleaza_comenzi: true });
  const [saving, setSaving] = useState(false);
  const lineName = lines.find(l => l.cod === line)?.nume || line;

  const handleSave = async () => {
    setSaving(true);
    try { await api.post('/exception-events', form); onSaved(); } catch (e) { alert(e.response?.data?.detail || e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-sm border border-zinc-200 w-full max-w-md shadow-lg">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-red-600 text-white">
          <div><h3 className="text-sm font-medium">Eveniment Exceptie / Defectiune</h3><p className="text-xs text-white/80">{lineName} &middot; {date}</p></div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">Tip</label>
              <select value={form.tip} onChange={e => setForm({...form, tip: e.target.value})} className="w-full h-9 px-3 border border-zinc-200 rounded-sm text-sm bg-white">
                <option value="defectiune">Defectiune</option>
                <option value="neprevazut">Neprevazut</option>
                <option value="schimbare_sortiment">Schimbare Sortiment</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">Ora Start</label>
              <input type="time" value={form.ora_start} onChange={e => setForm({...form, ora_start: e.target.value})} className="w-full h-9 px-3 border border-zinc-200 rounded-sm text-sm" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">Durata (min)</label>
              <input type="number" value={form.durata_min} onChange={e => setForm({...form, durata_min: parseInt(e.target.value) || 0})} className="w-full h-9 px-3 border border-zinc-200 rounded-sm text-sm" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.decaleaza_comenzi} onChange={e => setForm({...form, decaleaza_comenzi: e.target.checked})} className="accent-red-600" />Decaleaza comenzi</label>
            </div>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">Descriere</label>
            <input value={form.descriere} onChange={e => setForm({...form, descriere: e.target.value})} placeholder="Descriere eveniment..." className="w-full h-9 px-3 border border-zinc-200 rounded-sm text-sm" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t">
          <button onClick={onClose} className="px-4 h-9 border border-zinc-200 text-sm rounded-sm hover:bg-zinc-50">Anuleaza</button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 h-9 bg-red-600 text-white text-sm rounded-sm hover:bg-red-700 disabled:opacity-50">
            <Check className="w-4 h-4" />{saving ? '...' : 'Adauga Eveniment'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Day Timeline Gantt ─── */
function DayTimeline({ lines, day, prodOrders, supportOrders, exceptionEvents, api, onNav, onAdd, onEdit, onDelete, onDrop, dragOrder, setDragOrder, onAddSupport, onAddException, onRefresh }) {
  const dateStr = formatDate(day);
  const dayProd = prodOrders.filter(o => o.data_start === dateStr);
  const daySup = supportOrders.filter(o => (o.data || '').startsWith(dateStr));

  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => (DAY_START + i) % 24);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-3 mb-2 shrink-0">
        <button onClick={() => onNav(-1)} className="p-1.5 border border-zinc-200 rounded-sm hover:bg-zinc-50"><ChevronLeft className="w-4 h-4" /></button>
        <Calendar className="w-4 h-4 text-orange-600" />
        <span className="text-sm font-medium text-zinc-900">{day.toLocaleDateString('ro-RO', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</span>
        <button onClick={() => onNav(1)} className="p-1.5 border border-zinc-200 rounded-sm hover:bg-zinc-50"><ChevronRight className="w-4 h-4" /></button>
      </div>

      <div className="flex-1 border border-zinc-200 rounded-sm bg-white overflow-auto" data-testid="gantt-chart-container">
        {/* Timeline header */}
        <div className="flex sticky top-0 z-20 bg-white border-b border-zinc-200">
          <div className="shrink-0 border-r border-zinc-200 bg-zinc-50 flex items-end px-2 py-1" style={{ width: LINE_LABEL_W }}>
            <span className="text-[9px] text-zinc-400 uppercase tracking-widest font-bold">Linie</span>
          </div>
          <div className="relative" style={{ width: TIMELINE_W, minWidth: TIMELINE_W }}>
            {/* Shift backgrounds */}
            <div className="flex h-5">
              {SHIFT_HOURS.map(s => {
                const startSlot = hourToSlot(s.start);
                const w = 8 * SLOTS_PER_HOUR * SLOT_PX;
                return (
                  <div key={s.id} className="absolute top-0 h-5 flex items-center justify-center text-[9px] font-bold uppercase tracking-widest border-b border-zinc-200"
                    style={{ left: startSlot * SLOT_PX, width: w, backgroundColor: s.id === 3 ? '#f0f0f4' : s.id === 2 ? '#fafafa' : '#fff' }}>
                    <span className={s.id === 1 ? 'text-orange-600' : s.id === 2 ? 'text-blue-600' : 'text-zinc-500'}>{s.label} ({s.start % 24}:00 - {s.end % 24}:00)</span>
                  </div>
                );
              })}
            </div>
            {/* Hour markers */}
            <div className="flex h-4 border-b border-zinc-200">
              {hours.map((h, i) => (
                <div key={i} className="border-r border-zinc-100 text-[8px] text-zinc-400 text-center leading-4 font-mono" style={{ width: SLOTS_PER_HOUR * SLOT_PX }}>
                  {String(h).padStart(2, '0')}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Lines */}
        {lines.map((line, li) => {
          const lineProds = dayProd.filter(o => o.linie_productie === line.cod);
          const lineSups = daySup.filter(o => o.linie_productie === line.cod || o.linie === line.cod);
          const rowH = Math.max(60, lineProds.length * 52 + lineSups.length * 22 + 10);

          return (
            <div key={line.id} className="flex border-b border-zinc-100"
              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('bg-orange-50'); }}
              onDragLeave={e => { e.currentTarget.classList.remove('bg-orange-50'); }}
              onDrop={e => {
                e.preventDefault(); e.currentTarget.classList.remove('bg-orange-50');
                if (dragOrder) {
                  const rect = e.currentTarget.querySelector('.timeline-area')?.getBoundingClientRect();
                  if (rect) {
                    const x = e.clientX - rect.left;
                    onDrop(dragOrder.id, line.cod, dateStr, x);
                    setDragOrder(null);
                  }
                }
              }}>
              {/* Line label */}
              <div className="shrink-0 border-r border-zinc-200 px-2 py-1 flex flex-col justify-center" style={{ width: LINE_LABEL_W, minHeight: rowH }}>
                <div className="text-[10px] font-medium text-zinc-800">{line.nume}</div>
                <div className="text-[8px] text-zinc-400">{line.fabrica}</div>
                <div className="flex gap-0.5 mt-1 flex-wrap">
                  {SHIFT_HOURS.map(s => (
                    <button key={s.id} onClick={() => onAdd(line.cod, day, s.id)} className="text-[7px] px-1 py-0.5 bg-zinc-100 hover:bg-orange-100 text-zinc-500 hover:text-orange-600 rounded" title={`Productie ${s.label}`}>+{s.label}</button>
                  ))}
                  <button onClick={() => onAddSupport('maintenance', line.cod, day, 1)} className="text-[7px] px-1 py-0.5 bg-purple-50 hover:bg-purple-100 text-purple-500 rounded" title="Mentenanta">+MNT</button>
                  <button onClick={() => onAddSupport('hygiene', line.cod, day, 1)} className="text-[7px] px-1 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-500 rounded" title="Igienizare">+IG</button>
                  <button onClick={() => onAddSupport('ddd', line.cod, day, 1)} className="text-[7px] px-1 py-0.5 bg-green-50 hover:bg-green-100 text-green-500 rounded" title="DDD">+DDD</button>
                  <button onClick={() => onAddException(line.cod, day)} className="text-[7px] px-1 py-0.5 bg-red-50 hover:bg-red-100 text-red-500 rounded" title="Eveniment exceptie">+EXC</button>
                </div>
              </div>

              {/* Timeline area */}
              <div className="relative timeline-area" style={{ width: TIMELINE_W, minWidth: TIMELINE_W, minHeight: rowH }}>
                {/* Grid lines */}
                {hours.map((_, i) => (
                  <div key={i} className="absolute top-0 bottom-0 border-r border-zinc-50" style={{ left: i * SLOTS_PER_HOUR * SLOT_PX }} />
                ))}
                {[16, 32].map(slot => (
                  <div key={slot} className="absolute top-0 bottom-0 border-r border-zinc-300 border-dashed" style={{ left: slot * SLOT_PX }} />
                ))}

                {/* Exception events - red bars - clickable to delete */}
                {(exceptionEvents || []).filter(ev => ev.linie_productie === line.cod && ev.data === dateStr).map((ev, ei) => {
                  const [hh, mm] = (ev.ora_start || '07:00').split(':').map(Number);
                  const evStartSlot = hourToSlot(hh) + (mm / 30);
                  const evDurSlots = Math.max((ev.durata_min || 60) / 30, 1);
                  return (
                    <div key={`exc-${ev.id}`} className="absolute z-30 rounded-sm cursor-pointer"
                      style={{ left: evStartSlot * SLOT_PX, width: evDurSlots * SLOT_PX, top: 0, bottom: 0, backgroundColor: '#DC262618', border: '2px solid #DC2626' }}
                      onClick={() => { if (window.confirm(`${ev.tip}: ${ev.descriere} (${ev.durata_min}min)\nStergi?`)) api.delete(`/exception-events/${ev.id}`).then(() => onRefresh()); }}
                      title={`${ev.tip}: ${ev.descriere} - Click pt stergere`}>
                      <div className="px-1.5 py-1 text-[9px] font-bold text-red-700">
                        {ev.tip?.toUpperCase()}: {ev.descriere} ({ev.durata_min}min)
                        {ev.decaleaza_comenzi && <span className="text-[7px] ml-1">→ Decaleaza</span>}
                      </div>
                    </div>
                  );
                })}

                {/* Production orders as bars - TALLER with more detail */}
                {lineProds.map((o, oi) => {
                  // Use ora_start if available, otherwise fall back to shift start
                  let startSlot;
                  if (o.ora_start) {
                    const [hh, mm] = o.ora_start.split(':').map(Number);
                    startSlot = hourToSlot(hh) + Math.floor((mm || 0) / 30);
                  } else {
                    startSlot = shiftStartSlot(o.schimb);
                  }
                  const durationSlots = Math.max((o.ore_productie || 1) * SLOTS_PER_HOUR, 2);
                  const color = PROD_COLORS[oi % PROD_COLORS.length];
                  const barH = 44;
                  const top = oi * (barH + 4) + 4;

                  // Per-shift distribution
                  let remaining = o.ore_productie || 0;
                  const shiftDist = [];
                  let curShift = o.schimb;
                  let curStart = startSlot;
                  while (remaining > 0 && curShift <= 3) {
                    const shiftEnd = (curShift === 1 ? 16 : curShift === 2 ? 32 : 48);
                    const available = (shiftEnd - curStart) / SLOTS_PER_HOUR;
                    const used = Math.min(remaining, available);
                    const ppo = o.cantitate_paleti && o.ore_productie ? o.cantitate_paleti / o.ore_productie : 0;
                    const spo = o.cantitate_sarje && o.ore_productie ? o.cantitate_sarje / o.ore_productie : 0;
                    shiftDist.push({ shift: curShift, hours: used, paleti: Math.round(ppo * used * 10) / 10, sarje: Math.round(spo * used * 10) / 10 });
                    remaining -= used;
                    curShift++;
                    curStart = shiftEnd;
                  }

                  // Changeover slot - use order's durata_changeover or default 120min
                  const changeoverMin = o.durata_changeover != null ? o.durata_changeover : 120;
                  const changeoverStart = startSlot + durationSlots;
                  const changeoverSlots = changeoverMin / 30;

                  return (
                    <React.Fragment key={o.id}>
                      {/* Main order bar */}
                      <div className="absolute rounded-sm cursor-grab active:cursor-grabbing group"
                        draggable onDragStart={() => setDragOrder(o)} onDragEnd={() => setDragOrder(null)}
                        style={{ left: startSlot * SLOT_PX, width: durationSlots * SLOT_PX, top, height: barH, backgroundColor: color + '25', border: `2px solid ${color}` }}
                        onClick={() => onEdit(o)} data-testid={`gantt-order-${o.id}`}>
                        <div className="absolute inset-y-0 left-0 rounded-sm opacity-20" style={{ width: '100%', backgroundColor: color }} />
                        <div className="absolute inset-0 flex flex-col justify-center px-1.5 z-10 overflow-hidden" style={{ color }}>
                          <div className="flex items-center gap-1 text-[9px] font-bold truncate">
                            <span>{o.cod_material}</span>
                            <span className="opacity-50 font-normal truncate">{o.descriere_material}</span>
                            <GripVertical className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-60 shrink-0" />
                          </div>
                          <div className="text-[8px] opacity-70 font-mono truncate">{o.cod_comanda} | Start: {o.ora_start || 'auto'}</div>
                          <div className="text-[8px] flex gap-2">
                            <span className="font-medium">Tot: {o.cantitate_paleti}p {o.cantitate_sarje}sj {o.ore_productie}h</span>
                            {shiftDist.length > 1 && shiftDist.map((sd, si) => (
                              <span key={si} className="opacity-60">S{sd.shift}: {sd.paleti}p/{sd.sarje}sj</span>
                            ))}
                          </div>
                        </div>
                        <button onClick={e => { e.stopPropagation(); onDelete(o.id); }}
                          className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 z-20 text-[8px]">×</button>
                      </div>
                      {/* Changeover slot - CLICKABLE to edit */}
                      {changeoverMin > 0 && changeoverStart < TOTAL_SLOTS && (
                        <div className="absolute rounded-sm cursor-pointer group/ch"
                          style={{ left: changeoverStart * SLOT_PX, width: Math.min(changeoverSlots, TOTAL_SLOTS - changeoverStart) * SLOT_PX, top: top + 4, height: barH - 8, backgroundColor: '#a1a1aa15', border: '1.5px dashed #a1a1aa' }}
                          onClick={() => {
                            const newMin = prompt(`Durata schimbare sortiment (minute):\nActual: ${changeoverMin} min`, changeoverMin);
                            if (newMin !== null) {
                              api.put(`/production-orders/${o.id}`, { durata_changeover: parseInt(newMin) || 0 }).then(() => onRefresh());
                            }
                          }}
                          title={`Schimbare sortiment: ${changeoverMin}min - Click pt ajustare`}>
                          <div className="px-1 flex items-center h-full text-[7px] text-zinc-400 truncate">
                            <span className="group-hover/ch:text-zinc-600">Schimb.Sort. {changeoverMin}min</span>
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}

                {/* Support orders */}
                {lineSups.map((o, oi) => {
                  const topPos = lineProds.length * 52 + oi * 22 + 4;
                  const startSlot = o.schimb ? shiftStartSlot(o.schimb) : 0;
                  const dur = (o.timp_interventie_ore || 1) * SLOTS_PER_HOUR;
                  const typeLabel = { maintenance: 'MNT', hygiene: 'IG', ddd: 'DDD', cdi: 'CDI' };
                  return (
                    <div key={`sup-${o.id}`} className="absolute rounded-sm"
                      style={{ left: startSlot * SLOT_PX, width: Math.max(dur, 2) * SLOT_PX, top: topPos, height: 18, backgroundColor: o._color + '22', border: `1px dashed ${o._color}` }}>
                      <div className="flex items-center h-full px-1 text-[8px] font-medium" style={{ color: o._color }}>
                        {typeLabel[o._type] || ''}: {o.cod || o.descriere || o.proiect || ''} {o.timp_interventie_ore ? `${o.timp_interventie_ore}h` : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 mt-1.5 text-[10px] text-zinc-500 shrink-0 flex-wrap">
        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />S1: 07-15 | S2: 15-23 | S3: 23-07</span>
        <span className="flex items-center gap-1"><div className="w-3 h-2 rounded-sm" style={{ backgroundColor: SUPPORT_COLORS.maintenance }} /><Wrench className="w-3 h-3" />Mentenanta</span>
        <span className="flex items-center gap-1"><div className="w-3 h-2 rounded-sm" style={{ backgroundColor: SUPPORT_COLORS.hygiene }} /><Droplets className="w-3 h-3" />Igienizare</span>
        <span className="flex items-center gap-1"><div className="w-3 h-2 rounded-sm" style={{ backgroundColor: SUPPORT_COLORS.ddd }} /><Bug className="w-3 h-3" />DDD</span>
        <span className="flex items-center gap-1"><div className="w-3 h-2 rounded-sm" style={{ backgroundColor: SUPPORT_COLORS.cdi }} /><FlaskConical className="w-3 h-3" />CDI</span>
        <span className="flex items-center gap-1"><div className="w-3 h-2 rounded-sm border border-red-400 border-dashed" style={{ backgroundColor: '#DC262620' }} />Exceptie</span>
        <span className="flex items-center gap-1"><div className="w-3 h-2 rounded-sm border border-zinc-400 border-dashed" />Schimb. Sort.</span>
        <span>{dayProd.length} comenzi productie</span>
      </div>
    </div>
  );
}

/* ─── Week View ─── */
function WeekView({ lines, weekDates, prodOrders, onNavWeek, onDayClick, onEdit }) {
  const DAYS = ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sam', 'Dum'];
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-3 mb-2 shrink-0">
        <button onClick={() => onNavWeek(-1)} className="p-1.5 border border-zinc-200 rounded-sm hover:bg-zinc-50" data-testid="prev-week-btn"><ChevronLeft className="w-4 h-4" /></button>
        <span className="text-sm font-medium text-zinc-900">Sapt {Math.ceil((weekDates[0].getTime() - new Date(weekDates[0].getFullYear(), 0, 1).getTime()) / 604800000)} &middot; {weekDates[0].toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' })} - {weekDates[6].toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
        <button onClick={() => onNavWeek(1)} className="p-1.5 border border-zinc-200 rounded-sm hover:bg-zinc-50" data-testid="next-week-btn"><ChevronRight className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 border border-zinc-200 rounded-sm bg-white overflow-auto">
        <table className="w-full border-collapse min-w-[900px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-zinc-100">
              <th className="border-r border-b border-zinc-200 px-2 py-1.5 text-left text-[10px] uppercase tracking-widest font-bold text-zinc-500 w-36 sticky left-0 bg-zinc-100 z-20">Linie</th>
              {weekDates.map((d, i) => (
                <th key={i} className={`border-r border-b border-zinc-200 px-1 py-1.5 text-center text-[10px] uppercase tracking-widest font-bold cursor-pointer hover:bg-orange-50 ${i >= 5 ? 'text-orange-600' : 'text-zinc-500'}`} onClick={() => onDayClick(d)}>
                  {DAYS[i]} {d.getDate()}/{d.getMonth() + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map(line => (
              <tr key={line.id} className="border-b border-zinc-100">
                <td className="border-r border-zinc-200 px-2 py-1 sticky left-0 bg-white z-10">
                  <div className="text-[10px] font-medium text-zinc-800 truncate">{line.nume}</div>
                  <div className="text-[8px] text-zinc-400">{line.fabrica}</div>
                </td>
                {weekDates.map((date, di) => {
                  const ds = formatDate(date);
                  const cellOrders = prodOrders.filter(o => o.linie_productie === line.cod && o.data_start === ds);
                  const totalH = cellOrders.reduce((s, o) => s + (o.ore_productie || 0), 0);
                  return (
                    <td key={di} className="border-r border-zinc-100 p-0.5 align-top h-14 cursor-pointer hover:bg-orange-50/30" onClick={() => onDayClick(date)}>
                      {cellOrders.map((o, oi) => (
                        <div key={o.id} className="text-[8px] px-1 py-0.5 rounded-sm mb-0.5 truncate cursor-pointer"
                          style={{ backgroundColor: PROD_COLORS[oi % PROD_COLORS.length] + '33', borderLeft: `2px solid ${PROD_COLORS[oi % PROD_COLORS.length]}` }}
                          onClick={e => { e.stopPropagation(); onEdit(o); }}>
                          <span className="font-medium">{o.cod_material}</span>
                          <span className="ml-1 opacity-60">{o.cantitate_paleti}p {o.ore_productie}h</span>
                        </div>
                      ))}
                      {totalH > 0 && <div className="text-[7px] text-zinc-400 text-center mt-0.5">{totalH}h / 24h</div>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Production Order Modal - SIMPLIFIED & FUNCTIONAL ─── */
function ProdOrderModal({ api, lines, modal, onClose, onSaved }) {
  const { mode, line, date, shift, order } = modal;
  const isEdit = mode === 'edit';
  const [codMaterial, setCodMaterial] = useState(order?.cod_material || '');
  const [descMaterial, setDescMaterial] = useState(order?.descriere_material || '');
  const [unplanned, setUnplanned] = useState([]);
  const [selected, setSelected] = useState({});
  const [cantPaleti, setCantPaleti] = useState(order?.cantitate_paleti || 0);
  const [cantSarje, setCantSarje] = useState(order?.cantitate_sarje || 0);
  const [oreProductie, setOreProductie] = useState(order?.ore_productie || 0);
  const [oraStart, setOraStart] = useState(order?.ora_start || (shift === 1 ? '07:00' : shift === 2 ? '15:00' : '23:00'));
  const [changeover, setChangeover] = useState(order?.durata_changeover || 120);
  const [matInfo, setMatInfo] = useState(null);
  const [orderDate, setOrderDate] = useState(date);
  const [orderShift, setOrderShift] = useState(shift);
  const [searched, setSearched] = useState(false);
  const [saving, setSaving] = useState(false);

  const lineName = lines.find(l => l.cod === line)?.nume || line;

  useEffect(() => {
    if (codMaterial) {
      api.get(`/materials/by-code/${codMaterial}`).then(r => { if (r.data?.found) setMatInfo(r.data); }).catch(() => {});
    }
  }, [codMaterial, api]);

  const searchPSF = async () => {
    if (!codMaterial.trim()) return;
    try {
      const res = await api.get(`/production-orders/unplanned/${codMaterial.trim()}`);
      setUnplanned(res.data);
      setSearched(true);
      if (res.data.length > 0 && !descMaterial) setDescMaterial(res.data[0].descriere_material || '');
    } catch(e) { console.error(e); setSearched(true); }
  };

  const togglePSF = (psf_nr, maxQty) => {
    setSelected(p => { const n = { ...p }; if (n[psf_nr] !== undefined) delete n[psf_nr]; else n[psf_nr] = maxQty; return n; });
  };

  const recalc = useCallback((paleti) => {
    if (!matInfo || paleti <= 0) return;
    const pps = matInfo.paleti_pe_sarja || 1;
    const ppo = matInfo.paleti_pe_ora || 1;
    setCantSarje(Math.ceil(paleti / pps));
    setOreProductie(Math.round((paleti / ppo) * 100) / 100);
  }, [matInfo]);

  useEffect(() => {
    if (isEdit) return;
    const total = Object.values(selected).reduce((s, v) => s + v, 0);
    if (total > 0) { setCantPaleti(total); recalc(total); }
  }, [selected, isEdit, recalc]);

  const handlePaletiChange = (val) => { setCantPaleti(val); recalc(val); };

  // Update shift based on ora_start
  useEffect(() => {
    const h = parseInt(oraStart.split(':')[0]);
    if (h >= 7 && h < 15) setOrderShift(1);
    else if (h >= 15 && h < 23) setOrderShift(2);
    else setOrderShift(3);
  }, [oraStart]);

  const handleSave = async () => {
    if (!codMaterial || cantPaleti <= 0) { alert('Completati cod material si cantitate!'); return; }
    setSaving(true);
    const d = new Date(orderDate);
    const wk = String(Math.ceil(((d - new Date(d.getFullYear(), 0, 1)) / 86400000 + new Date(d.getFullYear(), 0, 1).getDay() + 1) / 7)).padStart(2, '0');
    const code = isEdit ? order.cod_comanda : `${String(d.getDate()).padStart(2, '0')}${wk}${d.getFullYear().toString().slice(-2)}${codMaterial}`;
    const payload = {
      cod_comanda: code, cod_material: codMaterial, descriere_material: descMaterial,
      linie_productie: line, data_start: orderDate, ora_start: oraStart, schimb: orderShift,
      cantitate_paleti: cantPaleti, cantitate_sarje: cantSarje, ore_productie: oreProductie,
      durata_changeover: changeover,
      psf_psc_refs: Object.keys(selected).length > 0 ? Object.keys(selected) : (order?.psf_psc_refs || []),
      psf_quantities: selected, status: 'planificat'
    };
    try {
      if (isEdit) await api.put(`/production-orders/${order.id}`, payload);
      else await api.post('/production-orders', payload);
      onSaved();
    } catch (e) { alert(e.response?.data?.detail || e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" data-testid="add-prod-order-modal">
      <div className="bg-white rounded-sm border border-zinc-200 w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-lg">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 bg-zinc-50 shrink-0">
          <div>
            <h3 className="text-base font-medium text-zinc-900 font-['Work_Sans']">{isEdit ? 'Editeaza Comanda' : 'Comanda Productie Noua'}</h3>
            <p className="text-xs text-zinc-500">{lineName} &middot; {orderDate} &middot; Ora start: {oraStart} &middot; S{orderShift}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-zinc-200 rounded"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Row 1: Material + Date + Ora Start */}
          <div className="grid grid-cols-4 gap-2">
            <div className="col-span-1">
              <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">Cod Material</label>
              <div className="flex gap-1">
                <input data-testid="modal-cod-material" value={codMaterial} onChange={e => setCodMaterial(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchPSF()}
                  placeholder="6000201" className="flex-1 h-9 px-2 border border-zinc-200 rounded-sm text-sm" disabled={isEdit} />
                {!isEdit && <button onClick={searchPSF} className="px-2 h-9 bg-zinc-800 text-white text-xs rounded-sm" data-testid="search-material-btn">PSF</button>}
              </div>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">Data</label>
              <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} className="w-full h-9 px-2 border border-zinc-200 rounded-sm text-xs" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">Ora Start</label>
              <input type="time" value={oraStart} onChange={e => setOraStart(e.target.value)} className="w-full h-9 px-2 border border-zinc-200 rounded-sm text-sm font-mono" data-testid="modal-ora-start" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">Schimb. Sort. (min)</label>
              <input type="number" value={changeover} onChange={e => setChangeover(parseInt(e.target.value) || 0)} min={0} step={15}
                className="w-full h-9 px-2 border border-zinc-200 rounded-sm text-sm" />
            </div>
          </div>

          {matInfo && (
            <div className="bg-blue-50 border border-blue-200 rounded-sm p-2 text-xs text-blue-800 flex gap-3">
              <span><strong>{matInfo.descriere || codMaterial}</strong></span>
              <span>Pal/oră: <strong>{matInfo.paleti_pe_ora}</strong></span>
              <span>Pal/șarjă: <strong>{matInfo.paleti_pe_sarja || '-'}</strong></span>
              <span>Flux: <strong>{matInfo.timp_flux_min || 0}min</strong></span>
              {matInfo.linie_productie && <span>Linie: <strong>{matInfo.linie_productie}</strong></span>}
            </div>
          )}

          {/* Unplanned PSFs */}
          {searched && !isEdit && unplanned.length > 0 && (
            <div className="border border-zinc-200 rounded-sm max-h-40 overflow-y-auto">
              <table className="w-full text-xs">
                <thead><tr className="bg-zinc-50 border-b border-zinc-200 sticky top-0">
                  <th className="px-2 py-1 w-8"></th><th className="px-2 py-1 text-left">PSF/PSC</th><th className="px-2 py-1 text-left">Client</th><th className="px-2 py-1 text-right">Disp.</th><th className="px-2 py-1 text-right">Planific</th><th className="px-2 py-1 text-left">Deadline</th>
                </tr></thead>
                <tbody>{unplanned.map(o => {
                  const isSel = selected[o.psf_nr] !== undefined;
                  const rem = o.cantitate_ramasa || o.cantitate;
                  return (
                    <tr key={o.id} className={`border-b border-zinc-100 cursor-pointer ${isSel ? 'bg-orange-50' : 'hover:bg-zinc-50'}`} onClick={() => togglePSF(o.psf_nr, rem)}>
                      <td className="px-2 py-1"><input type="checkbox" checked={isSel} readOnly className="accent-orange-600" /></td>
                      <td className="px-2 py-1 font-mono">{o.psf_nr}</td><td className="px-2 py-1">{o.client}</td>
                      <td className="px-2 py-1 text-right font-medium">{rem}</td>
                      <td className="px-2 py-1 text-right">{isSel && <input type="number" value={selected[o.psf_nr]} onClick={e => e.stopPropagation()} onChange={e => setSelected(p => ({ ...p, [o.psf_nr]: parseFloat(e.target.value) || 0 }))} max={rem} className="w-14 h-5 px-1 border border-orange-300 rounded-sm text-xs text-right bg-orange-50" />}</td>
                      <td className="px-2 py-1 text-zinc-500">{o.data_limita_punere_stoc}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          )}
          {searched && !isEdit && unplanned.length === 0 && (
            <div className="text-xs text-zinc-400 bg-zinc-50 rounded-sm p-2">Nicio comanda PS neplanificata pentru {codMaterial}. Puteti introduce manual cantitatea.</div>
          )}

          {/* Row 2: Quantities */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">Cantitate Paleți</label>
              <input type="number" value={cantPaleti} onChange={e => handlePaletiChange(parseFloat(e.target.value) || 0)} className="w-full h-9 px-3 border border-zinc-200 rounded-sm text-sm font-medium" data-testid="modal-cant-paleti" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">Nr Șarje <span className="text-orange-500 text-[8px]">(auto)</span></label>
              <input type="number" value={cantSarje} onChange={e => setCantSarje(parseFloat(e.target.value) || 0)} className="w-full h-9 px-3 border border-orange-200 rounded-sm text-sm bg-orange-50/30" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">Ore Producție <span className="text-orange-500 text-[8px]">(auto)</span></label>
              <input type="number" step="0.1" value={oreProductie} onChange={e => setOreProductie(parseFloat(e.target.value) || 0)} className="w-full h-9 px-3 border border-orange-200 rounded-sm text-sm bg-orange-50/30" />
            </div>
          </div>

          {cantPaleti > 0 && (
            <div className="text-xs bg-orange-50 border border-orange-200 rounded-sm p-2 space-y-0.5">
              <div><strong>{cantPaleti}</strong> paleți &middot; <strong>{cantSarje}</strong> șarje &middot; <strong>{oreProductie}</strong>h producție + <strong>{changeover}</strong>min schimb. sort.</div>
              <div className="text-orange-600">Start: {oraStart} pe S{orderShift} &middot; {oreProductie > 8 && <span className="text-red-600 font-medium">Se intinde pe {Math.ceil(oreProductie / 8)} schimburi!</span>}</div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-200 shrink-0">
          <button onClick={onClose} className="px-4 h-9 border border-zinc-200 text-sm rounded-sm hover:bg-zinc-50">Anuleaza</button>
          <button onClick={handleSave} disabled={saving || !codMaterial || cantPaleti <= 0}
            className="flex items-center gap-2 px-4 h-9 bg-orange-600 text-white text-sm rounded-sm hover:bg-orange-700 disabled:opacity-50 font-medium" data-testid="save-prod-order-btn">
            <Check className="w-4 h-4" />{saving ? '...' : isEdit ? 'Salveaza' : 'Planifica'}
          </button>
        </div>
      </div>
    </div>
  );
}


/* ─── Support Order Modal (Maintenance/Hygiene/DDD/CDI) ─── */
function SupportOrderModal({ api, modal, lines, onClose, onSaved }) {
  const { type, line, date, shift } = modal;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fabrica: lines.find(l => l.cod === line)?.fabrica || '',
    linie_productie: line,
    data: date,
    schimb: shift,
  });

  const typeConfig = {
    maintenance: { label: 'Mentenanta', endpoint: '/orders/maintenance', color: 'purple', fields: [
      { key: 'cod', label: 'Cod', placeholder: 'MNT-001' },
      { key: 'intern_extern', label: 'Intern/Extern', type: 'select', options: ['Intern', 'Extern'] },
      { key: 'sub_ansamblu', label: 'Sub-ansamblu linie' },
      { key: 'prioritate', label: 'Prioritate', type: 'select', options: ['Urgent', 'Ridicata', 'Normal', 'Scazuta'] },
      { key: 'timp_interventie_min', label: 'Timp interventie (min)', type: 'number' },
      { key: 'nr_cda', label: 'Nr comanda' },
    ]},
    hygiene: { label: 'Igienizare', endpoint: '/orders/hygiene', color: 'blue', fields: [
      { key: 'cod', label: 'Cod', placeholder: 'IG-001' },
      { key: 'sub_ansamblu_zona', label: 'Sub-ansamblu / Zona' },
      { key: 'prioritate', label: 'Prioritate', type: 'select', options: ['Urgent', 'Ridicata', 'Normal', 'Scazuta'] },
      { key: 'nr_cda', label: 'Nr comanda' },
    ]},
    ddd: { label: 'DDD', endpoint: '/orders/ddd', color: 'green', fields: [
      { key: 'cod', label: 'Cod', placeholder: 'DDD-001' },
      { key: 'sub_ansamblu_zona', label: 'Sub-ansamblu / Zona' },
      { key: 'prioritate', label: 'Prioritate', type: 'select', options: ['Urgent', 'Normal', 'Scazuta'] },
      { key: 'nr_cda', label: 'Nr comanda' },
    ]},
    cdi: { label: 'CDI', endpoint: '/orders/cdi', color: 'amber', fields: [
      { key: 'cod', label: 'Cod', placeholder: 'CDI-001' },
      { key: 'proiect', label: 'Proiect' },
      { key: 'descriere', label: 'Descriere activitate' },
      { key: 'responsabil', label: 'Responsabil' },
      { key: 'prioritate', label: 'Prioritate', type: 'select', options: ['Urgent', 'Normal', 'Scazuta'] },
    ]},
  };

  const cfg = typeConfig[type] || typeConfig.maintenance;
  const lineName = lines.find(l => l.cod === line)?.nume || line;
  const colorClass = { purple: 'bg-purple-600', blue: 'bg-blue-600', green: 'bg-green-600', amber: 'bg-amber-600' };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form, status: 'planificat' };
      if (payload.timp_interventie_min) {
        payload.timp_interventie_ore = Math.round(parseFloat(payload.timp_interventie_min) / 60 * 100) / 100;
      }
      await api.post(cfg.endpoint, payload);
      onSaved();
    } catch (e) { alert(e.response?.data?.detail || e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" data-testid="support-order-modal">
      <div className="bg-white rounded-sm border border-zinc-200 w-full max-w-lg shadow-lg">
        <div className={`flex items-center justify-between px-4 py-3 border-b border-zinc-200 ${colorClass[cfg.color] || 'bg-zinc-600'} text-white`}>
          <div>
            <h3 className="text-base font-medium font-['Work_Sans']">Planificare {cfg.label}</h3>
            <p className="text-xs text-white/80">{lineName} &middot; {date} &middot; Schimb {shift}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">Fabrica</label>
              <input value={form.fabrica || ''} onChange={e => setForm({...form, fabrica: e.target.value})} className="w-full h-9 px-3 border border-zinc-200 rounded-sm text-sm" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">Data / Schimb</label>
              <div className="flex gap-1">
                <input type="date" value={form.data || ''} onChange={e => setForm({...form, data: e.target.value})} className="flex-1 h-9 px-2 border border-zinc-200 rounded-sm text-xs" />
                <select value={form.schimb || 1} onChange={e => setForm({...form, schimb: parseInt(e.target.value)})} className="w-14 h-9 border border-zinc-200 rounded-sm text-xs">
                  <option value={1}>S1</option><option value={2}>S2</option><option value={3}>S3</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {cfg.fields.map(f => (
              <div key={f.key}>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">{f.label}</label>
                {f.type === 'select' ? (
                  <select value={form[f.key] || ''} onChange={e => setForm({...form, [f.key]: e.target.value})} className="w-full h-9 px-3 border border-zinc-200 rounded-sm text-sm bg-white">
                    <option value="">Selecteaza...</option>
                    {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input type={f.type || 'text'} value={form[f.key] || ''} placeholder={f.placeholder || ''}
                    onChange={e => setForm({...form, [f.key]: f.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value})}
                    className="w-full h-9 px-3 border border-zinc-200 rounded-sm text-sm" />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-200">
          <button onClick={onClose} className="px-4 h-9 border border-zinc-200 text-sm rounded-sm hover:bg-zinc-50">Anuleaza</button>
          <button onClick={handleSave} disabled={saving}
            className={`flex items-center gap-2 px-4 h-9 text-white text-sm rounded-sm font-medium disabled:opacity-50 ${colorClass[cfg.color] || 'bg-zinc-600'} hover:opacity-90`}
            data-testid="save-support-order-btn">
            <Check className="w-4 h-4" />{saving ? 'Se salveaza...' : `Planifica ${cfg.label}`}
          </button>
        </div>
      </div>
    </div>
  );
}