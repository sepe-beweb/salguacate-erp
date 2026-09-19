import { lazy, Suspense } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import ScreenBoundary from '../../apps/erp-web/src/components/ScreenBoundary';

afterEach(() => { vi.restoreAllMocks(); });
const BrokenScreen = () => { throw new Error('internal-url-and-private-details'); };
beforeEach(() => {
  // React 18 reports caught render errors to the jsdom window as well. Silence
  // only these two injected fixtures; unexpected errors must still fail loudly.
  const expectedError = (event: ErrorEvent) => {
    if (['internal-url-and-private-details', 'missing-chunk-private-path'].includes(event.error?.message)) event.preventDefault();
  };
  window.addEventListener('error', expectedError);
  return () => window.removeEventListener('error', expectedError);
});

describe('Screen loading boundary', () => {
  it('shows pending status without replacing the surrounding layout', async () => {
    let resolve!: (value: { default: () => JSX.Element }) => void;
    const Page = lazy(() => new Promise<{ default: () => JSX.Element }>(done => { resolve = done; }));
    render(<><nav>Menú disponible</nav><ScreenBoundary onHome={vi.fn()}><Suspense fallback={<p role="status">Cargando pantalla...</p>}><Page /></Suspense></ScreenBoundary></>);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando pantalla...');
    expect(screen.getByRole('navigation')).toHaveTextContent('Menú disponible');
    await act(async () => resolve({ default: () => <h2>Pantalla cargada</h2> }));
    expect(await screen.findByRole('heading', { name: 'Pantalla cargada' })).toBeVisible();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('catches a rejected module without automatic retry and leaves sibling draft intact', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const loader = vi.fn(() => Promise.reject(new Error('missing-chunk-private-path')));
    const Page = lazy(loader);
    render(<><input aria-label="Borrador externo" defaultValue="No perder" /><ScreenBoundary onHome={vi.fn()}><Suspense fallback={<p>Cargando</p>}><Page /></Suspense></ScreenBoundary></>);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo mostrar esta pantalla');
    expect(screen.getByLabelText('Borrador externo')).toHaveValue('No perder');
    expect(screen.queryByText(/missing-chunk-private-path/)).not.toBeInTheDocument();
    expect(loader).toHaveBeenCalledOnce();
  });

  it('catches render errors and offers navigation without exposing the exception', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const home = vi.fn();
    render(<ScreenBoundary onHome={home}><BrokenScreen /></ScreenBoundary>);
    expect(screen.getByRole('alert')).not.toHaveTextContent('internal-url-and-private-details');
    fireEvent.click(screen.getByRole('button', { name: 'Volver al inicio' }));
    expect(home).toHaveBeenCalledOnce();
  });

  it('only resets a failed screen when its route or identity key changes', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const view = render(<ScreenBoundary key="1:owner:/broken" onHome={vi.fn()}><BrokenScreen /></ScreenBoundary>);
    view.rerender(<ScreenBoundary key="1:owner:/broken" onHome={vi.fn()}><h2>Contenido nuevo</h2></ScreenBoundary>);
    expect(screen.getByRole('alert')).toBeVisible();
    view.rerender(<ScreenBoundary key="1:owner:/other" onHome={vi.fn()}><h2>Otra pantalla</h2></ScreenBoundary>);
    expect(screen.getByRole('heading', { name: 'Otra pantalla' })).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('requires confirmation of session and draft loss before a reload', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ScreenBoundary onHome={vi.fn()}><BrokenScreen /></ScreenBoundary>);
    expect(confirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Recargar aplicación' }));
    expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/sesión.*borradores.*PDF/));
    expect(screen.getByRole('alert')).toBeVisible();
  });
});
