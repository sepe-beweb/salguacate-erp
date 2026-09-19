import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import type { Role } from '../context/AuthContext';
import ModalDialog from './ModalDialog';
import NavigationLinks from './NavigationLinks';

export default function MobileNavigation({ role }: { role: Role }) {
  const [open, setOpen] = useState(false); const { pathname } = useLocation();
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const changed = () => { if (desktop.matches) setOpen(false); };
    desktop.addEventListener('change', changed);
    return () => desktop.removeEventListener('change', changed);
  }, []);
  return <>
    <button type="button" aria-label="Abrir navegación" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}
      className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-sm">
      <Menu size={18} aria-hidden="true" />
    </button>
    {open && <ModalDialog label="Navegación" onClose={() => setOpen(false)}>
      <div className="p-4">
        <div className="flex justify-between items-center mb-4"><h1 className="text-xl font-bold">Navegación</h1>
          <button type="button" aria-label="Cerrar navegación" onClick={() => setOpen(false)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"><X size={20} /></button>
        </div>
        <nav aria-label="Navegación móvil"><NavigationLinks role={role} includeSettings onNavigate={() => setOpen(false)} /></nav>
      </div>
    </ModalDialog>}
  </>;
}
