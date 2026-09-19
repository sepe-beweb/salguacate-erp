import { useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';
import { readJson, errorMessage } from '../apiResponse';
import { isValidNewPin } from '../pinValidation';

export default function ChangePin() {
  const { fetchWithAuth, logout } = useAuth();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const clearPins = () => { setCurrentPin(''); setNewPin(''); setConfirmation(''); };
  const cancel = () => { if (!inFlight.current) { clearPins(); logout(); } };
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    if (!/^\d{4,8}$/.test(currentPin) || !isValidNewPin(newPin) || newPin === currentPin) {
      setError('Indica tu PIN actual y uno nuevo de 6 a 8 dígitos, distinto del actual y no todos iguales.'); return;
    }
    if (confirmation !== newPin) { setError('La confirmación no coincide con el PIN nuevo.'); return; }
    inFlight.current = true;
    setBusy(true); setError('');
    try {
      const response = await fetchWithAuth(`${API_URL}/api/auth/pin`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPin, newPin })
      });
      const data = await readJson<{ success?: boolean } | null>(response);
      if (data?.success !== true) throw new Error('El servidor no confirmó el cambio de PIN.');
      clearPins();
      logout();
    } catch (cause) {
      setError(`${errorMessage(cause)} Si se perdió la conexión, sal y comprueba el acceso con el PIN nuevo antes de repetir el cambio.`);
    } finally { inFlight.current = false; setBusy(false); }
  }
  const fieldClass = 'block border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded p-3 w-full';
  return <main className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white p-4">
    <form onSubmit={submit} className="bg-white dark:bg-slate-900 rounded-2xl shadow p-6 max-w-md w-full">
      <fieldset disabled={busy} className="space-y-5">
      <h1 className="text-2xl font-bold">Renueva tu PIN</h1>
      <p id="renew-pin-help">Tu acceso antiguo requiere un PIN nuevo de 6 a 8 dígitos, no todos iguales. Después tendrás que volver a acceder.</p>
      <label className="block">PIN actual
        <input className={fieldClass} type="password" inputMode="numeric" autoComplete="current-password" pattern="[0-9]{4,8}" maxLength={8} required value={currentPin} onChange={e => setCurrentPin(e.target.value.replace(/\D/g, ''))} />
      </label>
      <label className="block">PIN nuevo
        <input className={fieldClass} type="password" inputMode="numeric" autoComplete="new-password" aria-describedby="renew-pin-help" pattern="[0-9]{6,8}" minLength={6} maxLength={8} required value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))} />
      </label>
      <label className="block">Confirmar PIN nuevo
        <input className={fieldClass} type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{6,8}" minLength={6} maxLength={8} required value={confirmation} onChange={e => setConfirmation(e.target.value.replace(/\D/g, ''))} />
      </label>
      {error && <p role="alert" className="text-red-700 dark:text-red-400">{error}</p>}
      <button type="submit" className="bg-brand-600 text-white rounded p-3 w-full disabled:opacity-50">{busy ? 'Guardando…' : 'Cambiar PIN y salir'}</button>
      <button type="button" onClick={cancel} className="w-full">Cancelar y salir</button>
      </fieldset>
    </form>
  </main>;
}
