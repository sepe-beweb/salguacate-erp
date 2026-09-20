import { useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { CreatePath } from '../pendingCreates';

function AttemptLink({ path, to, label }: { path: CreatePath; to: string; label: string }) {
  const { pendingCreates } = useAuth();
  const attempt = useSyncExternalStore(pendingCreates.subscribe, () => pendingCreates.get(path));
  if (!attempt) return null;
  return <Link to={to} className="underline font-medium">{label}: {attempt.busy ? 'guardando' : attempt.status === 'confirmed' ? 'confirmado' : 'por revisar'}</Link>;
}

export default function PendingCreatesNotice() {
  const { pendingCreates } = useAuth();
  const hasAttempts = useSyncExternalStore(pendingCreates.subscribe, () => Boolean(pendingCreates.get('/api/notas') || pendingCreates.get('/api/gastos') || pendingCreates.get('/api/rutinas') || pendingCreates.get('/api/relevos')));
  if (!hasAttempts) return null;
  return <aside aria-label="Guardados de esta sesión" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-950 p-3 text-sm space-y-2">
    <p>Guardados de esta sesión. Puedes navegar; al recargar o cerrar sesión se pierde esta recuperación.</p>
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      <AttemptLink path="/api/notas" to="/notas" label="Revisar nota" />
      <AttemptLink path="/api/gastos" to="/gastos" label="Revisar gasto" />
      <AttemptLink path="/api/rutinas" to="/turno" label="Revisar rutina" />
      <AttemptLink path="/api/relevos" to="/turno" label="Revisar aviso" />
    </div>
  </aside>;
}
