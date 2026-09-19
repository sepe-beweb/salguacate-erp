import { closingHistory, financialSummary, readFinancialLists, selectFinancialPeriod, type FinancialLists } from './financialData';
import { isCivilDate } from './financialValues';
import { readEvents, readTasks, type PlannedEvent, type PlannedTask } from './planningData';
import { readStock, type StockItem } from './stockData';
import { readStaff, type StaffMember } from './personnelData';
import { readPresence, type Presence } from './presenceData';

type DashboardLists = [...FinancialLists, PlannedTask[], PlannedEvent[], StockItem[], StaffMember[], Presence[]];

export async function readDashboardLists(responses: Response[]): Promise<DashboardLists> {
  const [financial, tasks, events, products, users, presence] = await Promise.all([
    readFinancialLists(responses.slice(0, 2)), readTasks([responses[2]]), readEvents([responses[3]]),
    readStock(responses[4]), readStaff([responses[5]]), readPresence(responses[6])
  ]);
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
