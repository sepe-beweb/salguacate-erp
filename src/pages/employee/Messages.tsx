import { useState, useEffect } from 'react';
import { Mail, Send, Loader2, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface Mensaje {
  id: number;
  remitente_id: number;
  remitente_nombre: string;
  asunto: string;
  cuerpo: string;
  fecha: string;
  leido: number;
}

interface PublicUser {
  id: number;
  nombre: string;
  rol: string;
}

export default function Messages() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Mensaje[]>([]);
  const [publicUsers, setPublicUsers] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isComposing, setIsComposing] = useState(false);
  const [newMsg, setNewMsg] = useState({ destinatario_id: 0, asunto: '', cuerpo: '' });
  const [sending, setSending] = useState(false);

  const fetchMessages = () => {
    if (!user) return;
    setLoading(true);
    fetch(`http://localhost:3001/api/mensajes?usuario_id=${user.id}`)
      .then(res => res.json())
      .then(data => {
        setMessages(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error cargando mensajes", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchMessages();

    // Cargar destinatarios dinámicos
    fetch('http://localhost:3001/api/usuarios/public')
      .then(res => res.json())
      .then(data => {
        setPublicUsers(data);
        if (user && data.length > 0) {
          const firstOther = data.find((u: PublicUser) => String(u.id) !== String(user.id));
          if (firstOther) {
            setNewMsg(prev => ({ ...prev, destinatario_id: firstOther.id }));
          }
        }
      })
      .catch(err => console.error("Error cargando destinatarios públicos", err));
  }, [user]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newMsg.destinatario_id || !newMsg.asunto || !newMsg.cuerpo) return;
    
    setSending(true);
    try {
      const res = await fetch('http://localhost:3001/api/mensajes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          remitente_id: user.id,
          destinatario_id: newMsg.destinatario_id,
          asunto: newMsg.asunto,
          cuerpo: newMsg.cuerpo
        })
      });
      
      if (res.ok) {
        setIsComposing(false);
        const firstOther = publicUsers.find(u => String(u.id) !== String(user.id));
        setNewMsg({ destinatario_id: firstOther ? firstOther.id : 0, asunto: '', cuerpo: '' });
        fetchMessages();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const getRoleLabel = (rol: string) => {
    switch(rol) {
      case 'owner': return 'Propietario';
      case 'manager': return 'Encargado';
      default: return 'Empleado';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500">
        <Loader2 size={32} className="animate-spin text-brand-500 mb-4" />
        <p>Cargando buzón...</p>
      </div>
    );
  }

  const otherUsers = publicUsers.filter(u => String(u.id) !== String(user?.id));

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Bandeja de Entrada</h2>
        <button 
          onClick={() => setIsComposing(!isComposing)}
          className="bg-brand-100 hover:bg-brand-200 dark:bg-brand-900/30 dark:hover:bg-brand-900/50 text-brand-700 dark:text-brand-400 p-2 rounded-full transition-colors"
        >
          {isComposing ? <span className="px-2 font-medium">Cancelar</span> : <Mail size={20} />}
        </button>
      </div>

      {isComposing && (
        <form onSubmit={handleSend} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-brand-200 dark:border-brand-800 shadow-sm space-y-4 animate-in slide-in-from-top-2">
          <h3 className="font-semibold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">Nuevo Mensaje Interno</h3>
          
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Destinatario</label>
            <select 
              value={newMsg.destinatario_id}
              onChange={e => setNewMsg({...newMsg, destinatario_id: Number(e.target.value)})}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-900 dark:text-white"
            >
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
            <label className="block text-xs font-medium text-slate-500 mb-1">Asunto</label>
            <input 
              type="text" 
              value={newMsg.asunto}
              onChange={e => setNewMsg({...newMsg, asunto: e.target.value})}
              required
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-900 dark:text-white"
              placeholder="Ej. Cambio de turno"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Mensaje</label>
            <textarea 
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
        </form>
      )}

      <div className="space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-slate-500">No tienes mensajes nuevos.</p>
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-full text-slate-500">
                    <User size={16} />
                  </div>
                  <span className="font-semibold text-sm text-slate-900 dark:text-white">{msg.remitente_nombre}</span>
                </div>
                <span className="text-[10px] text-slate-400">
                  {new Date(msg.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
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
