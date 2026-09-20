import { useEffect, useState } from 'react';

// Keep enlargement inside a keyboard-scrollable viewport, never widen the dialog/page.
export default function DocumentImage({ url, title }: { url: string; title: string }) {
  const [zoom, setZoom] = useState(false); const [failed, setFailed] = useState(false);
  useEffect(() => { setZoom(false); setFailed(false); }, [url]);
  return <div className="space-y-2 min-w-0">
    {failed ? <p role="alert" className="rounded-lg bg-amber-50 text-amber-900 p-3">No se puede mostrar esta imagen. El archivo original sigue disponible para descargar; revisa que sea una imagen válida.</p> : <>
      <button type="button" aria-pressed={zoom} onClick={() => setZoom(v => !v)} className="border rounded-lg px-4 py-2.5">{zoom ? 'Ajustar imagen' : 'Ampliar imagen'}</button>
      {zoom && <p className="text-xs text-slate-500">Desplázate dentro de la imagen para leer los detalles. También puedes usar las flechas del teclado.</p>}
    </>}
    <div role="region" aria-label={`Vista de ${title}`} tabIndex={0} className="max-h-[55dvh] overflow-auto rounded-xl bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600">
      <img src={url} alt={`Documento: ${title}`} onError={() => setFailed(true)} className={failed ? 'hidden' : zoom ? 'w-[1600px] max-w-none' : 'w-full max-h-[55dvh] object-contain'} />
    </div>
  </div>;
}
