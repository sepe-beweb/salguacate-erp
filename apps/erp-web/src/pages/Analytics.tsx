import { locationLabel } from '../locations';
import { useLocalScope } from '../hooks/useLocalScope';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import { BarChart3, TrendingUp, AlertCircle, MapPin } from 'lucide-react';
import { useApiRead } from '../hooks/useApiLists';
import RequestError from '../components/RequestError';

import { financialSummary, readFinancialLists, selectFinancialPeriod, financialDays } from '../financialData';
import { formatEuroCents } from '../financialValues';

export default function Analytics() {
  const { data: lists, loading, error, reload } = useApiRead(['/api/cierres', '/api/gastos'], readFinancialLists);
  const [filterLocal, setFilterLocal] = useLocalScope();
  if (loading) return <p role="status" className="p-8 text-center text-slate-500">Cargando analíticas...</p>;
  if (error || !lists) return <RequestError message={error || 'No se pudieron cargar las analíticas.'} onRetry={reload} />;
  const [filteredData, filteredGastosForLocal] = selectFinancialPeriod(lists, filterLocal);
  if (lists[0].length === 0 && lists[1].length === 0) return <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500">
    <BarChart3 size={48} className="mb-4" /><p>No hay datos suficientes para generar gráficos.</p><p className="text-sm">Registra cierres o gastos primero.</p>
  </div>;
  const { income: totalIngresos, expenses: totalGastos, balance: beneficioNeto, cash: totalEfectivo, card: totalTarjeta, discrepancy: totalDescuadre, inconsistent } = financialSummary(filteredData, filteredGastosForLocal);
  const chartData = financialDays(filteredData, filteredGastosForLocal);
  const pieData = [{ name: 'Efectivo', value: totalEfectivo }, { name: 'Tarjeta', value: totalTarjeta }];
  const COLORS = ['#10b981', '#3b82f6'];
  const tooltipMoney = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) ? formatEuroCents(value) : '—';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-brand-100 dark:bg-brand-900/30 p-2 rounded-xl text-brand-600 dark:text-brand-400">
            <TrendingUp size={24} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Evolución económica</h2>
        </div>
      </div>

      {/* Filtro por Local */}
      <div className="flex gap-2">
        {['Todos', 'Principal', 'Segundo Local'].map(l => (
          <button key={l} aria-pressed={filterLocal === l} onClick={() => setFilterLocal(l)}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${filterLocal === l ? 'bg-brand-600 text-white shadow-md' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'}`}
          >
            <MapPin size={12} />{locationLabel(l)}
          </button>
        ))}
      </div>

      {inconsistent && <p role="status" className="rounded-lg border border-amber-300 p-3">Hay cierres cuyo total no coincide con efectivo más tarjeta. Se conserva el total registrado; revisa su origen.</p>}
      {chartData.length === 0 && <p role="status">No hay movimientos para el local seleccionado.</p>}
      {/* Tarjetas de Resumen Rápido */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-sm text-slate-500 dark:text-slate-400">Ingresos Brutos</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 flex items-center">
            {formatEuroCents(totalIngresos)}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-sm text-slate-500 dark:text-slate-400">Gastos Detectados</p>
          <p className="text-2xl font-bold text-red-500 dark:text-red-400 mt-1 flex items-center">
            {formatEuroCents(totalGastos)}
          </p>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800/50 shadow-sm">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Saldo ingresos − gastos</p>
          <p className={`text-2xl font-black mt-1 flex items-center ${beneficioNeto >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {formatEuroCents(beneficioNeto)}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-sm text-slate-500 dark:text-slate-400">Descuadre Total</p>
          <p className={`text-2xl font-bold mt-1 flex items-center ${totalDescuadre < 0 ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>
            <AlertCircle size={20} className="mr-2" />
            {totalDescuadre > 0 ? '+' : ''}{formatEuroCents(totalDescuadre)}
          </p>
        </div>
      </div>

      {/* Gráfico de Evolución */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Evolución de Ingresos</h3>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis width={85} allowDecimals={false} tickFormatter={value => tooltipMoney(value)} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={tooltipMoney}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                itemStyle={{ fontWeight: 'bold' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Line isAnimationActive={false} type="monotone" dataKey="Ingresos" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
              <Line isAnimationActive={false} type="monotone" dataKey="Gastos" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
              <Line isAnimationActive={false} type="monotone" dataKey="Saldo" name="Saldo ingresos − gastos" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Gráfico Circular de Métodos de Pago */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Métodos de Pago</h3>
          <div className="h-[200px] w-full flex justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  isAnimationActive={false}
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={tooltipMoney} />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico de Barras de Descuadre */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Descuadres de Caja</h3>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis width={85} allowDecimals={false} tickFormatter={value => tooltipMoney(value)} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={tooltipMoney} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                <Bar isAnimationActive={false} dataKey="Descuadre">
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.Descuadre < 0 ? '#ef4444' : '#10b981'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
