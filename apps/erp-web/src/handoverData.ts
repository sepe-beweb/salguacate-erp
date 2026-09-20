import { readJson } from './apiResponse';
import { isCivilDate } from './financialValues';
import { LOCATIONS } from './locations';
import { storedUtcTimestamp } from './storedTimestamp';

export interface Routine { id: number; local: string; titulo: string; fase: 'apertura' | 'cierre'; frecuencia: 'diaria' | 'laborables' | 'fin_semana'; pasos: string[]; activa: number; autor_id: number; creado_en: string; }
export interface RoutineTask { id: number; titulo: string; local: string; fecha: string; rutina_ejecucion_id: number; rutina_titulo: string; fase: string; completada: number; completado_por: number | null; completado_nombre: string | null; completado_en: string | null; }
export interface Handover { id: number; local: string; fecha: string; contenido: string; autor_id: number; autor_nombre: string; creado_en: string; resuelto_por: number | null; resuelto_nombre: string | null; resuelto_en: string | null; lecturas: { relevo_id: number; usuario_id: number; usuario_nombre: string; leido_en: string }[]; }
export interface Workday { local: string; fecha: string; rutinas: Routine[]; tareas: RoutineTask[]; ejecuciones: { id: number; rutina_id: number; fecha: string; preparado_por: number; creado_en: string }[]; relevos: Handover[]; }
const id = (v: number) => Number.isSafeInteger(v) && v > 0;
const text = (v: unknown): v is string => typeof v === 'string' && Boolean(v.trim());
const flag = (v: unknown) => v === 0 || v === 1;
function valid(condition: unknown): asserts condition { if (!condition) throw new Error('El relevo contiene datos inválidos. No se muestran listas ni contadores parciales.'); }
function unique(rows: { id: number }[]) { valid(Array.isArray(rows)); valid(rows.every(r => r && id(r.id)) && new Set(rows.map(r => r.id)).size === rows.length); }
export async function readWorkday(responses: Response[]): Promise<Workday> {
  const data = await readJson<Workday>(responses[0]);
  valid(data && LOCATIONS.some(l => l.value === data.local) && isCivilDate(data.fecha));
  unique(data.rutinas); unique(data.tareas); unique(data.ejecuciones); unique(data.relevos);
  for (const r of data.rutinas) {
    valid(r.local === data.local && text(r.titulo) && ['apertura', 'cierre'].includes(r.fase) && ['diaria', 'laborables', 'fin_semana'].includes(r.frecuencia) && flag(r.activa) && id(r.autor_id));
    valid(Array.isArray(r.pasos) && r.pasos.length > 0 && r.pasos.length <= 30 && r.pasos.every(p => text(p) && p.length <= 160)); storedUtcTimestamp(r.creado_en);
  }
  for (const e of data.ejecuciones) {
    valid(e.fecha === data.fecha && id(e.preparado_por) && data.rutinas.some(r => r.id === e.rutina_id)); storedUtcTimestamp(e.creado_en);
  }
  for (const t of data.tareas) {
    const execution = data.ejecuciones.find(e => e.id === t.rutina_ejecucion_id);
    const routine = data.rutinas.find(r => r.id === execution?.rutina_id);
    valid(t.local === data.local && t.fecha === data.fecha && text(t.titulo) && flag(t.completada) && routine && t.fase === routine.fase && t.rutina_titulo === routine.titulo);
    if (t.completada) { valid(id(t.completado_por!) && text(t.completado_nombre)); storedUtcTimestamp(t.completado_en!); }
    else valid(t.completado_por === null && t.completado_nombre === null && t.completado_en === null);
  }
  for (const e of data.ejecuciones) valid(data.tareas.filter(t => t.rutina_ejecucion_id === e.id).length === data.rutinas.find(r => r.id === e.rutina_id)!.pasos.length);
  for (const r of data.relevos) {
    valid(r.local === data.local && isCivilDate(r.fecha) && text(r.contenido) && id(r.autor_id) && text(r.autor_nombre)); storedUtcTimestamp(r.creado_en);
    if (r.resuelto_por === null) valid(r.resuelto_nombre === null && r.resuelto_en === null);
    else { valid(id(r.resuelto_por) && text(r.resuelto_nombre)); storedUtcTimestamp(r.resuelto_en!); }
    valid(Array.isArray(r.lecturas)); const readers = new Set<number>();
    for (const l of r.lecturas) {
      valid(l && l.relevo_id === r.id && id(l.usuario_id) && !readers.has(l.usuario_id) && text(l.usuario_nombre));
      storedUtcTimestamp(l.leido_en); readers.add(l.usuario_id);
    }
  }
  return data;
}
export function routineApplies(routine: Routine, date: string) {
  if (!isCivilDate(date)) return false;
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return routine.frecuencia === 'diaria' || (routine.frecuencia === 'laborables' ? day >= 1 && day <= 5 : day === 0 || day === 6);
}
