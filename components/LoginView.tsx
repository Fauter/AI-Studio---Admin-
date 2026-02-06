import React from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function LoginView() {
  const { loading, error } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
          <p className="text-slate-500 font-medium">Cargando GarageIA...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">GarageIA</h1>
          <p className="text-slate-500 mt-2">Plataforma Administrativa Inteligente</p>
        </div>
        
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 border border-red-200 text-red-700 flex items-center gap-3">
            <ShieldAlert className="h-5 w-5" />
            <p>{error}</p>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="text-center py-8">
            <h2 className="text-2xl font-semibold text-slate-800 mb-2">Bienvenido</h2>
            <p className="text-slate-500 mb-8">
              Por favor, inicia sesión para acceder al panel.
            </p>
            
            <div className="inline-block bg-blue-50 text-blue-700 px-6 py-4 rounded-lg text-sm font-mono border border-blue-100">
              Esperando autenticación de Supabase...
            </div>
            <p className="text-xs text-slate-400 mt-4">
              La autenticación se maneja automáticamente si hay sesión activa en Supabase Client.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}