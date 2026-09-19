import { readList } from './apiResponse';
export interface PublicUser { id: number; nombre: string; rol: 'owner' | 'manager' | 'employee'; }
export async function readPublicUsers(responses: Response[]): Promise<PublicUser[]> {
  const rows = await readList<PublicUser>(responses[0]); const ids = new Set<number>();
  for (const row of rows) {
    if (!row || !Number.isSafeInteger(row.id) || row.id < 1 || ids.has(row.id) || typeof row.nombre !== 'string' || !row.nombre.trim() || !['owner', 'manager', 'employee'].includes(row.rol)) throw new Error('La lista de perfiles contiene datos inválidos.');
    ids.add(row.id);
  }
  return rows;
}
