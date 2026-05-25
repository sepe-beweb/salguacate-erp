import { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import { BarChart3, TrendingUp, AlertCircle, Euro, MapPin } from 'lucide-react';
import { API_URL } from '../config';

interface Cierre {
  id: number;
  fecha: string;
  local: string;
  efectivo: number;
  tarjeta: number;
  invitaciones: number;
  descuadre: number;
  total: number;
}

interface Gasto {
  id: number;
  fecha: string;
  proveedor_nombre: string;
  total: number;
  concepto: string;
}

export default function Analytics() {
  const [data, setData] = useState<Cierre[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLocal, setFilterLocal] = useState('Todos');

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/cierres`).then(res => res.json()),
      fetch(`${API_URL}/api/gastos`).then(res => res.json())
    ])
      .then(([resCierres, resGastos]) => {
        const sortedData = resCierres.sort((a: Cierre, b: Cierre) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
        setData(sortedData);
        setGastos(resGastos);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error cargando analíticas", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Cargando analíticas...</div>;
  }

  const filteredData = filterLocal === 'Todos' ? data : data.filter(c => c.local === filterLocal);

  if (filteredData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500">
        <BarChart3 size={48} className="mb-4 text-slate-300 dark:text-slate-700" />
        <p>No hay datos suficientes para generar gráficos.</p>
        <p className="text-sm">Registra algunos cierres de caja primero.</p>
      </div>
    );
  }

  // Preprocesar datos para gráficos
  const chartData = filteredData.map(item => {
    // Buscar gastos de este mismo día
    const dateStr = item.fecha.split('T')[0];
    const gastosDia = gastos
      .filter(g => g.fecha.startsWith(dateStr))
      .reduce((sum, g) => sum + g.total, 0);

    return {
      name: new Date(item.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
      Ingresos: item.total,
      Gastos: gastosDia,
      Beneficio: item.total - gastosDia,
      Efectivo: item.efectivo,
      Tarjeta: item.tarjeta,
      Descuadre: item.descuadre
    };
  });

  // Calcular métricas
  const totalEfectivo = filteredData.reduce((acc, curr) => acc + curr.efectivo, 0);
  const totalTarjeta = filteredData.reduce((acc, curr) => acc + curr.tarjeta, 0);
  const pieData = [
    { name: 'Efectivo', value: totalEfectivo },
    { name: 'Tarjeta', value: totalTarjeta }
  ];
  const COLORS = ['#10b981', '#3b82f6']; // Emerald, Blue

  // Calcular métricas
  const totalIngresos = totalEfectivo + totalTarjeta;
  const totalGastos = gastos.reduce((acc, curr) => acc + curr.total, 0);
  const beneficioNeto = totalIngresos - totalGastos;
  const totalDescuadre = filteredData.reduce((acc, curr) => acc + curr.descuadre, 0);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-brand-100 dark:bg-brand-900/30 p-2 rounded-xl text-brand-600 dark:text-brand-400">
            <TrendingUp size={24} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Analíticas Financieras</h2>
        </div>
      </div>

      {/* Filtro por Local */}
      <div className="flex gap-2">
        {['Todos', 'Principal', 'Segundo Local'].map(l => (
          <button key={l} onClick={() => setFilterLocal(l)}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${filterLocal === l ? 'bg-brand-600 text-white shadow-md' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'}`}
          >
            <MapPin size={12} />{l}
          </button>
        ))}
      </div>

      {/* Tarjetas de Resumen Rápido */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-sm text-slate-500 dark:text-slate-400">Ingresos Brutos</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 flex items-center">
            <Euro size={20} className="mr-1 text-slate-400" />
            {totalIngresos.toLocaleString('es-ES', { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-sm text-slate-500 dark:text-slate-400">Gastos Detectados</p>
          <p className="text-2xl font-bold text-red-500 dark:text-red-400 mt-1 flex items-center">
            <Euro size={20} className="mr-1" />
            {totalGastos.toLocaleString('es-ES', { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800/50 shadow-sm">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Beneficio Neto</p>
          <p className={`text-2xl font-black mt-1 flex items-center ${beneficioNeto >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            <Euro size={20} className="mr-1" />
            {beneficioNeto.toLocaleString('es-ES', { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-sm text-slate-500 dark:text-slate-400">Descuadre Total</p>
          <p className={`text-2xl font-bold mt-1 flex items-center ${totalDescuadre < 0 ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>
            <AlertCircle size={20} className="mr-2" />
            {totalDescuadre > 0 ? '+' : ''}{totalDescuadre.toFixed(2)}€
          </p>
        </div>
      </div>

      {/* Gráfico de Evolución */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Evolución de Ingresos</h3>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                itemStyle={{ fontWeight: 'bold' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Line type="monotone" dataKey="Ingresos" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="Gastos" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Beneficio" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 5" dot={false} />
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
                <Tooltip formatter={(value) => `${value}€`} />
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
              <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                <Bar dataKey="Descuadre">
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
