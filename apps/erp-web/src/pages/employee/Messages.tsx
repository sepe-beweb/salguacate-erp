import { useState, useRef } from 'react';
import { Mail, Send, Loader2, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config';
import { readJson, errorMessage } from '../../apiResponse';
import { useApiRead } from '../../hooks/useApiLists';
import { readMessageWorkspace } from '../../messageData';
import { storedUtcTimestamp } from '../../storedTimestamp';
import RequestError from '../../components/RequestError';

export default function Messages() {
  const { user, fetchWithAuth } = useAuth();
  const { data, loading, error: loadError, reload: fetchMessages } = useApiRead(['/api/mensajes', '/api/usuarios/public'], readMessageWorkspace);
  const messages = data?.[0] ?? []; const publicUsers = data?.[1] ?? [];
  const [isComposing, setIsComposing] = useState(false);
  const [newMsg, setNewMsg] = useState({ destinatario_id: 0, asunto: '', cuerpo: '' });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const inFlight = useRef(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || inFlight.current || loading || loadError || !data) return;
    if (!publicUsers.some(recipient => recipient.id === newMsg.destinatario_id && String(recipient.id) !== String(user.id)) ||
      !newMsg.asunto.trim() || newMsg.asunto.length > 160 || !newMsg.cuerpo.trim() || newMsg.cuerpo.length > 10000) {
      setError('Selecciona un destinatario disponible y completa asunto y mensaje válidos.'); return;
    }
    
    inFlight.current = true; setSending(true); setError(''); setSuccess('');
    try {
      const res = await fetchWithAuth(`${API_URL}/api/mensajes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinatario_id: newMsg.destinatario_id,
          asunto: newMsg.asunto,
          cuerpo: newMsg.cuerpo
        })
      });
      
      await readJson(res);
      setIsComposing(false);
      setNewMsg({ destinatario_id: 0, asunto: '', cuerpo: '' });
      setSuccess('Mensaje enviado correctamente.');
      fetchMessages();
    } catch (err) {
      setError(`${errorMessage(err)} Si se perdió la conexión, comprueba con el destinatario si lo recibió antes de repetir.`);
    } finally {
      inFlight.current = false; setSending(false);
    }
  };

  const getRoleLabel = (rol: string) => {
    switch(rol) {
      case 'owner': return 'Propietario';
      case 'manager': return 'Encargado';
      default: return 'Empleado';
    }
  };

  const otherUsers = publicUsers.filter(u => String(u.id) !== String(user?.id));

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {error && <div role="alert" className="rounded-lg bg-red-50 text-red-700 p-3">{error}</div>}
      {success && <p role="status" className="text-brand-700">{success}</p>}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Bandeja de Entrada</h2>
        <button 
          aria-label={isComposing ? 'Cancelar mensaje' : 'Nuevo mensaje'}
          disabled={sending || loading || !!loadError}
          onClick={() => setIsComposing(!isComposing)}
          className="bg-brand-100 hover:bg-brand-200 dark:bg-brand-900/30 dark:hover:bg-brand-900/50 text-brand-700 dark:text-brand-400 p-2 rounded-full transition-colors"
        >
          {isComposing ? <span className="px-2 font-medium">Cancelar</span> : <Mail size={20} />}
        </button>
      </div>

      {isComposing && (
        <form onSubmit={handleSend} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-brand-200 dark:border-brand-800 shadow-sm space-y-4 animate-in slide-in-from-top-2">
          <fieldset disabled={sending || loading || !!loadError} className="space-y-4">
          <h3 className="font-semibold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">Nuevo Mensaje Interno</h3>
          
          <div>
            <label htmlFor="message-recipient" className="block text-xs font-medium text-slate-500 mb-1">Destinatario</label>
            <select id="message-recipient" required
              value={newMsg.destinatario_id}
              onChange={e => setNewMsg({...newMsg, destinatario_id: Number(e.target.value)})}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-900 dark:text-white"
            >
              <option value={0}>Selecciona destinatario...</option>
              {newMsg.destinatario_id !== 0 && !otherUsers.some(recipient => recipient.id === newMsg.destinatario_id) && <option value={newMsg.destinatario_id} disabled>Destinatario no disponible; selecciona otro</option>}
              {otherUsers.length === 0 ? (
                <option value="">No hay otros destinatarios disponibles</option>
              ) : (
                otherUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.nombre} ({getRoleLabel(u.rol)})
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label htmlFor="message-subject" className="block text-xs font-medium text-slate-500 mb-1">Asunto</label>
            <input id="message-subject"
              type="text" 
              maxLength={160}
              value={newMsg.asunto}
              onChange={e => setNewMsg({...newMsg, asunto: e.target.value})}
              required
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-900 dark:text-white"
              placeholder="Ej. Cambio de turno"
            />
          </div>

          <div>
            <label htmlFor="message-body" className="block text-xs font-medium text-slate-500 mb-1">Mensaje</label>
            <textarea id="message-body"
              maxLength={10000}
              value={newMsg.cuerpo}
              onChange={e => setNewMsg({...newMsg, cuerpo: e.target.value})}
              required
              rows={4}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-900 dark:text-white resize-none"
              placeholder="Escribe tu mensaje aquí..."
            ></textarea>
          </div>

          <button 
            type="submit"
            disabled={sending || otherUsers.length === 0}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-medium py-2.5 rounded-lg flex justify-center items-center gap-2 transition-colors disabled:opacity-50"
          >
            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            Enviar Mensaje
          </button>
          {(newMsg.asunto || newMsg.cuerpo || newMsg.destinatario_id !== 0) && <button type="button" className="text-red-700 underline" onClick={() => { if (confirm('¿Descartar el borrador de mensaje?')) { setNewMsg({ destinatario_id: 0, asunto: '', cuerpo: '' }); setError(''); setIsComposing(false); } }}>Descartar borrador de mensaje</button>}
          </fieldset>
        </form>
      )}

      <div className="space-y-3">
        {loading ? <p role="status">Cargando buzón...</p> : loadError ? <RequestError message={loadError} onRetry={fetchMessages} /> : messages.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-slate-500">No tienes mensajes nuevos.</p>
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors [overflow-wrap:anywhere]">
              <div className="flex flex-wrap gap-2 justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-full text-slate-500">
                    <User size={16} />
                  </div>
                  <span className="font-semibold text-sm text-slate-900 dark:text-white">{msg.remitente_nombre}</span>
                </div>
                <span className="text-[10px] text-slate-400">
                  <time dateTime={storedUtcTimestamp(msg.fecha).toISOString()}>{storedUtcTimestamp(msg.fecha).toLocaleString('es-ES', { year: 'numeric', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</time>
                </span>
              </div>
              <h4 className="font-medium text-slate-800 dark:text-slate-200 text-sm mb-1">{msg.asunto}</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{msg.cuerpo}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
