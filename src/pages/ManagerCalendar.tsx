import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, Plus, Trash2, Loader2, X, AlertCircle, Briefcase, Wrench, FileText, Headphones, Mic2, Sparkles, Download, Pencil } from 'lucide-react';
import { API_URL } from '../config';

interface Evento {
  id: number;
  titulo: string;
  fecha: string;
  hora: string;
  descripcion: string;
  tipo: string;
}

const EMPTY_EVENT = { titulo: '', fecha: '', hora: '10:00', descripcion: '', tipo: 'General' };

export default function ManagerCalendar() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Edit mode
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // Poster Generator state
  const [posterEvento, setPosterEvento] = useState<Evento | null>(null);
  const [posterLoading, setPosterLoading] = useState(false);
  const [posterImage, setPosterImage] = useState<string | null>(null);
  const [posterError, setPosterError] = useState<string | null>(null);
  
  const today = new Date().toISOString().split('T')[0];
  const [formData, setFormData] = useState({ ...EMPTY_EVENT, fecha: today });

  const fetchEventos = () => {
    setLoading(true);
    fetch(`${API_URL}/api/eventos`)
      .then(res => res.json())
      .then(data => {
        setEventos(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchEventos();
    const handleAiAction = () => fetchEventos();
    window.addEventListener('ai_action_executed', handleAiAction);
    return () => window.removeEventListener('ai_action_executed', handleAiAction);
  }, []);

  // Open modal for NEW event
  const openNewModal = () => {
    setEditingId(null);
    setFormData({ ...EMPTY_EVENT, fecha: today });
    setShowModal(true);
  };

  // Open modal for EDITING an existing event
  const openEditModal = (evento: Evento) => {
    setEditingId(evento.id);
    setFormData({
      titulo: evento.titulo,
      fecha: evento.fecha,
      hora: evento.hora,
      descripcion: evento.descripcion || '',
      tipo: evento.tipo
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.titulo || !formData.fecha || !formData.hora) return;
    
    setIsSubmitting(true);
    try {
      const url = editingId 
        ? `${API_URL}/api/eventos/${editingId}`
        : `${API_URL}/api/eventos`;
      const method = editingId ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setShowModal(false);
        setEditingId(null);
        setFormData({ ...EMPTY_EVENT, fecha: today });
        fetchEventos();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Seguro que quieres borrar este evento?')) return;
    try {
      const res = await fetch(`${API_URL}/api/eventos/${id}`, { method: 'DELETE' });
      if (res.ok) fetchEventos();
    } catch (err) {
      console.error(err);
    }
  };

  // Poster generation
  const handleGeneratePoster = async (evento: Evento) => {
    setPosterEvento(evento);
    setPosterLoading(true);
    setPosterImage(null);
    setPosterError(null);

    try {
      const res = await fetch(`${API_URL}/api/ai/poster`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: evento.titulo,
          fecha: evento.fecha,
          hora: evento.hora,
          tipo: evento.tipo,
          descripcion: evento.descripcion
        })
      });
      const data = await res.json();
      if (data.success && data.image) {
        setPosterImage(data.image);
      } else {
        setPosterError(data.error || 'No se pudo generar el cartel. Asegúrate de que la API de Imagen tiene facturación activa.');
      }
    } catch (err) {
      setPosterError('Error de conexión con el servidor.');
      console.error(err);
    } finally {
      setPosterLoading(false);
    }
  };

  const handleDownloadPoster = () => {
    if (!posterImage || !posterEvento) return;
    const link = document.createElement('a');
    link.href = posterImage;
    link.download = `cartel_${posterEvento.titulo.replace(/\s+/g, '_').toLowerCase()}.png`;
    link.click();
  };

  const isMusicalEvent = (tipo: string) => tipo === 'Pinchada' || tipo === 'Concierto';

  const getTipoEstilos = (tipo: string) => {
    switch(tipo) {
      case 'Mantenimiento': return { bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-800', text: 'text-orange-700 dark:text-orange-400', icon: <Wrench size={18} /> };
      case 'Proveedor': return { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-400', icon: <Briefcase size={18} /> };
      case 'Reunion': return { bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-200 dark:border-purple-800', text: 'text-purple-700 dark:text-purple-400', icon: <AlertCircle size={18} /> };
      case 'Pinchada': return { bg: 'bg-pink-50 dark:bg-pink-900/20', border: 'border-pink-300 dark:border-pink-700', text: 'text-pink-600 dark:text-pink-400', icon: <Headphones size={18} /> };
      case 'Concierto': return { bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-300 dark:border-emerald-700', text: 'text-emerald-600 dark:text-emerald-400', icon: <Mic2 size={18} /> };
      default: return { bg: 'bg-slate-50 dark:bg-slate-800/50', border: 'border-slate-200 dark:border-slate-700', text: 'text-slate-700 dark:text-slate-300', icon: <FileText size={18} /> };
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <CalendarIcon className="text-brand-500" />
          Agenda
        </h2>
        <button 
          onClick={openNewModal}
          className="bg-brand-600 hover:bg-brand-700 text-white p-2 rounded-full transition-colors shadow-md flex items-center gap-1 px-4"
        >
          <Plus size={18} /> <span className="font-semibold text-sm">Nuevo</span>
        </button>
      </div>

      {/* Modal: Crear / Editar Evento */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-xl p-6 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingId ? 'Editar Evento' : 'Añadir a la Agenda'}
              </h3>
              <button onClick={() => { setShowModal(false); setEditingId(null); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Título</label>
                <input 
                  type="text" required
                  value={formData.titulo}
                  onChange={e => setFormData({...formData, titulo: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
                  placeholder="Ej. Noche de Techno con DJ Marko"
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fecha</label>
                  <input 
                    type="date" required
                    value={formData.fecha}
                    onChange={e => setFormData({...formData, fecha: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Hora</label>
                  <input 
                    type="time" required
                    value={formData.hora}
                    onChange={e => setFormData({...formData, hora: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo de Evento</label>
                <select 
                  value={formData.tipo}
                  onChange={e => setFormData({...formData, tipo: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
                >
                  <optgroup label="General">
                    <option value="General">General</option>
                    <option value="Mantenimiento">Mantenimiento</option>
                    <option value="Proveedor">Cita con Proveedor</option>
                    <option value="Reunion">Reunión</option>
                  </optgroup>
                  <optgroup label="🎵 Música">
                    <option value="Pinchada">🎧 Pinchada / DJ Set</option>
                    <option value="Concierto">🎤 Concierto / Música en Vivo</option>
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notas (Opcional)</label>
                <textarea 
                  rows={2}
                  value={formData.descripcion}
                  onChange={e => setFormData({...formData, descripcion: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white resize-none"
                  placeholder="Detalles adicionales..."
                ></textarea>
              </div>
              <button 
                type="submit" disabled={isSubmitting}
                className="w-full mt-4 bg-brand-600 hover:bg-brand-700 text-white font-medium py-3 rounded-lg flex justify-center items-center transition-colors disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : (editingId ? "Guardar Cambios" : "Guardar Evento")}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Poster Generator */}
      {posterEvento && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 p-5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Sparkles size={20} className="text-yellow-300" />
                <h3 className="text-lg font-bold text-white">Generador de Carteles IA</h3>
              </div>
              <button onClick={() => { setPosterEvento(null); setPosterImage(null); setPosterError(null); }} className="text-white/70 hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-slate-400 text-sm mb-4">
                Generando cartel para: <span className="text-white font-semibold">{posterEvento.titulo}</span>
              </p>

              {posterLoading && (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div className="relative">
                    <Loader2 size={48} className="animate-spin text-pink-500" />
                    <Sparkles size={20} className="absolute -top-1 -right-1 text-yellow-400 animate-pulse" />
                  </div>
                  <p className="text-slate-400 text-sm animate-pulse">La IA está diseñando tu cartel...</p>
                </div>
              )}

              {posterError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl text-sm text-center">
                  {posterError}
                </div>
              )}

              {posterImage && (
                <div className="space-y-4">
                  <div className="rounded-xl overflow-hidden border border-slate-700 shadow-lg">
                    <img src={posterImage} alt="Cartel generado" className="w-full" />
                  </div>
                  <button
                    onClick={handleDownloadPoster}
                    className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
                  >
                    <Download size={18} />
                    Descargar Cartel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lista de eventos */}
      {loading ? (
        <div className="flex justify-center py-12 text-brand-500">
          <Loader2 className="animate-spin" size={32} />
        </div>
      ) : eventos.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center shadow-sm">
          <div className="bg-slate-100 dark:bg-slate-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <CalendarIcon size={32} className="text-slate-400" />
          </div>
          <p className="text-lg font-bold text-slate-900 dark:text-white">Agenda Libre</p>
          <p className="text-slate-500 mt-1">No tienes próximos eventos programados.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {eventos.map((evento) => {
            const estilos = getTipoEstilos(evento.tipo);
            const isPast = new Date(`${evento.fecha}T${evento.hora}`) < new Date();
            
            return (
              <div 
                key={evento.id} 
                className={`${estilos.bg} border ${estilos.border} rounded-2xl p-4 shadow-sm flex gap-4 ${isPast ? 'opacity-50 grayscale' : ''} transition-all`}
              >
                <div className={`mt-1 ${estilos.text}`}>
                  {estilos.icon}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h3 className={`font-bold ${isPast ? 'line-through' : ''} text-slate-900 dark:text-white text-lg`}>{evento.titulo}</h3>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEditModal(evento)} className="text-slate-400 hover:text-brand-500 transition-colors p-1" title="Editar">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => handleDelete(evento.id)} className="text-slate-400 hover:text-red-500 transition-colors p-1" title="Eliminar">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300">
                      <CalendarIcon size={14} className={estilos.text} />
                      {new Date(evento.fecha).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300">
                      <Clock size={14} className={estilos.text} />
                      {evento.hora}
                    </div>
                    <div className={`text-xs px-2 py-0.5 rounded-full font-bold border ${estilos.border} ${estilos.text}`}>
                      {evento.tipo}
                    </div>
                  </div>
                  
                  {evento.descripcion && (
                    <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 bg-white/50 dark:bg-black/20 p-2.5 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
                      {evento.descripcion}
                    </p>
                  )}

                  {/* Botón Crear Cartel — solo en eventos musicales y no pasados */}
                  {isMusicalEvent(evento.tipo) && !isPast && (
                    <button
                      onClick={() => handleGeneratePoster(evento)}
                      className="mt-3 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white text-xs font-bold py-2 px-4 rounded-xl flex items-center gap-1.5 transition-all shadow-md hover:shadow-lg"
                    >
                      <Sparkles size={14} />
                      Crear Cartel Promocional
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
