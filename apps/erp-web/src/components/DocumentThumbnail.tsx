import { useEffect, useRef, useState } from 'react';
import { FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';
import type { DocumentRecord } from '../documentData';

// Private originals are requested only when their card approaches the viewport, never via public image URLs.
export default function DocumentThumbnail({ doc }: { doc: DocumentRecord }) {
  const { fetchWithAuth } = useAuth(); const ref = useRef<HTMLDivElement>(null); const [visible, setVisible] = useState(false); const [url, setUrl] = useState(''); const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (doc.mime === 'application/pdf' || typeof IntersectionObserver === 'undefined' || !ref.current) return;
    const observer = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { setVisible(true); observer.disconnect(); } }, { rootMargin: '100px' });
    observer.observe(ref.current); return () => observer.disconnect();
  }, [doc.id, doc.mime]);
  useEffect(() => {
    if (!visible) return; let active = true; let objectUrl = ''; const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetchWithAuth(`${API_URL}/api/documentos/${doc.id}/archivo`, { signal: controller.signal }); if (!response.ok) throw new Error('Thumbnail unavailable');
        const blob = await response.blob(); if (blob.type !== doc.mime || blob.size !== doc.bytes) throw new Error('Invalid thumbnail');
        if (!active) return; objectUrl = URL.createObjectURL(blob); setUrl(objectUrl);
      } catch { if (active) setFailed(true); }
    })();
    return () => { active = false; controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [doc.id, doc.mime, doc.bytes, visible, fetchWithAuth]);
  return <div ref={ref} className="h-36 flex items-center justify-center overflow-hidden relative">
    {url && !failed ? <img src={url} alt={`Miniatura de ${doc.titulo}`} onError={() => setFailed(true)} className="h-full w-full object-cover object-top" /> : <div className="flex flex-col items-center gap-2 p-4"><FileText size={36} aria-hidden="true" /><span className="text-xs">{failed ? 'Vista previa no disponible' : doc.mime === 'application/pdf' ? 'PDF · Visor de páginas al abrir' : 'Documento escaneado'}</span></div>}
  </div>;
}
