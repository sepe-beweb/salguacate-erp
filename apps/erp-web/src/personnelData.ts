import { readList } from './apiResponse';
import { isCivilDate } from './financialValues';
import { isCivilTime } from './planningData';
import { readShifts, type PlannedShift } from './shiftData';

export interface StaffMember { id: number; nombre: string; rol: string; local: string | null; telefono: string | null; has_pin: number; }
export interface PersonnelRequest { id: number; usuario_id: number; tipo: string; fecha_inicio: string; fecha_fin: string | null; comentarios: string | null; estado: 'pendiente' | 'aprobado' | 'rechazado'; empleado_nombre: string; empleado_rol: string; empleado_local: string | null; creado_en: string; }
const validId = (id: number) => Number.isSafeInteger(id) && id > 0;
const textOrNull = (value: unknown) => typeof value === 'string' || value === null;

// The API writes creado_en using SQLite CURRENT_TIMESTAMP (UTC, space separator).
// Also accept explicit UTC ISO timestamps; do not guess offsets for arbitrary strings.
export function requestCreatedAt(value: string) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z?$/.test(value) ||
    !isCivilDate(value.slice(0, 10)) || !isCivilTime(value.slice(11, 16)) || Number(value.slice(17, 19)) > 59) throw new Error('Fecha de registro de petición inválida.');
  if (value[10] === 'T' && !value.endsWith('Z')) throw new Error('La fecha de registro no indica zona horaria.');
  const date = new Date(value.replace(' ', 'T').replace(/Z?$/, 'Z'));
  if (!Number.isFinite(date.getTime())) throw new Error('Fecha de registro inválida.');
  return date;
}
export async function readPersonnelRequests(responses: Response[]): Promise<PersonnelRequest[]> {
  const rows = await readList<PersonnelRequest>(responses[0]); const ids = new Set<number>();
  for (const row of rows) {
    if (!row || !validId(row.id) || ids.has(row.id) || !validId(row.usuario_id) ||
      !['vacaciones', 'cambio', 'baja', 'asuntos'].includes(row.tipo) || !['pendiente', 'aprobado', 'rechazado'].includes(row.estado) ||
      !isCivilDate(row.fecha_inicio) || (row.fecha_fin !== null && (!isCivilDate(row.fecha_fin) || row.fecha_fin < row.fecha_inicio)) ||
      !textOrNull(row.comentarios) || typeof row.empleado_nombre !== 'string' || typeof row.empleado_rol !== 'string' || !textOrNull(row.empleado_local)) throw new Error('La lista de peticiones contiene datos inválidos. No se muestran estados parciales.');
    requestCreatedAt(row.creado_en); ids.add(row.id);
  }
  return rows.slice().sort((a, b) => requestCreatedAt(b.creado_en).getTime() - requestCreatedAt(a.creado_en).getTime() || b.id - a.id);
}
export async function readStaff(responses: Response[]): Promise<StaffMember[]> {
  const rows = await readList<StaffMember>(responses[0]); const ids = new Set<number>();
  for (const row of rows) {
    if (!row || !validId(row.id) || ids.has(row.id) || typeof row.nombre !== 'string' || !['owner', 'manager', 'employee'].includes(row.rol) ||
      !textOrNull(row.local) || !textOrNull(row.telefono) || ![0, 1].includes(row.has_pin)) throw new Error('La plantilla contiene datos inválidos.');
    ids.add(row.id);
  }
  return rows;
}
export async function readPersonnelWorkspace(responses: Response[]): Promise<[StaffMember[], PlannedShift[], PersonnelRequest[]]> {
  return Promise.all([readStaff([responses[0]]), readShifts([responses[1]]), readPersonnelRequests([responses[2]])]);
}
