import { useState, useEffect } from 'react';
import { Users, CalendarClock, UserCheck, Loader2, X, Clock, MapPin, Plus, Pencil, Trash2, Phone, Sparkles } from 'lucide-react';

interface Employee {
  id: number;
  nombre: string;
  rol: string;
  local: string;
  telefono?: string;
  pin?: string;
  status?: string;
}

const EMPTY_EMP = { nombre: '', rol: 'employee', local: 'Principal', telefono: '', pin: '0000' };

export default function HRManagement() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [turnos, setTurnos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Employee CRUD modal
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [editingEmpId, setEditingEmpId] = useState<number | null>(null);
  const [empForm, setEmpForm] = useState(EMPTY_EMP);
  const [isEmpSubmitting, setIsEmpSubmitting] = useState(false);

  // Shift modal
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [newShift, setNewShift] = useState({ usuario_id: '', fecha: '', hora_inicio: '18:00', hora_fin: '02:00', local: 'Principal', compañeros: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      fetch('http://localhost:3001/api/usuarios').then(res => res.json()),
      fetch('http://localhost:3001/api/turnos').then(res => res.json())
    ])
    .then(([empData, turnosData]) => {
      setEmployees(empData.map((emp: Employee) => ({...emp, status: 'out'})));
      setTurnos(turnosData.sort((a: any, b: any) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()));
      setLoading(false);
    })
    .catch(err => {
      console.error("Error fetching data", err);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchData();
    const handleAiAction = () => fetchData();
    window.addEventListener('ai_action_executed', handleAiAction);
    return () => window.removeEventListener('ai_action_executed', handleAiAction);
  }, []);

  // --- Employee CRUD ---
  const openNewEmp = () => {
    setEditingEmpId(null);
    setEmpForm(EMPTY_EMP);
    setShowEmpModal(true);
  };

  const openEditEmp = (emp: Employee) => {
    setEditingEmpId(emp.id);
    setEmpForm({ nombre: emp.nombre, rol: emp.rol, local: emp.local || 'Principal', telefono: emp.telefono || '', pin: emp.pin || '0000' });
    setShowEmpModal(true);
  };

  const handleEmpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empForm.nombre) return;
    setIsEmpSubmitting(true);
    try {
      const url = editingEmpId
        ? `http://localhost:3001/api/usuarios/${editingEmpId}`
        : 'http://localhost:3001/api/usuarios';
      const method = editingEmpId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(empForm)
      });
      if (res.ok) {
        setShowEmpModal(false);
        setEditingEmpId(null);
        setEmpForm(EMPTY_EMP);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsEmpSubmitting(false);
    }
  };

  const handleDeleteEmp = async (id: number, nombre: string) => {
    if (!confirm(`¿Seguro que quieres eliminar a ${nombre}? Se perderán sus turnos y fichajes asociados.`)) return;
    try {
      const res = await fetch(`http://localhost:3001/api/usuarios/${id}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // --- Shift assignment ---
  const handleAssignShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShift.usuario_id || !newShift.fecha) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('http://localhost:3001/api/turnos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newShift)
      });
      if (res.ok) {
        setShowShiftModal(false);
        setNewShift({ usuario_id: '', fecha: '', hora_inicio: '18:00', hora_fin: '02:00', local: 'Principal', compañeros: '' });
        fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRolLabel = (rol: string) => {
    switch(rol) {
      case 'owner': return { label: 'Propietario', style: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' };
      case 'manager': return { label: 'Encargado', style: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' };
      default: return { label: 'Empleado', style: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' };
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Recursos Humanos</h2>
        <button 
          onClick={openNewEmp}
          className="bg-brand-600 hover:bg-brand-700 text-white p-2 rounded-full transition-colors shadow-md flex items-center gap-1 px-4"
        >
          <Plus size={18} /> <span className="font-semibold text-sm">Empleado</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div 
          onClick={() => setShowShiftModal(true)}
          className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center text-center transition-colors hover:border-brand-500 cursor-pointer"
        >
          <CalendarClock size={32} className="text-brand-500 mb-2" />
          <p className="text-sm font-medium text-slate-900 dark:text-white">Crear Cuadrante</p>
          <p className="text-xs text-slate-500 mt-1">Asignar turno</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center text-center transition-colors">
          <UserCheck size={32} className="text-brand-500 mb-2" />
          <p className="text-sm font-medium text-slate-900 dark:text-white">Plantilla</p>
          <div className="mt-1 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 text-xs font-bold px-2 py-0.5 rounded-full">
            {employees.length} personas
          </div>
        </div>
      </div>

      {/* Plantilla */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Users size={20} className="text-slate-500" />
          Plantilla
        </h3>
        
        <div className="space-y-3">
          {loading ? (
            <div className="flex justify-center p-8 text-brand-500">
              <Loader2 className="animate-spin" size={32} />
            </div>
          ) : employees.length === 0 ? (
            <p className="text-slate-500 text-center py-4">No hay empleados. Pulsa "+ Empleado" para añadir.</p>
          ) : (
            employees.map(emp => {
              const rolInfo = getRolLabel(emp.rol);
              return (
                <div key={emp.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center border border-brand-200 dark:border-brand-800">
                      <span className="font-bold text-brand-600 dark:text-brand-400">{emp.nombre.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">{emp.nombre}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${rolInfo.style}`}>{rolInfo.label}</span>
                        {emp.local && <span className="text-xs text-slate-400">{emp.local}</span>}
                      </div>
                      {emp.telefono && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
                          <Phone size={10} /> {emp.telefono}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEditEmp(emp)} className="text-slate-400 hover:text-brand-500 transition-colors p-1.5" title="Editar">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => handleDeleteEmp(emp.id, emp.nombre)} className="text-slate-400 hover:text-red-500 transition-colors p-1.5" title="Eliminar">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
        
        {/* Próximos Turnos */}
        <div className="flex justify-between items-center mt-8 mb-3">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarClock size={20} className="text-brand-500" />
            Agenda de Turnos
          </h3>
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('open_ai_chat', { 
                detail: { message: "Por favor, planifica automáticamente los turnos de esta semana para la plantilla actual y asígnalos usando la función asignar_turno." } 
              }));
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-200 to-yellow-400 dark:from-yellow-600/20 dark:to-amber-500/20 border border-yellow-300 dark:border-yellow-500/30 text-yellow-800 dark:text-yellow-400 px-3 py-1.5 rounded-full text-sm font-medium hover:scale-105 transition-transform shadow-sm"
          >
            <Sparkles size={16} className="text-yellow-600 dark:text-yellow-400 animate-pulse" />
            Autogenerar con IA
          </button>
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="flex justify-center p-8 text-brand-500">
              <Loader2 className="animate-spin" size={32} />
            </div>
          ) : turnos.length === 0 ? (
            <p className="text-slate-500 text-center py-4">No hay turnos asignados próximamente.</p>
          ) : (
            turnos.map(turno => {
              const turnoDate = new Date(turno.fecha);
              const isToday = new Date().toDateString() === turnoDate.toDateString();
              
              return (
                <div key={turno.id} className={`bg-white dark:bg-slate-900 p-4 rounded-xl border ${isToday ? 'border-brand-500 dark:border-brand-500/50 shadow-md shadow-brand-500/10' : 'border-slate-200 dark:border-slate-800 shadow-sm'} transition-colors`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isToday ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                        {turno.empleado_nombre ? turno.empleado_nombre.charAt(0) : '?'}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{turno.empleado_nombre}</p>
                        <p className="text-xs text-slate-500">{isToday ? 'HOY' : turnoDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded text-sm font-medium text-slate-700 dark:text-slate-300">
                      <Clock size={14} className="text-brand-500" />
                      {turno.hora_inicio} - {turno.hora_fin}
                    </div>
                  </div>
                  
                  <div className="mt-3 flex gap-4 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3">
                    <div className="flex items-center gap-1">
                      <MapPin size={14} />
                      {turno.local}
                    </div>
                    {turno.compañeros && (
                      <div className="flex items-center gap-1">
                        <Users size={14} />
                        Con: {turno.compañeros}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal: Crear/Editar Empleado */}
      {showEmpModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-xl p-6 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingEmpId ? 'Editar Empleado' : 'Nuevo Empleado'}
              </h3>
              <button onClick={() => { setShowEmpModal(false); setEditingEmpId(null); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleEmpSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre Completo</label>
                <input 
                  type="text" required
                  value={empForm.nombre}
                  onChange={e => setEmpForm({...empForm, nombre: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
                  placeholder="Ej. Ana García López"
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Rol</label>
                  <select 
                    value={empForm.rol}
                    onChange={e => setEmpForm({...empForm, rol: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
                  >
                    <option value="employee">Empleado</option>
                    <option value="manager">Encargado</option>
                    <option value="owner">Propietario</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Local</label>
                  <select 
                    value={empForm.local}
                    onChange={e => setEmpForm({...empForm, local: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
                  >
                    <option value="Principal">Principal</option>
                    <option value="Segundo Local">Segundo Local</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Teléfono (Opcional)</label>
                <input 
                  type="tel"
                  value={empForm.telefono}
                  onChange={e => setEmpForm({...empForm, telefono: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
                  placeholder="Ej. 612 345 678"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">PIN de Acceso</label>
                <input 
                  type="text"
                  inputMode="numeric"
                  maxLength={8}
                  value={empForm.pin}
                  onChange={e => setEmpForm({...empForm, pin: e.target.value.replace(/\D/g, '')})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white font-mono tracking-widest text-center"
                  placeholder="0000"
                />
                <p className="text-xs text-slate-400 mt-1">Mínimo 4 dígitos. Se usa para entrar a la app.</p>
              </div>
              <button 
                type="submit" disabled={isEmpSubmitting}
                className="w-full mt-2 bg-brand-600 hover:bg-brand-700 text-white font-medium py-3 rounded-lg flex justify-center items-center transition-colors disabled:opacity-50"
              >
                {isEmpSubmitting ? <Loader2 size={20} className="animate-spin" /> : (editingEmpId ? "Guardar Cambios" : "Añadir Empleado")}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Asignar Turno */}
      {showShiftModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-xl p-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Asignar Turno</h3>
              <button onClick={() => setShowShiftModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAssignShift} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Empleado</label>
                <select 
                  required
                  value={newShift.usuario_id}
                  onChange={e => setNewShift({...newShift, usuario_id: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
                >
                  <option value="">Selecciona empleado</option>
                  {employees.filter(e => e.rol === 'employee').map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fecha</label>
                <input 
                  type="date" required
                  value={newShift.fecha}
                  onChange={e => setNewShift({...newShift, fecha: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Hora Inicio</label>
                  <input 
                    type="time" required
                    value={newShift.hora_inicio}
                    onChange={e => setNewShift({...newShift, hora_inicio: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Hora Fin</label>
                  <input 
                    type="time" required
                    value={newShift.hora_fin}
                    onChange={e => setNewShift({...newShift, hora_fin: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Compañeros (opcional)</label>
                <input 
                  type="text" 
                  value={newShift.compañeros}
                  onChange={e => setNewShift({...newShift, compañeros: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
                  placeholder="Ej. Juan Pérez"
                />
              </div>
              <button 
                type="submit" disabled={isSubmitting}
                className="w-full mt-2 bg-brand-600 hover:bg-brand-700 text-white font-medium py-3 rounded-lg flex justify-center items-center transition-colors disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : "Guardar Turno"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
