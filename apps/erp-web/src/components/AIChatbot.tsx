import { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Sparkles, Loader2, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';
import ModalDialog from './ModalDialog';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
}

export default function AIChatbot() {
  const { user, fetchWithAuth } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', sender: 'ai', text: 'Asistente de consulta de stock. Requiere activación del servicio por el administrador. No modifica datos. No incluyas información personal o confidencial.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const handleOpenChat = (e: any) => {
      setIsOpen(true);
      if (e.detail?.message) {
        setInput(e.detail.message);
      }
    };
    window.addEventListener('open_ai_chat', handleOpenChat);
    return () => window.removeEventListener('open_ai_chat', handleOpenChat);
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: input.trim()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetchWithAuth(`${API_URL}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.text,
          history: messages.slice(-24).map(msg => ({ sender: msg.sender, text: msg.text.slice(0, 2000) }))
        })
      });

      const data = await res.json();
      
      if (data.success) {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          text: data.reply
        }]);
        if (data.actionExecuted) {
          window.dispatchEvent(new Event('ai_action_executed'));
        }
      } else {
        throw new Error(data.details || data.error || 'Error en la respuesta del servidor');
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: error instanceof Error ? error.message : 'Lo siento, he tenido un problema de conexión con el servidor. ¿Puedes repetirlo?'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Solo propietarios y encargados pueden ver el bot
  if (user?.role === 'employee') return null;

  return (
    <>
      {/* Secondary action in document flow: never covers the day's work. */}
        <button
          type="button"
          aria-label="Abrir asistente"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          onClick={() => setIsOpen(true)}
          className="rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-4 py-3 text-sm flex items-center gap-2 hover:border-brand-500"
        >
          <Sparkles size={18} aria-hidden="true" /> Consultar asistente
        </button>

      {/* Ventana de Chat Overlay */}
      {isOpen && (
        <ModalDialog label="Asistente ERP" onClose={() => setIsOpen(false)}>
        <div className="h-[70dvh] max-h-[700px] flex flex-col overflow-hidden">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-brand-600 to-indigo-600 p-4 flex items-center justify-between text-white shrink-0">
            <div className="flex items-center gap-2">
              <Bot size={24} />
              <div>
                <h3 className="font-bold">Asistente ERP</h3>
                <p className="text-brand-100 text-xs">Solo consulta · activación opcional</p>
              </div>
            </div>
            <button 
              type="button" aria-label="Cerrar asistente"
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Area de Mensajes */}
          <div role="log" aria-label="Conversación del asistente" className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950/50">
            {messages.map(msg => (
              <div 
                key={msg.id} 
                className={`flex gap-3 max-w-[85%] ${msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
              >
                <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.sender === 'user' ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300' : 'bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400'}`}>
                  {msg.sender === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div className={`p-3 rounded-2xl text-sm ${
                  msg.sender === 'user' 
                    ? 'bg-brand-600 text-white rounded-tr-sm' 
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700 shadow-sm rounded-tl-sm'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 max-w-[85%]">
                <div className="shrink-0 w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-600 flex items-center justify-center">
                  <Bot size={16} />
                </div>
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm rounded-tl-sm flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin text-brand-500" />
                  <span className="text-xs text-slate-500">Analizando datos...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
            <div className="relative flex items-center">
              <input
                aria-label="Consulta de stock" data-autofocus
                type="text"
                maxLength={2000}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Consulta de stock…"
                className="w-full pl-4 pr-12 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-full text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 transition-all outline-none"
              />
              <button
                type="button" aria-label="Enviar consulta"
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="absolute right-2 p-2 bg-brand-600 text-white rounded-full hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:hover:bg-brand-600"
              >
                <Send size={16} className="ml-0.5" />
              </button>
            </div>
          </div>
        </div>
        </ModalDialog>
      )}
    </>
  );
}
