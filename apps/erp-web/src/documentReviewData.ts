import { readJson } from './apiResponse';
import { isCivilDate } from './financialValues';
import { storedUtcTimestamp } from './storedTimestamp';

export const reviewStates = { pendiente: 'Pendiente', en_revision: 'En revisión', revisado: 'Revisado' };
export interface ReviewFields { estado: keyof typeof reviewStates; responsable_id: number | null; fecha_limite: string | null; observaciones: string; }
export interface DocumentReview {
  revision_estado: ReviewFields['estado']; revision_responsable_id: number | null; revision_responsable_nombre: string | null;
  revision_fecha_limite: string | null; revision_notas: string; revisado_por: number | null; revisado_nombre: string | null; revisado_en: string | null;
}
export interface Reviewer { id: number; nombre: string; rol: 'owner' | 'manager'; local: string; }
export interface ReviewSummary { activos: number; pendientes: number; en_revision: number; revisados: number; vencidos: number; sin_asignar: number; }
const id = (value: unknown) => Number.isSafeInteger(value) && Number(value) > 0;
const name = (value: unknown) => typeof value === 'string' && !!value.trim();
export function validReview(row: DocumentReview) {
  try {
    return Object.prototype.hasOwnProperty.call(reviewStates, row.revision_estado) && (row.revision_responsable_id === null ? row.revision_responsable_nombre === null : id(row.revision_responsable_id) && name(row.revision_responsable_nombre)) &&
      (row.revision_fecha_limite === null || isCivilDate(row.revision_fecha_limite)) && typeof row.revision_notas === 'string' && row.revision_notas.length <= 1000 &&
      (row.revision_estado === 'revisado' ? id(row.revisado_por) && name(row.revisado_nombre) && typeof row.revisado_en === 'string' && !!storedUtcTimestamp(row.revisado_en) : row.revisado_por === null && row.revisado_nombre === null && row.revisado_en === null);
  } catch { return false; }
}
export function validReviewSummary(summary: ReviewSummary) {
  return summary && ['activos', 'pendientes', 'en_revision', 'revisados', 'vencidos', 'sin_asignar'].every(key => Number.isSafeInteger(summary[key as keyof ReviewSummary]) && summary[key as keyof ReviewSummary] >= 0) && summary.activos === summary.pendientes + summary.en_revision + summary.revisados && summary.vencidos <= summary.pendientes + summary.en_revision && summary.sin_asignar <= summary.pendientes + summary.en_revision;
}
export const reviewDraft = (doc: DocumentReview): ReviewFields => ({ estado: doc.revision_estado, responsable_id: doc.revision_responsable_id, fecha_limite: doc.revision_fecha_limite, observaciones: doc.revision_notas });
export async function readReviewers(response: Response): Promise<Reviewer[]> {
  const rows = await readJson<Reviewer[]>(response);
  if (!Array.isArray(rows) || !rows.every(r => r && id(r.id) && name(r.nombre) && ['owner', 'manager'].includes(r.rol) && ['Todos', 'Principal', 'Segundo Local'].includes(r.local)) || new Set(rows.map(r => r.id)).size !== rows.length) throw new Error('La lista de responsables no es válida.');
  return rows;
}
