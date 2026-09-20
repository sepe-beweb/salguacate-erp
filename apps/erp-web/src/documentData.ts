import { readJson } from './apiResponse';
import { isCivilDate } from './financialValues';
import { localDate } from './localDate';
import { storedUtcTimestamp } from './storedTimestamp';
import { validReview, validReviewSummary, type DocumentReview, type ReviewSummary } from './documentReviewData';

export const documentTypes = { factura_proveedor: 'Factura proveedor', ticket: 'Ticket', albaran: 'Albarán', gasto_extra: 'Gasto extra', contrato: 'Contrato', otro: 'Otro documento' };
export type DocumentType = keyof typeof documentTypes;
export interface DocumentFields { local: string; titulo: string; fecha: string; tipo: DocumentType; etiquetas: string[]; notas: string; proveedor_id: number | null; }
export function includePendingTag<T extends DocumentFields>(value: T, pending: string): T {
  const clean = pending.trim().toLocaleLowerCase('es-ES');
  if (!clean || value.etiquetas.includes(clean)) return value;
  if (clean.length > 40 || value.etiquetas.length >= 12) throw new Error('Admite hasta 12 etiquetas de 40 caracteres. Quita una antes de añadir otra.');
  return { ...value, etiquetas: [...value.etiquetas, clean] };
}
export interface DocumentRecord extends DocumentFields, DocumentReview { id: number; gasto_id: number | null; nombre_archivo: string; mime: string; bytes: number; autor_id: number; autor_nombre: string; proveedor_nombre: string | null; creado_en: string; actualizado_en: string; revision: number; archivado: number; }
export interface DocumentDetail extends DocumentRecord { cambios: { id: number; detalle: string; creado_en: string; actor_nombre: string }[]; }
export interface DocumentPage { items: DocumentRecord[]; total: number; pagina: number; por_pagina: number; resumen: ReviewSummary; }
export const emptyDocument = (local: string): DocumentFields => ({ local: local === 'Segundo Local' ? local : 'Principal', titulo: '', fecha: localDate(), tipo: 'factura_proveedor', etiquetas: [], notas: '', proveedor_id: null });
export const documentInput = 'block w-full min-w-0 p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900';
const positive = (value: unknown) => Number.isSafeInteger(value) && Number(value) > 0;
const nullableId = (value: unknown) => value === null || positive(value);
const stamp = (value: unknown) => { try { return typeof value === 'string' && !!storedUtcTimestamp(value); } catch { return false; } };
export function validDocument(row: DocumentRecord) {
  return row && validReview(row) && positive(row.id) && ['Principal', 'Segundo Local'].includes(row.local) && typeof row.titulo === 'string' && row.titulo.trim() && isCivilDate(row.fecha) && Object.prototype.hasOwnProperty.call(documentTypes, row.tipo) &&
    Array.isArray(row.etiquetas) && row.etiquetas.length <= 12 && row.etiquetas.every(t => typeof t === 'string' && t.trim() && t.length <= 40) && new Set(row.etiquetas).size === row.etiquetas.length && typeof row.notas === 'string' && nullableId(row.proveedor_id) && nullableId(row.gasto_id) &&
    typeof row.nombre_archivo === 'string' && row.nombre_archivo.trim() && ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(row.mime) && positive(row.bytes) && row.bytes <= 10 * 1024 * 1024 && positive(row.autor_id) && typeof row.autor_nombre === 'string' && row.autor_nombre.trim() && (row.proveedor_nombre === null || typeof row.proveedor_nombre === 'string') && stamp(row.creado_en) && stamp(row.actualizado_en) && positive(row.revision) && [0, 1].includes(row.archivado);
}
export async function readDocumentPage(response: Response): Promise<DocumentPage> {
  const page = await readJson<DocumentPage>(response);
  if (!page || !validReviewSummary(page.resumen)) throw new Error('El resumen de revisión no es válido. No se muestra una lista parcial.');
  if (!page || !Array.isArray(page.items) || !page.items.every(validDocument) || new Set(page.items.map(d => d.id)).size !== page.items.length || !Number.isSafeInteger(page.total) || page.total < page.items.length || !positive(page.pagina) || page.por_pagina !== 24 || page.pagina > Math.max(1, Math.ceil(page.total / 24)) || page.items.length !== Math.min(24, Math.max(0, page.total - (page.pagina - 1) * 24))) throw new Error('El archivo contiene datos inválidos. No se muestra una lista parcial.');
  return page;
}
export async function readDocumentDetail(response: Response): Promise<DocumentDetail> {
  const doc = await readJson<DocumentDetail>(response);
  if (!validDocument(doc) || !Array.isArray(doc.cambios) || doc.cambios.length === 0 || new Set(doc.cambios.map(c => c.id)).size !== doc.cambios.length || !doc.cambios.every(c => c && positive(c.id) && typeof c.detalle === 'string' && typeof c.actor_nombre === 'string' && stamp(c.creado_en))) throw new Error('La ficha o su historial no son válidos.');
  return doc;
}
export const documentSize = (bytes: number) => bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;

export function readFileBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result.split(',')[1]) : reject(new Error('Archivo ilegible.'));
    reader.readAsDataURL(file);
  });
}
export function validateDocumentFiles(files: File[]) {
  if (!files.length || files.length > 10 || files.some(f => !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(f.type) || !f.size || f.size > 10 * 1024 * 1024)) throw new Error('Selecciona un PDF o hasta 10 fotos JPEG, PNG o WebP, de hasta 10 MB cada una.');
  if (files.length > 1 && files.some(f => f.type === 'application/pdf')) throw new Error('Sube un solo PDF o varias fotos; no mezcles ambos formatos.');
}
export async function prepareDocument(files: File[]): Promise<File> {
  validateDocumentFiles(files);
  if (files.length === 1) return files[0];
  const { jsPDF } = await import('jspdf'); const pdf = new jsPDF();
  for (let index = 0; index < files.length; index++) {
    const url = URL.createObjectURL(files[index]);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('Una de las páginas no es una imagen válida.')); image.src = url; });
      if (!img.width || !img.height || img.width * img.height > 40_000_000) throw new Error('Una página supera los 40 megapíxeles. Reduce su tamaño.');
      const scale = Math.min(1, 2000 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas'); canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
      const context = canvas.getContext('2d'); if (!context) throw new Error('No se puede preparar el PDF en este navegador.');
      context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(img, 0, 0, canvas.width, canvas.height);
      if (index) pdf.addPage(); const ratio = Math.min(190 / canvas.width, 277 / canvas.height);
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.85), 'JPEG', 10, 10, canvas.width * ratio, canvas.height * ratio);
    } finally { URL.revokeObjectURL(url); }
  }
  const result = new File([pdf.output('blob')], 'documento-multipagina.pdf', { type: 'application/pdf' });
  if (result.size > 10 * 1024 * 1024) throw new Error('El PDF preparado supera 10 MB. Divide las páginas en varios documentos.');
  return result;
}
