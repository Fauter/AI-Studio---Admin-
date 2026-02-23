
import React, { useEffect, useState, useRef } from 'react';
import { MemoryRouter, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { Loader2, RefreshCw } from 'lucide-react';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import OnboardingPage from './pages/OnboardingPage';
import DashboardLayout from './components/DashboardLayout';
import PenaltyConfigPage from './pages/PenaltyConfig';
import PriceManagement from './pages/PriceManagement';
import GlobalAdminPage from './pages/GlobalAdmin';
import SettingsPage from './pages/SettingsPage';
import AccessControlPage from './pages/AccessControlPage';
import ConfigAdmin from './components/admin/ConfigAdmin';
import { UserRole } from './types';

// --- Components ---

const DashboardHome = () => (
  <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm animate-in fade-in">
    <h2 className="text-xl font-bold text-slate-900">Resumen Operativo</h2>
    <p className="text-slate-500 mt-2">Bienvenido al panel de control. Selecciona una opción del menú lateral para comenzar.</p>
  </div>
);

// Componente visual simple para la raíz. La lógica real está en el Guardián de AppRoutes.
const RootDispatcher = () => {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <p className="text-sm text-slate-500 font-medium">Estableciendo entorno seguro...</p>
      </div>
    </div>
  );
};

// --- Main App Logic ---

const AppRoutes = () => {
  const { session, shadowUser, user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [showReset, setShowReset] = useState(false);

  // REF: Controla que la redirección forzada ocurra SOLO UNA VEZ por sesión activa.
  // Esto permite navegar dentro de la app sin ser pateado al inicio constantemente,
  // pero asegura que un F5 o Login inicial respete la regla de entrada.
  const hasRedirectedRef = useRef(false);

  // --- GUARDIÁN GLOBAL DE NAVEGACIÓN ---
  useEffect(() => {
    // 1. Si no hay sesión, resetear el flag para permitir futura redirección al loguearse.
    if (!loading && !user && !shadowUser) {
      hasRedirectedRef.current = false;
      return;
    }

    // 2. Esperar a que la autenticación termine de cargar.
    if (loading) return;

    // PREVENIR COLISIÓN: Si hay usuario pero el perfil aún no carga, esperar.
    // Evita quemar el hasRedirectedRef prematuramente dejándonos en RootDispatcher (loading infinito).
    if (user && !profile) return;

    // 3. Si ya redirigimos en esta sesión, no intervenir (permitir navegación SPA).
    if (hasRedirectedRef.current) return;

    // --- LÓGICA DE REDIRECCIÓN INICIAL (REGLA DE ORO) ---

    // CASO A: Shadow User (Empleados)
    if (shadowUser) {
      if (shadowUser.role === UserRole.ADMINISTRATIVE) {
        const allowed = shadowUser.permissions?.allowed_garages || [];
        if (allowed.length > 0) {
          navigate(`/${allowed[0]}/dashboard`, { replace: true });
        } else {
          console.warn("Administrativo sin garajes asignados.");
        }
      } else {
        // Managers -> Hub (Onboarding)
        navigate('/setup/onboarding', { replace: true });
      }
    }
    // CASO B: Standard User (Owner / SuperAdmin)
    else if (user && profile) {
      if (profile.role === UserRole.SUPERADMIN) {
        navigate('/admin/global', { replace: true });
      } else {
        // Owners -> Hub (Onboarding) - SIEMPRE, incluso con deep link.
        navigate('/setup/onboarding', { replace: true });
      }
    }

    // Marcar como redirigido para liberar la navegación interna
    hasRedirectedRef.current = true;

  }, [loading, user, shadowUser, profile, navigate]);

  // Circuit Breaker
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) setShowReset(true);
    }, 7000);
    return () => clearTimeout(timer);
  }, [loading]);

  const handleHardReset = async () => {
    // Proactively clean all possible caches and storages before network request
    try {
      sessionStorage.removeItem('garage_shadow_user');
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sb-')) {
          localStorage.removeItem(key);
        }
      }
    } catch (e) {
      console.warn('Error clearing storage:', e);
    }

    // Fire and forget signOut to avoid hanging on network error
    signOut().catch(() => { });

    window.location.replace('/');
  };

  // 1. GLOBAL LOADING (Initial Check)
  // Only show loader if we have NO previous session data while loading
  if (loading && !session && !shadowUser) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-50 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-100 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
        <div className="relative z-10 flex flex-col items-center gap-6 p-8 bg-white/50 backdrop-blur-sm rounded-2xl border border-white/50 shadow-xl">
          <Loader2 className="h-12 w-12 animate-spin text-indigo-600 relative z-10" />
          <div className="text-center space-y-2">
            <h3 className="text-lg font-bold text-slate-800 tracking-tight">GarageIA</h3>
            <p className="text-sm text-slate-500 font-medium animate-pulse">Iniciando sistema seguro...</p>
          </div>
          {showReset && (
            <div className="mt-4 pt-4 border-t border-slate-200 w-full animate-in fade-in slide-in-from-bottom-4">
              <button onClick={handleHardReset} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:border-red-300 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-lg text-xs font-bold transition-all shadow-sm">
                <RefreshCw className="h-3 w-3" /> Reiniciar Conexión
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. UNAUTHENTICATED STATE
  if (!session && !shadowUser) {
    return <LoginPage />;
  }

  // 3. AUTHENTICATED ROUTES
  return (
    <Routes>
      <Route path="/" element={<RootDispatcher />} />
      <Route path="/setup/onboarding" element={<OnboardingPage />} />

      {/* GLOBAL ADMIN ROUTES */}
      <Route path="/admin/global" element={<DashboardLayout />}>
        <Route index element={<GlobalAdminPage />} />
        <Route path="config" element={
          <ConfigAdmin onSystemReset={() => { window.location.href = '/admin/global'; }} />
        } />
      </Route>

      {/* GARAGE CONTEXT ROUTES */}
      <Route path="/:garageId" element={<DashboardLayout />}>
        <Route index element={<DashboardHome />} />
        <Route path="dashboard" element={<DashboardHome />} />
        <Route path="finanzas" element={<PenaltyConfigPage />} />
        <Route path="precios" element={<PriceManagement />} />
        <Route path="accesos" element={<AccessControlPage />} />
        <Route path="ajustes" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>

      {/* Global Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <MemoryRouter>
        <AppRoutes />
      </MemoryRouter>
    </AuthProvider>
  );
}

export default App;
