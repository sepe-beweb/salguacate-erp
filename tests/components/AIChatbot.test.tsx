import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AIChatbot from '../../apps/erp-web/src/components/AIChatbot';

// Mock del AuthContext
vi.mock('../../apps/erp-web/src/context/AuthContext', () => {
  return {
    useAuth: () => ({
      user: { id: '1', name: 'Jefe (Admin)', role: 'owner' }
    })
  };
});

describe('🤖 Asistente de IA (AIChatbot) - Componente React', () => {
  it('labels controls, focuses the query and closes with native cancellation while restoring focus', () => {
    render(<AIChatbot />);
    const opener = screen.getByRole('button', { name: 'Abrir asistente' });
    opener.focus(); fireEvent.click(opener);
    expect(screen.getByRole('dialog', { name: 'Asistente ERP' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Consulta de stock' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Cerrar asistente' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Enviar consulta' })).toBeDisabled();
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: true, cancelable: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
  
  it('Debería renderizar el botón flotante del asistente de IA para administradores', () => {
    render(<AIChatbot />);
    
    // Debería haber un botón flotante visible en pantalla
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('Debería abrir la ventana del chat al pulsar el botón flotante', async () => {
    render(<AIChatbot />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    // Debería abrir la cabecera del Asistente ERP
    const heading = screen.getByText('Asistente ERP');
    expect(heading).toBeInTheDocument();
  });

});
