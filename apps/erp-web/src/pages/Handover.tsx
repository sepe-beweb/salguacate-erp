import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLocalScope } from '../hooks/useLocalScope';
import { useApiRead } from '../hooks/useApiLists';
import { useIdempotentCreate } from '../hooks/useIdempotentCreate';
import { API_URL } from '../config';
import { readJson, errorMessage } from '../apiResponse';
import { readWorkday, routineApplies, type Handover, type Workday } from '../handoverData';
import { LOCATIONS, locationLabel } from '../locations';
import { localDate } from '../localDate';
import { formatCivilDate, isCivilDate } from '../financialValues';
import { formatPresenceTimestamp } from '../presenceData';
import ModalDialog from '../components/ModalDialog';
import RequestError from '../components/RequestError';

const panel = 'rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3 min-w-0';
const button = 'rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm font-medium hover:border-brand-500 disabled:opacity-50';
const primary = `${button} bg-brand-600 text-white border-brand-600`;
const input = 'block mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-2 min-w-0';
type Body = { local: string; fecha?: string; contenido?: string; titulo?: string; fase?: string; frecuencia?: string; pasos?: string[] };
const blank = (local: string, fecha: string) => ({ local, fecha, contenido: '', titulo: '', fase: 'apertura', frecuencia: 'diaria', pasos: '' });

