import { useState, useRef, useEffect, type FormEvent, type ChangeEvent } from 'react';
import { Camera, FileText, Download, Trash2, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';
import { readJson, errorMessage } from '../apiResponse';
import { localDate } from '../localDate';
import { parseScanResult, type ScanMode, type ScanResult } from '../scannerResult';
import RequestError from '../components/RequestError';
import { useIdempotentCreate } from '../hooks/useIdempotentCreate';
import ExpenseFields from '../components/ExpenseFields';
import { emptyExpense } from '../expenses';

interface ScannedDoc { id: string; name: string; date: string; dataUrl: string; }
const emptyInvoice = emptyExpense;

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('No se pudo leer la imagen. Selecciona otra.'));
    image.src = source;
  });
}

export default function Scanner() {
  const { fetchWithAuth } = useAuth();
  const { submit: createExpense, locked, discard, payload, inFlight, confirmedId, recoveryError } = useIdempotentCreate<ReturnType<typeof emptyInvoice>>('/api/gastos');
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [processingImage, setIsProcessing] = useState(false);
  const isProcessing = processingImage || inFlight;
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [consent, setConsent] = useState(false);
  const [documents, setDocuments] = useState<ScannedDoc[]>([]);
  const [aiResult, setAiResult] = useState<ScanResult | null>(null);
  const [scanMode, setScanMode] = useState<ScanMode>('pdf');
  const [invoiceForm, setInvoiceForm] = useState(() => payload ?? emptyInvoice());
  const [recovered, setRecovered] = useState(Boolean(payload));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const operation = useRef(0);
  const pending = useRef(false);
  useEffect(() => () => { operation.current++; }, []);
  useEffect(() => () => { if (imageSrc) URL.revokeObjectURL(imageSrc); }, [imageSrc]);
  useEffect(() => {
    if (!confirmedId) return;
    setImageSrc(null); setAiResult(null); setConsent(false); setInvoiceForm(emptyInvoice());
    setRecovered(false); setError(''); setSuccess('Gasto registrado correctamente.'); discard();
  }, [confirmedId, discard]);

  const clearImage = () => {
    setImageSrc(null); setAiResult(null); setConsent(false); setInvoiceForm(emptyInvoice()); setRecovered(false);
  };
  const handleCapture = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || pending.current || locked || recovered) return;
    setError(''); setSuccess('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setError('Selecciona una imagen JPEG, PNG o WebP de hasta 10 MB.'); return;
    }
    try {
      const url = URL.createObjectURL(file);
      setAiResult(null); setConsent(false); setInvoiceForm(emptyInvoice()); setImageSrc(url);
    } catch { setError('No se pudo abrir la imagen. Selecciónala de nuevo.'); }
  };
  const changeMode = (mode: ScanMode) => {
    if (pending.current || locked || mode === scanMode) return;
    setScanMode(mode); setAiResult(null); setConsent(false); setError('');
  };
  const processImage = async () => {
    if (!imageSrc || pending.current || locked || (scanMode !== 'pdf' && !consent)) return;
    pending.current = true;
    const request = ++operation.current;
    setIsProcessing(true); setError(''); setSuccess('');
    try {
      const img = await loadImage(imageSrc);
      if (request !== operation.current) return;
      if (!img.width || !img.height || img.width * img.height > 40_000_000) throw new Error('La imagen no es válida o supera los 40 megapíxeles.');
      if (scanMode === 'pdf') {
        const { jsPDF } = await import('jspdf');
        if (request !== operation.current) return;
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const width = pdf.internal.pageSize.getWidth();
        const height = pdf.internal.pageSize.getHeight();
        const scale = Math.min((width - 20) / img.width, (height - 20) / img.height);
        const w = img.width * scale; const h = img.height * scale;
        pdf.addImage(img, 'JPEG', (width - w) / 2, (height - h) / 2, w, h);
        const doc = { id: crypto.randomUUID(), name: `Factura_${localDate()}`, date: new Date().toLocaleString(), dataUrl: pdf.output('datauristring') };
        setDocuments(previous => [...previous, doc]); clearImage();
        setSuccess('PDF preparado. Descárgalo para conservarlo.');
      } else {
        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No se pudo preparar la imagen para analizarla.');
        ctx.drawImage(img, 0, 0);
        const response = await fetchWithAuth(`${API_URL}/api/ai/vision`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: canvas.toDataURL('image/jpeg').split(',')[1], mode: scanMode === 'ai_invoice' ? 'invoice' : 'inventory' })
        });
        const result = parseScanResult(await readJson<unknown>(response), scanMode);
        if (request !== operation.current) return;
        setAiResult(result);
        if (result.kind === 'ai_invoice') setInvoiceForm(previous => ({
          ...previous, proveedor_nombre: result.proveedor, total: result.total, concepto: result.concepto
        }));
      }
    } catch (cause) {
      if (request === operation.current) setError(errorMessage(cause));
    } finally {
      if (request === operation.current) { pending.current = false; setIsProcessing(false); }
    }
  };
  const saveExpense = async (event: FormEvent) => {
    event.preventDefault();
    if (pending.current || inFlight || (!recovered && aiResult?.kind !== 'ai_invoice')) return;
    setError(''); setSuccess('');
    try {
      await createExpense(invoiceForm);
    } catch { /* The session owns the outcome even while this route is absent. */ }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Escáner</h2>
      <RequestError message={error || (recoveryError ? `${recoveryError} Se conserva el borrador.` : '')} />
      {success && <p role="status" className="rounded-lg bg-emerald-50 text-emerald-800 p-3">{success}</p>}
      <p className="text-sm text-slate-500">El PDF se genera en este dispositivo. Los documentos solo permanecen en esta pantalla: descárgalos antes de salir o recargar.</p>
      <input aria-label="Seleccionar imagen" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" ref={fileInputRef} onChange={handleCapture} disabled={isProcessing} className="hidden" />
      {recovered && !imageSrc && <section className="rounded-xl border p-4 space-y-3">
        <p>Gasto recuperado de esta sesión. Se conserva el formulario enviado, no la imagen ni el consentimiento para analizarla.</p>
        <button disabled={inFlight} className="underline" onClick={() => {
          if (locked && !window.confirm('El servidor puede haber registrado el gasto. Descartar elimina el intento y su protección. Comprueba los gastos antes de crear otro. ¿Continuar?')) return;
          discard(); clearImage(); setError('');
        }}>Descartar intento pendiente</button>
      </section>}
      {!imageSrc && !recovered ? (
        <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-8 flex flex-col items-center gap-4 min-h-[220px] bg-white dark:bg-slate-900">
          <Camera size={48} className="text-brand-600" />
          <span className="text-lg font-semibold">Escanear Documento</span>
          <span className="text-sm text-slate-500">Selecciona una foto o abre la cámara. JPEG, PNG o WebP, hasta 10 MB.</span>
        </button>
      ) : imageSrc ? (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border p-3">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium">Vista Previa</h3>
              <button aria-label="Descartar imagen y borrador" disabled={isProcessing} onClick={() => {
                if (locked && !window.confirm('El servidor puede haber registrado el gasto. Descartar elimina este borrador y su protección frente a duplicados. Comprueba los gastos antes de crear otro. ¿Continuar?')) return;
                discard(); clearImage(); setError('');
              }} className="p-2 text-red-500"><Trash2 size={20} /></button>
            </div>
            <img src={imageSrc} alt="Vista previa" className="max-h-[50vh] w-full object-contain rounded-lg" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {([['pdf', 'Solo PDF'], ['ai_invoice', 'Factura IA'], ['ai_inventory', 'Stock IA']] as const).map(([mode, label]) => (
              <button key={mode} disabled={isProcessing || locked} aria-pressed={scanMode === mode} onClick={() => changeMode(mode)} className={`p-2 rounded-lg ${scanMode === mode ? 'bg-brand-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>{label}</button>
            ))}
          </div>
          {scanMode !== 'pdf' && (
            <label className="flex gap-2 text-sm">
              <input type="checkbox" checked={consent} disabled={isProcessing} onChange={event => setConsent(event.target.checked)} />
              Autorizo enviar esta imagen a Gemini para analizarla. No contiene datos sensibles. El servicio debe estar habilitado por la administración.
            </label>
          )}
          <button onClick={processImage} disabled={isProcessing || (scanMode !== 'pdf' && !consent) || aiResult !== null} className="w-full bg-brand-600 text-white p-3 rounded-xl disabled:opacity-50 flex justify-center gap-2">
            {scanMode === 'pdf' ? <FileText size={20} /> : <Sparkles size={20} />}
            {isProcessing ? 'Procesando...' : scanMode === 'pdf' ? 'Guardar como PDF' : 'Analizar con Gemini'}
          </button>
          {aiResult?.kind === 'ai_inventory' && (
            <section className="rounded-xl border p-4 space-y-2">
              <h3 className="font-semibold">Estimación de inventario</h3>
              <p>Botellas estimadas: {aiResult.botellasEstimadas}. Confianza: {aiResult.confianza}%.</p>
              <p>{aiResult.rawText}</p>
              <p className="text-sm text-slate-500">Es una estimación visual: no modifica el inventario.</p>
            </section>
          )}
        </div>
      ) : null}
          {(aiResult?.kind === 'ai_invoice' || recovered) && (
            <form onSubmit={saveExpense} className="rounded-xl border border-brand-200 p-4 space-y-3">
              <h3 className="font-semibold">Revisar factura</h3>
              <p className="text-sm text-slate-500">El análisis puede contener errores. Revisa cada campo antes de registrar el gasto.</p>
              {inFlight && <p role="status">Esperando la respuesta del guardado. Puedes volver a esta pantalla sin repetir el envío.</p>}
              {locked && !isProcessing && <p role="status" className="text-sm">Hay un guardado sin confirmar. Los datos quedan bloqueados. Puedes confirmar el mismo intento sin crear otro gasto. Se conserva al navegar en esta sesión, pero se pierde al recargar o cerrar sesión.</p>}
              <ExpenseFields value={invoiceForm} onChange={setInvoiceForm} disabled={isProcessing || locked} amountLabel="Total Detectado (€)" conceptRequired />
              <button type="submit" disabled={isProcessing} className="w-full bg-emerald-600 text-white p-3 rounded-lg disabled:opacity-50">{isProcessing ? 'Registrando...' : locked ? 'Confirmar guardado pendiente' : 'Registrar Gasto Directamente'}</button>
            </form>
          )}
      {documents.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-semibold">Documentos Recientes</h3>
          {documents.map(doc => (
            <div key={doc.id} className="bg-white dark:bg-slate-900 rounded-xl border p-4 flex items-center justify-between">
              <div><p>{doc.name}.pdf</p><p className="text-sm text-slate-500">{doc.date}</p></div>
              <a aria-label={`Descargar ${doc.name}.pdf`} href={doc.dataUrl} download={`${doc.name}.pdf`} className="p-2 text-brand-600"><Download size={20} /></a>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
