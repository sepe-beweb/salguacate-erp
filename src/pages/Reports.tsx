import { useState, useEffect } from 'react';
import { FileBarChart, Download, Loader2, CalendarDays, TrendingUp, TrendingDown, Wallet, MapPin } from 'lucide-react';
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

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function Reports() {
  const [cierres, setCierres] = useState<Cierre[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedLocal, setSelectedLocal] = useState('Todos');

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/cierres`).then(r => r.json()),
      fetch(`${API_URL}/api/gastos`).then(r => r.json()),
    ])
    .then(([c, g]) => { setCierres(c); setGastos(g); setLoading(false); })
    .catch(() => setLoading(false));
  }, []);

  // Filter by selected month and local
  const monthStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
  const filteredCierres = cierres.filter(c => c.fecha.startsWith(monthStr) && (selectedLocal === 'Todos' || c.local === selectedLocal));
  const filteredGastos = gastos.filter(g => g.fecha.startsWith(monthStr));

  // Aggregations
  const totalIngresos = filteredCierres.reduce((sum, c) => sum + c.total, 0);
  const totalEfectivo = filteredCierres.reduce((sum, c) => sum + c.efectivo, 0);
  const totalTarjeta = filteredCierres.reduce((sum, c) => sum + c.tarjeta, 0);
  const totalInvitaciones = filteredCierres.reduce((sum, c) => sum + c.invitaciones, 0);
  const totalDescuadre = filteredCierres.reduce((sum, c) => sum + c.descuadre, 0);
  const totalGastos = filteredGastos.reduce((sum, g) => sum + g.total, 0);
  const beneficioNeto = totalIngresos - totalGastos;

  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const cierresRows = filteredCierres.map(c => `
      <tr>
        <td>${new Date(c.fecha).toLocaleDateString('es-ES')}</td>
        <td>${c.local}</td>
        <td class="num">€${c.efectivo.toFixed(2)}</td>
        <td class="num">€${c.tarjeta.toFixed(2)}</td>
        <td class="num">€${c.invitaciones.toFixed(2)}</td>
        <td class="num ${c.descuadre !== 0 ? 'warn' : ''}">€${c.descuadre.toFixed(2)}</td>
        <td class="num bold">€${c.total.toFixed(2)}</td>
      </tr>
    `).join('');

    const gastosRows = filteredGastos.map(g => `
      <tr>
        <td>${new Date(g.fecha).toLocaleDateString('es-ES')}</td>
        <td>${g.proveedor_nombre}</td>
        <td>${g.concepto || '-'}</td>
        <td class="num bold">€${g.total.toFixed(2)}</td>
      </tr>
    `).join('');

    printWindow.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Informe ${MONTHS[selectedMonth]} ${selectedYear} - Salguacate</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #1e293b; padding: 32px; max-width: 900px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #16a34a; padding-bottom: 16px; margin-bottom: 24px; }
    .header h1 { font-size: 28px; color: #16a34a; }
    .header .subtitle { color: #64748b; font-size: 14px; margin-top: 4px; }
    .header .date-info { text-align: right; color: #64748b; font-size: 13px; }
    .section { margin-bottom: 28px; }
    .section h2 { font-size: 16px; color: #16a34a; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .summary-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; text-align: center; }
    .summary-card .label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
    .summary-card .value { font-size: 22px; font-weight: 700; margin-top: 4px; }
    .summary-card .positive { color: #16a34a; }
    .summary-card .negative { color: #dc2626; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #f1f5f9; color: #475569; font-weight: 600; text-align: left; padding: 8px 10px; border-bottom: 2px solid #e2e8f0; }
    td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; }
    tr:hover { background: #f8fafc; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .bold { font-weight: 700; }
    .warn { color: #dc2626; }
    .totals-row { background: #f0fdf4 !important; font-weight: 700; border-top: 2px solid #16a34a; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
    @media print { body { padding: 16px; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Salguacate</h1>
      <div class="subtitle">Informe Mensual de Gestión</div>
    </div>
    <div class="date-info">
      <strong>${MONTHS[selectedMonth]} ${selectedYear}</strong><br>
      Generado: ${new Date().toLocaleDateString('es-ES')} ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
    </div>
  </div>

  <div class="summary-grid">
    <div class="summary-card">
      <div class="label">Ingresos Totales</div>
      <div class="value positive">€${totalIngresos.toFixed(2)}</div>
    </div>
    <div class="summary-card">
      <div class="label">Gastos Totales</div>
      <div class="value negative">€${totalGastos.toFixed(2)}</div>
    </div>
    <div class="summary-card">
      <div class="label">Beneficio Neto</div>
      <div class="value ${beneficioNeto >= 0 ? 'positive' : 'negative'}">€${beneficioNeto.toFixed(2)}</div>
    </div>
    <div class="summary-card">
      <div class="label">Nº Cierres</div>
      <div class="value">${filteredCierres.length}</div>
    </div>
  </div>

  <div class="section">
    <h2>Detalle de Cierres de Caja</h2>
    ${filteredCierres.length === 0 ? '<p style="color:#94a3b8;padding:12px;">Sin cierres registrados este mes.</p>' : `
    <table>
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Local</th>
          <th style="text-align:right">Efectivo</th>
          <th style="text-align:right">Tarjeta</th>
          <th style="text-align:right">Invitaciones</th>
          <th style="text-align:right">Descuadre</th>
          <th style="text-align:right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${cierresRows}
        <tr class="totals-row">
          <td colspan="2">TOTALES</td>
          <td class="num">€${totalEfectivo.toFixed(2)}</td>
          <td class="num">€${totalTarjeta.toFixed(2)}</td>
          <td class="num">€${totalInvitaciones.toFixed(2)}</td>
          <td class="num">€${totalDescuadre.toFixed(2)}</td>
          <td class="num">€${totalIngresos.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>`}
  </div>

  <div class="section">
    <h2>Detalle de Gastos / Albaranes</h2>
    ${filteredGastos.length === 0 ? '<p style="color:#94a3b8;padding:12px;">Sin gastos registrados este mes.</p>' : `
    <table>
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Proveedor</th>
          <th>Concepto</th>
          <th style="text-align:right">Importe</th>
        </tr>
      </thead>
      <tbody>
        ${gastosRows}
        <tr class="totals-row">
          <td colspan="3">TOTAL GASTOS</td>
          <td class="num">€${totalGastos.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>`}
  </div>

  <div class="section">
    <h2>Resumen por Método de Pago</h2>
    <table>
      <thead>
        <tr><th>Método</th><th style="text-align:right">Total</th><th style="text-align:right">% del Total</th></tr>
      </thead>
      <tbody>
        <tr><td>💵 Efectivo</td><td class="num">€${totalEfectivo.toFixed(2)}</td><td class="num">${totalIngresos ? ((totalEfectivo/totalIngresos)*100).toFixed(1) : 0}%</td></tr>
        <tr><td>💳 Tarjeta</td><td class="num">€${totalTarjeta.toFixed(2)}</td><td class="num">${totalIngresos ? ((totalTarjeta/totalIngresos)*100).toFixed(1) : 0}%</td></tr>
        <tr><td>🎁 Invitaciones</td><td class="num">€${totalInvitaciones.toFixed(2)}</td><td class="num">${totalIngresos ? ((totalInvitaciones/totalIngresos)*100).toFixed(1) : 0}%</td></tr>
      </tbody>
    </table>
  </div>

  <div class="footer">
    Informe generado automáticamente por Salguacate ERP · ${new Date().getFullYear()}
  </div>

  <script>window.onload = () => window.print();</script>
</body>
</html>`);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <FileBarChart className="text-brand-500" />
          Informes
        </h2>
      </div>

      {/* Selector de mes */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
          <CalendarDays size={16} />
          Periodo del informe
        </label>
        <div className="flex gap-3">
          <select 
            value={selectedMonth} 
            onChange={e => setSelectedMonth(parseInt(e.target.value))}
            className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
          >
            {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select 
            value={selectedYear} 
            onChange={e => setSelectedYear(parseInt(e.target.value))}
            className="w-28 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
          >
            {[2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="mt-3">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
            <MapPin size={16} />
            Local
          </label>
          <div className="flex gap-2">
            {['Todos', 'Principal', 'Segundo Local'].map(l => (
              <button key={l} onClick={() => setSelectedLocal(l)} className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${selectedLocal === l ? 'bg-brand-600 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'}`}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-brand-500">
          <Loader2 className="animate-spin" size={32} />
        </div>
      ) : (
        <>
          {/* Resumen Visual */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={16} className="text-emerald-500" />
                <span className="text-xs text-slate-500 font-medium">Ingresos</span>
              </div>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">€{totalIngresos.toFixed(2)}</p>
              <p className="text-xs text-slate-400 mt-1">{filteredCierres.length} cierres</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown size={16} className="text-red-500" />
                <span className="text-xs text-slate-500 font-medium">Gastos</span>
              </div>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">€{totalGastos.toFixed(2)}</p>
              <p className="text-xs text-slate-400 mt-1">{filteredGastos.length} facturas</p>
            </div>
            <div className="col-span-2 bg-gradient-to-r from-brand-50 to-emerald-50 dark:from-brand-900/20 dark:to-emerald-900/20 p-4 rounded-2xl border border-brand-200 dark:border-brand-800 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Wallet size={16} className="text-brand-600" />
                <span className="text-xs text-slate-500 font-medium">Beneficio Neto</span>
              </div>
              <p className={`text-3xl font-bold ${beneficioNeto >= 0 ? 'text-brand-600 dark:text-brand-400' : 'text-red-600 dark:text-red-400'}`}>
                €{beneficioNeto.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Desglose métodos de pago */}
          {totalIngresos > 0 && (
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Métodos de Pago</h3>
              <div className="space-y-2.5">
                {[
                  { label: 'Efectivo', value: totalEfectivo, color: 'bg-emerald-500' },
                  { label: 'Tarjeta', value: totalTarjeta, color: 'bg-blue-500' },
                  { label: 'Invitaciones', value: totalInvitaciones, color: 'bg-amber-500' },
                ].map(m => (
                  <div key={m.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600 dark:text-slate-400">{m.label}</span>
                      <span className="font-medium text-slate-900 dark:text-white">€{m.value.toFixed(2)} ({totalIngresos ? ((m.value/totalIngresos)*100).toFixed(0) : 0}%)</span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full ${m.color} rounded-full transition-all duration-500`} style={{ width: `${totalIngresos ? (m.value/totalIngresos)*100 : 0}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Botón exportar */}
          <button
            onClick={handleExportPDF}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors shadow-md"
          >
            <Download size={20} />
            Exportar Informe PDF — {MONTHS[selectedMonth]} {selectedYear}
          </button>
        </>
      )}
    </div>
  );
}
