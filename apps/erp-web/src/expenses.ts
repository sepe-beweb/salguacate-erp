import { readList } from './apiResponse';
import { localDate } from './localDate';

export interface ExpenseDraft { fecha: string; local: string; proveedor_nombre: string; total: string; concepto: string; }
export interface Expense { id: number; fecha: string; local: string; proveedor_nombre: string; total: number; concepto: string; }
export const emptyExpense = (): ExpenseDraft => ({ fecha: localDate(), local: 'Principal', proveedor_nombre: '', total: '', concepto: '' });
export const expenseDate = (date: string) => date.split('-').reverse().join('/');
export const formatExpenseCents = (cents: number) => (cents / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
export const expenseCents = (total: number) => Math.round(total * 100);
const civilDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;

export async function readExpenses(responses: Response[]): Promise<Expense[]> {
  const rows = await readList<Expense>(responses[0]);
  const ids = new Set<number>();
  for (const row of rows) {
    if (!row || !Number.isSafeInteger(row.id) || row.id < 1 || ids.has(row.id) || !civilDate(row.fecha) ||
      typeof row.local !== 'string' || typeof row.proveedor_nombre !== 'string' || typeof row.concepto !== 'string' ||
      typeof row.total !== 'number' || row.total < 0 || !Number.isSafeInteger(expenseCents(row.total)) || Math.abs(expenseCents(row.total) / 100 - row.total) > 0.00000001) {
      throw new Error('La lista de gastos contiene datos inválidos. No se muestran importes parciales.');
    }
    ids.add(row.id);
  }
  return rows;
}
