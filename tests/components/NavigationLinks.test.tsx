import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import NavigationLinks from '../../apps/erp-web/src/components/NavigationLinks';
import type { Role } from '../../apps/erp-web/src/context/AuthContext';
function Path() { return <output aria-label="Ruta actual">{useLocation().pathname}</output>; }
it.each(['owner', 'manager'] as const)('keeps the complete existing management navigation for %s', role => {
  const selected = vi.fn(); render(<MemoryRouter initialEntries={['/rrhh']}><NavigationLinks role={role} onNavigate={selected} includeSettings /><Path /></MemoryRouter>);
  expect(screen.getAllByRole('button')).toHaveLength(15);
  expect(screen.getByRole('button', { name: 'Recursos Humanos' })).toHaveAttribute('aria-current', 'page');
  expect(screen.queryByRole('button', { name: 'Solicitudes' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Informes Mensuales' })); expect(screen.getByLabelText('Ruta actual')).toHaveTextContent('/informes'); expect(selected).toHaveBeenCalledOnce();
  expect(screen.getByRole('button', { name: 'Informes Mensuales' })).toHaveAttribute('aria-current', 'page');
});
it('limits employee navigation to the five personal routes and optional settings', () => {
  render(<MemoryRouter><NavigationLinks role="employee" includeSettings /></MemoryRouter>);
  expect(screen.getAllByRole('button').map(button => button.textContent?.trim())).toEqual(['Inicio', 'Turnos Asignados', 'Control Horario', 'Buzón Interno', 'Solicitudes', 'Ajustes']);
  expect(screen.queryByRole('button', { name: 'Recursos Humanos' })).not.toBeInTheDocument();
});
it('does not turn an unknown role into management navigation', () => {
  render(<MemoryRouter><NavigationLinks role={'unknown' as Role} includeSettings /></MemoryRouter>); expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
