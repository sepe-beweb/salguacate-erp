import { useEffect, useState } from 'react';

// Theme persistence is optional; denied browser storage must not prevent login.
export function useTheme() {
  const [isDarkMode, setDarkMode] = useState(() => {
    try { const saved = localStorage.getItem('theme'); if (saved === 'dark' || saved === 'light') return saved === 'dark'; } catch { /* Session-only preference. */ }
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    try { localStorage.setItem('theme', isDarkMode ? 'dark' : 'light'); } catch { /* Keep the selected theme in memory. */ }
  }, [isDarkMode]);
  return { isDarkMode, toggleTheme: () => setDarkMode(current => !current) };
}
