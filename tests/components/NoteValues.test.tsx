import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { readNotes, noteCreatedAt } from '../../apps/erp-web/src/noteData';
import Notes from '../../apps/erp-web/src/pages/Notes';
import { createPendingCreates } from '../../apps/erp-web/src/pendingCreates';

const mocks = vi.hoisted(() => ({ fetchWithAuth: vi.fn(), user: { id: '1', name: 'Propietario', role: 'owner' } }));
let pendingCreates: ReturnType<typeof createPendingCreates>;
vi.mock('../../apps/erp-web/src/context/AuthContext', () => ({ useAuth: () => ({ ...mocks, pendingCreates }) }));
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const note = { id: 1, contenido: 'Nota guardada', color: 'sepia', fijada: 0, creado_en: '2024-02-29 23:30:00', usuario_id: null, autor: null };
beforeEach(() => { pendingCreates = createPendingCreates(); mocks.fetchWithAuth.mockReset().mockImplementation(async () => response([note])); });
it.each([{ id: '1' }, { id: 0 }, { contenido: {} }, { contenido: ' ' }, { color: [] }, { fijada: 'false' }, { fijada: 2 }, { creado_en: '2024-02-29T23:30:00' }, { creado_en: '2023-02-29 23:30:00' }, { usuario_id: '1' }, { usuario_id: 0 }, { autor: {} }, { autor: '' }])('rejects invalid note metadata %j', async change => {
  await expect(readNotes([response([{ ...note, ...change }])])).rejects.toThrow();
});
it('normalizes stored pin flags, preserves arbitrary/null colours and orders by pin, instant and ID', async () => {
  const values = [note, { ...note, id: 2, color: null }, { ...note, id: 3, fijada: 1, creado_en: '2020-01-01 00:00:00' }, { ...note, id: 4, fijada: false, creado_en: '2024-03-01T00:00:00Z' }];
  const notes = await readNotes([response(values)]);
  expect(notes.map(item => item.id)).toEqual([3, 4, 2, 1]); expect(notes.map(item => item.fijada)).toEqual([true, false, false, false]);
  expect(notes[2].color).toBeNull(); expect(notes[3].color).toBe('sepia'); expect(noteCreatedAt(note.creado_en).toISOString()).toBe('2024-02-29T23:30:00.000Z');
  await expect(readNotes([response([note, note])])).rejects.toThrow();
});
it('labels legacy colour and missing author, with a machine-readable UTC instant', async () => {
  render(<Notes />); await screen.findByText('Nota guardada');
  expect(screen.getByText('Color registrado: sepia')).toBeVisible(); expect(screen.getByText('Autor no registrado')).toBeVisible();
  expect(document.querySelector('time')).toHaveAttribute('datetime', '2024-02-29T23:30:00.000Z');
  expect(screen.getByTitle('Fijar arriba')).toHaveAttribute('aria-pressed', 'false');
});
it('blocks malformed list actions and retries reads without interpreting a string pin as true', async () => {
  let valid = false; mocks.fetchWithAuth.mockImplementation(async () => response([{ ...note, fijada: valid ? 0 : 'false' }]));
  render(<Notes />); expect(await screen.findByRole('alert')).toHaveTextContent('notas inválidas');
  expect(screen.queryByTitle('Desfijar')).not.toBeInTheDocument(); expect(screen.queryByText('Sin notas')).not.toBeInTheDocument();
  valid = true; fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga' })); expect(await screen.findByTitle('Fijar arriba')).toBeEnabled();
  expect(mocks.fetchWithAuth.mock.calls.every(([, options]) => !options?.method)).toBe(true);
});
it('sends only the target pin state once and reconciles a lost reply without overwriting content', async () => {
  let changed = false; let finish!: () => void;
  mocks.fetchWithAuth.mockImplementation(async (_url, options) => {
    if (options?.method === 'PATCH') { changed = true; await new Promise<void>(resolve => { finish = resolve; }); throw new Error('Respuesta perdida'); }
    return response([{ ...note, fijada: changed ? 1 : 0, contenido: changed ? 'Edición de otro cliente' : note.contenido }]);
  });
  render(<Notes />); const pin = await screen.findByTitle('Fijar arriba');
  act(() => { pin.click(); pin.click(); });
  expect(pin).toBeDisabled(); const writes = mocks.fetchWithAuth.mock.calls.filter(([, options]) => options?.method);
  expect(writes).toHaveLength(1); expect(writes[0][0]).toMatch(/\/notas\/1\/fijada$/); expect(JSON.parse(writes[0][1].body)).toEqual({ fijada: true });
  await act(async () => finish()); await waitFor(() => expect(screen.getByTitle('Desfijar')).toBeEnabled());
  expect(screen.getByText('Edición de otro cliente')).toBeVisible(); expect(screen.getByRole('alert')).toHaveTextContent('Respuesta perdida');
});
