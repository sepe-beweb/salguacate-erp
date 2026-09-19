import { BrowserRouter, Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { Home, Package, Sun, Moon, Camera, LogOut, Calendar as CalendarIcon, Clock, User, Mail, Truck, Settings, Sparkles } from 'lucide-react';
import { lazy, Suspense, useState, useEffect } from 'react';
import { useAuth, Role } from './context/AuthContext';
// Access screens stay in the entry bundle; feature screens load only when selected.
import Login from './pages/Login';
import ChangePin from './pages/ChangePin';
import AIChatbot from './components/AIChatbot';
import ScreenBoundary from './components/ScreenBoundary';
import PendingCreatesNotice from './components/PendingCreatesNotice';
import NavigationLinks from './components/NavigationLinks';
import MobileNavigation from './components/MobileNavigation';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Sales = lazy(() => import('./pages/Sales'));
const Scanner = lazy(() => import('./pages/Scanner'));
const Expenses = lazy(() => import('./pages/Expenses'));
const HRManagement = lazy(() => import('./pages/HRManagement'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const Providers = lazy(() => import('./pages/Providers'));
const Analytics = lazy(() => import('./pages/Analytics'));
const ManagerCalendar = lazy(() => import('./pages/ManagerCalendar'));
const Notes = lazy(() => import('./pages/Notes'));
const Reports = lazy(() => import('./pages/Reports'));
const Tasks = lazy(() => import('./pages/Tasks'));
const StockControl = lazy(() => import('./pages/StockControl'));
const EmployeeDashboard = lazy(() => import('./pages/employee/EmployeeDashboard'));
const Calendar = lazy(() => import('./pages/employee/Calendar'));
const ClockScreen = lazy(() => import('./pages/employee/Clock'));
const Requests = lazy(() => import('./pages/employee/Requests'));
const Messages = lazy(() => import('./pages/employee/Messages'));

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
          <button onClick={() => navigate('/peticiones')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentPath === '/peticiones' ? 'text-brand-600 dark:text-brand-400 font-semibold' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>
            <Sparkles size={20} />
            <span className="text-[10px] font-medium">Solicitudes</span>
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
        <button onClick={() => navigate('/correos')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentPath === '/correos' ? 'text-brand-600 dark:text-brand-400 font-semibold' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>
          <Mail size={20} />
          <span className="text-[10px] font-medium">Buzón</span>
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
  const { user } = useAuth();

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
        <nav aria-label="Navegación principal" className="space-y-1.5 flex-1 overflow-y-auto pr-1">
          <NavigationLinks role={role} />
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
  const location = useLocation();
  
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
  if (user.mustChangePin) return <ChangePin />;

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
            <div className="flex items-center gap-2">
              <MobileNavigation key={`${user.id}:${user.role}`} role={user.role} />
              <button 
                aria-label={isDarkMode ? 'Modo Claro' : 'Modo Oscuro'}
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
          {user.role !== 'employee' && <PendingCreatesNotice />}
          <ScreenBoundary key={`${user.id}:${user.role}:${location.pathname}`} onHome={() => navigate('/')}>
            <Suspense fallback={<p role="status" className="p-8 text-center text-slate-600 dark:text-slate-300">Cargando pantalla...</p>}>
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
                    <Route path="/gastos" element={<Expenses />} />
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
            </Suspense>
          </ScreenBoundary>
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
