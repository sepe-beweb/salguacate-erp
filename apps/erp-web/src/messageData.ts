import { readList } from './apiResponse';
import { storedUtcTimestamp } from './storedTimestamp';
export interface InternalMessage { id: number; remitente_id: number; destinatario_id: number; remitente_nombre: string; asunto: string; cuerpo: string; fecha: string; leido: number; }
export interface MessageRecipient { id: number; nombre: string; rol: string; }
const validId = (value: number) => Number.isSafeInteger(value) && value > 0;
export async function readMessageWorkspace(responses: Response[]): Promise<[InternalMessage[], MessageRecipient[]]> {
  const [messages, recipients] = await Promise.all([readList<InternalMessage>(responses[0]), readList<MessageRecipient>(responses[1])]);
  const messageIds = new Set<number>(); const recipientIds = new Set<number>();
  for (const row of messages) {
    if (!row || !validId(row.id) || messageIds.has(row.id) || !validId(row.remitente_id) || !validId(row.destinatario_id) ||
      typeof row.remitente_nombre !== 'string' || typeof row.asunto !== 'string' || typeof row.cuerpo !== 'string' || ![0, 1].includes(row.leido)) throw new Error('El buzón contiene datos inválidos.');
    storedUtcTimestamp(row.fecha); messageIds.add(row.id);
  }
  for (const row of recipients) {
    if (!row || !validId(row.id) || recipientIds.has(row.id) || typeof row.nombre !== 'string' || !['owner', 'manager', 'employee'].includes(row.rol)) throw new Error('La lista de destinatarios contiene datos inválidos.');
    recipientIds.add(row.id);
  }
  return [messages.slice().sort((a, b) => storedUtcTimestamp(b.fecha).getTime() - storedUtcTimestamp(a.fecha).getTime() || b.id - a.id), recipients];
}
