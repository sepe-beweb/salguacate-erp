import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import Notes from '../../apps/erp-web/src/pages/Notes';
import Scanner from '../../apps/erp-web/src/pages/Scanner';
import Clock from '../../apps/erp-web/src/pages/employee/Clock';
import Calendar from '../../apps/erp-web/src/pages/employee/Calendar';
import EmployeeDashboard from '../../apps/erp-web/src/pages/employee/EmployeeDashboard';
import { parseScanResult } from '../../apps/erp-web/src/scannerResult';
import { localDate } from '../../apps/erp-web/src/localDate';
import { createPendingCreates } from '../../apps/erp-web/src/pendingCreates';

const mocks = vi.hoisted(() => ({ fetchWithAuth: vi.fn(), user: { id: '3', name: 'María García', role: 'employee', location: 'Principal' } }));
let pendingCreates: ReturnType<typeof createPendingCreates>;
vi.mock('../../apps/erp-web/src/context/AuthContext', () => ({ useAuth: () => ({ ...mocks, pendingCreates }) }));
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const writes = () => mocks.fetchWithAuth.mock.calls.filter(([, options]) => options?.method && options.method !== 'GET');
const note = { id: 1, contenido: 'Nota existente', color: 'yellow', fijada: false, creado_en: '2026-09-19T12:00:00Z', usuario_id: 3, autor: 'María' };
const dialogMethods = Object.fromEntries(['showModal', 'close'].map(name => [name, Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, name)]));
beforeAll(() => {
  // jsdom-only shim. Native modal focus and Escape are exercised in browser tests.
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value: function () { this.setAttribute('open', ''); } },
    close: { configurable: true, value: function () { this.removeAttribute('open'); } }
  });
});
afterAll(() => {
  for (const [name, descriptor] of Object.entries(dialogMethods)) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
});
beforeEach(() => { mocks.fetchWithAuth.mockReset(); pendingCreates = createPendingCreates(); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Employee recovery', () => {
  it.each([response({ error: 'Fichaje no disponible' }, 503), response({ estado: 'desconocido' })])('blocks clock actions until a valid authoritative read', async failed => {
    mocks.fetchWithAuth.mockResolvedValueOnce(failed).mockImplementation(async () => response(null));
    render(<Clock />);
    await screen.findByRole('alert');
    expect(screen.queryByRole('button', { name: 'Fichar Entrada' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga' }));
    expect(await screen.findByRole('button', { name: 'Fichar Entrada' })).toBeEnabled();
    expect(writes()).toHaveLength(0);
  });

  it('reconciles a lost clock response with GET without repeating the write', async () => {
    let active = false;
    mocks.fetchWithAuth.mockImplementation(async (_url, options) => {
      if (options?.method === 'POST') { active = true; throw new Error('Conexión perdida'); }
      return response(active ? { estado: 'trabajando' } : null);
    });
    render(<Clock />);
    fireEvent.click(await screen.findByRole('button', { name: 'Fichar Entrada' }));
    expect(await screen.findByText('Turno Activo')).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('Conexión perdida');
    expect(writes()).toHaveLength(1);
    expect(JSON.parse(writes()[0][1].body)).toEqual({ tipo: 'entrada' });
  });

  it('keeps clock actions blocked if reconciliation also fails', async () => {
    let started = false;
    mocks.fetchWithAuth.mockImplementation(async (_url, options) => {
      if (options?.method === 'POST') { started = true; return response({ message: 'ok' }); }
      return started ? response({ error: 'Estado no disponible' }, 503) : response(null);
    });
    render(<Clock />);
    fireEvent.click(await screen.findByRole('button', { name: 'Fichar Entrada' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Estado no disponible');
    expect(screen.queryByRole('button', { name: 'Finalizar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fichar Entrada' })).not.toBeInTheDocument();
    expect(writes()).toHaveLength(1);
  });

  it('does not disguise failed calendar load as no shifts', async () => {
    mocks.fetchWithAuth.mockResolvedValueOnce(response({ error: 'Calendario no disponible' }, 503)).mockImplementation(async () => response([]));
    render(<Calendar />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Calendario no disponible');
    expect(screen.queryByText('Sin turnos asignados')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga' }));
    expect(await screen.findByText('Sin turnos asignados')).toBeVisible();
  });

  it('does not claim an off day or empty tasks after a partial dashboard read', async () => {
    mocks.fetchWithAuth.mockImplementation(async url => url.endsWith('/api/turnos') ? response({ error: 'Turnos inaccesibles' }, 503) : response([]));
    render(<MemoryRouter><EmployeeDashboard /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Turnos inaccesibles');
    expect(screen.queryByText('Sin turno registrado hoy')).not.toBeInTheDocument();
    expect(screen.queryByText('Sin tareas para hoy')).not.toBeInTheDocument();
  });

  it('preserves the authoritative task status on failed completion', async () => {
    const task = { id: 1, titulo: 'Revisar cámara', descripcion: '', asignado_nombre: 'María', completada: false, fecha: localDate(), asignado_a: 3, local: 'Principal', prioridad: 'normal' };
    mocks.fetchWithAuth.mockImplementation(async (url, options) => options?.method === 'PUT' ? response({ error: 'No guardado' }, 409) : response(url.endsWith('/api/tareas') ? [task] : []));
    render(<MemoryRouter><EmployeeDashboard /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Revisar cámara/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No guardado');
    expect(await screen.findByRole('button', { name: /Revisar cámara/ })).toHaveAttribute('aria-pressed', 'false');
    expect(writes()).toHaveLength(1);
  });
});

describe('Notes recovery', () => {
  it('reports failed load instead of empty notes and retries only GET', async () => {
    mocks.fetchWithAuth.mockResolvedValueOnce(response({}, 503)).mockImplementation(async () => response([]));
    render(<Notes />);
    await screen.findByRole('alert');
    expect(screen.queryByText('Sin notas')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga' }));
    expect(await screen.findByText('Sin notas')).toBeVisible();
    expect(writes()).toHaveLength(0);
  });

  it('retains the full draft and color after a failed create', async () => {
    mocks.fetchWithAuth.mockImplementation(async (_url, options) => options?.method === 'POST' ? response({ error: 'No se pudo guardar' }, 503) : response([]));
    render(<Notes />);
    await screen.findByText('Sin notas');
    fireEvent.click(screen.getByRole('button', { name: 'Nueva' }));
    fireEvent.change(screen.getByLabelText('Contenido de la nota'), { target: { value: 'Borrador conservado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Color blue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Nota' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar');
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(screen.getByLabelText('Contenido de la nota')).toHaveValue('Borrador conservado');
    expect(screen.getByRole('button', { name: 'Color blue' })).toHaveAttribute('aria-pressed', 'true');
    expect(writes()).toHaveLength(1);
  });

  it('cancels deletion and preserves a note on failed pin and deletion', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    mocks.fetchWithAuth.mockImplementation(async (_url, options) => options?.method ? response({ error: 'Cambio rechazado' }, 409) : response([note]));
    render(<Notes />);
    await screen.findByText('Nota existente');
    fireEvent.click(screen.getByTitle('Eliminar'));
    expect(writes()).toHaveLength(0);
    fireEvent.click(screen.getByTitle('Fijar arriba'));
    await screen.findByRole('alert');
    await waitFor(() => expect(screen.getByTitle('Fijar arriba')).toBeEnabled());
    expect(screen.getByTitle('Fijar arriba')).toHaveAttribute('aria-pressed', 'false');
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByTitle('Eliminar'));
    await waitFor(() => expect(screen.getByTitle('Eliminar')).toBeEnabled());
    expect(screen.getByText('Nota existente')).toBeVisible();
    expect(writes()).toHaveLength(2);
  });

  it('requires voice consent, appends finals once and aborts on modal close', async () => {
    const recognition = { start: vi.fn(), abort: vi.fn(), onresult: null as any, onerror: null as any, onend: null as any };
    vi.stubGlobal('SpeechRecognition', class { constructor() { return recognition; } });
    mocks.fetchWithAuth.mockImplementation(async () => response([]));
    render(<Notes />);
    await screen.findByText('Sin notas');
    fireEvent.click(screen.getByRole('button', { name: 'Nueva' }));
    expect(screen.getByTitle('Dictar por voz')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Contenido de la nota'), { target: { value: 'Texto escrito' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /Autorizo el dictado/ }));
    fireEvent.click(screen.getByTitle('Dictar por voz'));
    const result = Object.assign([{ transcript: 'más voz' }], { isFinal: true });
    act(() => { recognition.onresult({ resultIndex: 0, results: [result] }); recognition.onresult({ resultIndex: 0, results: [result] }); });
    expect(screen.getByLabelText('Contenido de la nota')).toHaveValue('Texto escrito más voz');
    expect(screen.getByRole('button', { name: 'Guardar Nota' })).toBeDisabled();
    const lateResult = recognition.onresult;
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar nota' }));
    expect(recognition.abort).toHaveBeenCalledOnce();
    act(() => lateResult({ resultIndex: 0, results: [Object.assign([{ transcript: 'tardío' }], { isFinal: true })] }));
    fireEvent.click(screen.getByRole('button', { name: 'Nueva' }));
    expect(screen.getByLabelText('Contenido de la nota')).toHaveValue('Texto escrito más voz');
    expect(screen.getByRole('checkbox', { name: /Autorizo el dictado/ })).not.toBeChecked();
    expect(writes()).toHaveLength(0);
  });
});

const invoice = { success: true, proveedor: 'Proveedor de prueba', total: 0, concepto: 'Compra', rawText: '' };
describe('Scanner result boundary', () => {
  it('preserves zero instead of losing the extracted total', () => {
    expect(parseScanResult(invoice, 'ai_invoice')).toMatchObject({ total: '0' });
  });
  it.each([
    { ...invoice, proveedor: {} }, { ...invoice, total: null }, { ...invoice, total: '' },
    { ...invoice, total: -1 }, { ...invoice, rawText: {} }, { ...invoice, success: false }
  ])('rejects unusable invoice data', data => expect(() => parseScanResult(data, 'ai_invoice')).toThrow('datos válidos'));
  it('validates counts and confidence before rendering inventory', () => {
    expect(parseScanResult({ success: true, botellasEstimadas: '3', confianza: '80' }, 'ai_inventory')).toMatchObject({ botellasEstimadas: 3, confianza: 80 });
    expect(() => parseScanResult({ success: true, botellasEstimadas: 1.5, confianza: 80 }, 'ai_inventory')).toThrow();
    expect(() => parseScanResult({ success: true, botellasEstimadas: 3, confianza: 101 }, 'ai_inventory')).toThrow();
  });
});

describe('Scanner recovery with simulated image decoding and AI', () => {
  beforeEach(() => {
    vi.stubGlobal('Image', class {
      width = 10; height = 10; onload: (() => void) | null = null;
      set src(_value: string) { queueMicrotask(() => this.onload?.()); }
    });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fixture');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as any);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,aW1hZ2U=');
  });
  const capture = () => fireEvent.change(screen.getByLabelText('Seleccionar imagen'), { target: { files: [new File(['fixture'], 'test.png', { type: 'image/png' })] } });
  const analyze = async () => {
    capture();
    fireEvent.click(screen.getByRole('button', { name: 'Factura IA' }));
    expect(screen.getByRole('button', { name: 'Analizar con Gemini' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /Autorizo enviar/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Analizar con Gemini' }));
  };
  it('keeps image after disabled AI without retrying or writing an expense', async () => {
    mocks.fetchWithAuth.mockResolvedValue(response({ error: 'IA desactivada' }, 503));
    render(<Scanner />);
    await analyze();
    expect(await screen.findByRole('alert')).toHaveTextContent('IA desactivada');
    expect(screen.getByAltText('Vista previa')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Registrar Gasto Directamente' })).not.toBeInTheDocument();
    expect(writes()).toHaveLength(1);
  });
  it('preserves all invoice edits on failed registration and clears extraction on discard', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mocks.fetchWithAuth.mockImplementation(async url => url.endsWith('/api/ai/vision') ? response(invoice) : response({ error: 'Gasto rechazado' }, 409));
    render(<Scanner />);
    await analyze();
    expect(await screen.findByLabelText('Total Detectado (€)')).toHaveValue(0);
    fireEvent.change(screen.getByLabelText('Proveedor'), { target: { value: 'Corregido' } });
    fireEvent.change(screen.getByLabelText('Concepto'), { target: { value: 'Compra revisada' } });
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-09-18' } });
    fireEvent.change(screen.getByLabelText('Local'), { target: { value: 'Segundo Local' } });
    fireEvent.change(screen.getByLabelText('Total Detectado (€)'), { target: { value: '12.50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar Gasto Directamente' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Gasto rechazado');
    expect(screen.getByLabelText('Proveedor')).toHaveValue('Corregido');
    expect(screen.getByLabelText('Concepto')).toHaveValue('Compra revisada');
    expect(screen.getByLabelText('Fecha')).toHaveValue('2026-09-18');
    expect(screen.getByLabelText('Local')).toHaveValue('Segundo Local');
    expect(screen.getByLabelText('Total Detectado (€)')).toHaveValue(12.5);
    expect(writes()).toHaveLength(2);
    expect(screen.queryByText('Gasto registrado correctamente.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Descartar imagen y borrador' }));
    capture();
    expect(screen.queryByLabelText('Proveedor')).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Autorizo enviar/ })).not.toBeChecked();
  });
  it('locks controls and prevents duplicate analysis while a request is pending', async () => {
    let finish!: (r: Response) => void;
    mocks.fetchWithAuth.mockImplementation(() => new Promise<Response>(resolve => { finish = resolve; }));
    render(<Scanner />);
    await analyze();
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(screen.getByRole('button', { name: 'Solo PDF' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Descartar imagen y borrador' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Procesando...' }));
    expect(writes()).toHaveLength(1);
    await act(async () => finish(response(invoice)));
    expect(screen.getByLabelText('Proveedor')).toHaveValue('Proveedor de prueba');
  });
  it('rejects an unsupported file without creating or sending an image', () => {
    render(<Scanner />);
    fireEvent.change(screen.getByLabelText('Seleccionar imagen'), { target: { files: [new File(['x'], 'bad.svg', { type: 'image/svg+xml' })] } });
    expect(screen.getByRole('alert')).toHaveTextContent('JPEG, PNG o WebP');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(writes()).toHaveLength(0);
  });
  it('registers a reviewed expense once and only then clears the image', async () => {
    mocks.fetchWithAuth.mockImplementation(async url => response(url.endsWith('/api/ai/vision') ? invoice : { id: 8 }));
    render(<Scanner />);
    await analyze();
    await screen.findByLabelText('Proveedor');
    fireEvent.click(screen.getByRole('button', { name: 'Registrar Gasto Directamente' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Gasto registrado correctamente.'));
    expect(screen.queryByAltText('Vista previa')).not.toBeInTheDocument();
    const expenses = writes().filter(([url]) => url.endsWith('/api/gastos'));
    expect(expenses).toHaveLength(1);
    expect(JSON.parse(expenses[0][1].body)).toMatchObject({ total: '0', proveedor_nombre: 'Proveedor de prueba', concepto: 'Compra' });
  });
  it('does not publish a late analysis or create an expense after leaving the screen', async () => {
    let finish!: (r: Response) => void;
    mocks.fetchWithAuth.mockImplementation(() => new Promise<Response>(resolve => { finish = resolve; }));
    const view = render(<Scanner />);
    await analyze();
    await waitFor(() => expect(writes()).toHaveLength(1));
    view.unmount();
    await act(async () => finish(response(invoice)));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fixture');
    expect(writes()).toHaveLength(1);
  });
});
