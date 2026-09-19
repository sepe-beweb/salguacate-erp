// An explicit build setting always wins, including local integration tests.
const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
export const API_URL = (import.meta.env.VITE_API_URL || (isLocalhost ? 'http://localhost:3001' : '')).replace(/\/$/, '');
