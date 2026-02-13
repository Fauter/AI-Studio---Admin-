
import React, { useEffect, useState } from 'react';
import { Outlet, useParams, useNavigate, NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Settings, 
  CreditCard, 
  ChevronDown, 
  LogOut, 
  Menu,
  Car,
  TableProperties,
  Server,
  Lock,
  LayoutGrid
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Garage, UserRole } from '../types';

export default function DashboardLayout() {
  const { garageId } = useParams<{ garageId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, user, profile, shadowUser, loading } = useAuth(); // Import loading!
  
  const [garages, setGarages] = useState<Garage[]>([]);
  const [loadingGarages, setLoadingGarages] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isSuperAdmin = profile?.role === UserRole.SUPERADMIN;
  const isGlobalAdminSection = location.pathname.startsWith('/admin/global');
  const isRestrictedRole = profile?.role === UserRole.AUDITOR || profile?.role === UserRole.OPERATOR;

  // --- MISION 3: SECURITY GUARD (RESOURCE LEVEL) ---
  useEffect(() => {
    const secureFetch = async () => {
      // 1. Wait for Auth (prevent premature redirects)
      if (loading) return;
      
      // 2. Validate Session
      if (!user && !shadowUser) {
        // App.tsx should have handled this, but double check
        navigate('/'); 
        return;
      }

      // 3. Block Restricted Roles (Desk App Users)
      if (isRestrictedRole) {
        setLoadingGarages(false);
        return; 
      }

      // 4. Protect Global Admin
      if (isGlobalAdminSection && !isSuperAdmin) {
        console.warn('[Security] Global Admin Access Denied');
        navigate('/setup/onboarding', { replace: true });
        return;
      }

      try {
        let fetchedGarages: Garage[] = [];

        if (isSuperAdmin) {
           // Admin sees all
           if (!isGlobalAdminSection) {
             const { data } = await supabase.from('garages').select('*');
             fetchedGarages = data as Garage[] || [];
           }
        } else if (profile?.role === UserRole.OWNER) {
           const { data } = await supabase.from('garages').select('*').eq('owner_id', user!.id);
           fetchedGarages = data as Garage[] || [];
        } else if (shadowUser) {
           // --- SHADOW SECURITY ---
           // Filter by permissions JSONB
           const allowedIds = shadowUser.permissions?.allowed_garages || [];
           
           if (allowedIds.length > 0) {
             const { data } = await supabase.from('garages').select('*').in('id', allowedIds);
             fetchedGarages = data as Garage[] || [];
           }
           
           // Context Guard: If trying to access a garage not in permissions
           if (garageId && !allowedIds.includes(garageId)) {
              console.warn(`[Security] Shadow User tried accessing forbidden garage: ${garageId}`);
              // Si es administrativo, mandarlo a su único garaje permitido, sino al onboarding
              if (shadowUser.role === UserRole.ADMINISTRATIVE && allowedIds.length > 0) {
                 navigate(`/${allowedIds[0]}/dashboard`, { replace: true });
              } else {
                 navigate('/setup/onboarding', { replace: true });
              }
              return;
           }
        }

        setGarages(fetchedGarages);

        // --- CONTEXT VALIDATION (OWNERSHIP CHECK) ---
        if (garageId && !isGlobalAdminSection) {
          const isValid = fetchedGarages.find(g => g.id === garageId);
          if (!isValid) {
             console.warn(`[Security] Access Denied to Garage ${garageId}`);
             // Si el garaje no pertenece al usuario, lo devolvemos a zona segura
             if (shadowUser?.role === UserRole.ADMINISTRATIVE && shadowUser.permissions?.allowed_garages.length === 1) {
                navigate(`/${shadowUser.permissions.allowed_garages[0]}/dashboard`, { replace: true });
             } else {
                navigate('/setup/onboarding', { replace: true });
             }
          }
        }

      } catch (err) {
        console.error('Error fetching garages:', err);
      } finally {
        setLoadingGarages(false);
      }
    };

    secureFetch();
  }, [user, shadowUser, profile, garageId, navigate, isSuperAdmin, isGlobalAdminSection, isRestrictedRole, loading]);

  const handleGarageChange = (newId: string) => {
    const parts = location.pathname.split('/');
    // Preserve current section if possible (e.g. /oldId/finanzas -> /newId/finanzas)
    const section = parts.length > 2 && parts[2] !== 'global' ? parts[2] : 'dashboard';
    navigate(`/${newId}/${section}`);
    setIsMobileMenuOpen(false);
  };

  // --- MENU FILTERING (REGLAS DE NEGOCIO STRICTAS) ---
  const allNavLinks = [
    { id: 'dashboard', name: 'Dashboard', path: 'dashboard', icon: LayoutDashboard },
    { id: 'precios', name: 'Gestión de Precios', path: 'precios', icon: TableProperties },
    { id: 'finanzas', name: 'Finanzas & Punitorios', path: 'finanzas', icon: CreditCard },
    { id: 'ajustes', name: 'Configuración', path: 'ajustes', icon: Settings },
  ];

  const allowedNavLinks = allNavLinks.filter(link => {
    // 1. Owner / SuperAdmin -> Access All
    if (profile?.role === UserRole.OWNER || profile?.role === UserRole.SUPERADMIN) return true;

    // 2. Manager -> Access All INSIDE Garage (Business Rule #1)
    if (shadowUser && shadowUser.role === UserRole.MANAGER) return true;

    // 3. Administrative -> Filtered by Permissions (Business Rule #2)
    if (shadowUser && shadowUser.role === UserRole.ADMINISTRATIVE) {
      // Dashboard is always base access
      if (link.id === 'dashboard') return true;
      // Check granular permissions
      return shadowUser.permissions?.sections?.includes(link.id);
    }

    return false;
  });

  if (loading || loadingGarages) {
    return <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500">Cargando entorno...</div>;
  }

  // --- RESTRICTED ACCESS VIEW ---
  if (isRestrictedRole) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-100 p-6 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 max-w-md w-full">
          <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-6">
            <Lock className="h-8 w-8 text-amber-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Acceso Web Restringido</h1>
          <p className="text-slate-500 mb-8">
            Tu perfil solo tiene acceso a través de la aplicación de escritorio.
          </p>
          <button 
            onClick={() => signOut()}
            className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="h-4 w-4" /> Cerrar Sesión
          </button>
        </div>
      </div>
    );
  }

  const currentGarage = garages.find(g => g.id === garageId);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0 flex flex-col
      `}>
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 px-6 bg-slate-950 font-bold text-white text-xl tracking-tight shadow-sm z-10">
          <div className={`p-1.5 rounded-lg ${isSuperAdmin ? 'bg-indigo-600' : 'bg-blue-600'}`}>
            {isSuperAdmin ? <Server className="h-5 w-5 text-white" /> : <Car className="h-5 w-5 text-white" />}
          </div>
          GarageIA
        </div>

        {/* Context Selector */}
        <div className="px-6 py-6 border-b border-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            {isGlobalAdminSection ? 'Modo Sistema' : 'Garaje Activo'}
          </p>
          <div className="relative">
            {/* Si es administrativo, no puede cambiar de garaje (solo tiene 1) */}
            {shadowUser?.role === UserRole.ADMINISTRATIVE ? (
               <div className="w-full rounded-lg bg-slate-800 border border-slate-700 py-2.5 px-3 text-sm font-medium text-white flex items-center gap-2">
                 <Lock className="h-3 w-3 text-slate-500" />
                 <span className="truncate">{currentGarage?.name || 'Cargando...'}</span>
               </div>
            ) : (
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
            )}
          </div>

          {/* Hub Button: Managers/Owners/SuperAdmin ONLY */}
          {!isGlobalAdminSection && shadowUser?.role !== UserRole.ADMINISTRATIVE && (
            <button
              onClick={() => navigate('/setup/onboarding')}
              className="mt-3 w-full group flex items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs font-medium text-slate-400 transition-all hover:border-slate-700 hover:bg-slate-800 hover:text-white"
            >
              <LayoutGrid className="h-3.5 w-3.5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
              Volver al Hub
            </button>
          )}
        </div>

        {/* Nav Links */}
        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {/* SuperAdmin Specific */}
          {isSuperAdmin && (
            <div className="mb-6">
              <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Sistema</p>
              <NavLink to="/admin/global" end onClick={() => setIsMobileMenuOpen(false)} className={({ isActive }) => `group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all mb-1 ${isActive ? 'bg-indigo-600 text-white' : 'text-indigo-200 hover:bg-slate-800'}`}>
                <LayoutDashboard className="mr-3 h-5 w-5 flex-shrink-0" /> Centro de Comando
              </NavLink>
              <NavLink to="/admin/global/config" onClick={() => setIsMobileMenuOpen(false)} className={({ isActive }) => `group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${isActive ? 'bg-red-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-red-400'}`}>
                <Settings className="mr-3 h-5 w-5 flex-shrink-0" /> Configuración Global
              </NavLink>
            </div>
          )}

          {/* Operational Links */}
          {(garageId || (!isSuperAdmin && garages.length > 0)) && (
             <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-2">Gestión Operativa</p>
          )}

          {garageId ? (
            allowedNavLinks.map((item) => (
              <NavLink
                key={item.id}
                to={`/${garageId}/${item.path}`}
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) => `group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
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

        {/* Footer */}
        <div className="border-t border-slate-800 bg-slate-950/50 p-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-full font-bold text-xs ${isSuperAdmin ? 'bg-indigo-900 text-indigo-200' : 'bg-blue-900 text-blue-200'}`}>
              {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-white">{profile?.full_name || 'Usuario'}</p>
              <p className="truncate text-[10px] text-indigo-400 font-bold tracking-wider uppercase mt-0.5">
                {profile?.role === UserRole.MANAGER ? 'GERENTE' : profile?.role}
              </p>
            </div>
            <button onClick={() => signOut()} className="rounded p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main & Mobile Header */}
      <div className="flex flex-1 flex-col h-full overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 md:hidden">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="rounded-md p-2 text-slate-600 hover:bg-slate-100">
              <Menu className="h-6 w-6" />
            </button>
            <span className="font-semibold text-slate-900 truncate">
              {currentGarage?.name || (isGlobalAdminSection ? 'Administración Global' : 'GarageIA')}
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-slate-50 p-4 md:p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}
    </div>
  );
}
