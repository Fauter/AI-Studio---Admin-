
import React, { useEffect, useState } from 'react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import OnboardingPage from './pages/OnboardingPage';
import DashboardLayout from './components/DashboardLayout';
import PenaltyConfigPage from './pages/PenaltyConfig';
import PriceManagement from './pages/PriceManagement';
import GlobalAdminPage from './pages/GlobalAdmin';
import SettingsPage from './pages/SettingsPage';
import AccessControlPage from './pages/AccessControlPage';
import ConfigAdmin from './components/admin/ConfigAdmin'; // Added Import
import { UserRole } from './types';

// --- Components ---

const DashboardHome = () => (
  <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
    <h2 className="text-xl font-bold text-slate-900">Resumen Operativo</h2>
    <p className="text-slate-500 mt-2">Bienvenido al panel de control. Selecciona una opción del menú lateral para comenzar.</p>
  </div>
);

// MISION 2: Enrutamiento Inteligente & Seguro
const RootRedirect = () => {
  const { user, profile, loading, shadowUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // 1. Wait for Auth to settle
    if (loading) return;
    
    // 2. No User -> Force Login
    if (!user && !shadowUser) {
      // Logic handled by AppRoutes fallback, but explicit checking here helps logic flow
      return; 
    }

    // 3. Routing Logic
    const routeUser = () => {
      // A. Global Admin (Priority 1)
      if (profile?.role === UserRole.SUPERADMIN) {
        navigate('/admin/global', { replace: true });
        return;
      }

      // B. Shadow Users / Employees (Priority 2)
      // They must always go to onboarding/selector first to confirm context
      if (shadowUser) {
        navigate('/setup/onboarding', { replace: true });
        return;
      }

      // C. Owners / Managers (Priority 3)
      // Default to onboarding to select garage
      navigate('/setup/onboarding', { replace: true });
    };

    routeUser();
  }, [user, profile, loading, shadowUser, navigate]);

  return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <p className="text-sm text-slate-500 font-medium">Validando credenciales...</p>
      </div>
    </div>
  );
};

// --- Main App Logic (Inside Router Context) ---

const AppRoutes = () => {
  const { session, shadowUser, loading, signOut } = useAuth();
  const [showReset, setShowReset] = useState(false);

  // Circuit Breaker for Infinite Loading
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) {
        setShowReset(true);
      }
    }, 7000); // 7 seconds timeout
    return () => clearTimeout(timer);
  }, [loading]);

  const handleHardReset = async () => {
    await signOut();
    window.location.href = '/'; // Hard reload
  };

  // --- Loading State (Elegante) ---
  if (loading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-50 relative overflow-hidden">
        {/* Background Decor */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-100 rounded-full blur-3xl opacity-50 pointer-events-none"></div>

        <div className="relative z-10 flex flex-col items-center gap-6 p-8 bg-white/50 backdrop-blur-sm rounded-2xl border border-white/50 shadow-xl">
          <div className="relative">
            <div className="absolute inset-0 bg-indigo-500 rounded-full blur-md opacity-20 animate-pulse"></div>
            <Loader2 className="h-12 w-12 animate-spin text-indigo-600 relative z-10" />
          </div>
          
          <div className="text-center space-y-2">
            <h3 className="text-lg font-bold text-slate-800 tracking-tight">GarageIA</h3>
            <p className="text-sm text-slate-500 font-medium animate-pulse">Iniciando sistema seguro...</p>
          </div>

          {showReset && (
            <div className="mt-4 pt-4 border-t border-slate-200 w-full animate-in fade-in slide-in-from-bottom-4">
               <button 
                onClick={handleHardReset}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:border-red-300 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-lg text-xs font-bold transition-all shadow-sm"
              >
                <RefreshCw className="h-3 w-3" /> Reiniciar Conexión
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- Unauthenticated View ---
  // Checks both Supabase Session AND Shadow Session
  if (!session && !shadowUser) {
    return <LoginPage />;
  }

  // --- Authenticated Routing ---
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
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
         <Route path="*" element={<div className="p-8 text-slate-500">Sección no encontrada.</div>} />
      </Route>
      
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
};

// --- Root App Component ---
function App() {
  return (
    <MemoryRouter>
      <AppRoutes />
    </MemoryRouter>
  );
}

export default App;
