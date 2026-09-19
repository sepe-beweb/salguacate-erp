export type ScanMode = 'pdf' | 'ai_invoice' | 'ai_inventory';
export type ScanResult =
  | { kind: 'ai_invoice'; proveedor: string; total: string; concepto: string; rawText: string }
  | { kind: 'ai_inventory'; botellasEstimadas: number; confianza: number; rawText: string };

export function parseScanResult(value: unknown, mode: ScanMode): ScanResult {
  const fail = () => { throw new Error('El análisis no contiene datos válidos. Se conserva la imagen.'); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
  const data = value as Record<string, unknown>;
  const text = (key: string, limit: number) => {
    const item = data[key];
    if (typeof item !== 'string' || item.length > limit) return fail();
    return item;
  };
  const number = (key: string) => {
    const item = data[key];
    if ((typeof item !== 'number' && typeof item !== 'string') || String(item).trim() === '') return fail();
    const result = Number(item);
    if (!Number.isFinite(result) || result < 0) return fail();
    return result;
  };
  if (data.success !== true) return fail();
  const rawText = data.rawText == null ? '' : text('rawText', 10000);
  if (mode === 'ai_invoice') return {
    kind: mode, proveedor: text('proveedor', 160), total: String(number('total')),
    concepto: text('concepto', 1000), rawText
  };
  if (mode !== 'ai_inventory') return fail();
  const botellasEstimadas = number('botellasEstimadas');
  const confianza = number('confianza');
  if (!Number.isSafeInteger(botellasEstimadas) || confianza > 100) return fail();
  return { kind: mode, botellasEstimadas, confianza, rawText };
}
