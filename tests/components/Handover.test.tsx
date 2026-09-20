import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import HandoverPage from '../../apps/erp-web/src/pages/Handover';
import { readWorkday, type Workday } from '../../apps/erp-web/src/handoverData';
import { createPendingCreates } from '../../apps/erp-web/src/pendingCreates';
const mocks = vi.hoisted(() => ({ fetchWithAuth: vi.fn(), user: { id: '2', name: 'Dora', role: 'manager', location: 'Principal' }, pendingCreates: null as unknown as ReturnType<typeof createPendingCreates> }));
vi.mock('../../apps/erp-web/src/context/AuthContext', () => ({ useAuth: () => mocks }));
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const timestamp = '2026-09-20 10:00:00';
const fixture = (): Workday => ({ local: 'Principal', fecha: '2026-09-20',
  responsables: [{ id: 2, nombre: 'Dora' }, { id: 3, nombre: 'María' }],
  rutinas: [{ id: 1, local: 'Principal', titulo: 'Apertura sala', fase: 'apertura', frecuencia: 'diaria', pasos: ['Revisar mesas'], activa: 1, autor_id: 2, creado_en: timestamp }],
  ejecuciones: [{ id: 1, rutina_id: 1, fecha: '2026-09-20', preparado_por: 2, creado_en: timestamp }],
  tareas: [{ id: 1, titulo: 'Revisar mesas', local: 'Principal', fecha: '2026-09-20', rutina_ejecucion_id: 1, rutina_titulo: 'Apertura sala', fase: 'apertura', completada: 0, completado_por: null, completado_nombre: null, completado_en: null }],
  relevos: [{ id: 1, local: 'Principal', fecha: '2026-09-19', contenido: 'Aviso pendiente anterior', autor_id: 2, autor_nombre: 'Dora', creado_en: timestamp, resuelto_por: null, resuelto_en: null, resuelto_nombre: null, lecturas: [], responsable_id: null, responsable_nombre: null, responsable_disponible: 0, prioridad: 'normal', estado: 'pendiente', revision: 1, cambios: [] }]
});
const mount = () => render(<MemoryRouter><HandoverPage /></MemoryRouter>);
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 8, 20, 12));
  mocks.pendingCreates = createPendingCreates(); mocks.user = { id: '2', name: 'Dora', role: 'manager', location: 'Principal' };
  mocks.fetchWithAuth.mockReset().mockImplementation(async () => response(fixture()));
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
it('preserves management draft on conflict and sends the observed revision', async () => {
  mocks.fetchWithAuth.mockImplementation(async (_url, options) => options?.method === 'PUT' ? response({ error: 'El aviso ha cambiado' }, 409) : response(fixture()));
  mount(); fireEvent.click(await screen.findByRole('button', { name: 'Gestionar aviso' }));
  const dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('Responsable'), { target: { value: '3' } });
  fireEvent.change(within(dialog).getByLabelText('Prioridad del aviso'), { target: { value: 'alta' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar gestión' }));
  await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent('El aviso ha cambiado'));
  expect(within(dialog).getByLabelText('Responsable')).toHaveValue('3');
  const call = mocks.fetchWithAuth.mock.calls.find(([, options]) => options?.method === 'PUT');
  expect(JSON.parse(call![1].body)).toEqual({ responsable_id: 3, prioridad: 'alta', estado: 'pendiente', revision: 1 });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cerrar y conservar' }));
  fireEvent.click(screen.getByRole('button', { name: 'Continuar gestión del aviso #1' }));
  expect(screen.getByLabelText('Responsable')).toHaveValue('3');
});
it('filters mine, unassigned and resolved while reading remains distinct from resolution', async () => {
  const data = fixture(); data.relevos.push({ ...data.relevos[0], id: 2, contenido: 'Asignado a Dora', responsable_id: 2, responsable_nombre: 'Dora', responsable_disponible: 1 });
  mocks.fetchWithAuth.mockResolvedValue(response(data)); mount(); await screen.findByText('Asignado a Dora');
  fireEvent.change(screen.getByLabelText('Ver avisos'), { target: { value: 'mios' } });
  expect(screen.getByText('Asignado a Dora')).toBeVisible(); expect(screen.queryByText('Aviso pendiente anterior')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Ver avisos'), { target: { value: 'sin_responsable' } });
  expect(screen.getByText('Aviso pendiente anterior')).toBeVisible(); expect(screen.queryByText('Asignado a Dora')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Ver avisos'), { target: { value: 'resueltos' } });
  expect(screen.getByText('No hay avisos con este filtro.')).toBeVisible();
  expect(mocks.fetchWithAuth).toHaveBeenCalledTimes(1);
});
it('loads complete workday without producing writes and keeps previous-day notices', async () => {
  mount(); await screen.findByText('Aviso pendiente anterior');
  expect(screen.getByRole('checkbox', { name: /Revisar mesas/ })).not.toBeChecked();
  expect(mocks.fetchWithAuth.mock.calls).toHaveLength(1);
  expect(mocks.fetchWithAuth.mock.calls[0][0]).toContain('local=Principal&fecha=2026-09-20');
});
it.each([
  (d: Workday) => { d.rutinas[0].activa = 9; },
  (d: Workday) => { d.tareas[0].completada = 4; },
  (d: Workday) => { d.tareas[0].completada = 1; },
  (d: Workday) => { d.tareas[0].local = 'Segundo Local'; },
  (d: Workday) => { d.tareas[0].rutina_ejecucion_id = 42; },
  (d: Workday) => { d.tareas = []; },
  (d: Workday) => { d.relevos[0].resuelto_por = 2; },
  (d: Workday) => { d.relevos.push(d.relevos[0]); },
  (d: Workday) => { d.relevos[0].creado_en = '2026-02-30 10:00:00'; },
  (d: Workday) => { d.relevos[0].lecturas = [{ relevo_id: 9, usuario_id: 3, usuario_nombre: 'María', leido_en: timestamp }]; },
])('rejects inconsistent payloads instead of publishing partial completion or reading counters', async corrupt => {
  const data = fixture(); corrupt(data); await expect(readWorkday([response(data)])).rejects.toThrow();
});
it('blocks writes on failed reads and recovers explicitly', async () => {
  mocks.fetchWithAuth.mockResolvedValueOnce(response({ error: 'Lectura no disponible' }, 503)); mount();
  expect(await screen.findByRole('alert')).toHaveTextContent('Lectura no disponible');
  expect(screen.getByRole('button', { name: 'Preparar tareas del día' })).toBeDisabled();
  expect(screen.queryByText('Aviso pendiente anterior')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar jornada' }));
  await screen.findByText('Aviso pendiente anterior');
});
it('does not expose local switching, preparation or resolution to employees', async () => {
  mocks.user = { id: '3', name: 'María', role: 'employee', location: 'Principal' }; mount(); await screen.findByText('Aviso pendiente anterior');
  expect(screen.queryByLabelText('Local de la jornada')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Preparar tareas del día' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Resolver aviso' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'He leído el aviso' })).toBeEnabled();
});
it('preserves drafts on Escape and local changes until explicitly discarded', async () => {
  mount(); await screen.findByText('Aviso pendiente anterior'); fireEvent.click(screen.getByRole('button', { name: 'Dejar aviso' }));
  fireEvent.change(screen.getByLabelText('Qué debe saber el siguiente turno'), { target: { value: 'Borrador Aguacate' } });
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: true, cancelable: true }));
  fireEvent.change(screen.getByLabelText('Local de la jornada'), { target: { value: 'Segundo Local' } });
  fireEvent.click(screen.getByRole('button', { name: 'Dejar aviso' }));
  expect(screen.getByLabelText('Local del aviso')).toHaveValue('Principal');
  expect(screen.getByLabelText('Qué debe saber el siguiente turno')).toHaveValue('Borrador Aguacate');
});
it('restores an uncertain notice across navigation with the same key/body and no second creation after GET failure', async () => {
  const writes: RequestInit[] = []; let loseResponse = true;
  mocks.fetchWithAuth.mockImplementation(async (_url: string, options?: RequestInit) => {
    if (options?.method === 'POST') { writes.push(options); if (loseResponse) throw new Error('Respuesta perdida'); return response({ id: 7 }, 201); }
    return loseResponse ? response(fixture()) : response({ error: 'Lectura posterior fallida' }, 503);
  });
  const view = mount(); await screen.findByText('Aviso pendiente anterior');
  fireEvent.click(screen.getByRole('button', { name: 'Dejar aviso' }));
  fireEvent.change(screen.getByLabelText('Qué debe saber el siguiente turno'), { target: { value: 'Recuperar aviso' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar aviso' }));
  await screen.findByText('Respuesta perdida'); expect(screen.getByLabelText('Qué debe saber el siguiente turno')).toBeDisabled();
  view.unmount(); mount(); expect(screen.getByLabelText('Qué debe saber el siguiente turno')).toHaveValue('Recuperar aviso');
  loseResponse = false; fireEvent.click(screen.getByRole('button', { name: 'Confirmar guardado pendiente' }));
  await screen.findByText('Aviso guardado (n.º 7).'); await screen.findByText('Lectura posterior fallida');
  expect(writes).toHaveLength(2); expect(writes[0].body).toBe(writes[1].body); expect(writes[0].headers).toEqual(writes[1].headers);
  expect(mocks.pendingCreates.get('/api/relevos')).toBeNull();
});
it('does not enable another checkbox write until the post-write read has settled', async () => {
  let release!: (r: Response) => void;
  mocks.fetchWithAuth.mockResolvedValueOnce(response(fixture())).mockResolvedValueOnce(response({ mensaje: 'ok' })).mockImplementationOnce(() => new Promise<Response>(resolve => { release = resolve; }));
  mount(); const task = await screen.findByRole('checkbox', { name: /Revisar mesas/ }); fireEvent.click(task);
  await waitFor(() => expect(mocks.fetchWithAuth).toHaveBeenCalledTimes(3));
  expect(screen.getByRole('button', { name: 'Preparar tareas del día' })).toBeDisabled();
  release(response(fixture())); await waitFor(() => expect(screen.getByRole('button', { name: 'Preparar tareas del día' })).toBeEnabled());
});
