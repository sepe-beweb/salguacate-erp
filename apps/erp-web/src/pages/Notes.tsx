import { useState, useEffect, useRef } from 'react';
import { StickyNote, Plus, Trash2, Loader2, Mic, MicOff, Pin, PinOff, X, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';

import { readJson, errorMessage } from '../apiResponse';
import { useApiLists } from '../hooks/useApiLists';
import RequestError from '../components/RequestError';

interface Nota {
  id: number;
  contenido: string;
  color: string;
  fijada: boolean;
  creado_en: string;
  usuario_id: number | null;
  autor: string | null;
}

const COLORS = [
  { id: 'yellow', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-700', accent: 'bg-amber-400' },
  { id: 'blue', bg: 'bg-sky-50 dark:bg-sky-900/20', border: 'border-sky-200 dark:border-sky-700', accent: 'bg-sky-400' },
  { id: 'green', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-700', accent: 'bg-emerald-400' },
  { id: 'pink', bg: 'bg-pink-50 dark:bg-pink-900/20', border: 'border-pink-200 dark:border-pink-700', accent: 'bg-pink-400' },
  { id: 'purple', bg: 'bg-violet-50 dark:bg-violet-900/20', border: 'border-violet-200 dark:border-violet-700', accent: 'bg-violet-400' },
];

export default function Notes() {
  const { user, fetchWithAuth } = useAuth();
  const { data, loading, error: loadError, reload: fetchNotas } = useApiLists<[Nota]>(['/api/notas']);
  const notas = data?.[0] ?? [];
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const modalRef = useRef<HTMLDialogElement>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);
  const [voiceConsent, setVoiceConsent] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [selectedColor, setSelectedColor] = useState('yellow');

  // Voice dictation
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const handleAction = () => { void fetchNotas(); };
    window.addEventListener('ai_action_executed', handleAction);
    return () => window.removeEventListener('ai_action_executed', handleAction);
  }, [fetchNotas]);

  useEffect(() => {
    if (showModal) {
      modalRef.current?.showModal();
      noteInputRef.current?.focus();
    }
  }, [showModal]);
  useEffect(() => () => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) { recognition.onresult = null; recognition.onerror = null; recognition.onend = null; recognition.abort(); }
  }, []);

  const stopVoice = () => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) { recognition.onresult = null; recognition.onerror = null; recognition.onend = null; recognition.abort(); }
    setIsListening(false);
  };
  const closeModal = () => {
    if (isSubmitting) return;
    stopVoice(); setVoiceConsent(false);
    modalRef.current?.close(); setShowModal(false);
  };
  const toggleVoice = () => {
    if (isListening) { stopVoice(); return; }
    if (!voiceConsent || isSubmitting) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { setError('Este navegador no ofrece dictado. Puedes escribir la nota.'); return; }
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'es-ES'; recognition.continuous = true; recognition.interimResults = false;
    let text = newNote;
    const processed = new Set<number>();
    recognition.onresult = (event: any) => {
      if (recognitionRef.current !== recognition) return;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (!event.results[i].isFinal || processed.has(i)) continue;
        processed.add(i);
        const next = [text, event.results[i][0].transcript].filter(Boolean).join(' ');
        if (next.length > 5000) { stopVoice(); setError('La nota admite hasta 5000 caracteres. Se conserva el texto anterior.'); return; }
        text = next;
      }
      setNewNote(text);
    };
    recognition.onerror = () => { if (recognitionRef.current === recognition) { stopVoice(); setError('El dictado no está disponible o no tiene permiso. Se conserva la nota.'); } };
    recognition.onend = () => { if (recognitionRef.current === recognition) { recognitionRef.current = null; setIsListening(false); } };
    try { setError(''); recognition.start(); setIsListening(true); }
    catch { stopVoice(); setError('No se pudo iniciar el dictado. Puedes escribir la nota.'); }
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || isSubmitting || isListening) return;
    setError('');
    
    setIsSubmitting(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/notas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          contenido: newNote.trim(), 
          color: selectedColor,
          usuario_id: user ? parseInt(user.id) : null
        })
      });
      await readJson(res);
      modalRef.current?.close(); setShowModal(false); setVoiceConsent(false);
      setNewNote('');
      setSelectedColor('yellow');
      await fetchNotas();
    } catch (err) {
      setError(`${errorMessage(err)} Revisa las notas antes de repetir el guardado si se perdió la conexión.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (busy || !window.confirm('¿Eliminar esta nota? Esta acción no se puede deshacer.')) return;
    setBusy(true); setError('');
    try {
      const res = await fetchWithAuth(`${API_URL}/api/notas/${id}`, { method: 'DELETE' });
      await readJson(res);
      await fetchNotas();
    } catch (err) {
      setError(`${errorMessage(err)} Comprueba la lista antes de repetir la eliminación.`);
    } finally { setBusy(false); }
  };

  const handleTogglePin = async (nota: Nota) => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetchWithAuth(`${API_URL}/api/notas/${nota.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contenido: nota.contenido, color: nota.color, fijada: !nota.fijada })
      });
      await readJson(response);
      await fetchNotas();
    } catch (err) {
      setError(errorMessage(err));
    } finally { setBusy(false); }
  };

  const getColorStyle = (colorId: string) => COLORS.find(c => c.id === colorId) || COLORS[0];

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <StickyNote className="text-amber-500" />
          Notas
        </h2>
        <button 
          disabled={busy} onClick={() => { setError(''); setShowModal(true); }}
          className="bg-brand-600 hover:bg-brand-700 text-white p-2 rounded-full transition-colors shadow-md flex items-center gap-1 px-4"
        >
          <Plus size={18} /> <span className="font-semibold text-sm">Nueva</span>
        </button>
      </div>

      {!showModal && <RequestError message={error} onRetry={fetchNotas} />}
      {/* Modal: Nueva Nota */}
      {showModal && (
        <dialog ref={modalRef} aria-labelledby="note-title" onCancel={event => { event.preventDefault(); closeModal(); }} className="m-auto w-11/12 max-w-md max-h-[90dvh] overflow-y-auto rounded-2xl p-0 bg-white dark:bg-slate-900 backdrop:bg-black/50">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-xl p-6 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 id="note-title" className="text-lg font-bold text-slate-900 dark:text-white">Nueva Nota</h3>
              <button aria-label="Cerrar nota" disabled={isSubmitting} onClick={closeModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveNote} className="space-y-4">
              <RequestError message={error} onRetry={fetchNotas} />
              <fieldset disabled={isSubmitting} className="space-y-4">
              {/* Voice indicator */}
              {isListening && (
                <div className="flex items-center gap-2 text-red-500 text-sm font-medium bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg border border-red-200 dark:border-red-800">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                  Escuchando... habla ahora
                </div>
              )}

              <div className="relative">
                <textarea ref={noteInputRef} aria-label="Contenido de la nota" maxLength={5000} disabled={isListening}
                  rows={5}
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 pr-12 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 resize-none text-base"
                  placeholder="Escribe o dicta tu nota..."
                ></textarea>
                <button
                  type="button"
                  disabled={!voiceConsent && !isListening} onClick={toggleVoice}
                  className={`absolute right-3 bottom-3 p-2.5 rounded-full transition-all shadow-md ${
                    isListening 
                      ? 'bg-red-500 text-white animate-pulse shadow-red-500/30' 
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-brand-500 hover:text-white'
                  }`}
                  title={isListening ? 'Parar dictado' : 'Dictar por voz'}
                >
                  {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
              </div>

              <label className="flex gap-2 text-xs text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={voiceConsent} disabled={isListening} onChange={event => setVoiceConsent(event.target.checked)} />
                Autorizo el dictado del navegador, que puede enviar audio a su proveedor. No dictaré datos sensibles.
              </label>
              {/* Color picker */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Color</label>
                <div className="flex gap-2">
                  {COLORS.map(c => (
                    <button
                      aria-label={`Color ${c.id}`} aria-pressed={selectedColor === c.id} key={c.id}
                      type="button"
                      onClick={() => setSelectedColor(c.id)}
                      className={`w-8 h-8 rounded-full ${c.accent} transition-all ${
                        selectedColor === c.id 
                          ? 'ring-2 ring-offset-2 ring-brand-500 dark:ring-offset-slate-900 scale-110' 
                          : 'opacity-60 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Autor info */}
              {user && (
                <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-lg">
                  <User size={12} />
                  Se guardará como nota de: <span className="font-medium text-slate-600 dark:text-slate-300">{user.name}</span>
                </div>
              )}

              <button 
                type="submit" disabled={isSubmitting || isListening || !newNote.trim()}
                className="w-full bg-brand-600 hover:bg-brand-700 text-white font-medium py-3 rounded-lg flex justify-center items-center transition-colors disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : "Guardar Nota"}
              </button>
              </fieldset>
            </form>
          </div>
        </dialog>
      )}

      {/* Lista de notas */}
      {loading ? (
        <div className="flex justify-center py-12 text-brand-500">
          <Loader2 className="animate-spin" size={32} />
        </div>
      ) : loadError ? <RequestError message={loadError} onRetry={fetchNotas} /> : notas.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center shadow-sm">
          <div className="bg-amber-100 dark:bg-amber-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <StickyNote size={32} className="text-amber-500" />
          </div>
          <p className="text-lg font-bold text-slate-900 dark:text-white">Sin notas</p>
          <p className="text-slate-500 mt-1">Pulsa "Nueva" para crear tu primera nota, escrita o por voz.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {notas.map((nota) => {
            const style = getColorStyle(nota.color);
            return (
              <div 
                key={nota.id} 
                className={`${style.bg} border ${style.border} rounded-2xl p-4 shadow-sm transition-all relative group`}
              >
                {nota.fijada && (
                  <div className="absolute -top-1.5 -right-1.5 bg-brand-500 text-white rounded-full p-1 shadow-md">
                    <Pin size={10} />
                  </div>
                )}

                <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap text-sm leading-relaxed">
                  {nota.contenido}
                </p>

                <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-200/50 dark:border-slate-700/30">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-slate-400">{formatDate(nota.creado_en)}</span>
                    {nota.autor && (
                      <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <User size={10} /> {nota.autor}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                    <button 
                      disabled={busy} aria-pressed={Boolean(nota.fijada)} onClick={() => handleTogglePin(nota)}
                      className={`p-1.5 rounded-lg transition-colors ${nota.fijada ? 'text-brand-500 hover:text-brand-600' : 'text-slate-400 hover:text-brand-500'}`}
                      title={nota.fijada ? 'Desfijar' : 'Fijar arriba'}
                    >
                      {nota.fijada ? <PinOff size={14} /> : <Pin size={14} />}
                    </button>
                    <button 
                      disabled={busy} onClick={() => handleDelete(nota.id)}
                      className="text-slate-400 hover:text-red-500 transition-colors p-1.5 rounded-lg"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
