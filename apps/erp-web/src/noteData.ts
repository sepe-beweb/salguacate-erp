import { readList } from './apiResponse';
import { storedUtcTimestamp } from './storedTimestamp';

export interface Note { id: number; contenido: string; color: string | null; fijada: boolean; creado_en: string; usuario_id: number | null; autor: string | null; }
export async function readNotes(responses: Response[]): Promise<Note[]> {
  const notes = await readList<Note>(responses[0]); const ids = new Set<number>();
  const result = notes.map(note => {
    if (!note || !Number.isSafeInteger(note.id) || note.id < 1 || ids.has(note.id) || typeof note.contenido !== 'string' || !note.contenido.trim() ||
      (note.color !== null && typeof note.color !== 'string') || ![true, false, 0, 1].includes(note.fijada) ||
      (note.usuario_id !== null && (!Number.isSafeInteger(note.usuario_id) || note.usuario_id < 1)) ||
      (note.autor !== null && (typeof note.autor !== 'string' || !note.autor.trim()))) throw new Error('El muro contiene notas inválidas. No se muestran notas ni estados parciales.');
    storedUtcTimestamp(note.creado_en); ids.add(note.id);
    return { ...note, fijada: Boolean(note.fijada) };
  });
  return result.sort((a, b) => Number(b.fijada) - Number(a.fijada) || storedUtcTimestamp(b.creado_en).getTime() - storedUtcTimestamp(a.creado_en).getTime() || b.id - a.id);
}
export function noteCreatedAt(value: string) { return storedUtcTimestamp(value); }
