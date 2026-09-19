import { useState, useEffect } from 'react';
import { UserCheck, Loader2, X, Plus, Pencil, Trash2, CalendarClock, Phone, MapPin, Lock, Check } from 'lucide-react';
import { API_URL } from '../config';
import { readJson, errorMessage } from '../apiResponse';
import { useAuth } from '../context/AuthContext';
import { useApiRead } from '../hooks/useApiLists';
import { readPersonnelWorkspace, requestCreatedAt, type StaffMember as Employee } from '../personnelData';
import { formatCivilDate } from '../financialValues';
import RequestError from '../components/RequestError';

const EMPTY_EMP = { nombre: '', rol: 'employee', local: 'Principal', telefono: '', pin: '' };

export default function HRManagement() {
  const { fetchWithAuth, user } = useAuth();
  const [activeSection, setActiveSection] = useState<'employees' | 'requests'>('employees');
  
  const { data, loading, error: loadError, reload: fetchData } = useApiRead(['/api/usuarios', '/api/turnos', '/api/peticiones'], readPersonnelWorkspace);
  const employees = data?.[0] ?? [];
  const peticiones = data?.[2] ?? [];
  const [busy, setBusy] = useState(false);

  // Employee CRUD modal
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [editingEmpId, setEditingEmpId] = useState<number | null>(null);
  const [empForm, setEmpForm] = useState(EMPTY_EMP);
  const [isEmpSubmitting, setIsEmpSubmitting] = useState(false);
  const [crudError, setCrudError] = useState('');

  // Shift modal
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [newShift, setNewShift] = useState({ usuario_id: '', fecha: '', hora_inicio: '18:00', hora_fin: '02:00', local: 'Principal', compañeros: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const handleAiAction = () => fetchData();
    window.addEventListener('ai_action_executed', handleAiAction);
    return () => window.removeEventListener('ai_action_executed', handleAiAction);
  }, [fetchData]);

  // --- Employee CRUD ---
  const openNewEmp = () => {
    setEditingEmpId(null);
    setCrudError('');
    setEmpForm(EMPTY_EMP);
    setShowEmpModal(true);
  };

  const openEditEmp = (emp: Employee) => {
    setEditingEmpId(emp.id);
    setCrudError('');
    setEmpForm({ 
      nombre: emp.nombre, 
      rol: emp.rol, 
      local: emp.local || 'Principal', 
      telefono: emp.telefono || '', 
      pin: '' // Dejar PIN vacío al iniciar edición (para no exponerlo)
    });
    setShowEmpModal(true);
  };

  const handleEmpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empForm.nombre || isEmpSubmitting || isSubmitting || busy || loading || loadError) return;
    setIsEmpSubmitting(true);
    setCrudError('');
    try {
      const url = editingEmpId
        ? `${API_URL}/api/usuarios/${editingEmpId}`
        : `${API_URL}/api/usuarios`;
      const method = editingEmpId ? 'PUT' : 'POST';
      
      const payload = { ...empForm };
      if (!editingEmpId && !payload.pin) {
        alert('Indica un PIN de 6 a 8 dígitos para el nuevo empleado.');
        return;
      }

      const res = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      await readJson(res);
        setShowEmpModal(false);
        setEditingEmpId(null);
        setEmpForm(EMPTY_EMP);
        fetchData();
    } catch (err) {
      setCrudError(errorMessage(err));
    } finally {
      setIsEmpSubmitting(false);
    }
  };

  const handleEmpDelete = async (id: number) => {
    if (busy || isSubmitting || isEmpSubmitting || loading || loadError) return;
    if (!confirm('¿Desactivar este empleado? Perderá acceso; sus turnos y fichajes se conservarán.')) return;
    setCrudError(''); setBusy(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/usuarios/${id}`, { method: 'DELETE' });
      await readJson(res); await fetchData();
    } catch (err) {
      setCrudError(`${errorMessage(err)} Revisa la plantilla antes de repetir la desactivación.`); await fetchData();
    } finally { setBusy(false); }
  };

  // --- Shift assignment ---
  const handleAssignShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShift.usuario_id || !newShift.fecha || isSubmitting || isEmpSubmitting || busy || loading || loadError) return;
    setIsSubmitting(true); setCrudError('');
    try {
      const res = await fetchWithAuth(`${API_URL}/api/turnos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newShift)
      });
      await readJson(res);
        setShowShiftModal(false);
        setNewShift({ usuario_id: '', fecha: '', hora_inicio: '18:00', hora_fin: '02:00', local: 'Principal', compañeros: '' });
        fetchData();
    } catch (err) {
      console.error(err);
      setCrudError(errorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- [NUEVO P0] Aprobación/Rechazo de Peticiones ---
  const handleRequestStatus = async (id: number, estado: 'aprobado' | 'rechazado') => {
    if (busy || isSubmitting || isEmpSubmitting || loading || loadError) return;
    setBusy(true); setCrudError('');
    try {
      const res = await fetchWithAuth(`${API_URL}/api/peticiones/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado })
      });
      await readJson(res); await fetchData();
    } catch (err) {
      setCrudError(`${errorMessage(err)} Comprueba la petición antes de repetir la decisión.`); await fetchData();
    } finally { setBusy(false); }
  };

  const getRolLabel = (rol: string) => {
    switch(rol) {
      case 'owner': return { label: 'Propietario', style: 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400' };
      case 'manager': return { label: 'Encargado', style: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' };
      default: return { label: 'Empleado', style: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' };
    }
  };

  const getRequestTypeLabel = (type: string) => {
    switch(type) {
      case 'vacaciones': return { label: 'Vacaciones 🏖️', style: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' };
      case 'cambio': return { label: 'Cambio de Turno 🔁', style: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' };
      case 'baja': return { label: 'Baja Médica 🤒', style: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400' };
      default: return { label: 'Asuntos Propios 💼', style: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' };
    }
  };

  const canEditEmployee = (emp: Employee) => user?.role === 'owner' || emp.rol === 'employee';

  if (loading) return <p role="status" className="p-8 text-center">Cargando plantilla, turnos y peticiones...</p>;
  if (loadError || !data) return <RequestError message={loadError || 'No se pudo cargar Recursos Humanos.'} onRetry={fetchData} />;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Recursos Humanos</h2>
        <button 
          disabled={busy || isSubmitting || isEmpSubmitting} onClick={openNewEmp}
          className="bg-brand-600 hover:bg-brand-700 text-white p-2 rounded-full transition-colors shadow-md flex items-center gap-1 px-4"
        >
          <Plus size={18} /> <span className="font-semibold text-sm">Empleado</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button type="button" disabled={busy || isSubmitting || isEmpSubmitting}
          onClick={() => { setCrudError(''); setShowShiftModal(true); }}
          className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center text-center transition-colors hover:border-brand-500 cursor-pointer"
        >
          <CalendarClock size={32} className="text-brand-500 mb-2" />
          <p className="text-sm font-medium text-slate-900 dark:text-white">Crear Cuadrante</p>
          <p className="text-xs text-slate-500 mt-1">Asignar turno</p>
        </button>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center text-center transition-colors">
          <UserCheck size={32} className="text-brand-500 mb-2" />
          <p className="text-sm font-medium text-slate-900 dark:text-white">Plantilla</p>
          <div className="mt-1 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 text-xs font-bold px-2 py-0.5 rounded-full">
            {employees.length} personas
          </div>
        </div>
      </div>

      {crudError && !showEmpModal && !showShiftModal && (
        <div role="alert" className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 p-4 rounded-xl text-red-600 dark:text-red-400 text-sm">
          {crudError}
        </div>
      )}

      {/* --- Navegación de Pestañas --- */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveSection('employees')}
          className={`flex-1 pb-3 text-sm font-semibold transition-colors border-b-2 text-center ${activeSection === 'employees' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Plantilla ({employees.length})
        </button>
        <button
          onClick={() => setActiveSection('requests')}
          className={`flex-1 pb-3 text-sm font-semibold transition-colors border-b-2 text-center ${activeSection === 'requests' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Peticiones de Personal ({peticiones.filter(p => p.estado === 'pendiente').length} pendientes)
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-8 text-brand-500">
          <Loader2 className="animate-spin" size={32} />
        </div>
      ) : activeSection === 'employees' ? (
        /* --- PANELES DE PLANTILLA --- */
        <div className="space-y-4">
          <div className="space-y-3">
            {employees.length === 0 ? (
              <p className="text-slate-400 dark:text-slate-500 text-sm text-center py-4">No hay personas activas en la plantilla.</p>
            ) : (
              employees.map(emp => {
                const label = getRolLabel(emp.rol);
                return (
                  <div key={emp.id} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-950 dark:text-white">{emp.nombre}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${label.style}`}>{label.label}</span>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                        {emp.telefono && (
                          <span className="flex items-center gap-1"><Phone size={12} /> {emp.telefono}</span>
                        )}
                        <span className="flex items-center gap-1"><MapPin size={12} /> {emp.local || 'Local no indicado'}</span>
                        <span className="flex items-center gap-0.5 text-slate-400">
                          <Lock size={11} className={emp.has_pin ? "text-emerald-500" : "text-amber-500"} />
                          {emp.has_pin ? 'PIN configurado' : 'PIN no configurado'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {canEditEmployee(emp) && (
                        <button
                          disabled={busy || isSubmitting || isEmpSubmitting} onClick={() => openEditEmp(emp)}
                          className="p-2 text-slate-500 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          title="Editar empleado"
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                      {user?.role === 'owner' && (
                        <button
                          disabled={busy || isSubmitting || isEmpSubmitting} onClick={() => handleEmpDelete(emp.id)}
                          className="p-2 text-slate-500 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          title="Desactivar empleado"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* --- [NUEVO P0] PANELES DE PETICIONES DE PERSONAL --- */
        <div className="space-y-4">
          {peticiones.length === 0 ? (
            <p className="text-slate-400 dark:text-slate-500 text-sm text-center py-8">No hay peticiones registradas de ningún empleado.</p>
          ) : (
            peticiones.map(p => {
              const typeLabel = getRequestTypeLabel(p.tipo);
              return (
                <div key={p.id} className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3.5 transition-colors">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-slate-900 dark:text-white text-base">{p.empleado_nombre}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">{getRolLabel(p.empleado_rol).label} · {p.empleado_local}</p>
                    </div>
                    
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${typeLabel.style}`}>
                      {typeLabel.label}
                    </span>
                  </div>

                  <div className="text-sm bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl space-y-1 text-slate-700 dark:text-slate-300">
                    <p><strong className="text-xs text-slate-400">Fecha Inicio:</strong> {formatCivilDate(p.fecha_inicio)}</p>
                    {p.fecha_fin && (
                      <p><strong className="text-xs text-slate-400">Fecha Fin:</strong> {formatCivilDate(p.fecha_fin)}</p>
                    )}
                    {p.comentarios && (
                      <p className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/50 text-xs italic text-slate-500 dark:text-slate-400">"{p.comentarios}"</p>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-1">
                    <span className="text-[10px] text-slate-400">Solicitado el {requestCreatedAt(p.creado_en).toLocaleString('es-ES', { year: 'numeric', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                    
                    <div className="flex items-center gap-2">
                      {p.estado === 'pendiente' ? (
                        <>
                          <button
                            disabled={busy} onClick={() => handleRequestStatus(p.id, 'rechazado')}
                            className="flex items-center gap-1 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-700 dark:text-red-400 text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors"
                          >
                            <X size={14} /> Rechazar
                          </button>
                          <button
                            disabled={busy} onClick={() => handleRequestStatus(p.id, 'aprobado')}
                            className="flex items-center gap-1 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors shadow-sm"
                          >
                            <Check size={14} /> Aprobar
                          </button>
                        </>
                      ) : (
                        <span className={`text-xs font-bold px-3 py-1.5 rounded-xl ${
                          p.estado === 'aprobado' 
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/20' 
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                        }`}>
                          {p.estado === 'aprobado' ? '✅ Aprobada' : '❌ Rechazada'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* --- CRUD MODAL --- */}
      {showEmpModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {editingEmpId ? "Editar Empleado" : "Añadir Empleado"}
              </h3>
              <button 
                aria-label="Cerrar empleado" disabled={isEmpSubmitting} onClick={() => setShowEmpModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEmpSubmit} className="space-y-4">
              <fieldset disabled={isEmpSubmitting} className="space-y-4">
              {crudError && <p role="alert" className="text-red-700">{crudError}</p>}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre Completo</label>
                <input 
                  type="text" required
                  value={empForm.nombre}
                  onChange={e => setEmpForm({...empForm, nombre: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
                  placeholder="Ej. Juan Pérez"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Rol</label>
                  <select 
                    value={empForm.rol}
                    onChange={e => setEmpForm({...empForm, rol: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
                  >
                    <option value="employee">Empleado</option>
                    {user?.role === 'owner' && <option value="manager">Encargado</option>}
                    {user?.role === 'owner' && <option value="owner">Propietario</option>}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Local</label>
                  <select 
                    value={empForm.local}
                    onChange={e => setEmpForm({...empForm, local: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
                  >
                    <option value="Principal">Principal</option>
                    <option value="Segundo Local">Segundo Local</option>
                    <option value="Todos">Todos</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Teléfono</label>
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
                  placeholder={editingEmpId ? "Vacío para mantener el PIN actual" : "PIN de 6 a 8 dígitos"}
                />
                <p className="text-xs text-slate-400 mt-1">Mínimo 4 dígitos. Se usa para entrar a la app.</p>
              </div>
              <button 
                type="submit" disabled={isEmpSubmitting}
                className="w-full mt-2 bg-brand-600 hover:bg-brand-700 text-white font-medium py-3 rounded-lg flex justify-center items-center transition-colors disabled:opacity-50"
              >
                {isEmpSubmitting ? <Loader2 size={20} className="animate-spin" /> : (editingEmpId ? "Guardar Cambios" : "Añadir Empleado")}
              </button>
              </fieldset>
            </form>
          </div>
        </div>
      )}

      {/* --- SHIFT MODAL --- */}
      {showShiftModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Asignar Turno</h3>
              <button 
                aria-label="Cerrar turno" disabled={isSubmitting} onClick={() => setShowShiftModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAssignShift} className="space-y-4">
              <fieldset disabled={isSubmitting} className="space-y-4">
              {crudError && <p role="alert" className="text-red-700">{crudError}</p>}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Empleado</label>
                <select 
                  required
                  value={newShift.usuario_id}
                  onChange={e => setNewShift({...newShift, usuario_id: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
                >
                  <option value="">Selecciona empleado...</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fecha</label>
                  <input 
                    type="date" required
                    value={newShift.fecha}
                    onChange={e => setNewShift({...newShift, fecha: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Local</label>
                  <select 
                    value={newShift.local}
                    onChange={e => setNewShift({...newShift, local: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
                  >
                    <option value="Principal">Principal</option>
                    <option value="Segundo Local">Segundo Local</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Hora Inicio</label>
                  <input 
                    type="time" required
                    value={newShift.hora_inicio}
                    onChange={e => setNewShift({...newShift, hora_inicio: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
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
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Compañeros (Opcional)</label>
                <input 
                  type="text"
                  value={newShift.compañeros}
                  onChange={e => setNewShift({...newShift, compañeros: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
                  placeholder="Ej. María García, Pedro"
                />
              </div>
              <button 
                type="submit" disabled={isSubmitting}
                className="w-full mt-2 bg-brand-600 hover:bg-brand-700 text-white font-medium py-3 rounded-lg flex justify-center items-center transition-colors disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : "Guardar Turno"}
              </button>
              </fieldset>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