function CreateForm({ kind, local, fecha, reload }: { kind: 'rutina' | 'aviso'; local: string; fecha: string; reload: () => Promise<void> }) {
  const { user } = useAuth();
  const { payload, submit, locked, inFlight, confirmedId, recoveryError, discard } = useIdempotentCreate<Body>(kind === 'rutina' ? '/api/rutinas' : '/api/relevos');
  const [draft, setDraft] = useState(() => ({ ...blank(local, fecha), ...payload, pasos: payload?.pasos?.join('\n') ?? '' }));
  const [open, setOpen] = useState(Boolean(payload)); const [error, setError] = useState(''); const [success, setSuccess] = useState('');
  useEffect(() => {
    if (!confirmedId) return;
    setOpen(false); setError(''); setSuccess(`${kind === 'rutina' ? 'Rutina guardada' : 'Aviso guardado'} (n.º ${confirmedId}).`);
    setDraft(blank(local, fecha)); discard(); void reload();
  }, [confirmedId, discard, reload, kind, local, fecha]);
  const change = (key: keyof typeof draft, value: string) => setDraft(d => ({ ...d, [key]: value }));
  const title = kind === 'rutina' ? 'Nueva rutina' : 'Dejar aviso';
  return <div className="space-y-2">
    <button className={primary} onClick={() => {
      if (!draft.contenido && !draft.titulo && !draft.pasos && !payload) setDraft(blank(local, fecha));
      setOpen(true);
    }}>{payload ? `Revisar ${kind === 'rutina' ? 'rutina' : 'aviso'} pendiente` : title}</button>
    {success && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">{success}</p>}
    {open && <ModalDialog label={title} busy={inFlight} onClose={() => setOpen(false)} wide>
      <form className="p-5 space-y-4" onSubmit={async event => {
        event.preventDefault(); setError('');
        const body: Body = kind === 'rutina'
          ? { local: draft.local, titulo: draft.titulo.trim(), fase: draft.fase, frecuencia: draft.frecuencia, pasos: draft.pasos.split('\n').map(p => p.trim()).filter(Boolean) }
          : { local: draft.local, fecha: draft.fecha, contenido: draft.contenido.trim() };
        try { await submit(locked && payload ? payload : body); } catch (cause) { setError(errorMessage(cause)); }
      }}>
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="text-sm">{locationLabel(draft.local)} · {kind === 'aviso' ? 'Visible para el equipo de este local y la dirección.' : 'Cada paso se convertirá en una tarea compartida del local.'}</p>
        <RequestError message={error || recoveryError} />
        <fieldset disabled={locked || inFlight} className="space-y-3">
          <label className="block text-sm">{kind === 'rutina' ? 'Local de la rutina' : 'Local del aviso'}<select className={input} value={draft.local} onChange={e => change('local', e.target.value)} disabled={user?.role === 'employee'}>{LOCATIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}</select></label>
          {kind === 'rutina' ? <>
            <label className="block text-sm">Nombre de la rutina<input data-autofocus required maxLength={120} className={input} value={draft.titulo} onChange={e => change('titulo', e.target.value)} /></label>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-sm">Momento<select className={input} value={draft.fase} onChange={e => change('fase', e.target.value)}><option value="apertura">Apertura</option><option value="cierre">Cierre</option></select></label>
              <label className="text-sm">Repetición<select className={input} value={draft.frecuencia} onChange={e => change('frecuencia', e.target.value)}><option value="diaria">Todos los días</option><option value="laborables">Lunes a viernes</option><option value="fin_semana">Sábado y domingo</option></select></label>
            </div>
            <label className="block text-sm">Pasos, uno por línea<textarea required rows={6} maxLength={4830} className={input} value={draft.pasos} onChange={e => change('pasos', e.target.value)} /></label>
            <p className="text-xs text-slate-500">De 1 a 30 pasos, máximo 160 caracteres por paso. Crear la rutina no genera tareas todavía.</p>
          </> : <>
            <label className="block text-sm">Fecha del aviso<input type="date" required className={input} value={draft.fecha} onChange={e => change('fecha', e.target.value)} /></label>
            <label className="block text-sm">Qué debe saber el siguiente turno<textarea data-autofocus required maxLength={3000} rows={5} className={input} value={draft.contenido} onChange={e => change('contenido', e.target.value)} /></label>
            <p className="text-xs text-slate-500">Se registrará como {user?.name}. Evita información personal sensible; no se envían notificaciones externas.</p>
          </>}
        </fieldset>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={primary} disabled={inFlight}>{inFlight ? 'Guardando…' : locked ? 'Confirmar guardado pendiente' : kind === 'rutina' ? 'Guardar rutina' : 'Guardar aviso'}</button>
          <button type="button" className={button} disabled={inFlight} onClick={() => setOpen(false)}>Cerrar y conservar borrador</button>
          <button type="button" className={button} disabled={inFlight} onClick={() => {
            if (!window.confirm(locked ? 'El servidor puede haber guardado este intento. Descartarlo elimina la protección frente a duplicados. Comprueba el listado antes de crear otro. ¿Continuar?' : '¿Descartar este borrador?')) return;
            discard(); setDraft(blank(local, fecha)); setError(''); setOpen(false);
          }}>Descartar borrador</button>
        </div>
      </form>
    </ModalDialog>}
  </div>;
}

export default function HandoverPage() {
  const { user, fetchWithAuth } = useAuth(); const manager = user?.role !== 'employee';
  const [scope, setScope] = useLocalScope();
  const local = manager ? (scope === 'Segundo Local' ? scope : 'Principal') : user?.location ?? '';
  const [fecha, setFecha] = useState(localDate); const [history, setHistory] = useState(false);
  const [search, setSearch] = useSearchParams();
  const filter = ['mios', 'sin_responsable', 'resueltos'].includes(search.get('avisos') ?? '') ? search.get('avisos')! : 'pendientes';
  const [editing, setEditing] = useState<{ entry: Handover; responsible: string; priority: string; state: string; people: Workday['responsables'] } | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [configurationOpen, setConfigurationOpen] = useState(false);
  const { data, loading, error: loadError, reload } = useApiRead([`/api/jornada?${new URLSearchParams({ local, fecha })}`], readWorkday);
  const [busy, setBusy] = useState(false); const writing = useRef(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const verified = data && data.local === local && data.fecha === fecha;
  const blocked = busy || loading || Boolean(loadError) || !verified;
  const notices = data?.relevos.filter(r => filter === 'resueltos' ? r.estado === 'resuelto' : (history || r.estado !== 'resuelto') &&
    (filter === 'mios' ? String(r.responsable_id) === user?.id : filter === 'sin_responsable' ? r.responsable_id === null || !r.responsable_disponible : true)) ?? [];
  async function mutate(path: string, method: string, body: object = {}) {
    if (writing.current || blocked) return;
    writing.current = true; setBusy(true); setError(''); setMessage('');
    try {
      await readJson(await fetchWithAuth(`${API_URL}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
      setMessage('Cambio guardado. Se ha solicitado una lectura actualizada.');
      return true;
    } catch (cause) { setError(`${errorMessage(cause)} Se consultará el estado antes de permitir otro cambio.`); }
    finally { await reload(); writing.current = false; setBusy(false); }
  }
  return <div className="space-y-5 [overflow-wrap:anywhere]">
    <header className="space-y-3">
      <p className="text-sm text-slate-500">Continuidad entre turnos</p>
      <h2 className="text-2xl font-bold">Relevo y rutinas</h2>
      <p className="text-sm">Lo que hay que hacer y lo que el siguiente turno necesita saber.</p>
      <div className="flex flex-wrap gap-3 items-end">
        {manager ? <label className="text-sm">Local de la jornada<select className={input} disabled={busy} value={local} onChange={e => setScope(e.target.value)}>{LOCATIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}</select></label> : <p>{locationLabel(local)}</p>}
        <label className="text-sm">Día de las rutinas<input className={input} type="date" required disabled={busy} value={fecha} onChange={e => { if (isCivilDate(e.target.value)) setFecha(e.target.value); }} /></label>
        <button className={button} disabled={busy || loading} onClick={reload}>Actualizar jornada</button>
      </div>
      {manager && scope === 'Todos' && <p className="text-xs text-slate-500">Esta pantalla trabaja con un local cada vez. Mostrando Aguacate.</p>}
    </header>
    <RequestError message={error} />{message && <p role="status" className="text-sm">{message}</p>}
    <section aria-label="Avisos entre turnos" className={panel}>
      <h3 className="text-lg font-semibold">Avisos entre turnos</h3>
      <CreateForm kind="aviso" local={local} fecha={fecha} reload={reload} />
      <label className="block text-sm">Ver avisos<select className={`${input} sm:max-w-xs`} value={filter} onChange={e => { setSearch(e.target.value === 'pendientes' ? {} : { avisos: e.target.value }); setHistory(false); }}>
        <option value="pendientes">Todos los pendientes</option><option value="mios">Mis pendientes</option><option value="sin_responsable">Sin responsable disponible</option><option value="resueltos">Resueltos</option>
      </select></label>
      <p className="text-xs text-slate-500">Los pendientes siguen aquí aunque cambie el día. Abrirlos no los marca como leídos.</p>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={history} onChange={e => setHistory(e.target.checked)} />Mostrar también los resueltos</label>
      {loading ? <p role="status">Cargando jornada…</p> : loadError || !verified ? <RequestError message={loadError || 'No se ha podido verificar la jornada.'} onRetry={reload} /> : <>
        {!notices.length && <p className="text-sm text-slate-500">{filter === 'pendientes' ? 'No hay avisos pendientes para este local.' : 'No hay avisos con este filtro.'}</p>}
        {editing && !editorOpen && <button className={button} onClick={() => setEditorOpen(true)}>Continuar gestión del aviso #{editing.entry.id}</button>}
        <div className="space-y-3">{notices.map(r => <article key={r.id} className={`rounded-xl p-3 space-y-2 border ${r.prioridad === 'alta' && r.estado !== 'resuelto' ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800' : 'bg-slate-50 dark:bg-slate-800 border-transparent'}`}>
          <p className="text-xs text-slate-500">{r.autor_nombre} · {formatCivilDate(r.fecha)} · registrado {formatPresenceTimestamp(r.creado_en)}</p>
          <p className="text-xs font-semibold">{r.estado === 'en_curso' ? 'En curso' : r.estado === 'resuelto' ? 'Resuelto' : 'Pendiente'} · Prioridad {r.prioridad} · {r.responsable_nombre || 'Sin responsable'}</p>
          {r.responsable_id !== null && !r.responsable_disponible && r.estado !== 'resuelto' && <p className="text-sm text-amber-700 dark:text-amber-400">Responsable no disponible en este local. La dirección debe revisar la asignación.</p>}
          <p className="whitespace-pre-wrap text-sm">{r.contenido}</p>
          {r.resuelto_por !== null && <p className="text-sm text-emerald-700 dark:text-emerald-400">Resuelto por {r.resuelto_nombre} · {formatPresenceTimestamp(r.resuelto_en!)}</p>}
          <p className="text-xs">{r.lecturas.length ? `Lecturas confirmadas: ${r.lecturas.map(l => `${l.usuario_nombre} (${formatPresenceTimestamp(l.leido_en)})`).join(', ')}` : 'Sin lecturas confirmadas.'}</p>
          <div className="flex flex-wrap gap-2">
            {manager && <button className={button} disabled={blocked} onClick={() => {
              if (editing && editing.entry.id !== r.id) { setError('Hay una gestión en borrador. Continúala o descártala antes de editar otro aviso.'); return; }
              if (!editing) setEditing({ entry: r, responsible: String(r.responsable_id ?? ''), priority: r.prioridad, state: r.estado, people: data.responsables }); setEditorOpen(true);
            }}>Gestionar aviso</button>}
            {!manager && String(r.responsable_id) === user?.id && r.estado === 'pendiente' && <button className={button} disabled={blocked} onClick={() => mutate(`/api/relevos/${r.id}/gestion`, 'PUT', { responsable_id: r.responsable_id, prioridad: r.prioridad, estado: 'en_curso', revision: r.revision })}>Empezar mi gestión</button>}
            {r.lecturas.some(l => String(l.usuario_id) === user?.id) ? <p className="text-sm">Ya has confirmado la lectura</p> : <button className={button} disabled={blocked} onClick={() => mutate(`/api/relevos/${r.id}/leer`, 'PUT')}>He leído el aviso</button>}
            {manager && r.resuelto_por === null && <button className={button} disabled={blocked} onClick={() => { if (window.confirm('¿Marcar este aviso como resuelto? Se conservará en el historial con tu nombre.')) void mutate(`/api/relevos/${r.id}/gestion`, 'PUT', { responsable_id: r.responsable_id, prioridad: r.prioridad, estado: 'resuelto', revision: r.revision }); }}>Resolver aviso</button>}
          </div>
          {r.cambios.length > 0 && <details><summary className="cursor-pointer text-xs">Historial de gestión ({r.cambios.length})</summary><ul className="text-xs mt-2 space-y-2">{r.cambios.map(c => <li key={c.id}>{c.actor_nombre} · {formatPresenceTimestamp(c.creado_en)}<p>{c.detalle}</p></li>)}</ul></details>}
        </article>)}</div>
      </>}
    </section>
    {editing && editorOpen && <ModalDialog label="Gestionar aviso" busy={busy} onClose={() => setEditorOpen(false)}>
      <form className="p-5 space-y-4" onSubmit={async event => { event.preventDefault(); if (await mutate(`/api/relevos/${editing.entry.id}/gestion`, 'PUT', { responsable_id: editing.responsible ? Number(editing.responsible) : null, prioridad: editing.priority, estado: editing.state, revision: editing.entry.revision })) { setEditing(null); setEditorOpen(false); } }}>
        <h2 className="text-xl font-bold">Gestionar aviso</h2><p className="text-sm">{locationLabel(editing.entry.local)} · {editing.entry.contenido}</p><RequestError message={error} />
        <fieldset disabled={busy} className="space-y-3">
          <label className="block text-sm">Responsable<select data-autofocus className={input} value={editing.responsible} onChange={e => setEditing({ ...editing, responsible: e.target.value })}><option value="">Sin responsable</option>{editing.people.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}{editing.entry.responsable_id !== null && !editing.people.some(p => p.id === editing.entry.responsable_id) && <option value={editing.entry.responsable_id}>{editing.entry.responsable_nombre} · no disponible</option>}</select></label>
          <label className="block text-sm">Prioridad del aviso<select className={input} value={editing.priority} onChange={e => setEditing({ ...editing, priority: e.target.value })}><option value="normal">Normal</option><option value="alta">Alta</option></select></label>
          <label className="block text-sm">Estado del aviso<select className={input} value={editing.state} onChange={e => setEditing({ ...editing, state: e.target.value })}><option value="pendiente">Pendiente</option><option value="en_curso">En curso</option><option value="resuelto">Resuelto</option></select></label>
        </fieldset>
        <div className="flex flex-wrap gap-2"><button className={primary} disabled={blocked}>Guardar gestión</button><button type="button" className={button} disabled={busy} onClick={() => setEditorOpen(false)}>Cerrar y conservar</button>
          <button type="button" className={button} disabled={busy} onClick={() => { if (window.confirm('¿Descartar este borrador de gestión?')) { setEditing(null); setEditorOpen(false); setError(''); } }}>Descartar gestión</button>
        </div>
        <p className="text-xs text-slate-500">Si alguien ha cambiado el aviso, el guardado se detiene. Descarta el borrador y vuelve a abrir la gestión para partir de los datos actualizados.</p>
      </form>
    </ModalDialog>}
    <section aria-label="Rutinas del día" className={panel}>
      <h3 className="text-lg font-semibold">Apertura y cierre · {formatCivilDate(fecha)}</h3>
      <p className="text-sm">Listas compartidas por el equipo de {locationLabel(local)}. La marca registra quién terminó cada paso.</p>
      {manager && <div className="flex flex-wrap gap-3 items-start">
        <button className={primary} disabled={blocked} onClick={() => mutate('/api/rutinas/preparar', 'POST', { local, fecha })}>Preparar tareas del día</button>
        <CreateForm kind="rutina" local={local} fecha={fecha} reload={reload} />
      </div>}
      <p className="text-xs text-slate-500">La dirección prepara las tareas de forma explícita. Repetir la preparación del mismo día no duplica los pasos ya creados.</p>
      {verified && !loading && !loadError && <>
        {data.tareas.length === 0 && <p className="text-sm">Todavía no hay tareas de rutina preparadas para este día.</p>}
        <div className="grid md:grid-cols-2 gap-4">{(['apertura', 'cierre'] as const).map(phase => {
          const tasks = data.tareas.filter(t => t.fase === phase);
          return <section key={phase} aria-label={phase === 'apertura' ? 'Lista de apertura' : 'Lista de cierre'} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-3">
            <h4 className="font-semibold">{phase === 'apertura' ? 'Apertura' : 'Cierre'} · {tasks.filter(t => t.completada).length}/{tasks.length}</h4>
            {tasks.map(t => <div key={t.id} className="text-sm">
              <label className="flex gap-3 items-start py-2"><input type="checkbox" className="mt-1 w-4 h-4 shrink-0" checked={Boolean(t.completada)} disabled={blocked} onChange={() => mutate(`/api/tareas/${t.id}/completada`, 'PUT', { completada: !t.completada })} /><span>{t.titulo}<small className="block text-slate-500">{t.rutina_titulo}</small></span></label>
              {t.completada === 1 && <p className="text-xs text-emerald-700 dark:text-emerald-400 pl-7">{t.completado_nombre} · {formatPresenceTimestamp(t.completado_en!)}</p>}
            </div>)}
          </section>;
        })}</div>
        {manager && <details className="pt-2" open={configurationOpen}><summary className="cursor-pointer text-sm font-medium" onClick={event => { event.preventDefault(); setConfigurationOpen(open => !open); }}>Rutinas configuradas ({data.rutinas.filter(r => r.activa).length} activas)</summary>
          <ul className="space-y-3 mt-3">{data.rutinas.map(r => <li key={r.id} className="text-sm border-t border-slate-200 dark:border-slate-700 pt-3">
            <p className="font-medium">{r.titulo} · {r.fase}{!r.activa && ' · Archivada'}</p>
            <p>{r.frecuencia === 'diaria' ? 'Todos los días' : r.frecuencia === 'laborables' ? 'Lunes a viernes' : 'Sábado y domingo'} · {r.pasos.length} pasos</p>
            {r.activa === 1 && <p className="text-xs text-slate-500">{routineApplies(r, fecha) ? data.ejecuciones.some(e => e.rutina_id === r.id) ? 'Ya preparada para el día seleccionado.' : 'Se incluirá al preparar este día.' : 'No corresponde al día seleccionado.'}</p>}
            {r.activa === 1 && <button className={`${button} mt-2`} disabled={blocked} onClick={() => { if (window.confirm(`¿Archivar «${r.titulo}»? Sus tareas e historial se conservarán; no generará tareas nuevas.`)) void mutate(`/api/rutinas/${r.id}/archivar`, 'PUT'); }}>Archivar rutina</button>}
          </li>)}</ul>
          <p className="mt-3 text-xs text-slate-500">Para cambiar una lista, archívala y crea su sustituta. No se reescriben días ya preparados.</p>
        </details>}
      </>}
      <Link className="inline-block text-sm underline" to={manager ? '/tareas' : '/'}>Ver también las tareas generales</Link>
    </section>
  </div>;
}
