import React, { useEffect, useState } from 'react';
import { Outlet, useParams, useNavigate, NavLink, useLocation } from 'react-router-dom';
import { 
  Building2, 
  LayoutDashboard, 
  Settings, 
  CreditCard, 
  Users, 
  ChevronDown, 
  LogOut, 
  Menu,
  Car,
  TableProperties,
  ShieldCheck,
  Server
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Garage, UserRole } from '../types';

export default function DashboardLayout() {
  const { garageId } = useParams<{ garageId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, user, profile } = useAuth();
  
  const [garages, setGarages] = useState<Garage[]>([]);
  const [loadingGarages, setLoadingGarages] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isSuperAdmin = profile?.role === UserRole.SUPERADMIN;
  const isGlobalAdminSection = location.pathname.startsWith('/admin/global');

  // Fetch Garages & Security Check
  useEffect(() => {
    const fetchAndValidate = async () => {
      if (!user) return;

      try {
        let query = supabase.from('garages').select('*');

        if (!isSuperAdmin) {
           query = query.eq('owner_id', user.id);
        }

        const { data, error } = await query;
        
        if (error) throw error;
        
        const fetchedGarages = data as Garage[] || [];
        setGarages(fetchedGarages);

        // --- SECURITY GUARD ---
        // If we are in a garage context (garageId exists) AND not in global admin
        if (garageId && !isGlobalAdminSection) {
          const isValidGarage = fetchedGarages.find(g => g.id === garageId);
          
          if (!isValidGarage) {
            console.warn(`[Security] Access denied to garage ${garageId}. Redirecting to selection.`);
            navigate('/setup/onboarding', { replace: true });
          }
        } 
        // If user hits root / layout without ID and isn't admin
        else if (!garageId && !isGlobalAdminSection) {
             navigate('/setup/onboarding', { replace: true });
        }

      } catch (err) {
        console.error('Error fetching garages:', err);
      } finally {
        setLoadingGarages(false);
      }
    };

    fetchAndValidate();
  }, [user, profile, garageId, navigate, isSuperAdmin, isGlobalAdminSection]);

  const handleGarageChange = (newId: string) => {
    const parts = location.pathname.split('/');
    const section = parts.length > 2 && parts[2] !== 'global' ? parts[2] : 'dashboard';
    navigate(`/${newId}/${section}`);
    setIsMobileMenuOpen(false);
  };

  const navLinks = [
    { name: 'Dashboard', path: 'dashboard', icon: LayoutDashboard },
    { name: 'Gestión de Precios', path: 'precios', icon: TableProperties },
    { name: 'Config. Edificio', path: 'config-edificio', icon: Building2 },
    { name: 'Finanzas & Punitorios', path: 'finanzas', icon: CreditCard },
    { name: 'Accesos & Personal', path: 'accesos', icon: Users },
    { name: 'Configuración', path: 'ajustes', icon: Settings },
  ];

  if (loadingGarages) {
    return <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500">Cargando entorno...</div>;
  }

  const currentGarage = garages.find(g => g.id === garageId);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      
      {/* Sidebar - Desktop & Mobile */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0 flex flex-col
      `}>
        {/* Logo Area */}
        <div className="flex h-16 items-center gap-2 px-6 bg-slate-950 font-bold text-white text-xl tracking-tight shadow-sm z-10">
          <div className={`p-1.5 rounded-lg ${isSuperAdmin ? 'bg-indigo-600' : 'bg-blue-600'}`}>
            {isSuperAdmin ? <Server className="h-5 w-5 text-white" /> : <Car className="h-5 w-5 text-white" />}
          </div>
          GarageIA
        </div>

        {/* Garage Context Label */}
        <div className="px-6 py-6 border-b border-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            {isGlobalAdminSection ? 'Modo Sistema' : 'Garaje Activo'}
          </p>
          <div className="relative">
            <select 
              className={`w-full appearance-none rounded-lg bg-slate-800 border border-slate-700 py-2.5 pl-3 pr-10 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all
                ${isGlobalAdminSection ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              value={garageId || ''}
              onChange={(e) => handleGarageChange(e.target.value)}
              disabled={isGlobalAdminSection}
            >
              <option value="" disabled>
                {isGlobalAdminSection ? 'Vista Global' : 'Seleccionar Garaje'}
              </option>
              {garages.map(g => (
                <option key={g.id} value={g.id}>{g.name || 'Sin Nombre'}</option>
              ))}
            </select>
            {!isGlobalAdminSection && (
              <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          
          {/* SUPERADMIN SECTION */}
          {isSuperAdmin && (
            <div className="mb-6">
              <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Super Admin
              </p>
              <NavLink
                to="/admin/global"
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) => `
                  group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all mb-1
                  ${isActive 
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/20' 
                    : 'text-indigo-200 hover:bg-slate-800 hover:text-white'
                  }
                `}
              >
                <ShieldCheck className="mr-3 h-5 w-5 flex-shrink-0" />
                Administración Global
              </NavLink>
            </div>
          )}

          {/* GARAGE SECTION */}
          {(garageId || (!isSuperAdmin && garages.length > 0)) && (
             <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-2">
               Gestión Operativa
             </p>
          )}

          {garageId ? (
            navLinks.map((item) => (
              <NavLink
                key={item.name}
                to={`/${garageId}/${item.path}`}
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) => `
                  group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all
                  ${isActive 
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }
                `}
              >
                <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                {item.name}
              </NavLink>
            ))
          ) : (
            !isGlobalAdminSection && (
              <div className="px-3 py-4 text-center text-sm text-slate-500 bg-slate-800/50 rounded-lg mx-3 border border-slate-700/50">
                Selecciona un garaje para continuar
              </div>
            )
          )}
        </nav>

        {/* User Footer */}
        <div className="border-t border-slate-800 bg-slate-950/50 p-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-full font-bold text-xs ${isSuperAdmin ? 'bg-indigo-900 text-indigo-200' : 'bg-blue-900 text-blue-200'}`}>
              {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-white">{profile?.full_name || 'Usuario'}</p>
              <p className="truncate text-xs text-slate-500 capitalize">{profile?.role || 'Invitado'}</p>
            </div>
            <button 
              onClick={() => signOut()} 
              className="rounded p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Cerrar Sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col h-full overflow-hidden">
        {/* Mobile Header */}
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 md:hidden">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="rounded-md p-2 text-slate-600 hover:bg-slate-100"
            >
              <Menu className="h-6 w-6" />
            </button>
            <span className="font-semibold text-slate-900 truncate">
              {currentGarage?.name || (isGlobalAdminSection ? 'Administración Global' : 'GarageIA')}
            </span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-slate-50 p-4 md:p-8">
          <div className="mx-auto max-w-7xl">
            {/* If we are here, we either have a garageId or we are in global admin.
                If garageId was invalid, the useEffect would have kicked us out. */}
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}