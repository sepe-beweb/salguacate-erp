import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Store, User as UserIcon, Lock, Loader2, AlertCircle, ChevronLeft } from 'lucide-react';
import { API_URL } from '../config';

interface PublicUser {
  id: number;
  nombre: string;
  rol: string;
}

export default function Login() {
  const { login } = useAuth();
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<PublicUser | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLogging, setIsLogging] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/usuarios/public`)
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(data => { setUsers(data); setLoading(false); })
      .catch(() => {
        setError('No se pudo establecer conexión con el servidor backend');
        setLoading(false);
      });
  }, []);

  const getRoleIcon = (rol: string) => {
    switch(rol) {
      case 'owner': return <ShieldCheck size={24} />;
      case 'manager': return <Store size={24} />;
      default: return <UserIcon size={24} />;
    }
  };

  const getRoleStyle = (rol: string) => {
    switch(rol) {
      case 'owner': return 'bg-brand-100 dark:bg-brand-900/50 text-brand-600 dark:text-brand-400';
      case 'manager': return 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400';
      default: return 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400';
    }
  };

  const getRoleLabel = (rol: string) => {
    switch(rol) {
      case 'owner': return 'Propietario';
      case 'manager': return 'Encargado';
      default: return 'Empleado';
    }
  };

  const handleLogin = async () => {
    if (!selectedUser || pin.length < 4) return;
    setIsLogging(true);
    setError('');
    
    const res = await login(selectedUser.id, pin);
    if (!res.success) {
      setError(res.error || 'PIN incorrecto');
      setPin('');
    }
    setIsLogging(false);
  };

  const handlePinKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 transition-colors duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-xl border border-slate-200 dark:border-slate-800 space-y-6 animate-in fade-in zoom-in-95 duration-500">
        
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-brand-100 dark:bg-brand-900/30 rounded-2xl mx-auto flex items-center justify-center mb-4">
            <Store size={32} className="text-brand-600 dark:text-brand-400" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-brand-600 to-brand-800 dark:from-brand-400 dark:to-brand-600 bg-clip-text text-transparent">
            Salguacate
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            {selectedUser ? 'Introduce tu PIN' : 'Selecciona tu perfil'}
          </p>
        </div>

        {/* Step 1: User selection */}
        {!selectedUser && (
          <div className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-8 text-brand-500">
                <Loader2 className="animate-spin" size={32} />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-4 text-slate-550 space-y-3">
                <div className="flex items-center justify-center gap-2 text-red-500 text-sm bg-red-50 dark:bg-red-900/20 px-3 py-3 rounded-lg border border-red-100 dark:border-red-900/30">
                  <AlertCircle size={18} />
                  <span>{error || 'Servidor no disponible'}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">Revisa que el backend esté encendido e intenta recargar la página.</p>
                <button 
                  onClick={() => { setLoading(true); setError(''); fetch(`${API_URL}/api/usuarios/public`).then(r => r.json()).then(d => { setUsers(d); setLoading(false); }).catch(() => { setError('Error de red al conectar al servidor'); setLoading(false); }); }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors"
                >
                  Reintentar Conexión
                </button>
              </div>
            ) : (
              users.map(u => (
                <button 
                  key={u.id}
                  onClick={() => { setSelectedUser(u); setPin(''); setError(''); }}
                  className="w-full flex items-center p-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 transition-colors group"
                >
                  <div className={`p-3 rounded-xl group-hover:scale-110 transition-transform ${getRoleStyle(u.rol)}`}>
                    {getRoleIcon(u.rol)}
                  </div>
                  <div className="ml-4 text-left flex-1">
                    <p className="font-semibold text-slate-900 dark:text-white">{u.nombre}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{getRoleLabel(u.rol)}</p>
                  </div>
                  <Lock size={16} className="text-slate-300 dark:text-slate-600" />
                </button>
              ))
            )}
          </div>
        )}

        {/* Step 2: PIN entry */}
        {selectedUser && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
            <button 
              onClick={() => { setSelectedUser(null); setPin(''); setError(''); }}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-brand-500 transition-colors"
            >
              <ChevronLeft size={16} /> Cambiar usuario
            </button>

            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className={`p-3 rounded-xl ${getRoleStyle(selectedUser.rol)}`}>
                {getRoleIcon(selectedUser.rol)}
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">{selectedUser.nombre}</p>
                <p className="text-sm text-slate-500">{getRoleLabel(selectedUser.rol)}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">PIN de acceso</label>
              <input 
                type="password"
                inputMode="numeric"
                maxLength={8}
                autoFocus
                value={pin}
                onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setError(''); }}
                onKeyDown={handlePinKeyDown}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-center text-2xl tracking-[0.5em] font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
                placeholder="• • • •"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <button 
              onClick={handleLogin}
              disabled={pin.length < 4 || isLogging}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3.5 rounded-xl flex justify-center items-center transition-colors disabled:opacity-50"
            >
              {isLogging ? <Loader2 size={20} className="animate-spin" /> : 'Acceder'}
            </button>

            <p className="text-xs text-center text-slate-400">PIN por defecto: 0000</p>
          </div>
        )}

      </div>
    </div>
  );
}
