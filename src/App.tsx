import { BrowserRouter, Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { Home, Package, Sun, Moon, Camera, LogOut, Calendar as CalendarIcon, Clock, User, Mail, Truck, ClipboardList, CreditCard, Music, StickyNote, BarChart3, FileSpreadsheet, Settings, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth, Role } from './context/AuthContext';

// Componentes
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Sales from './pages/Sales';
import Scanner from './pages/Scanner';
import Login from './pages/Login';
import HRManagement from './pages/HRManagement';
import SettingsPage from './pages/Settings';
import Providers from './pages/Providers';
import Analytics from './pages/Analytics';
import ManagerCalendar from './pages/ManagerCalendar';
import Notes from './pages/Notes';
import Reports from './pages/Reports';
import Tasks from './pages/Tasks';
import StockControl from './pages/StockControl';

// Componentes Empleado
import EmployeeDashboard from './pages/employee/EmployeeDashboard';
import Calendar from './pages/employee/Calendar';
import ClockScreen from './pages/employee/Clock';
import Requests from './pages/employee/Requests';
import Messages from './pages/employee/Messages';

// Componentes Globales
import AIChatbot from './components/AIChatbot';

function BottomNav({ role }: { role: Role }) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  
  if (role === 'employee') {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pb-safe z-50 transition-colors duration-200 lg:hidden">
        <div className="flex justify-around items-center h-16">
          <button onClick={() => navigate('/')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentPath === '/' ? 'text-brand-600 dark:text-brand-400 font-semibold' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>
            <Home size={20} />
            <span className="text-[10px] font-medium">Inicio</span>
          </button>
          <button onClick={() => navigate('/calendario')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentPath === '/calendario' ? 'text-brand-600 dark:text-brand-400 font-semibold' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>
            <CalendarIcon size={20} />
            <span className="text-[10px] font-medium">Turnos</span>
          </button>
          <button onClick={() => navigate('/fichaje')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentPath === '/fichaje' ? 'text-brand-600 dark:text-brand-400 font-semibold' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>
            <Clock size={20} />
            <span className="text-[10px] font-medium">Fichar</span>
          </button>
          <button onClick={() => navigate('/correos')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentPath === '/correos' ? 'text-brand-600 dark:text-brand-400 font-semibold' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>
            <Mail size={20} />
            <span className="text-[10px] font-medium">Buzón</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pb-safe z-50 transition-colors duration-200 lg:hidden">
      <div className="flex justify-around items-center h-16">
        <button onClick={() => navigate('/')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentPath === '/' ? 'text-brand-600 dark:text-brand-400 font-semibold' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>
          <Home size={20} />
          <span className="text-[10px] font-medium">Inicio</span>
        </button>
        <button onClick={() => navigate('/inventario')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentPath === '/inventario' ? 'text-brand-600 dark:text-brand-400 font-semibold' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>
          <Package size={20} />
          <span className="text-[10px] font-medium">Stock</span>
        </button>
        <button onClick={() => navigate('/proveedores')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentPath === '/proveedores' ? 'text-brand-600 dark:text-brand-400 font-semibold' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>
          <Truck size={20} />
          <span className="text-[10px] font-medium">Proveedores</span>
        </button>
        <button onClick={() => navigate('/escaner')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentPath === '/escaner' ? 'text-brand-600 dark:text-brand-400 font-semibold' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>
          <Camera size={20} />
          <span className="text-[10px] font-medium">Escáner</span>
        </button>
      </div>
    </div>
  );
}

interface SidebarProps {
  role: Role;
  isDarkMode: boolean;
  toggleTheme: () => void;
  logout: () => void;
}

function Sidebar({ role, isDarkMode, toggleTheme, logout }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  const isActive = (path: string) => location.pathname === path;
  
  const linkClass = (path: string) => `
    flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
    ${isActive(path) 
      ? 'bg-gradient-to-r from-brand-600 to-brand-700 text-white shadow-md shadow-brand-600/20' 
      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-950 dark:hover:text-white'
    }
  `;

  return (
    <aside className="w-72 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex-col justify-between hidden lg:flex h-screen sticky top-0 p-6 shrink-0 transition-colors duration-200">
      <div className="space-y-6 flex-1 flex flex-col min-h-0">
        {/* Logo */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/80">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-brand-500 to-brand-700 bg-clip-text text-transparent">
              Salguacate
            </h1>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold mt-0.5">ERP Restauración</p>
          </div>
          <span className="bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">
            {role === 'owner' ? 'Owner' : role === 'manager' ? 'Manager' : 'Staff'}
          </span>
        </div>

        {/* User Card */}
        <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/50 p-3.5 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-800 flex items-center justify-center font-bold text-brand-600 dark:text-brand-400 shrink-0">
            {user?.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{user?.name}</p>
            <p className="text-xs text-slate-400 truncate">{user?.location || 'Todos los locales'}</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1.5 flex-1 overflow-y-auto pr-1">
          {role === 'employee' ? (
            <>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-4 mb-2">Panel Personal</p>
              <button onClick={() => navigate('/')} className={linkClass('/')}>
                <Home size={18} /> Inicio
              </button>
              <button onClick={() => navigate('/calendario')} className={linkClass('/calendario')}>
                <CalendarIcon size={18} /> Turnos Asignados
              </button>
              <button onClick={() => navigate('/fichaje')} className={linkClass('/fichaje')}>
                <Clock size={18} /> Control Horario
              </button>
              <button onClick={() => navigate('/correos')} className={linkClass('/correos')}>
                <Mail size={18} /> Buzón Interno
              </button>
              <button onClick={() => navigate('/peticiones')} className={linkClass('/peticiones')}>
                <Sparkles size={18} /> Solicitudes
              </button>
            </>
          ) : (
            <>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-4 mb-2">Operaciones</p>
              <button onClick={() => navigate('/')} className={linkClass('/')}>
                <Home size={18} /> Panel de Control
              </button>
              <button onClick={() => navigate('/inventario')} className={linkClass('/inventario')}>
                <Package size={18} /> Almacén y Stock
              </button>
              <button onClick={() => navigate('/control-stock')} className={linkClass('/control-stock')}>
                <ClipboardList size={18} /> Pedidos de Reposición
              </button>
              <button onClick={() => navigate('/proveedores')} className={linkClass('/proveedores')}>
                <Truck size={18} /> Proveedores
              </button>
              <button onClick={() => navigate('/escaner')} className={linkClass('/escaner')}>
                <Camera size={18} /> Escáner de Facturas
              </button>

              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-4 mt-4 mb-2">Gestión y Equipo</p>
              <button onClick={() => navigate('/rrhh')} className={linkClass('/rrhh')}>
                <User size={18} /> Recursos Humanos
              </button>
              <button onClick={() => navigate('/tareas')} className={linkClass('/tareas')}>
                <ClipboardList size={18} /> Lista de Checklists
              </button>
              <button onClick={() => navigate('/agenda')} className={linkClass('/agenda')}>
                <Music size={18} /> Agenda de Eventos
              </button>
              <button onClick={() => navigate('/correos')} className={linkClass('/correos')}>
                <Mail size={18} /> Buzón de Mensajes
              </button>
              <button onClick={() => navigate('/notas')} className={linkClass('/notas')}>
                <StickyNote size={18} /> Muro de Notas
              </button>

              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-4 mt-4 mb-2">Finanzas</p>
              <button onClick={() => navigate('/ventas')} className={linkClass('/ventas')}>
                <CreditCard size={18} /> Cierres de Caja
              </button>
              <button onClick={() => navigate('/analiticas')} className={linkClass('/analiticas')}>
                <BarChart3 size={18} /> Analíticas Visuales
              </button>
              <button onClick={() => navigate('/informes')} className={linkClass('/informes')}>
                <FileSpreadsheet size={18} /> Informes Mensuales
              </button>
            </>
          )}
        </nav>
      </div>

      {/* Sidebar Footer Controls */}
      <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-2 flex-shrink-0">
        <div className="flex gap-2">
          <button 
            onClick={toggleTheme}
            className="flex-1 flex justify-center items-center p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800/60 text-slate-600 dark:text-slate-300 transition-colors"
            title={isDarkMode ? 'Modo Claro' : 'Modo Oscuro'}
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button 
            onClick={() => navigate('/ajustes')}
            className="flex-1 flex justify-center items-center p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800/60 text-slate-600 dark:text-slate-300 transition-colors"
            title="Ajustes"
          >
            <Settings size={18} />
          </button>
        </div>
        <button 
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 font-medium transition-colors"
        >
          <LogOut size={16} /> Cerrar Sesión
        </button>
      </div>
    </aside>
  );
}

function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) return savedTheme === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  if (!user) return <Login />;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200 lg:flex">
      
      {/* Sidebar for Desktop */}
      <Sidebar role={user.role} isDarkMode={isDarkMode} toggleTheme={toggleTheme} logout={logout} />

      {/* Main Layout Container */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Mobile Header */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 sticky top-0 z-40 transition-colors duration-200 lg:hidden shrink-0">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold bg-gradient-to-r from-brand-600 to-brand-800 dark:from-brand-400 dark:to-brand-600 bg-clip-text text-transparent">
              Salguacate
            </h1>
            <div className="flex items-center gap-3">
              <button 
                onClick={toggleTheme}
                className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-sm transition-colors"
              >
                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button 
                onClick={() => navigate('/ajustes')}
                className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-sm transition-colors"
                title="Ajustes de Perfil"
              >
                <User size={18} />
              </button>
              <button 
                onClick={logout}
                className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-sm transition-colors"
                title="Cerrar sesión"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        {/* Content View */}
        <main className="p-4 lg:p-8 flex-1 max-w-[1600px] w-full mx-auto pb-24 lg:pb-8">
          <Routes>
            {user.role === 'employee' ? (
              <>
                <Route path="/" element={<EmployeeDashboard />} />
                <Route path="/calendario" element={<Calendar />} />
                <Route path="/peticiones" element={<Requests />} />
                <Route path="/correos" element={<Messages />} />
                <Route path="/fichaje" element={<ClockScreen />} />
                <Route path="/ajustes" element={<SettingsPage />} />
              </>
            ) : (
              <>
                <Route path="/" element={<Dashboard />} />
                <Route path="/inventario" element={<Inventory />} />
                <Route path="/ventas" element={<Sales />} />
                <Route path="/escaner" element={<Scanner />} />
                <Route path="/correos" element={<Messages />} />
                <Route path="/rrhh" element={<HRManagement />} />
                <Route path="/proveedores" element={<Providers />} />
                <Route path="/analiticas" element={<Analytics />} />
                <Route path="/agenda" element={<ManagerCalendar />} />
                <Route path="/notas" element={<Notes />} />
                <Route path="/informes" element={<Reports />} />
                <Route path="/tareas" element={<Tasks />} />
                <Route path="/control-stock" element={<StockControl />} />
                <Route path="/ajustes" element={<SettingsPage />} />
              </>
            )}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        
      </div>

      {/* Asistente de IA (Controla internamente si se muestra según el rol) */}
      <AIChatbot />

      {/* Bottom Nav for Mobile */}
      <BottomNav role={user.role} />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <MainLayout />
    </BrowserRouter>
  );
}

export default App;
