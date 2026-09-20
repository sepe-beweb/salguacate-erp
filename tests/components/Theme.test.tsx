import { act, renderHook } from '@testing-library/react';
import { afterEach, it, expect, vi } from 'vitest';
import { useTheme } from '../../apps/erp-web/src/hooks/useTheme';
afterEach(() => { vi.restoreAllMocks(); document.documentElement.classList.remove('dark'); localStorage.clear(); });
it('keeps the app usable with blocked storage and permits an in-memory theme change', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
  const { result } = renderHook(useTheme); const initial = result.current.isDarkMode;
  act(() => result.current.toggleTheme());
  expect(result.current.isDarkMode).toBe(!initial); expect(document.documentElement.classList.contains('dark')).toBe(!initial);
});
it('restores a valid theme and persists explicit changes', () => {
  localStorage.setItem('theme','dark'); const { result } = renderHook(useTheme);
  expect(result.current.isDarkMode).toBe(true); act(() => result.current.toggleTheme()); expect(localStorage.getItem('theme')).toBe('light');
});
