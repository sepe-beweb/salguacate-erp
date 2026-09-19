import { readList } from './apiResponse';
import { isCivilDate } from './financialValues';
import { isCivilTime, readTasks, type PlannedTask } from './planningData';

export interface PlannedShift { id: number; usuario_id: number; fecha: string; hora_inicio: string; hora_fin: string; local: string | null; compañeros: string | null; }
export async function readShifts(responses: Response[]): Promise<PlannedShift[]> {
  const shifts = await readList<PlannedShift>(responses[0]);
  const ids = new Set<number>();
  for (const shift of shifts) {
    if (!shift || !Number.isSafeInteger(shift.id) || shift.id < 1 || ids.has(shift.id) ||
      !Number.isSafeInteger(shift.usuario_id) || shift.usuario_id < 1 || !isCivilDate(shift.fecha) ||
      !isCivilTime(shift.hora_inicio) || !isCivilTime(shift.hora_fin) ||
      (shift.local !== null && typeof shift.local !== 'string') || (shift.compañeros !== null && typeof shift.compañeros !== 'string')) throw new Error('El calendario contiene turnos inválidos. No se muestra un calendario parcial.');
    ids.add(shift.id);
  }
  // Keep every shift. A wall-clock end before start is valid; no duration is inferred here.
  return shifts.slice().sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora_inicio.localeCompare(b.hora_inicio) || a.id - b.id);
}
export async function readEmployeePlanning(responses: Response[]): Promise<[PlannedTask[], PlannedShift[]]> {
  return Promise.all([readTasks([responses[0]]), readShifts([responses[1]])]);
}
