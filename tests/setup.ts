import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock matchMedia (necesario para jsdom con Recharts o componentes responsivos)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock window.scrollTo
window.scrollTo = vi.fn();
Element.prototype.scrollIntoView = vi.fn();

// jsdom does not implement native dialog focus/inert behavior; browser tests cover it.
Object.defineProperties(HTMLDialogElement.prototype, {
  showModal: { configurable: true, value: function () { this.setAttribute('open', ''); } },
  close: { configurable: true, value: function () { this.removeAttribute('open'); } }
});
