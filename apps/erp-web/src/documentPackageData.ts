import { readJson } from './apiResponse';
import { isCivilDate } from './financialValues';
export interface PackageScope { local: string; mes: string; incluir_pendientes: boolean; }
export interface PackageEntry { id: number; titulo: string; local: string; fecha: string; revision_estado: string; archivo: string; bytes: number; sha256: string; }
export interface DocumentPackage extends PackageScope { huella: string; total: number; bytes: number; documentos: PackageEntry[]; }
export async function readDocumentPackage(response: Response, expected?: PackageScope): Promise<DocumentPackage> {
  const p = await readJson<DocumentPackage>(response);
  if (!p || !['Todos', 'Principal', 'Segundo Local'].includes(p.local) || typeof p.mes !== 'string' || !/^\d{4}-\d{2}$/.test(p.mes) || !isCivilDate(p.mes + '-01') || typeof p.incluir_pendientes !== 'boolean' || !/^[a-f0-9]{64}$/.test(p.huella) || !Number.isSafeInteger(p.total) || p.total < 0 || p.total > 100 || !Number.isSafeInteger(p.bytes) || p.bytes < 0 || p.bytes > 50 * 1024 * 1024 || !Array.isArray(p.documentos) || p.documentos.length !== p.total || !p.documentos.every(d => d && Number.isSafeInteger(d.id) && d.id > 0 && typeof d.titulo === 'string' && !!d.titulo.trim() && ['Aguacate', 'Salmon'].includes(d.local) && isCivilDate(d.fecha) && d.fecha.startsWith(p.mes + '-') && ['pendiente', 'en_revision', 'revisado'].includes(d.revision_estado) && (p.incluir_pendientes || d.revision_estado === 'revisado') && typeof d.archivo === 'string' && /^(Aguacate|Salmon)\/\d{4}-\d{2}\/[a-z_]+\/documento-\d+\.(pdf|png|jpg|webp)$/.test(d.archivo) && /^[a-f0-9]{64}$/.test(d.sha256) && Number.isSafeInteger(d.bytes) && d.bytes > 0 && d.bytes <= 10 * 1024 * 1024) || new Set(p.documentos.map(d => d.id)).size !== p.total || new Set(p.documentos.map(d => d.archivo)).size !== p.total || p.documentos.reduce((sum, d) => sum + d.bytes, 0) !== p.bytes) throw new Error('La vista previa del paquete no es válida. No se prepara una descarga parcial.');
  if ((expected && (p.local !== expected.local || p.mes !== expected.mes || p.incluir_pendientes !== expected.incluir_pendientes))
    || typeof p.huella !== 'string'
    || p.documentos.some(d => typeof d.sha256 !== 'string'
      || (p.local !== 'Todos' && d.local !== (p.local === 'Principal' ? 'Aguacate' : 'Salmon'))
      || !d.archivo.startsWith(`${d.local}/${p.mes}/`))) {
    throw new Error('La vista previa no corresponde al alcance solicitado. Actualiza la selección.');
  }
  return p;
}
