import { readList } from './apiResponse';
import { localDate } from './localDate';
import { isCivilDate, toCents } from './financialValues';
export { formatCivilDate as expenseDate, formatEuroCents as formatExpenseCents, toCents as expenseCents } from './financialValues';

export interface ExpenseDraft { fecha: string; local: string; proveedor_nombre: string; total: string; concepto: string; }
export interface Expense { id: number; fecha: string; local: string; proveedor_nombre: string; total: number; concepto: string; }
export const emptyExpense = (): ExpenseDraft => ({ fecha: localDate(), local: 'Principal', proveedor_nombre: '', total: '', concepto: '' });

export async function readExpenses(responses: Response[]): Promise<Expense[]> {
  const rows = await readList<Expense>(responses[0]);
  const ids = new Set<number>();
  for (const row of rows) {
    if (!row || !Number.isSafeInteger(row.id) || row.id < 1 || ids.has(row.id) || !isCivilDate(row.fecha) ||
      typeof row.local !== 'string' || typeof row.proveedor_nombre !== 'string' || typeof row.concepto !== 'string' ||
      typeof row.total !== 'number' || row.total < 0) {
      throw new Error('La lista de gastos contiene datos inválidos. No se muestran importes parciales.');
    }
    try { toCents(row.total); } catch { throw new Error('La lista de gastos contiene datos inválidos. No se muestran importes parciales.'); }
    ids.add(row.id);
  }
  return rows;
}
