import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import Documents from '../../apps/erp-web/src/pages/Documents';
import DocumentUpload from '../../apps/erp-web/src/components/DocumentUpload';
import DocumentDetail from '../../apps/erp-web/src/components/DocumentDetail';
import DocumentImage from '../../apps/erp-web/src/components/DocumentImage';
import DocumentPackage from '../../apps/erp-web/src/components/DocumentPackage';
import { readDocumentPackage } from '../../apps/erp-web/src/documentPackageData';
import { readDocumentPage, readDocumentDetail, validateDocumentFiles, emptyDocument, includePendingTag } from '../../apps/erp-web/src/documentData';

const mocks = vi.hoisted(() => ({ fetchWithAuth: vi.fn(), user: { id: '1', role: 'owner', location: 'Todos' } }));
vi.mock('../../apps/erp-web/src/context/AuthContext', () => ({ useAuth: () => mocks }));
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const review = { revision_estado: 'pendiente' as const, revision_responsable_id: null, revision_responsable_nombre: null, revision_fecha_limite: null, revision_notas: '', revisado_por: null, revisado_nombre: null, revisado_en: null };
const doc = { ...emptyDocument('Principal'), ...review, titulo: 'Factura de pan', etiquetas: ['pagado'], id: 7, gasto_id: null, nombre_archivo: 'factura.pdf', mime: 'application/pdf', bytes: 30, autor_id: 1, autor_nombre: 'Felipe', proveedor_nombre: null, creado_en: '2026-09-20 10:00:00', actualizado_en: '2026-09-20 10:00:00', revision: 1, archivado: 0 };
const detail = { ...doc, cambios: [{ id: 1, detalle: 'Documento incorporado', creado_en: '2026-09-20 10:00:00', actor_nombre: 'Felipe' }] };
const records = (items = [doc]) => ({ items, total: items.length, pagina: 1, por_pagina: 24, resumen: { activos: items.length, pendientes: items.length, en_revision: 0, revisados: 0, vencidos: 0, sin_asignar: items.length } });
const file = () => new File(['%PDF-1.4\n%%EOF'], 'factura.pdf', { type: 'application/pdf' });
const writes = () => mocks.fetchWithAuth.mock.calls.filter(([, options]) => options?.method);
beforeEach(() => { mocks.fetchWithAuth.mockReset(); mocks.user.role = 'owner'; mocks.user.location = 'Todos'; vi.stubGlobal('URL', class extends URL { static createObjectURL() { return 'blob:test'; } static revokeObjectURL() {} }); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('reads a complete archive and applies filters only on explicit submission', async () => {
  mocks.fetchWithAuth.mockImplementation(async url => String(url).includes('/api/proveedores') ? response([]) : response(records()));
  render(<MemoryRouter><Documents /></MemoryRouter>);
  await screen.findByRole('button', { name: 'Abrir Factura de pan' });
  fireEvent.change(screen.getByLabelText('Etiqueta exacta'), { target: { value: 'pagado' } });
  expect(mocks.fetchWithAuth.mock.calls.some(([url]) => String(url).includes('etiqueta=pagado'))).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
  await waitFor(() => expect(mocks.fetchWithAuth.mock.calls.some(([url]) => String(url).includes('etiqueta=pagado'))).toBe(true));
  expect(writes()).toHaveLength(0);
});
it('does not expose a partial archive when its provider list fails', async () => {
  mocks.fetchWithAuth.mockImplementation(async url => String(url).includes('/api/proveedores') ? response({ error: 'Proveedores no disponibles' }, 503) : response(records()));
  render(<MemoryRouter><Documents /></MemoryRouter>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Proveedores no disponibles');
  expect(screen.queryByRole('button', { name: 'Abrir Factura de pan' })).not.toBeInTheDocument(); expect(screen.queryByText('No hay documentos en esta selección')).not.toBeInTheDocument();
});
it('limits the manager selector to their local and preserves an expense filter', async () => {
  mocks.user.role = 'manager'; mocks.user.location = 'Principal'; mocks.fetchWithAuth.mockImplementation(async url => String(url).includes('/api/proveedores') ? response([]) : response(records()));
  render(<MemoryRouter initialEntries={['/documentos?gasto=8&local=Segundo%20Local']}><Documents /></MemoryRouter>);
  await screen.findByRole('button', { name: 'Abrir Factura de pan' });
  expect(screen.getByLabelText('Local del archivo').querySelectorAll('option')).toHaveLength(1);
  expect(mocks.fetchWithAuth.mock.calls.some(([url]) => String(url).includes('local=Principal') && String(url).includes('gasto=8'))).toBe(true);
});
it.each([{ ...doc, tipo: 'unknown' }, { ...doc, fecha: '2026-02-30' }, { ...doc, bytes: -1 }, { ...doc, etiquetas: ['x', 'x'] }, { ...doc, mime: 'text/html' }, { ...doc, archivado: 2 }, null])('rejects malformed document records', async value => {
  await expect(readDocumentPage(response(records([value as typeof doc])))).rejects.toThrow();
});
it('rejects duplicate rows and broken history instead of showing partial data', async () => {
  await expect(readDocumentPage(response(records([doc, doc])))).rejects.toThrow();
  await expect(readDocumentDetail(response({ ...detail, cambios: [{ ...detail.cambios[0], creado_en: 'yesterday' }] }))).rejects.toThrow();
});
it('rejects mixed PDFs and photos, oversized documents and too many pages locally', () => {
  expect(() => validateDocumentFiles([file(), new File(['png'], 'x.png', { type: 'image/png' })])).toThrow(/mezcles/);
  expect(() => validateDocumentFiles(Array(11).fill(file()))).toThrow();
  expect(() => validateDocumentFiles([new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'big.pdf', { type: 'application/pdf' })])).toThrow();
});
it('retains a failed upload and retries the exact key and body without another creation', async () => {
  const saved = vi.fn(); let posts = 0;
  mocks.fetchWithAuth.mockImplementation(async (_url, options) => { if (options?.method) { posts++; if (posts === 1) throw new Error('Conexión perdida'); return response({ id: 7 }, 201); } return response([]); });
  render(<MemoryRouter><DocumentUpload initialFile={file()} local="Principal" onSaved={saved} onClose={vi.fn()} /></MemoryRouter>);
  await screen.findByLabelText('Título', { exact: true }); fireEvent.change(screen.getByLabelText('Título', { exact: true }), { target: { value: 'Factura pendiente' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar en Documentos' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Conexión perdida'); expect(screen.getByLabelText('Título', { exact: true })).toHaveValue('Factura pendiente'); expect(screen.getByLabelText('Título', { exact: true })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar guardado pendiente' }));
  await waitFor(() => expect(saved).toHaveBeenCalledWith(7)); expect(writes()).toHaveLength(2);
  expect(writes()[0][1].body).toBe(writes()[1][1].body); expect(writes()[0][1].headers['Idempotency-Key']).toBe(writes()[1][1].headers['Idempotency-Key']);
});
it('allows correcting a definite validation failure while retaining the file and classification', async () => {
  mocks.fetchWithAuth.mockImplementation(async (_url, options) => options?.method ? response({ error: 'Revisa el proveedor' }, 400) : response([]));
  render(<MemoryRouter><DocumentUpload initialFile={file()} local="Principal" onSaved={vi.fn()} onClose={vi.fn()} /></MemoryRouter>);
  await screen.findByLabelText('Título', { exact: true }); fireEvent.click(screen.getByRole('button', { name: 'Guardar en Documentos' }));
  await screen.findByRole('alert'); expect(screen.getByLabelText('Título', { exact: true })).not.toBeDisabled(); expect(screen.getByText(/1\. factura.pdf/)).toBeVisible();
});
it('does not publish a late upload confirmation after the dialog unmounts', async () => {
  let finish!: (r: Response) => void; const saved = vi.fn(); mocks.fetchWithAuth.mockImplementation(async (_url, options) => options?.method ? new Promise<Response>(resolve => { finish = resolve; }) : response([]));
  const view = render(<MemoryRouter><DocumentUpload initialFile={file()} local="Principal" onSaved={saved} onClose={vi.fn()} /></MemoryRouter>);
  await screen.findByLabelText('Título', { exact: true }); fireEvent.click(screen.getByRole('button', { name: 'Guardar en Documentos' }));
  await waitFor(() => expect(writes()).toHaveLength(1)); view.unmount(); finish(response({ id: 7 }, 201)); await new Promise(resolve => setTimeout(resolve, 0)); expect(saved).not.toHaveBeenCalled();
});
it('preserves metadata edits on conflict and does not repeat the write when refreshing', async () => {
  mocks.fetchWithAuth.mockImplementation(async (url, options) => options?.method ? response({ error: 'El documento ha cambiado' }, 409) : String(url).endsWith('/api/documentos/7') ? response(detail) : String(url).endsWith('/archivo') ? response({ error: 'No disponible' }, 503) : response([]));
  render(<MemoryRouter><DocumentDetail id={7} onClose={vi.fn()} onChanged={vi.fn()} /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Clasificación', exact: true }));
  fireEvent.change(screen.getByLabelText('Título', { exact: true }), { target: { value: 'Cambio sin perder' } }); fireEvent.click(screen.getByRole('button', { name: 'Guardar clasificación' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('El documento ha cambiado'); expect(screen.getByLabelText('Título', { exact: true })).toHaveValue('Cambio sin perder');
  expect(writes()).toHaveLength(1);
});

const detailReads = (url: string) => url.endsWith('/api/documentos/7') ? response(detail) : url.endsWith('/archivo') ? response({ error: 'No disponible' }, 503) : response([]);
it('confirms closing a dirty classification and retains a declined draft across sections', async () => {
  const close = vi.fn(); const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  mocks.fetchWithAuth.mockImplementation(async url => detailReads(String(url)));
  render(<MemoryRouter><DocumentDetail id={7} onClose={close} onChanged={vi.fn()} /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Clasificación', exact: true }));
  fireEvent.change(screen.getByLabelText('Título', { exact: true }), { target: { value: 'Borrador protegido' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar ficha' })); expect(confirm).toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Historial', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Clasificación', exact: true }));
  expect(screen.getByLabelText('Título', { exact: true })).toHaveValue('Borrador protegido'); expect(writes()).toHaveLength(0);
  confirm.mockReturnValue(true); fireEvent.click(screen.getByRole('button', { name: 'Cerrar ficha' })); expect(close).toHaveBeenCalledTimes(1);
});
it('protects an upload with only notes and incorporates the pending tag on save', async () => {
  const close = vi.fn(); vi.spyOn(window, 'confirm').mockReturnValue(false);
  mocks.fetchWithAuth.mockImplementation(async (_url, options) => options?.method ? response({ id: 7 }, 201) : response([]));
  render(<MemoryRouter><DocumentUpload local="Principal" onClose={close} onSaved={vi.fn()} /></MemoryRouter>);
  fireEvent.change(await screen.findByLabelText('Notas', { exact: true }), { target: { value: 'No perder' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar', exact: true })); expect(close).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Seleccionar PDF o imágenes'), { target: { files: [file()] } });
  fireEvent.change(screen.getByLabelText('Nueva etiqueta'), { target: { value: 'GESTORÍA' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar en Documentos' }));
  await waitFor(() => expect(writes()).toHaveLength(1)); expect(JSON.parse(writes()[0][1].body).etiquetas).toEqual(['gestoría']);
});
it('keeps a confirmed receipt visible if refreshing the saved document fails', async () => {
  let saved = false;
  mocks.fetchWithAuth.mockImplementation(async (url, options) => {
    if (options?.method) { saved = true; return response({ mensaje: 'Clasificación guardada.' }); }
    if (saved && String(url).endsWith('/api/documentos/7')) return response({ error: 'Lectura no disponible' }, 503);
    return detailReads(String(url));
  });
  render(<MemoryRouter><DocumentDetail id={7} onClose={vi.fn()} onChanged={vi.fn()} /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Clasificación', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Guardar clasificación' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Lectura no disponible');
  expect(screen.getByRole('status')).toHaveTextContent('El servidor ha confirmado el cambio'); expect(writes()).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar ficha desde el servidor' }));
  await screen.findByRole('alert'); expect(writes()).toHaveLength(1);
});
it('keeps the classification section selected after saving and includes a pending tag', async () => {
  let saved = false;
  mocks.fetchWithAuth.mockImplementation(async (url, options) => {
    if (options?.method) { saved = true; return response({ mensaje: 'Clasificación guardada.' }); }
    if (saved && String(url).endsWith('/api/documentos/7')) return response({ ...detail, revision: 2, etiquetas: ['pagado', 'revisar'] });
    return detailReads(String(url));
  });
  render(<MemoryRouter><DocumentDetail id={7} onClose={vi.fn()} onChanged={vi.fn()} /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Clasificación', exact: true }));
  fireEvent.change(screen.getByLabelText('Nueva etiqueta'), { target: { value: 'revisar' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar clasificación' }));
  await screen.findByRole('button', { name: 'Quitar etiqueta revisar' });
  expect(screen.getByRole('button', { name: 'Clasificación', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(JSON.parse(writes()[0][1].body).etiquetas).toEqual(['pagado', 'revisar']);
});
it('clears a selected expense when its search changes and blocks writes over classification drafts', async () => {
  const expense = { id: 1, fecha: '2026-09-20', local: 'Principal', proveedor_nombre: 'Pan', concepto: 'Compra', total: 12 };
  mocks.fetchWithAuth.mockImplementation(async url => String(url).endsWith('/api/gastos') ? response([expense]) : detailReads(String(url)));
  render(<MemoryRouter><DocumentDetail id={7} onClose={vi.fn()} onChanged={vi.fn()} /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Clasificación', exact: true }));
  fireEvent.change(screen.getByLabelText('Notas', { exact: true }), { target: { value: 'Clasificación pendiente' } });
  fireEvent.click(screen.getByRole('button', { name: 'Gasto vinculado', exact: true }));
  fireEvent.change(screen.getByLabelText('Gasto del local'), { target: { value: '1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Vincular gasto seleccionado' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Guarda primero la clasificación'); expect(writes()).toHaveLength(0);
  fireEvent.change(screen.getByLabelText('Buscar gasto'), { target: { value: 'Sin coincidencias' } });
  expect(screen.getByLabelText('Gasto del local')).toHaveValue(''); expect(screen.getByRole('button', { name: 'Vincular gasto seleccionado' })).toBeDisabled();
});
it('asks before a classification save can discard an expense draft', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(false); mocks.fetchWithAuth.mockImplementation(async url => detailReads(String(url)));
  render(<MemoryRouter><DocumentDetail id={7} onClose={vi.fn()} onChanged={vi.fn()} /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Gasto vinculado', exact: true }));
  fireEvent.change(screen.getByLabelText('Importe total (€)'), { target: { value: '9.99' } });
  fireEvent.click(screen.getByRole('button', { name: 'Clasificación', exact: true })); fireEvent.click(screen.getByRole('button', { name: 'Guardar clasificación' }));
  expect(writes()).toHaveLength(0); fireEvent.click(screen.getByRole('button', { name: 'Gasto vinculado', exact: true })); expect(screen.getByLabelText('Importe total (€)')).toHaveValue(9.99);
});
it('restores applied filters with browser history and honors a server-clamped page', async () => {
  function Back() { const navigate = useNavigate(); return <button onClick={() => navigate(-1)}>Atrás navegador</button>; }
  mocks.fetchWithAuth.mockImplementation(async url => String(url).includes('/api/proveedores') ? response([]) : response(records()));
  render(<MemoryRouter initialEntries={['/documentos?local=Principal&pagina=9']}><Back /><Documents /></MemoryRouter>);
  await screen.findByText('1 documento encontrado · Página 1 de 1'); expect(screen.getByRole('button', { name: 'Anterior', exact: true })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Local del archivo'), { target: { value: 'Segundo Local' } });
  fireEvent.change(screen.getByLabelText('Vínculo contable'), { target: { value: 'sin_gasto' } });
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
  await waitFor(() => expect(mocks.fetchWithAuth.mock.calls.some(([url]) => String(url).includes('vinculo=sin_gasto'))).toBe(true));
  fireEvent.click(screen.getByRole('button', { name: 'Atrás navegador' }));
  await waitFor(() => expect(screen.getByLabelText('Local del archivo')).toHaveValue('Principal')); expect(screen.getByLabelText('Vínculo contable')).toHaveValue('');
});
it('enlarges an image in its own keyboard viewport and reports decode failure', () => {
  render(<DocumentImage url="blob:document" title="Factura sintética" />);
  fireEvent.click(screen.getByRole('button', { name: 'Ampliar imagen' }));
  expect(screen.getByRole('button', { name: 'Ajustar imagen' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('region', { name: 'Vista de Factura sintética' })).toHaveAttribute('tabindex', '0');
  fireEvent.error(screen.getByRole('img')); expect(screen.getByRole('alert')).toHaveTextContent('No se puede mostrar esta imagen');
});
it('never drops a pending tag when the classification is full', () => {
  const full = { ...emptyDocument('Principal'), etiquetas: Array.from({ length: 12 }, (_, n) => String(n)) };
  expect(() => includePendingTag(full, 'otra')).toThrow(/12 etiquetas/);
  expect(includePendingTag(full, '1').etiquetas).toHaveLength(12);
});
it.each(['2026-02-30 10:00:00', '2026-09-20 25:00:00', '2026-09-20T10:00:00', '2026-09-20 10:00:00 trailing'])('rejects an invalid recorded timestamp %s', async stamp => {
  await expect(readDocumentDetail(response({ ...detail, creado_en: stamp }))).rejects.toThrow();
});
it.each([{ items: [], total: 3, pagina: 1, por_pagina: 24 }, { items: [doc], total: 25, pagina: 1, por_pagina: 24 }, { items: [], total: 0, pagina: 2, por_pagina: 24 }])('rejects incomplete or impossible archive pages', async page => {
  await expect(readDocumentPage(response(page))).rejects.toThrow(/lista parcial/);
});

const packagePreview = { local: 'Principal', mes: '2026-09', incluir_pendientes: false, huella: 'a'.repeat(64), total: 1, bytes: 30, documentos: [{ id: 7, titulo: 'Factura de pan', local: 'Aguacate', fecha: '2026-09-20', revision_estado: 'revisado', archivo: 'Aguacate/2026-09/factura_proveedor/documento-000007.pdf', bytes: 30, sha256: 'b'.repeat(64) }] };
it.each([
  { ...packagePreview, bytes: 31 },
  { ...packagePreview, documentos: [{ ...packagePreview.documentos[0], revision_estado: 'pendiente' }] },
  { ...packagePreview, documentos: [{ ...packagePreview.documentos[0], archivo: '../factura.pdf' }] },
  { ...packagePreview, documentos: [{ ...packagePreview.documentos[0], fecha: '2026-10-01' }] },
])('rejects incomplete or inconsistent package previews', async value => {
  await expect(readDocumentPackage(response(value))).rejects.toThrow(/descarga parcial/);
});
it('keeps review observations after a conflict and protects them when closing or saving classification', async () => {
  const close = vi.fn(); vi.spyOn(window, 'confirm').mockReturnValue(false);
  mocks.fetchWithAuth.mockImplementation(async (url, options) => options?.method ? response({ error: 'Otro usuario modificó este documento' }, 409) : detailReads(String(url)));
  render(<MemoryRouter><DocumentDetail id={7} startReview onClose={close} onChanged={vi.fn()} /></MemoryRouter>);
  fireEvent.change(await screen.findByLabelText('Observaciones de revisión'), { target: { value: 'Consultar con Dora' } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar revisión' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Guardar revisión' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Otro usuario');
  expect(screen.getByLabelText('Observaciones de revisión')).toHaveValue('Consultar con Dora');
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar ficha' })); expect(close).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Clasificación', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Guardar clasificación' }));
  expect(writes()).toHaveLength(1);
});
it('requires a fresh preview after changing package scope and releases the prepared download', async () => {
  const revoke = vi.spyOn(URL, 'revokeObjectURL');
  mocks.fetchWithAuth.mockImplementation(async (_url, options) => options?.method ? new Response(new Uint8Array(30), { headers: { 'Content-Type': 'application/zip' } }) : response(packagePreview));
  const mounted = render(<MemoryRouter><DocumentPackage local="Principal" onClose={vi.fn()} /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Mes documental'), { target: { value: '2026-09' } });
  fireEvent.click(screen.getByRole('button', { name: 'Consultar selección' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Preparar ZIP' }));
  expect(await screen.findByRole('link', { name: 'Descargar ZIP' })).toHaveAttribute('href', 'blob:test');
  expect(JSON.parse(writes()[0][1].body)).toEqual({ local: 'Principal', mes: '2026-09', incluir_pendientes: false, huella: packagePreview.huella });
  fireEvent.change(screen.getByLabelText('Mes documental'), { target: { value: '2026-10' } });
  expect(screen.queryByRole('link', { name: 'Descargar ZIP' })).not.toBeInTheDocument();
  expect(revoke).toHaveBeenCalledWith('blob:test'); expect(writes()).toHaveLength(1); mounted.unmount();
});
it('never offers a ZIP after a stale selection or an invalid content response', async () => {
  let attempt = 0;
  mocks.fetchWithAuth.mockImplementation(async (_url, options) => options?.method ? (++attempt === 1 ? response({ error: 'La selección ha cambiado' }, 409) : new Response('No es un ZIP', { headers: { 'Content-Type': 'text/html' } })) : response(packagePreview));
  render(<MemoryRouter><DocumentPackage local="Principal" onClose={vi.fn()} /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Mes documental'), { target: { value: '2026-09' } });
  fireEvent.click(screen.getByRole('button', { name: 'Consultar selección' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Preparar ZIP' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('La selección ha cambiado');
  fireEvent.click(screen.getByRole('button', { name: 'Preparar ZIP' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('ZIP válido'));
  expect(screen.queryByRole('link', { name: 'Descargar ZIP' })).not.toBeInTheDocument();
});
it('limits the manager package to their venue and excludes unreviewed documents by default', () => {
  mocks.user.role = 'manager'; mocks.user.location = 'Segundo Local';
  render(<MemoryRouter><DocumentPackage local="Todos" onClose={vi.fn()} /></MemoryRouter>);
  expect(screen.getByLabelText('Local del paquete')).toHaveValue('Segundo Local');
  expect(screen.getByLabelText('Local del paquete').querySelectorAll('option')).toHaveLength(1);
  expect(screen.getByRole('checkbox')).not.toBeChecked(); expect(mocks.fetchWithAuth).not.toHaveBeenCalled();
});
it('rejects a response for another month or venue even when otherwise valid', async () => {
  await expect(readDocumentPackage(response(packagePreview), { local: 'Principal', mes: '2026-10', incluir_pendientes: false })).rejects.toThrow(/alcance solicitado/);
  await expect(readDocumentPackage(response({ ...packagePreview, local: 'Segundo Local' }))).rejects.toThrow(/alcance solicitado/);
});
