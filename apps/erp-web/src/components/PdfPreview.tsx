import { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { errorMessage } from '../apiResponse';
import RequestError from './RequestError';

GlobalWorkerOptions.workerSrc = workerUrl;

// Canvas-only rendering: no PDF scripts, forms, attachments, annotations or external links are activated.
export default function PdfPreview({ url, title }: { url: string; title: string }) {
  const canvas = useRef<HTMLCanvasElement>(null); const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1); const [error, setError] = useState(''); const [busy, setBusy] = useState(true); const [zoom, setZoom] = useState(false);
  const [text, setText] = useState(''); const [textOpen, setTextOpen] = useState(false);
  useEffect(() => {
    let active = true; setPdf(null); setPage(1); setError(''); setBusy(true);
    const task = getDocument({ url, enableXfa: false, useSystemFonts: true, stopAtErrors: true, maxImageSize: 40_000_000 });
    void task.promise.then(document => { if (active) setPdf(document); }).catch(cause => { if (active) { setError(errorMessage(cause)); setBusy(false); } });
    return () => { active = false; void task.destroy(); };
  }, [url]);
  useEffect(() => {
    if (!pdf) return; let active = true; let render: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | undefined;
    setBusy(true); setError(''); setText('');
    void (async () => {
      try {
        const source = await pdf.getPage(page); if (!active || !canvas.current) return;
        const initial = source.getViewport({ scale: 1 });
        const scale = Math.min(2, 1400 / Math.max(initial.width, initial.height)); const viewport = source.getViewport({ scale });
        const element = canvas.current; element.width = Math.ceil(viewport.width); element.height = Math.ceil(viewport.height);
        render = source.render({ canvas: element, viewport }); await render.promise;
        const content = await source.getTextContent(); if (!active) return;
        setText(content.items.map(item => 'str' in item ? item.str : '').join(' ')); setBusy(false);
      } catch (cause) { if (active) { setError(errorMessage(cause)); setBusy(false); } }
    })();
    return () => { active = false; render?.cancel(); };
  }, [pdf, page]);
  return <section aria-label={`Vista previa de ${title}`} className="space-y-3">
    {pdf && <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><button type="button" aria-disabled={busy || page <= 1} className="border rounded-lg px-3 py-2.5 aria-disabled:opacity-40" onClick={() => { if (!busy && page > 1) { setBusy(true); setPage(p => p - 1); } }}>Página anterior</button><p aria-live="polite">Página {page} de {pdf.numPages}</p><button type="button" aria-disabled={busy || page >= pdf.numPages} className="border rounded-lg px-3 py-2.5 aria-disabled:opacity-40" onClick={() => { if (!busy && page < pdf.numPages) { setBusy(true); setPage(p => p + 1); } }}>Página siguiente</button></div>}
    {busy && <p role="status">Preparando vista previa...</p>}<RequestError message={error} />
    <div role="region" aria-label={`Página visible de ${title}`} tabIndex={0} className="overflow-auto max-h-[65dvh] rounded-lg border bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"><canvas ref={canvas} role="img" aria-label={`Página ${page} de ${title}`} className={zoom ? 'max-w-none' : 'w-full'} style={error || !pdf ? { display: 'none' } : busy ? { visibility: 'hidden' } : undefined} /></div>
    {pdf && <button type="button" className="underline text-sm" onClick={() => setZoom(v => !v)}>{zoom ? 'Ajustar al ancho' : 'Ampliar para leer'}</button>}
    {text && <details open={textOpen} onToggle={e => setTextOpen(e.currentTarget.open)} className="text-sm"><summary className="cursor-pointer underline">Texto de esta página</summary><p className="whitespace-pre-wrap mt-2">{text}</p></details>}
    {error && <p className="text-xs">Puedes descargar el original. Este visor no abre archivos cifrados ni ejecuta acciones interactivas.</p>}
    <p className="text-xs text-slate-500">Visor PDF.js · <a href="/licenses/pdfjs.txt" target="_blank" rel="noreferrer" className="underline">Licencia Apache-2.0</a></p>
  </section>;
}
