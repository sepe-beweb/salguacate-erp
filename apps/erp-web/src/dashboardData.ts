import { readList } from './apiResponse';
import { closingHistory, financialSummary, readFinancialLists, selectFinancialPeriod, type FinancialLists } from './financialData';
import { isCivilDate } from './financialValues';

interface Task { completada: boolean | number; fecha: string; }
interface Event { titulo: string; fecha: string; tipo: string; }
interface Product { stock_actual?: number; stock_minimo?: number; }
interface Presence { usuario_id: number; usuario_nombre: string; usuario_local: string; estado_presencia: string; ultimo_fichaje_entrada?: string; ultimo_fichaje_salida?: string; }
type DashboardLists = [...FinancialLists, Task[], Event[], Product[], unknown[], Presence[]];

export async function readDashboardLists(responses: Response[]): Promise<DashboardLists> {
  const [financial, tasks, events, products, users, presence] = await Promise.all([
    readFinancialLists(responses.slice(0, 2)), readList<Task>(responses[2]), readList<Event>(responses[3]),
    readList<Product>(responses[4]), readList(responses[5]), readList<Presence>(responses[6])
  ]);
  if (events.some(event => !event || !isCivilDate(event.fecha))) throw new Error('La agenda contiene fechas inválidas. No se pudo cargar el resumen.');
  return [...financial, tasks, events, products, users, presence];
}

export function dashboardFinancialSummary(lists: FinancialLists, today: string) {
  if (!isCivilDate(today)) throw new Error('Fecha del resumen inválida.');
  const month = today.slice(0, 7);
  const [year, number] = month.split('-').map(Number);
  const previousMonth = `${String(number === 1 ? year - 1 : year).padStart(4, '0')}-${String(number === 1 ? 12 : number - 1).padStart(2, '0')}`;
  const selected = selectFinancialPeriod(lists, 'Todos', month);
  const summary = financialSummary(...selected);
  return { ...summary, previousIncome: financialSummary(...selectFinancialPeriod(lists, 'Todos', previousMonth)).income,
    closingCount: selected[0].length, latest: closingHistory(lists[0])[0] ?? null,
    inconsistentHistory: financialSummary(...lists).inconsistent };
}
