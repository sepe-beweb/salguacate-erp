import { closingHistory, financialSummary, readFinancialLists, selectFinancialPeriod, type FinancialLists } from './financialData';
import { isCivilDate } from './financialValues';
import { readEvents, readTasks, type PlannedEvent, type PlannedTask } from './planningData';
import { readStock, readOrders, type StockItem, type StockOrder } from './stockData';
import { readStaff, type StaffMember } from './personnelData';
import { readPresence, type Presence } from './presenceData';
import { readShifts, type PlannedShift } from './shiftData';
import { matchesLocation } from './locations';

export type DashboardLists = [...FinancialLists, PlannedTask[], PlannedEvent[], StockItem[], StaffMember[], Presence[], PlannedShift[], StockOrder[]];

export async function readDashboardLists(responses: Response[]): Promise<DashboardLists> {
  const [financial, tasks, events, products, users, presence, shifts, orders] = await Promise.all([
    readFinancialLists(responses.slice(0, 2)), readTasks([responses[2]]), readEvents([responses[3]]),
    readStock(responses[4]), readStaff([responses[5]]), readPresence(responses[6]), readShifts([responses[7]]), readOrders(responses[8])
  ]);
  return [...financial, tasks, events, products, users, presence, shifts, orders];
}

export function selectDashboardLocation(lists: DashboardLists, selected: string): DashboardLists {
  const [closings, expenses, tasks, events, products, staff, presence, shifts, orders] = lists;
  return [closings.filter(row => matchesLocation(row.local, selected)), expenses.filter(row => matchesLocation(row.local, selected)),
    tasks.filter(row => matchesLocation(row.local, selected, true)), events,
    products.filter(row => matchesLocation(row.local, selected)), staff.filter(row => matchesLocation(row.local, selected, true)),
    presence.filter(row => matchesLocation(row.usuario_local, selected)), shifts.filter(row => matchesLocation(row.local, selected)),
    orders.filter(row => matchesLocation(row.local, selected))];
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
