import { TrendingUp, Users, FileText, Calendar as CalendarIcon, StickyNote, FileBarChart, ClipboardList, ClipboardCheck, Package, ArrowUpRight, ArrowDownRight, AlertTriangle, Music } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';

interface KPIs {
  // Sales
  ventasMes: number;
  ventasMesAnterior: number;
  ultimoCierre: number;
  totalCierres: number;
  // Expenses
  gastosMes: number;
  // Tasks
  tareasPendientes: number;
  tareasHoy: number;
  // Events
  proximoEvento: { titulo: string; fecha: string; tipo: string } | null;
  // Stock
  productosStock: number;
  stockBajo: number;
  // Employees
  totalEmpleados: number;
}

const today = new Date().toISOString().split('T')[0];
const thisMonth = today.substring(0, 7); // 'YYYY-MM'
const lastMonth = (() => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
})();

export default function Dashboard() {
  const { user } = useAuth();
  const [kpis, setKpis] = useState<KPIs>({
    ventasMes: 0, ventasMesAnterior: 0, ultimoCierre: 0, totalCierres: 0,
    gastosMes: 0, tareasPendientes: 0, tareasHoy: 0,
    proximoEvento: null, productosStock: 0, stockBajo: 0, totalEmpleados: 0
  });
  const [, setLoading] = useState(true);
  const [presencia, setPresencia] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/cierres`).then(r => r.json()).catch(() => []),
      fetch(`${API_URL}/api/gastos`).then(r => r.json()).catch(() => []),
      fetch(`${API_URL}/api/tareas`).then(r => r.json()).catch(() => []),
      fetch(`${API_URL}/api/eventos`).then(r => r.json()).catch(() => []),
      fetch(`${API_URL}/api/inventario`).then(r => r.json()).catch(() => []),
      fetch(`${API_URL}/api/usuarios`).then(r => r.json()).catch(() => []),
      fetch(`${API_URL}/api/fichajes/presencia`).then(r => r.json()).catch(() => []),
    ]).then(([cierres, gastos, tareas, eventos, productos, usuarios, presenciaData]) => {
      setPresencia(presenciaData || []);

      const ventasMes = cierres.filter((c: any) => c.fecha?.startsWith(thisMonth)).reduce((s: number, c: any) => s + (c.total || 0), 0);
      const ventasMesAnterior = cierres.filter((c: any) => c.fecha?.startsWith(lastMonth)).reduce((s: number, c: any) => s + (c.total || 0), 0);
      const ultimoCierre = cierres.length > 0 ? cierres[0].total : 0;

      const gastosMes = gastos.filter((g: any) => g.fecha?.startsWith(thisMonth)).reduce((s: number, g: any) => s + (g.total || 0), 0);

      const tareasPendientes = tareas.filter((t: any) => !t.completada).length;
      const tareasHoy = tareas.filter((t: any) => !t.completada && t.fecha === today).length;

      const futureEvents = eventos.filter((e: any) => e.fecha >= today).sort((a: any, b: any) => a.fecha.localeCompare(b.fecha));
      const proximoEvento = futureEvents.length > 0 ? futureEvents[0] : null;

      const stockBajo = productos.filter((p: any) => p.stock_actual !== undefined && p.stock_minimo !== undefined && p.stock_actual <= p.stock_minimo).length;

      setKpis({
        ventasMes, ventasMesAnterior, ultimoCierre,
        totalCierres: cierres.filter((c: any) => c.fecha?.startsWith(thisMonth)).length,
        gastosMes, tareasPendientes, tareasHoy, proximoEvento,
        productosStock: productos.length, stockBajo,
        totalEmpleados: usuarios.length
      });
      setPresencia(presenciaData);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const beneficio = kpis.ventasMes - kpis.gastosMes;
  const tendencia = kpis.ventasMesAnterior > 0
    ? ((kpis.ventasMes - kpis.ventasMesAnterior) / kpis.ventasMesAnterior * 100)
    : 0;

  const monthName = new Date().toLocaleDateString('es-ES', { month: 'long' });

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Greeting */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Hola, {user?.name?.split(' ')[0] || 'Jefe'} 👋
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
          {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Revenue Hero Card */}
      <div className="bg-gradient-to-br from-brand-600 to-brand-700 dark:from-brand-700 dark:to-brand-900 rounded-2xl p-5 text-white shadow-lg shadow-brand-500/20">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-brand-100 text-xs font-medium uppercase tracking-wider">Ingresos — {monthName}</p>
            <p className="text-3xl font-bold mt-1">€{kpis.ventasMes.toFixed(2)}</p>
            {tendencia !== 0 && (
              <div className={`flex items-center gap-1 mt-1.5 text-xs font-semibold ${tendencia > 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                {tendencia > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {Math.abs(tendencia).toFixed(1)}% vs mes anterior
              </div>
            )}
          </div>
          <div className="text-right">
            <p className="text-brand-200 text-xs">Beneficio neto</p>
            <p className={`text-xl font-bold ${beneficio >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>€{beneficio.toFixed(2)}</p>
          </div>
        </div>
        <div className="flex gap-4 mt-4 pt-3 border-t border-white/20 text-xs">
          <div><span className="text-brand-200">Cierres:</span> <span className="font-bold">{kpis.totalCierres}</span></div>
          <div><span className="text-brand-200">Gastos:</span> <span className="font-bold text-red-300">€{kpis.gastosMes.toFixed(2)}</span></div>
          <div><span className="text-brand-200">Último:</span> <span className="font-bold">€{kpis.ultimoCierre.toFixed(2)}</span></div>
        </div>
      </div>

      {/* Quick Alerts */}
      {(kpis.tareasHoy > 0 || kpis.stockBajo > 0 || kpis.proximoEvento) && (
        <div className="space-y-2">
          {kpis.tareasHoy > 0 && (
            <Link to="/tareas" className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 transition-colors hover:bg-amber-100 dark:hover:bg-amber-900/30">
              <div className="bg-amber-500 text-white p-2 rounded-lg"><ClipboardList size={16} /></div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">{kpis.tareasHoy} tarea{kpis.tareasHoy > 1 ? 's' : ''} para hoy</p>
              </div>
              <ArrowUpRight size={16} className="text-amber-400" />
            </Link>
          )}
          {kpis.stockBajo > 0 && (
            <Link to="/inventario" className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 transition-colors hover:bg-red-100 dark:hover:bg-red-900/30">
              <div className="bg-red-500 text-white p-2 rounded-lg"><AlertTriangle size={16} /></div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-800 dark:text-red-300">{kpis.stockBajo} producto{kpis.stockBajo > 1 ? 's' : ''} con stock bajo</p>
              </div>
              <ArrowUpRight size={16} className="text-red-400" />
            </Link>
          )}
          {kpis.proximoEvento && (
            <Link to="/agenda" className="flex items-center gap-3 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-xl p-3 transition-colors hover:bg-violet-100 dark:hover:bg-violet-900/30">
              <div className="bg-violet-500 text-white p-2 rounded-lg"><Music size={16} /></div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-violet-800 dark:text-violet-300">{kpis.proximoEvento.titulo}</p>
                <p className="text-xs text-violet-600 dark:text-violet-400">{new Date(kpis.proximoEvento.fecha).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })} · {kpis.proximoEvento.tipo}</p>
              </div>
              <ArrowUpRight size={16} className="text-violet-400" />
            </Link>
          )}
        </div>
      )}

      {/* Quick Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        <Link to="/tareas" className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm text-center transition-colors hover:border-teal-500">
          <p className="text-2xl font-bold text-teal-600 dark:text-teal-400">{kpis.tareasPendientes}</p>
          <p className="text-xs text-slate-500 mt-0.5">Pendientes</p>
        </Link>
        <Link to="/rrhh" className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm text-center transition-colors hover:border-brand-500">
          <p className="text-2xl font-bold text-brand-600 dark:text-brand-400">{kpis.totalEmpleados}</p>
          <p className="text-xs text-slate-500 mt-0.5">Empleados</p>
        </Link>
        <Link to="/inventario" className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm text-center transition-colors hover:border-emerald-500">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{kpis.productosStock}</p>
          <p className="text-xs text-slate-500 mt-0.5">Productos</p>
        </Link>
      </div>

      {/* Navigation Grid */}
      <div>
        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Módulos</h3>
        <div className="grid grid-cols-4 gap-3">
          {[
            { to: '/ventas', icon: <FileText size={22} />, label: 'Cierres', color: 'text-brand-500' },
            { to: '/rrhh', icon: <Users size={22} />, label: 'RRHH', color: 'text-brand-500' },
            { to: '/agenda', icon: <CalendarIcon size={22} />, label: 'Agenda', color: 'text-brand-500' },
            { to: '/inventario', icon: <Package size={22} />, label: 'Stock', color: 'text-emerald-500' },
            { to: '/control-stock', icon: <ClipboardCheck size={22} />, label: 'Pedidos', color: 'text-orange-500' },
            { to: '/notas', icon: <StickyNote size={22} />, label: 'Notas', color: 'text-amber-500' },
            { to: '/informes', icon: <FileBarChart size={22} />, label: 'Informes', color: 'text-indigo-500' },
            { to: '/tareas', icon: <ClipboardList size={22} />, label: 'Tareas', color: 'text-teal-500' },
            { to: '/analiticas', icon: <TrendingUp size={22} />, label: 'Analytics', color: 'text-rose-500' },
          ].map(item => (
            <Link key={item.to} to={item.to} className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center text-center transition-all hover:shadow-md hover:scale-[1.02] active:scale-95">
              <span className={item.color}>{item.icon}</span>
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-1.5">{item.label}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Control de Presencia en Tiempo Real */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Presencia en Tiempo Real</h3>
        <div className="space-y-2">
          {presencia.length === 0 ? (
            <p className="text-xs text-slate-450 dark:text-slate-500 text-center py-2">No hay información de turnos disponible.</p>
          ) : (
            presencia.map((emp: any) => {
              const dateOpts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
              
              let statusText = 'Fuera';
              let statusColor = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
              let indicatorColor = 'bg-slate-400';
              let timeInfo = '';

              if (emp.estado_presencia === 'trabajando') {
                statusText = 'Trabajando';
                statusColor = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400';
                indicatorColor = 'bg-emerald-500 animate-pulse';
                timeInfo = emp.ultimo_fichaje_entrada ? `Entrada: ${new Date(emp.ultimo_fichaje_entrada).toLocaleTimeString('es-ES', dateOpts)}` : '';
              } else if (emp.estado_presencia === 'descanso') {
                statusText = 'Descanso';
                statusColor = 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400';
                indicatorColor = 'bg-amber-500 animate-pulse';
                timeInfo = 'En pausa';
              } else if (emp.ultimo_fichaje_salida) {
                timeInfo = `Salida: ${new Date(emp.ultimo_fichaje_salida).toLocaleTimeString('es-ES', dateOpts)}`;
              }

              return (
                <div key={emp.usuario_id} className="flex justify-between items-center p-2.5 bg-slate-50 dark:bg-slate-850/50 rounded-lg border border-slate-100 dark:border-slate-800/40">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${indicatorColor}`}></span>
                    <div>
                      <p className="font-semibold text-sm text-slate-900 dark:text-white">{emp.usuario_nombre}</p>
                      <p className="text-[10px] text-slate-400">{emp.usuario_local || 'Principal'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor}`}>
                      {statusText}
                    </span>
                    {timeInfo && <p className="text-[10px] text-slate-550 dark:text-slate-400 mt-1 font-medium">{timeInfo}</p>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Locales */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Locales</h3>
        <div className="space-y-2.5">
          <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700/50">
            <span className="text-slate-700 dark:text-slate-200 font-medium">Local Principal</span>
            <span className="text-brand-700 dark:text-brand-400 text-xs font-semibold bg-brand-100 dark:bg-brand-400/10 px-2.5 py-1 rounded-full">Abierto</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700/50">
            <span className="text-slate-700 dark:text-slate-200 font-medium">Nuevo Local (Junio)</span>
            <span className="text-slate-500 dark:text-slate-400 text-xs font-semibold bg-slate-200 dark:bg-slate-700/50 px-2.5 py-1 rounded-full">Preparación</span>
          </div>
        </div>
      </div>
    </div>
  );
}
