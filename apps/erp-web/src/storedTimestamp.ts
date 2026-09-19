import { isCivilDate } from './financialValues';
import { isCivilTime } from './planningData';

// SQLite CURRENT_TIMESTAMP is UTC. ISO inputs must explicitly carry Z.
export function storedUtcTimestamp(value: string) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z?$/.test(value) ||
    !isCivilDate(value.slice(0, 10)) || !isCivilTime(value.slice(11, 16)) || Number(value.slice(17, 19)) > 59) throw new Error('Fecha de registro inválida.');
  if (value[10] === 'T' && !value.endsWith('Z')) throw new Error('La fecha de registro no indica zona horaria.');
  const date = new Date(value.replace(' ', 'T').replace(/Z?$/, 'Z'));
  if (!Number.isFinite(date.getTime())) throw new Error('Fecha de registro inválida.');
  return date;
}
