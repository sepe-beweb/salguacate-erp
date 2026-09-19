// Civil dates are calendar values, never instants in a browser time zone.
export function isCivilDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}
export function formatCivilDate(value: string) {
  if (!isCivilDate(value)) throw new Error('Fecha civil inválida.');
  return value.split('-').reverse().join('/');
}
export function toCents(value: number): number {
  const cents = Math.round(value * 100);
  if (typeof value !== 'number' || !Number.isSafeInteger(cents) || cents / 100 !== value) throw new Error('Importe inválido: se requieren céntimos exactos y un valor seguro.');
  return cents === 0 ? 0 : cents;
}
export function sumCents(values: number[]) {
  return values.reduce((sum, value) => {
    if (!Number.isSafeInteger(value) || !Number.isSafeInteger(sum + value)) throw new Error('El total financiero excede el rango seguro.');
    return sum + value;
  }, 0);
}
export function formatEuroCents(cents: number) {
  if (!Number.isSafeInteger(cents)) throw new Error('Importe en céntimos inválido.');
  const magnitude = Math.abs(cents);
  // Format the integer/fraction separately, retaining every cent near the safe limit.
  return `${cents < 0 ? '-' : ''}${Math.floor(magnitude / 100).toLocaleString('es-ES')},${String(magnitude % 100).padStart(2, '0')}\u00a0€`;
}
