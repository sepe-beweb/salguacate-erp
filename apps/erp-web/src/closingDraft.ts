import { isCivilDate, sumCents, toCents } from './financialValues';
import { localDate } from './localDate';

export interface ClosingDraft { fecha: string; local: string; efectivo: string; tarjeta: string; invitaciones: string; descuadre: string; }
export const emptyClosing = (): ClosingDraft => ({ fecha: localDate(), local: 'Principal', efectivo: '', tarjeta: '', invitaciones: '', descuadre: '' });

// Mirror the existing closing API's decimal syntax and per-field limit (1,000,000 euros).
// Keep the original strings in the POST; the server remains authoritative for the total.
export function closingPreview(draft: ClosingDraft): { valid: true; total: number } | { valid: false; error: string } {
  if (!isCivilDate(draft.fecha) || !['Principal', 'Segundo Local'].includes(draft.local)) return { valid: false, error: 'Revisa la fecha y el local del cierre.' };
  const cents: number[] = [];
  for (const field of ['efectivo', 'tarjeta', 'invitaciones', 'descuadre'] as const) {
    const value = draft[field] || (field === 'invitaciones' || field === 'descuadre' ? '0' : '');
    if (!/^-?\d+(\.\d{1,2})?$/.test(value)) return { valid: false, error: 'Completa efectivo y tarjeta y usa hasta dos decimales en los importes.' };
    try {
      const amount = toCents(Number(value));
      if (Math.abs(amount) > 100000000 || (field !== 'descuadre' && amount < 0)) throw new Error();
      cents.push(amount);
    } catch { return { valid: false, error: 'Cada importe debe estar entre 0 y 1.000.000 €. Solo el descuadre puede ser negativo.' }; }
  }
  return { valid: true, total: sumCents(cents.slice(0, 2)) };
}
