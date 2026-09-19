import { readList } from './apiResponse';
import { storedUtcTimestamp } from './storedTimestamp';

export interface Presence {
  usuario_id: number; usuario_nombre: string; usuario_rol: 'manager' | 'employee'; usuario_local: string | null;
  estado_presencia: 'trabajando' | 'descanso' | 'fuera'; ultimo_fichaje_entrada: string | null; ultimo_fichaje_salida: string | null;
}
export async function readPresence(response: Response): Promise<Presence[]> {
  const rows = await readList<Presence>(response); const ids = new Set<number>();
  for (const row of rows) {
    if (!row || !Number.isSafeInteger(row.usuario_id) || row.usuario_id < 1 || ids.has(row.usuario_id) || typeof row.usuario_nombre !== 'string' || !row.usuario_nombre.trim() ||
      !['manager', 'employee'].includes(row.usuario_rol) || (row.usuario_local !== null && typeof row.usuario_local !== 'string') ||
      !['trabajando', 'descanso', 'fuera'].includes(row.estado_presencia)) throw new Error('La presencia contiene datos inválidos. No se muestran estados parciales.');
    const entry = row.ultimo_fichaje_entrada === null ? null : storedUtcTimestamp(row.ultimo_fichaje_entrada);
    const exit = row.ultimo_fichaje_salida === null ? null : storedUtcTimestamp(row.ultimo_fichaje_salida);
    if ((row.estado_presencia !== 'fuera' && (!entry || exit)) || (row.estado_presencia === 'fuera' && Boolean(entry) !== Boolean(exit)) ||
      (entry && exit && exit.getTime() < entry.getTime())) throw new Error('El estado de presencia no concuerda con sus fichajes. Revisa los registros antes de interpretarlo.');
    ids.add(row.usuario_id);
  }
  return rows.slice().sort((a, b) => a.usuario_nombre.localeCompare(b.usuario_nombre, 'es') || a.usuario_id - b.usuario_id);
}
export const presenceTimestamp = storedUtcTimestamp;
export function formatPresenceTimestamp(value: string) {
  return presenceTimestamp(value).toLocaleString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}
