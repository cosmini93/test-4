import React, { useState, useEffect } from 'react';
import { useDataContext } from '../contexts/DataContext';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Settings, ClipboardList, BarChart3, ChevronLeft, ChevronRight,
  Upload, Wrench, Droplets, Bug, FlaskConical, GitCompare, Calculator, Bot,
  Database, Package, Download, RotateCcw
} from 'lucide-react';

const NAV_ITEMS = [
  { path: '/dashboard',     label: 'Dashboard',         icon: LayoutDashboard, group: 'main' },
  { path: '/comenzi',       label: 'Comenzi PS/PSC',    icon: ClipboardList,   group: 'main' },
  { path: '/cp',            label: 'Comenzi Producție', icon: BarChart3,       group: 'main' },
  { path: '/planning',      label: 'Planificare Gantt',  icon: BarChart3,       group: 'main' },
  { path: '/materiale',     label: 'Date Material',      icon: Package,         group: 'main' },
  { path: '/orders',        label: 'Toate Comenzile',    icon: Database,        group: 'support' },
  { path: '/psf-tracking',  label: 'Modificări PSF',     icon: GitCompare,      group: 'support' },
  { path: '/materials-calc',label: 'Necesar Materiale',  icon: Calculator,      group: 'support' },
  { path: '/ai-agent',      label: 'Agent AI',           icon: Bot,             group: 'support' },
  { path: '/admin',         label: 'Configurare',        icon: Settings,        group: 'config' },
];

export default function Layout({ children }) {
  const { store, exportJSON, resetStore, getBackupInfo } = useDataContext();
  const [backupTime, setBackupTime] = React.useState(null);
  React.useEffect(() => {
    const info = getBackupInfo?.();
    if (info) setBackupTime(info.savedAt);
    const interval = setInterval(() => {
      const i = getBackupInfo?.();
      if (i) setBackupTime(i.savedAt);
    }, 30000);
    return () => clearInterval(interval);
  }, [store]);
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [showDataMenu, setShowDataMenu] = useState(false);

  const isActive = (path) => location.pathname.startsWith(path);

  const stats = store ? {
    comenzi: (store.comenzi || []).length,
    materiale: Object.keys(store.materiale || {}).length,
    cp: (store.prod || []).length,
  } : {};

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50">
      <aside className={`${collapsed ? 'w-16' : 'w-56'} bg-white border-r border-zinc-200 flex flex-col transition-all duration-200 shrink-0`}>
        {/* Logo */}
        <div className="h-14 flex items-center px-3 border-b border-zinc-200 gap-2">
          <div className="w-8 h-8 rounded-sm bg-orange-600 flex items-center justify-center shrink-0 cursor-pointer" onClick={() => navigate('/dashboard')}>
            <span className="text-white font-bold text-sm font-['Work_Sans']">P</span>
          </div>
          {!collapsed && (
            <>
              <div className="overflow-hidden flex-1 cursor-pointer" onClick={() => navigate('/dashboard')}>
                <span className="text-base font-semibold text-zinc-900 font-['Work_Sans']">PID Planner</span>
                <span className="text-[9px] text-zinc-400 block -mt-0.5 uppercase tracking-widest">Planificare Producție</span>
              </div>
              <label title="Import Excel" className="flex items-center justify-center w-8 h-8 rounded-sm text-zinc-400 hover:text-green-600 hover:bg-green-50 cursor-pointer transition-colors">
                <FileSpreadsheet className="w-4 h-4" />
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={e => {
                  const f = e.target.files[0];
                  if (f) { import('../contexts/DataContext').then(m => {}); }
                  e.target.value = '';
                }} />
              </label>
            </>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto">
          {/* Main group */}
          {!collapsed && <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 px-3 pt-2 pb-1">Principal</div>}
          {NAV_ITEMS.filter(i => i.group === 'main').map(item => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <button key={item.path} onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 h-9 rounded-sm text-sm transition-colors ${
                  active ? 'bg-orange-50 border-l-2 border-orange-600 text-orange-700 font-medium'
                         : 'text-zinc-600 hover:bg-zinc-100 border-l-2 border-transparent'}`}>
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}

          {/* Support group */}
          {!collapsed && <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 px-3 pt-3 pb-1">Procese Suport</div>}
          {NAV_ITEMS.filter(i => i.group === 'support').map(item => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <button key={item.path} onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 h-9 rounded-sm text-sm transition-colors ${
                  active ? 'bg-orange-50 border-l-2 border-orange-600 text-orange-700 font-medium'
                         : 'text-zinc-600 hover:bg-zinc-100 border-l-2 border-transparent'}`}>
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}

          {/* Config */}
          {!collapsed && <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 px-3 pt-3 pb-1">Sistem</div>}
          {NAV_ITEMS.filter(i => i.group === 'config').map(item => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <button key={item.path} onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 h-9 rounded-sm text-sm transition-colors ${
                  active ? 'bg-orange-50 border-l-2 border-orange-600 text-orange-700 font-medium'
                         : 'text-zinc-600 hover:bg-zinc-100 border-l-2 border-transparent'}`}>
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Footer: stats + data actions */}
        <div className="border-t border-zinc-200 p-2 space-y-1">
          {!collapsed && store && (
            <div className="px-2 pb-1">
              <div className="grid grid-cols-3 gap-1 mb-1">
                {[['PS', stats.comenzi], ['Mat.', stats.materiale], ['CP', stats.cp]].map(([l, v]) => (
                  <div key={l} className="text-center">
                    <div className="text-xs font-semibold text-zinc-700">{v}</div>
                    <div className="text-[9px] text-zinc-400">{l}</div>
                  </div>
                ))}
              </div>
              {backupTime && (
                <div className="text-[8px] text-zinc-400 text-center truncate" title={`Backup: ${new Date(backupTime).toLocaleString('ro-RO')}`}>
                  💾 {new Date(backupTime).toLocaleTimeString('ro-RO', {hour:'2-digit',minute:'2-digit'})}
                </div>
              )}
            </div>
          )}
          <div className="flex items-center gap-1">
            <button onClick={() => setCollapsed(!collapsed)}
              className="flex-1 flex items-center justify-center h-8 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-sm">
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
            {!collapsed && (
              <>
                <button onClick={exportJSON} title="Export backup JSON"
                  className="flex items-center justify-center h-8 w-8 text-zinc-400 hover:text-green-600 hover:bg-green-50 rounded-sm">
                  <Download className="w-4 h-4" />
                </button>
                <button onClick={() => { if(window.confirm('Ștergi toate datele?')) resetStore(); }} title="Reset date"
                  className="flex items-center justify-center h-8 w-8 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-sm">
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
