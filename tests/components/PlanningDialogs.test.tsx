import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ModalDialog from '../../apps/erp-web/src/components/ModalDialog';
import Tasks from '../../apps/erp-web/src/pages/Tasks';
import ManagerCalendar from '../../apps/erp-web/src/pages/ManagerCalendar';

const mocks = vi.hoisted(() => ({ fetchWithAuth: vi.fn() }));
vi.mock('../../apps/erp-web/src/context/AuthContext', () => ({ useAuth: () => mocks }));
const response = (body: unknown) => new Response(JSON.stringify(body));
const event = { id: 1, titulo: 'Evento guardado', fecha: '2024-02-29', hora: '10:00', tipo: 'General', descripcion: '' };
const cancel = (dialog: HTMLElement) => fireEvent(dialog, new Event('cancel', { bubbles: true, cancelable: true }));
beforeEach(() => { mocks.fetchWithAuth.mockReset().mockImplementation(async url => response(url.endsWith('/eventos') ? [event] : [])); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('Native planning dialogs', () => {
  it('preserves an incompatible assignee while explaining and blocking the task until its local is corrected', async () => {
    mocks.fetchWithAuth.mockImplementation(async url => response(url.endsWith('/usuarios') ? [{ id: 3, nombre: 'María', rol: 'employee', local: 'Principal' }] : []));
    render(<Tasks />); await waitFor(() => expect(screen.getByRole('button', { name: 'Nueva' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Nueva' }));
    fireEvent.change(screen.getByLabelText('Asignar a'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Local'), { target: { value: 'Segundo Local' } });
    expect(screen.getByRole('alert')).toHaveTextContent('no pertenece al local');
    expect(screen.getByLabelText('Asignar a')).toHaveValue('3');
    expect(screen.getByRole('option', { name: 'María · Aguacate' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Crear Tarea' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Local'), { target: { value: 'Principal' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear Tarea' })).toBeEnabled();
    expect(mocks.fetchWithAuth.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
  });
  it('focuses the designated field, blocks cancellation while busy, and preserves focus on rerender', () => {
    const close = vi.fn(); const view = render(<ModalDialog label="Editor" busy onClose={close}><input data-autofocus aria-label="Campo" /></ModalDialog>);
    expect(screen.getByLabelText('Campo')).toHaveFocus();
    cancel(screen.getByRole('dialog')); expect(close).not.toHaveBeenCalled();
    view.rerender(<ModalDialog label="Editor" onClose={close}><input data-autofocus aria-label="Campo" /></ModalDialog>);
    cancel(screen.getByRole('dialog')); expect(close).toHaveBeenCalledTimes(1);
  });
  it('preserves the task draft on Escape and discards only after confirmation', async () => {
    render(<Tasks />); await waitFor(() => expect(screen.getByRole('button', { name: 'Nueva' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Nueva' }));
    fireEvent.change(screen.getByLabelText('Tarea'), { target: { value: 'Borrador completo' } });
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2024-02-29' } });
    cancel(screen.getByRole('dialog')); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Nueva' }));
    expect(screen.getByLabelText('Tarea')).toHaveValue('Borrador completo'); expect(screen.getByLabelText('Fecha')).toHaveValue('2024-02-29');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(screen.getByRole('button', { name: 'Descartar borrador' })); expect(screen.getByLabelText('Tarea')).toHaveValue('Borrador completo');
    confirm.mockReturnValue(true); fireEvent.click(screen.getByRole('button', { name: 'Descartar borrador' })); expect(screen.getByLabelText('Tarea')).toHaveValue('');
    expect(mocks.fetchWithAuth.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
  });
  it('defaults an untouched task to the opening date, even if the screen mounted yesterday', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2024, 1, 29, 23, 59));
    render(<Tasks />); await waitFor(() => expect(screen.getByRole('button', { name: 'Nueva' })).toBeEnabled());
    vi.setSystemTime(new Date(2024, 2, 1, 0, 1)); fireEvent.click(screen.getByRole('button', { name: 'Nueva' }));
    expect(screen.getByLabelText('Fecha')).toHaveValue('2024-03-01');
  });
  it('resumes an event edit and requires confirmation before replacing it with a new event', async () => {
    render(<ManagerCalendar />); fireEvent.click(await screen.findByRole('button', { name: 'Editar' }));
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Edición pendiente' } });
    cancel(screen.getByRole('dialog')); fireEvent.click(screen.getByRole('button', { name: 'Retomar borrador de evento' }));
    expect(screen.getByRole('dialog', { name: 'Editar Evento' })).toBeVisible(); expect(screen.getByLabelText('Título')).toHaveValue('Edición pendiente');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar evento' }));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo' })); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retomar borrador de evento' })).toBeVisible();
    confirm.mockReturnValue(true); fireEvent.click(screen.getByRole('button', { name: 'Nuevo' }));
    expect(screen.getByRole('dialog', { name: 'Añadir a la Agenda' })).toBeVisible(); expect(screen.getByLabelText('Título')).toHaveValue('');
  });
});
