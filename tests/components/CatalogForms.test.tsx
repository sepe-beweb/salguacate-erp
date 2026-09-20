import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Inventory from '../../apps/erp-web/src/pages/Inventory';
import Providers from '../../apps/erp-web/src/pages/Providers';
import { emptyProduct, emptyProvider, readProductForm, readProviderForm } from '../../apps/erp-web/src/catalogForms';
import { useProductImage } from '../../apps/erp-web/src/hooks/useProductImage';

const mocks = vi.hoisted(() => ({ fetchWithAuth: vi.fn() }));
vi.mock('../../apps/erp-web/src/context/AuthContext', () => ({ useAuth: () => mocks }));
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const cancel = () => fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: true, cancelable: true }));
beforeEach(() => { mocks.fetchWithAuth.mockReset().mockImplementation(async () => response([])); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it.each(['', ' ', '-1', '1.5', '1e3', '0x10', '1000001', '9007199254740992', '2\n'])('rejects a product quantity without truncation: %j', stock_actual => {
  expect(() => readProductForm({ ...emptyProduct(), producto: 'Agua', stock_actual })).toThrow('cantidades enteras');
});
it('converts only valid form values and enforces name/provider limits', () => {
  expect(readProductForm({ ...emptyProduct('Segundo Local'), producto: ' Agua ', stock_actual: '1000000' })).toEqual({ ...emptyProduct('Segundo Local'), producto: 'Agua', stock_actual: 1000000, stock_minimo: 5, proveedor_id: null });
  for (const changes of [{ producto: 'a'.repeat(161) }, { proveedor_id: '1\n' }, { proveedor_id: '-1' }, { categoria: 'Otra' }, { local: 'Otro' }]) expect(() => readProductForm({ ...emptyProduct(), producto: 'Agua', ...changes })).toThrow();
  for (const changes of [{ nombre: ' ' }, { nombre: 'a'.repeat(161) }, { telefono: '1'.repeat(41) }, { email: 'a'.repeat(255) }, { categoria: '' }]) expect(() => readProviderForm({ ...emptyProvider(), nombre: 'Proveedor', ...changes })).toThrow();
  expect(readProviderForm({ ...emptyProvider(), nombre: ' Distribuidor ' }).nombre).toBe('Distribuidor');
});
it('opens an untouched product for the selected local and preserves the edited draft after closing or changing filters', async () => {
  render(<Inventory />); fireEvent.click(await screen.findByRole('button', { name: 'Salmón', exact: true }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Nuevo producto' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Nuevo producto' }));
  expect(screen.getByLabelText('Local')).toHaveValue('Segundo Local'); expect(screen.getByLabelText('Nombre del Producto')).toHaveFocus();
  fireEvent.change(screen.getByLabelText('Nombre del Producto'), { target: { value: 'Borrador' } });
  fireEvent.change(screen.getByLabelText('Stock Actual'), { target: { value: '1.5' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Guardar Producto' }).closest('form')!);
  expect(await screen.findByRole('alert')).toHaveTextContent('cantidades enteras'); expect(screen.getByLabelText('Stock Actual')).toHaveValue(1.5);
  cancel(); fireEvent.click(screen.getByRole('button', { name: 'Aguacate', exact: true }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Nuevo producto' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Nuevo producto' })); expect(screen.getByLabelText('Local')).toHaveValue('Segundo Local'); expect(screen.getByLabelText('Nombre del Producto')).toHaveValue('Borrador');
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  fireEvent.click(screen.getByRole('button', { name: 'Descartar borrador de producto' })); expect(screen.getByLabelText('Nombre del Producto')).toHaveValue('Borrador');
  confirm.mockReturnValue(true); fireEvent.click(screen.getByRole('button', { name: 'Descartar borrador de producto' })); expect(screen.getByLabelText('Nombre del Producto')).toHaveValue(''); expect(screen.getByLabelText('Local')).toHaveValue('Principal');
  expect(mocks.fetchWithAuth.mock.calls.every(([, options]) => !options?.method)).toBe(true);
});
it.each([['product', Inventory, 'Nuevo producto', 'Nombre del Producto', 'Guardar Producto'], ['supplier', Providers, 'Nuevo proveedor', 'Nombre / Empresa', 'Guardar Proveedor']] as const)('locks a pending %s, blocks Escape and preserves a rejected draft', async (_name, Component, open, label, save) => {
  let finish!: (value: Response) => void;
  mocks.fetchWithAuth.mockImplementation(async (_url, options) => options?.method === 'POST' ? new Promise<Response>(resolve => { finish = resolve; }) : response([]));
  render(<Component />); fireEvent.click(await screen.findByRole('button', { name: open }));
  fireEvent.change(screen.getByLabelText(label), { target: { value: 'Borrador completo' } });
  const form = screen.getByRole('button', { name: save }).closest('form')!;
  act(() => { fireEvent.submit(form); fireEvent.submit(form); });
  expect(screen.getByLabelText(label)).toBeDisabled(); cancel(); expect(screen.getByRole('dialog')).toBeVisible();
  expect(mocks.fetchWithAuth.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
  await act(async () => finish(response({ error: 'Rechazado' }, 400)));
  expect(await screen.findByRole('alert')).toHaveTextContent('Rechazado'); expect(screen.getByLabelText(label)).toHaveValue('Borrador completo');
  cancel(); fireEvent.click(screen.getByRole('button', { name: open })); expect(screen.getByLabelText(label)).toHaveValue('Borrador completo');
});
it('keeps the product dialog open through a background refresh and exposes read failure inside it', async () => {
  render(<Inventory />); fireEvent.click(await screen.findByRole('button', { name: 'Nuevo producto' }));
  fireEvent.change(screen.getByLabelText('Nombre del Producto'), { target: { value: 'Borrador' } });
  mocks.fetchWithAuth.mockImplementation(async () => response({ error: 'Catálogo no disponible' }, 503));
  act(() => window.dispatchEvent(new Event('ai_action_executed')));
  expect(screen.getByRole('dialog')).toBeVisible(); expect(await screen.findByRole('alert')).toHaveTextContent('Catálogo no disponible');
  expect(screen.getByLabelText('Nombre del Producto')).toHaveValue('Borrador'); expect(screen.getByRole('button', { name: 'Guardar Producto' })).toBeDisabled();
});

class ControlledReader {
  static instances: ControlledReader[] = [];
  readyState = 0; result: string | ArrayBuffer | null = null;
  onload: (() => void) | null = null; onerror: (() => void) | null = null; onabort: (() => void) | null = null;
  constructor() { ControlledReader.instances.push(this); }
  readAsDataURL() { this.readyState = 1; }
  abort = vi.fn(() => { this.readyState = 2; this.onabort?.(); });
  finish(value = 'data:image/png;base64,AQID') { this.result = value; this.readyState = 2; this.onload?.(); }
}
it('ignores older image completions after a newer selection, cancel, clear and unmount', () => {
  ControlledReader.instances = []; vi.stubGlobal('FileReader', ControlledReader);
  const { result, unmount } = renderHook(() => useProductImage()); const file = new File(['fixture'], 'photo.png', { type: 'image/png' });
  act(() => result.current.read(file)); const first = ControlledReader.instances[0];
  act(() => result.current.read(file)); const second = ControlledReader.instances[1]; expect(first.abort).toHaveBeenCalledOnce();
  act(() => first.finish()); expect(result.current.value).toBe(''); expect(result.current.reading).toBe(true);
  act(() => second.finish('data:image/png;base64,BAUG')); expect(result.current.value).toBe('data:image/png;base64,BAUG');
  act(() => result.current.read(file)); const third = ControlledReader.instances[2];
  act(() => result.current.cancel()); act(() => third.finish()); expect(result.current.value).toBe(''); expect(result.current.error).toContain('cancelada');
  act(() => result.current.clear()); expect(result.current.error).toBe('');
  act(() => result.current.read(file)); const fourth = ControlledReader.instances[3]; unmount(); expect(fourth.abort).toHaveBeenCalledOnce(); act(() => fourth.finish());
});
it('rejects invalid files and failed reads, and clears a previous image on a new selection', () => {
  ControlledReader.instances = []; vi.stubGlobal('FileReader', ControlledReader);
  const { result } = renderHook(() => useProductImage());
  act(() => result.current.read(new File(['x'], 'file.svg', { type: 'image/svg+xml' }))); expect(result.current.error).toContain('PNG o JPEG'); expect(ControlledReader.instances).toHaveLength(0);
  act(() => result.current.read(new File(['x'], 'file.png', { type: 'image/png' }))); act(() => ControlledReader.instances[0].finish()); expect(result.current.value).not.toBe('');
  act(() => result.current.read(new File(['x'], 'file.png', { type: 'image/png' }))); expect(result.current.value).toBe('');
  act(() => ControlledReader.instances[1].onerror?.()); expect(result.current.reading).toBe(false); expect(result.current.error).toContain('No se pudo leer');
});
