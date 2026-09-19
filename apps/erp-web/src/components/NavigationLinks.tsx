import { Home, Package, Camera, Calendar, Clock, User, Mail, Truck, ClipboardList, CreditCard, Music, StickyNote, BarChart3, FileSpreadsheet, Settings, Sparkles, type LucideIcon } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Role } from '../context/AuthContext';

interface NavigationItem { path: string; label: string; icon: LucideIcon; }
interface NavigationGroup { label: string; items: NavigationItem[]; }
const personal: NavigationGroup[] = [{ label: 'Panel Personal', items: [
  { path: '/', label: 'Inicio', icon: Home },
  { path: '/calendario', label: 'Turnos Asignados', icon: Calendar },
  { path: '/fichaje', label: 'Control Horario', icon: Clock },
  { path: '/correos', label: 'Buzón Interno', icon: Mail },
  { path: '/peticiones', label: 'Solicitudes', icon: Sparkles },
] }];
const management: NavigationGroup[] = [
  { label: 'Operaciones', items: [
    { path: '/', label: 'Panel de Control', icon: Home },
    { path: '/inventario', label: 'Almacén y Stock', icon: Package },
    { path: '/control-stock', label: 'Pedidos de Reposición', icon: ClipboardList },
    { path: '/proveedores', label: 'Proveedores', icon: Truck },
    { path: '/escaner', label: 'Escáner de Facturas', icon: Camera },
  ] },
  { label: 'Gestión y Equipo', items: [
    { path: '/rrhh', label: 'Recursos Humanos', icon: User },
    { path: '/tareas', label: 'Lista de Checklists', icon: ClipboardList },
    { path: '/agenda', label: 'Agenda de Eventos', icon: Music },
    { path: '/correos', label: 'Buzón de Mensajes', icon: Mail },
    { path: '/notas', label: 'Muro de Notas', icon: StickyNote },
  ] },
  { label: 'Finanzas', items: [
    { path: '/ventas', label: 'Cierres de Caja', icon: CreditCard },
    { path: '/gastos', label: 'Gastos', icon: FileSpreadsheet },
    { path: '/analiticas', label: 'Analíticas Visuales', icon: BarChart3 },
    { path: '/informes', label: 'Informes Mensuales', icon: FileSpreadsheet },
  ] },
];
const preferences: NavigationGroup = { label: 'Cuenta', items: [{ path: '/ajustes', label: 'Ajustes', icon: Settings }] };

export default function NavigationLinks({ role, onNavigate, includeSettings = false }: { role: Role; onNavigate?: () => void; includeSettings?: boolean }) {
  const { pathname } = useLocation(); const navigate = useNavigate();
  const groups = role === 'employee' ? personal : role === 'owner' || role === 'manager' ? management : [];
  return <>{[...groups, ...(includeSettings && groups.length ? [preferences] : [])].map(group => <section key={group.label} className="space-y-1.5 mb-4">
    <h2 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-4 mb-2">{group.label}</h2>
    {group.items.map(({ path, label, icon: Icon }) => <button key={path} type="button" data-autofocus={pathname === path ? true : undefined} aria-current={pathname === path ? 'page' : undefined}
      onClick={() => { navigate(path); onNavigate?.(); }}
      className={`w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${pathname === path ? 'bg-gradient-to-r from-brand-600 to-brand-700 text-white shadow-md shadow-brand-600/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-950 dark:hover:text-white'}`}>
      <Icon size={18} className="shrink-0" aria-hidden="true" /> {label}
    </button>)}
  </section>)}</>;
}
