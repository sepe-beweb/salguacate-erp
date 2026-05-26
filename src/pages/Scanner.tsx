import { useState, useRef } from 'react';
import { Camera, FileText, CheckCircle2, Download, Trash2, Image as ImageIcon, Sparkles, Box } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { jsPDF } from 'jspdf';
import { API_URL } from '../config';

interface ScannedDoc {
  id: string;
  name: string;
  date: string;
  dataUrl: string;
}

export default function Scanner() {
  const { fetchWithAuth } = useAuth();
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [documents, setDocuments] = useState<ScannedDoc[]>([]);
  const [aiResult, setAiResult] = useState<any | null>(null);
  const [scanMode, setScanMode] = useState<'pdf' | 'ai_invoice' | 'ai_inventory'>('pdf');
  const [invoiceForm, setInvoiceForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    local: 'Principal',
    proveedor_nombre: '',
    total: '',
    concepto: 'Albarán procesado'
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setImageSrc(imageUrl);
    }
  };

  const saveAsPdf = async () => {
    if (!imageSrc) return;
    setIsProcessing(true);
    
    try {
      // Create a new jsPDF instance (A4 size)
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Load image to get dimensions
      const img = new Image();
      img.src = imageSrc;
      
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      // Calculate dimensions to fit A4 (210 x 297 mm)
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      const imgRatio = img.width / img.height;

      let renderWidth = pageWidth;
      let renderHeight = pageHeight;

      // Fit the image within the page margins (10mm margins)
      const margin = 10;
      const contentWidth = pageWidth - (margin * 2);
      const contentHeight = pageHeight - (margin * 2);

      if (imgRatio > contentWidth / contentHeight) {
        renderWidth = contentWidth;
        renderHeight = renderWidth / imgRatio;
      } else {
        renderHeight = contentHeight;
        renderWidth = renderHeight * imgRatio;
      }

      // Center the image
      const x = (pageWidth - renderWidth) / 2;
      const y = (pageHeight - renderHeight) / 2;

      pdf.addImage(img, 'JPEG', x, y, renderWidth, renderHeight);
      
      // Save to mock gallery
      const pdfDataUri = pdf.output('datauristring');
      const newDoc: ScannedDoc = {
        id: Date.now().toString(),
        name: `Factura_${new Date().toISOString().split('T')[0]}`,
        date: new Date().toLocaleString(),
        dataUrl: pdfDataUri
      };
      
      setDocuments(prev => [...prev, newDoc]);
      
      // Reset
      setImageSrc(null);
    } catch (error) {
      console.error("Error generating PDF", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const analyzeWithAI = async () => {
    if (!imageSrc) return;
    setIsProcessing(true);
    setAiResult(null);

    try {
      // Extraer base64 (quitando el prefijo de data uri)
      const canvas = document.createElement('canvas');
      const img = new Image();
      img.src = imageSrc;
      await new Promise(resolve => img.onload = resolve);
      
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);
      
      // Convertir a jpeg para la API
      const base64Image = canvas.toDataURL('image/jpeg').split(',')[1];

      const res = await fetchWithAuth(`${API_URL}/api/ai/vision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          imageBase64: base64Image, 
          mode: scanMode === 'ai_invoice' ? 'invoice' : 'inventory' 
        })
      });

      const data = await res.json();
      if (data.success) {
        setAiResult(data.result);
        if (scanMode === 'ai_invoice') {
          setInvoiceForm({
            fecha: new Date().toISOString().split('T')[0],
            local: 'Principal',
            proveedor_nombre: data.result.proveedor || '',
            total: data.result.total || '',
            concepto: 'Albarán procesado'
          });
        }
      }
    } catch (error) {
      console.error("Error con la IA", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Escáner</h2>
      </div>

      {!imageSrc ? (
        <div className="space-y-6">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-brand-500 dark:hover:border-brand-500 transition-colors shadow-sm group min-h-[300px]"
          >
            <div className="bg-brand-50 dark:bg-brand-900/20 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform">
              <Camera size={48} className="text-brand-600 dark:text-brand-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Escanear Documento</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">
              Toca para abrir la cámara y fotografiar un ticket o factura.
            </p>
            {/* Input nativo que abre la cámara en móviles */}
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              ref={fileInputRef}
              onChange={handleCapture}
              className="hidden" 
            />
          </div>

          {documents.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900 dark:text-white">Documentos Recientes</h3>
              <div className="space-y-3">
                {documents.map(doc => (
                  <div key={doc.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded-lg text-red-600 dark:text-red-400">
                        <FileText size={24} />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{doc.name}.pdf</p>
                        <p className="text-xs text-slate-500">{doc.date}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <a 
                        href={doc.dataUrl} 
                        download={`${doc.name}.pdf`}
                        className="p-2 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                      >
                        <Download size={20} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2 shadow-sm overflow-hidden">
            <div className="flex justify-between items-center px-2 py-3 border-b border-slate-100 dark:border-slate-800 mb-2">
              <h3 className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                <ImageIcon size={18} className="text-brand-500" />
                Vista Previa
              </h3>
              <button 
                onClick={() => setImageSrc(null)}
                className="text-slate-400 hover:text-red-500 transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
            {/* Vista previa de la imagen */}
            <div className="relative w-full aspect-[3/4] bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden flex items-center justify-center">
              <img 
                src={imageSrc} 
                alt="Vista previa" 
                className="max-w-full max-h-full object-contain"
              />
            </div>
          </div>

          {aiResult && (
            <div className="bg-gradient-to-r from-brand-50 to-indigo-50 dark:from-brand-900/20 dark:to-indigo-900/20 border border-brand-200 dark:border-brand-800 rounded-xl p-4 shadow-sm animate-in fade-in zoom-in-95 duration-300">
              <h4 className="font-semibold text-brand-800 dark:text-brand-300 flex items-center gap-2 mb-3">
                <Sparkles size={18} />
                Resultados de la Inteligencia Artificial
              </h4>
              
              {scanMode === 'ai_invoice' && (
                <div className="space-y-3 mt-4">
                  <div className="grid grid-cols-2 gap-3 mb-1">
                    <div>
                      <label className="text-xs text-slate-500">Total Detectado (€)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={invoiceForm.total} 
                        onChange={(e) => setInvoiceForm({...invoiceForm, total: e.target.value})}
                        className="w-full p-2 mt-1 border border-brand-100 dark:border-brand-800 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-bold text-lg" 
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">Proveedor</label>
                      <input 
                        type="text" 
                        value={invoiceForm.proveedor_nombre} 
                        onChange={(e) => setInvoiceForm({...invoiceForm, proveedor_nombre: e.target.value})}
                        className="w-full p-2 mt-1 border border-brand-100 dark:border-brand-800 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-medium" 
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mb-1">
                    <div>
                      <label className="text-xs text-slate-500">Fecha</label>
                      <input 
                        type="date" 
                        value={invoiceForm.fecha} 
                        onChange={(e) => setInvoiceForm({...invoiceForm, fecha: e.target.value})}
                        className="w-full p-2 mt-1 border border-brand-100 dark:border-brand-800 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm" 
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">Local</label>
                      <select 
                        value={invoiceForm.local} 
                        onChange={(e) => setInvoiceForm({...invoiceForm, local: e.target.value})}
                        className="w-full p-2 mt-1 border border-brand-100 dark:border-brand-800 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm" 
                      >
                        <option value="Principal">Principal</option>
                        <option value="Segundo Local">Segundo Local</option>
                      </select>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="text-xs text-slate-500">Concepto</label>
                    <input 
                      type="text" 
                      value={invoiceForm.concepto} 
                      onChange={(e) => setInvoiceForm({...invoiceForm, concepto: e.target.value})}
                      className="w-full p-2 mt-1 border border-brand-100 dark:border-brand-800 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm" 
                    />
                  </div>
                  
                  <button 
                    onClick={async () => {
                      setIsProcessing(true);
                      try {
                        const res = await fetchWithAuth(`${API_URL}/api/gastos`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ 
                            total: invoiceForm.total, 
                            proveedor_nombre: invoiceForm.proveedor_nombre,
                            fecha: invoiceForm.fecha,
                            local: invoiceForm.local,
                            concepto: invoiceForm.concepto
                          })
                        });
                        if (res.ok) {
                          alert("Gasto registrado en contabilidad");
                          setImageSrc(null);
                          setAiResult(null);
                        } else {
                          alert("Error al registrar gasto");
                        }
                      } catch (e) {
                        console.error(e);
                      } finally {
                        setIsProcessing(false);
                      }
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 rounded-lg flex justify-center items-center gap-2 shadow-md transition-colors"
                  >
                    Registrar Gasto Directamente
                  </button>
                </div>
              )}

              {scanMode === 'ai_inventory' && (
                <div className="bg-white dark:bg-slate-900 p-3 rounded-lg shadow-sm border border-brand-100 dark:border-brand-800 mb-3 text-center">
                  <p className="text-sm text-slate-500">Botellas estimadas en imagen</p>
                  <p className="text-3xl font-black text-brand-600 dark:text-brand-400">{aiResult.botellasEstimadas}</p>
                  <p className="text-xs text-emerald-600 mt-1">Confianza: {aiResult.confianza}</p>
                </div>
              )}

              <p className="text-sm text-slate-600 dark:text-slate-400 italic">"{aiResult.rawText}"</p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button 
              onClick={() => setScanMode('pdf')}
              className={`py-2 text-sm font-medium rounded-lg transition-colors ${scanMode === 'pdf' ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              Solo PDF
            </button>
            <button 
              onClick={() => setScanMode('ai_invoice')}
              className={`py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1 ${scanMode === 'ai_invoice' ? 'bg-white dark:bg-slate-700 shadow text-brand-600 dark:text-brand-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              <FileText size={14} /> Factura IA
            </button>
            <button 
              onClick={() => setScanMode('ai_inventory')}
              className={`py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1 ${scanMode === 'ai_inventory' ? 'bg-white dark:bg-slate-700 shadow text-brand-600 dark:text-brand-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              <Box size={14} /> Stock IA
            </button>
          </div>

          <button 
            onClick={scanMode === 'pdf' ? saveAsPdf : analyzeWithAI}
            disabled={isProcessing}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-medium py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 transition-colors disabled:opacity-50"
          >
            {isProcessing ? (
              <span className="animate-pulse flex items-center gap-2">
                <Sparkles size={20} className="animate-spin" /> Procesando...
              </span>
            ) : (
              <>
                {scanMode === 'pdf' ? <CheckCircle2 size={20} /> : <Sparkles size={20} />}
                {scanMode === 'pdf' ? 'Guardar como PDF' : 'Analizar con Gemini'}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
