import { useEffect, useRef, useState } from 'react';

// Local file reading only. The API still validates file content before storing it.
export function useProductImage() {
  const [value, setValue] = useState('');
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  const reader = useRef<FileReader | null>(null);
  const abort = () => { sequence.current++; const pending = reader.current; reader.current = null; if (pending?.readyState === 1) pending.abort(); };
  useEffect(() => () => { sequence.current++; const pending = reader.current; reader.current = null; if (pending?.readyState === 1) pending.abort(); }, []);
  const cancel = () => { const pending = reader.current !== null; abort(); setReading(false); if (pending) setError('Lectura de imagen cancelada. Selecciona la imagen de nuevo si quieres adjuntarla.'); };
  const clear = () => { abort(); setValue(''); setReading(false); setError(''); };
  const read = (file: File) => {
    clear();
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size === 0 || file.size > 3 * 1024 * 1024) { setError('La imagen debe ser PNG o JPEG de hasta 3 MB.'); return; }
    const generation = sequence.current; const pending = new FileReader(); reader.current = pending; setReading(true);
    const current = () => generation === sequence.current && reader.current === pending;
    const fail = () => { if (!current()) return; reader.current = null; setReading(false); setError('No se pudo leer la imagen. Selecciónala de nuevo.'); };
    pending.onerror = fail;
    pending.onabort = fail;
    pending.onload = () => {
      if (!current()) return;
      if (typeof pending.result !== 'string' || !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(pending.result) || pending.result.trim() !== pending.result) { fail(); return; }
      reader.current = null; setValue(pending.result); setReading(false);
    };
    try { pending.readAsDataURL(file); } catch { fail(); }
  };
  return { value, reading, error, read, cancel, clear };
}
