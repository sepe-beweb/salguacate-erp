import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';

export default function ChangePin() {
  const { fetchWithAuth, logout } = useAuth();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const response = await fetchWithAuth(`${API_URL}/api/auth/pin`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPin, newPin })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo cambiar el PIN.');
      logout();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error de conexión.');
    } finally { setBusy(false); }
  }
  return <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
    <form onSubmit={submit} className="bg-white rounded-2xl shadow p-8 space-y-5 max-w-md w-full">
      <h1 className="text-2xl font-bold">Renueva tu PIN</h1>
      <p>Tu acceso antiguo requiere un PIN nuevo de 6 a 8 dígitos. Después tendrás que volver a acceder.</p>
      <label className="block">PIN actual
        <input className="block border rounded p-3 w-full" type="password" inputMode="numeric" autoComplete="current-password" maxLength={8} required value={currentPin} onChange={e => setCurrentPin(e.target.value.replace(/\D/g, ''))} />
      </label>
      <label className="block">PIN nuevo
        <input className="block border rounded p-3 w-full" type="password" inputMode="numeric" autoComplete="new-password" minLength={6} maxLength={8} required value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))} />
      </label>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <button className="bg-brand-600 text-white rounded p-3 w-full" disabled={busy}>{busy ? 'Guardando…' : 'Cambiar PIN y salir'}</button>
      <button type="button" onClick={logout} className="w-full">Cancelar y salir</button>
    </form>
  </main>;
}
