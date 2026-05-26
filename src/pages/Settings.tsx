import { useAuth } from '../context/AuthContext';
import { User, Store, Lock, BellRing } from 'lucide-react';

export default function Settings() {
  const { user } = useAuth();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Ajustes</h2>
      
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center border-2 border-brand-500">
            <span className="text-2xl font-bold text-brand-700 dark:text-brand-400">{user?.name.charAt(0)}</span>
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{user?.name}</h3>
            <p className="text-sm text-slate-500 capitalize">{user?.role}</p>
          </div>
        </div>
        
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          <div className="p-4 flex items-center gap-3 transition-colors opacity-70">
            <User size={20} className="text-slate-400" />
            <div className="flex-1">
              <p className="font-medium text-slate-900 dark:text-white">Datos Personales</p>
            </div>
          </div>
          <div className="p-4 flex items-center gap-3 transition-colors opacity-70">
            <BellRing size={20} className="text-slate-400" />
            <div className="flex-1">
              <p className="font-medium text-slate-900 dark:text-white">Notificaciones</p>
            </div>
          </div>
          {user?.role === 'owner' && (
            <div className="p-4 flex items-center gap-3 transition-colors opacity-70">
              <Store size={20} className="text-slate-400" />
              <div className="flex-1">
                <p className="font-medium text-slate-900 dark:text-white">Gestión de Locales</p>
              </div>
            </div>
          )}
          <div className="p-4 flex items-center gap-3 transition-colors opacity-70">
            <Lock size={20} className="text-slate-400" />
            <div className="flex-1">
              <p className="font-medium text-slate-900 dark:text-white">Privacidad y Seguridad</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
