import { readList } from './apiResponse';
import { formatCivilDate, isCivilDate } from './financialValues';
import { localDate } from './localDate';

export interface PlannedEvent { id: number; titulo: string; fecha: string; hora: string; descripcion: string | null; tipo: string; }
export interface PlannedTask { id: number; titulo: string; descripcion: string | null; asignado_a: number | null; asignado_nombre: string | null; fecha: string; prioridad: string; completada: boolean; local: string | null; }
interface Employee { id: number; nombre: string; rol: string; }
const id = (value: number) => Number.isSafeInteger(value) && value > 0;
const nullableText = (value: unknown) => value === null || typeof value === 'string';
export const isCivilTime = (value: unknown): value is string => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
export { formatCivilDate };

export async function readEvents(responses: Response[]): Promise<PlannedEvent[]> {
  const events = await readList<PlannedEvent>(responses[0]);
  const ids = new Set<number>();
  for (const event of events) {
    if (!event || !id(event.id) || ids.has(event.id) || !isCivilDate(event.fecha) || !isCivilTime(event.hora) ||
      typeof event.titulo !== 'string' || !nullableText(event.descripcion) || typeof event.tipo !== 'string') throw new Error('La agenda contiene datos inválidos. No se muestra una agenda parcial.');
    ids.add(event.id);
  }
  return events.slice().sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora) || a.id - b.id);
}
export async function readTasks(responses: Response[]): Promise<PlannedTask[]> {
  const tasks = await readList<PlannedTask>(responses[0]);
  const ids = new Set<number>();
  for (const task of tasks) {
    if (!task || !id(task.id) || ids.has(task.id) || !isCivilDate(task.fecha) || typeof task.titulo !== 'string' ||
      !nullableText(task.descripcion) || !nullableText(task.asignado_nombre) || !nullableText(task.local) ||
      (task.asignado_a !== null && !id(task.asignado_a)) || !['baja', 'normal', 'alta'].includes(task.prioridad) ||
      ![true, false, 0, 1].includes(task.completada)) throw new Error('La lista de tareas contiene datos inválidos. No se muestran contadores parciales.');
    ids.add(task.id);
  }
  return tasks.map(task => ({ ...task, completada: Boolean(task.completada) })).sort((a, b) => b.fecha.localeCompare(a.fecha) || Number(a.completada) - Number(b.completada) || b.id - a.id);
}
export async function readTaskWorkspace(responses: Response[]): Promise<[PlannedTask[], Employee[]]> {
  const [tasks, employees] = await Promise.all([readTasks([responses[0]]), readList<Employee>(responses[1])]);
  const ids = new Set<number>();
  for (const employee of employees) {
    if (!employee || !id(employee.id) || ids.has(employee.id) || typeof employee.nombre !== 'string' || typeof employee.rol !== 'string') throw new Error('La lista de personas contiene datos inválidos.');
    ids.add(employee.id);
  }
  return [tasks, employees];
}
// Event times have no stored zone or offset: compare wall-clock values, never invent an instant.
export function eventHasPassed(event: Pick<PlannedEvent, 'fecha' | 'hora'>, now = new Date()) {
  if (!isCivilDate(event.fecha) || !isCivilTime(event.hora)) throw new Error('Fecha u hora de evento inválida.');
  const time = [now.getHours(), now.getMinutes(), now.getSeconds()].map(value => String(value).padStart(2, '0')).join(':');
  return `${event.fecha}T${event.hora}:00` < `${localDate(now)}T${time}`;
}
export const emptyTask = () => ({ titulo: '', descripcion: '', asignado_a: '', fecha: localDate(), prioridad: 'normal', local: '' });
