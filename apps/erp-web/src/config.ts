// Configuración de resolución de URL de API dinámica según el entorno de ejecución
const isLocalFile = window.location.protocol === 'file:';
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// URL del servidor Express desplegado en Render (producción)
// Puedes actualizar esta constante una vez tengas la URL final de tu backend en Render
const PRODUCTION_API_URL = import.meta.env.VITE_API_URL || 'https://salguacate-backend.onrender.com';

export const API_URL = isLocalhost
  ? 'http://localhost:3001'
  : (isLocalFile ? 'http://10.0.2.2:3001' : PRODUCTION_API_URL);
