import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import HandoverSummary from '../../apps/erp-web/src/components/HandoverSummary';
import { readHandoverSummary } from '../../apps/erp-web/src/handoverData';
const mocks = vi.hoisted(() => ({ fetchWithAuth: vi.fn(), user: { id: '3', role: 'employee', location: 'Principal' } }));
vi.mock('../../apps/erp-web/src/context/AuthContext', () => ({ useAuth: () => mocks }));
const fixture = () => ({ fecha: '2026-09-20', locales: [{ local: 'Principal', pendientes: 3, sin_leer: 2, asignados: 1, sin_responsable: 1, pasos: 8, completados: 3 }] });
const response = (data: unknown) => new Response(JSON.stringify(data));
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 8, 20, 12)); mocks.fetchWithAuth.mockReset().mockImplementation(async () => response(fixture())); });
afterEach(() => vi.useRealTimers());
it('shows explicit personal counters and filter links from one scoped read', async () => {
  render(<MemoryRouter><HandoverSummary /></MemoryRouter>);
  expect(await screen.findByText('3 avisos pendientes · 2 sin leer')).toBeVisible();
  expect(screen.getByText('Rutinas de hoy: 3 de 8 pasos completados')).toBeVisible();
  expect(screen.getByRole('link', { name: 'Mis pendientes (1)' })).toHaveAttribute('href', '/turno?avisos=mios');
  expect(mocks.fetchWithAuth.mock.calls[0][0]).toContain('local=Principal');
});
it('does not display counters for a different date or local', async () => {
  mocks.fetchWithAuth.mockImplementation(async () => response({ ...fixture(), fecha: '2026-09-19' }));
  render(<MemoryRouter><HandoverSummary /></MemoryRouter>);
  await screen.findByText(/No se ha podido verificar el relevo/);
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
it.each(['pendientes', 'sin_leer', 'asignados', 'sin_responsable', 'pasos', 'completados'] as const)('rejects invalid %s without publishing partial counters', async key => {
  const data = fixture(); data.locales[0][key] = -1;
  await expect(readHandoverSummary([response(data)])).rejects.toThrow();
});
it('rejects duplicate locals and impossible routine progress', async () => {
  const data = fixture(); data.locales.push(data.locales[0]);
  await expect(readHandoverSummary([response(data)])).rejects.toThrow();
  data.locales.pop(); data.locales[0].completados = 9;
  await expect(readHandoverSummary([response(data)])).rejects.toThrow();
});
