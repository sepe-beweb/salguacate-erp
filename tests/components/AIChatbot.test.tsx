import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AIChatbot from '../../src/components/AIChatbot';

// Mock del AuthContext
vi.mock('../../src/context/AuthContext', () => {
  return {
    useAuth: () => ({
      user: { id: '1', name: 'Jefe (Admin)', role: 'owner' }
    })
  };
});

describe('🤖 Asistente de IA (AIChatbot) - Componente React', () => {
  
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
