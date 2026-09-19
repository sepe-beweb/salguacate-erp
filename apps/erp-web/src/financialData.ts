import { readList } from './apiResponse';
import { readExpenses, type Expense } from './expenses';
import { formatCivilDate, isCivilDate, sumCents, toCents } from './financialValues';

export interface CashClosing { id: number; fecha: string; local: string; efectivo: number; tarjeta: number; invitaciones: number; descuadre: number; total: number; }
export type FinancialLists = [CashClosing[], Expense[]];
export function financialSummary(cierres: CashClosing[], gastos: Expense[]) {
  const sum = (field: 'total' | 'efectivo' | 'tarjeta' | 'invitaciones' | 'descuadre') => sumCents(cierres.map(row => toCents(row[field])));
  const income = sum('total'); const expenses = sumCents(gastos.map(row => toCents(row.total)));
  return { income, expenses, balance: sumCents([income, -expenses]), cash: sum('efectivo'), card: sum('tarjeta'), invitations: sum('invitaciones'), discrepancy: sum('descuadre'),
    inconsistent: cierres.some(row => toCents(row.total) !== sumCents([toCents(row.efectivo), toCents(row.tarjeta)])) };
}
export async function readFinancialLists(responses: Response[]): Promise<FinancialLists> {
  const [cierres, gastos] = await Promise.all([readCashClosings([responses[0]]), readExpenses([responses[1]])]);
  financialSummary(cierres, gastos);
  return [cierres, gastos];
}
export async function readCashClosings(responses: Response[]): Promise<CashClosing[]> {
  const cierres = await readList<CashClosing>(responses[0]);
  const ids = new Set<number>();
  for (const row of cierres) {
    if (!row || !Number.isSafeInteger(row.id) || row.id < 1 || ids.has(row.id) || !isCivilDate(row.fecha) || typeof row.local !== 'string') throw new Error('La lista de cierres contiene datos inválidos.');
    for (const field of ['total', 'efectivo', 'tarjeta', 'invitaciones', 'descuadre'] as const) {
      const cents = toCents(row[field]);
      if (field !== 'descuadre' && cents < 0) throw new Error('La lista de cierres contiene importes negativos no admitidos.');
    }
    sumCents([toCents(row.efectivo), toCents(row.tarjeta)]);
    ids.add(row.id);
  }
  // Guard the complete dataset before publishing it, including arbitrary local/month subsets.
  sumCents(cierres.map(row => Math.abs(toCents(row.descuadre))));
  financialSummary(cierres, []);
  return cierres;
}
export function closingHistory(cierres: CashClosing[], local = 'Todos') {
  return cierres.filter(row => local === 'Todos' || row.local === local).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id);
}
export function selectFinancialPeriod([cierres, gastos]: FinancialLists, local = 'Todos', month = ''): FinancialLists {
  const matches = (row: { local: string; fecha: string }) => (local === 'Todos' || row.local === local) && (!month || row.fecha.slice(0, 7) === month);
  const sort = (a: { fecha: string; id: number }, b: { fecha: string; id: number }) => a.fecha.localeCompare(b.fecha) || a.id - b.id;
  return [cierres.filter(matches).sort(sort), gastos.filter(matches).sort(sort)];
}
export function financialDays(cierres: CashClosing[], gastos: Expense[]) {
  const days = new Map<string, { name: string; date: string; Ingresos: number; Gastos: number; Saldo: number; Efectivo: number; Tarjeta: number; Descuadre: number }>();
  const day = (date: string) => {
    if (!days.has(date)) days.set(date, { date, name: formatCivilDate(date), Ingresos: 0, Gastos: 0, Saldo: 0, Efectivo: 0, Tarjeta: 0, Descuadre: 0 });
    return days.get(date)!;
  };
  for (const row of cierres) {
    const entry = day(row.fecha);
    for (const [key, field] of [['Ingresos', 'total'], ['Efectivo', 'efectivo'], ['Tarjeta', 'tarjeta'], ['Descuadre', 'descuadre']] as const) entry[key] = sumCents([entry[key], toCents(row[field])]);
  }
  for (const row of gastos) { const entry = day(row.fecha); entry.Gastos = sumCents([entry.Gastos, toCents(row.total)]); }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date)).map(row => ({ ...row, Saldo: sumCents([row.Ingresos, -row.Gastos]) }));
}
