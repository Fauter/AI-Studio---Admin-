
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { 
  Loader2, 
  Lock, 
  Mail, 
  AlertTriangle, 
  User, 
  ArrowRight, 
  ShieldCheck, 
  KeyRound 
} from 'lucide-react';
import { UserRole, UserSession } from '../types';

export default function LoginPage() {
  const { signInShadow } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  
  // Form State
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const isEmail = identifier.includes('@');

    try {
      if (isRegistering) {
        // --- FLUJO DE REGISTRO (Solo Owners) ---
        if (!isEmail) throw new Error("Se requiere un email válido para registrarse.");

        // 1. Crear Usuario Auth
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: identifier,
          password,
          options: { data: { full_name: fullName } }
        });

        if (signUpError) throw signUpError;
        if (!authData.user) throw new Error("No se pudo crear el usuario.");

        // 2. Crear Perfil (Optimista)
        await supabase.from('profiles').insert({
          id: authData.user.id,
          email: identifier,
          full_name: fullName,
          role: UserRole.OWNER
        });
        
        // El AuthProvider detectará el cambio de sesión automáticamente y App.tsx redirigirá.

      } else {
        // --- FLUJO DE LOGIN ---
        if (isEmail) {
            // A. Login Standard (Supabase Auth - Owners/SuperAdmins)
            const { error: signInError } = await supabase.auth.signInWithPassword({
              email: identifier,
              password,
            });

            if (signInError) throw signInError;
            // Éxito: El listener de AuthProvider manejará el estado.
            // App.tsx detectará el cambio y redirigirá.

        } else {
            // B. Login Shadow (Empleados - Managers/Admin/Operators)
            const { data, error } = await supabase.rpc('login_employee', {
              p_username: identifier,
              p_password: password
            });

            if (error) throw error;
            if (!data) throw new Error("Credenciales inválidas o usuario no encontrado.");

            // Construct Session Data
            const sessionData: UserSession = {
              ...data,
              isShadow: true, 
            };

            // EJECUTAR CAMBIO DE ESTADO GLOBAL
            // Esto actualiza el contexto. App.tsx detectará el cambio y ejecutará la redirección.
            signInShadow(sessionData);
            
            // CRÍTICO: NO bajamos el loading local.
            // Mantenemos el spinner hasta que el componente muera por la redirección global.
            return;
        }
      }
      
    } catch (err: any) {
      console.error("Auth Error:", err);
      let msg = err.message || 'Error desconocido.';
      
      if (msg.includes('Invalid login')) msg = 'Credenciales incorrectas.';
      if (msg.includes('rate limit')) msg = 'Demasiados intentos. Espera unos segundos.';
      
      setErrorMsg(msg);
      setLoading(false); // Solo bajamos loading si hubo error
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-900/20 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-900/10 rounded-full blur-[100px]"></div>
      </div>

      <div className="w-full max-w-lg bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-800 overflow-hidden relative z-10">
        
        {/* Header */}
        <div className="p-8 pb-0 text-center">
          <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-700 shadow-lg shadow-indigo-900/50 mb-6">
            {isRegistering ? <User className="h-8 w-8 text-white" /> : <ShieldCheck className="h-8 w-8 text-white" />}
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">GarageIA</h1>
          <p className="text-slate-400 text-sm mt-3 font-medium">
            {isRegistering ? 'Alta de Nuevo Propietario' : 'Plataforma de Gestión Integral'}
          </p>
        </div>

        {/* Form */}
        <div className="p-8">
          <form onSubmit={handleAuth} className="space-y-5">
            
            {errorMsg && (
              <div className="p-4 rounded-xl bg-red-950/30 border border-red-900/50 text-red-400 flex items-start gap-3 animate-in fade-in">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <p className="text-sm font-medium">{errorMsg}</p>
              </div>
            )}

            {isRegistering && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-4">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Nombre Completo</label>
                <div className="relative group">
                  <User className="absolute left-3 top-3.5 h-5 w-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                  <input
                    type="text" required
                    value={fullName} onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3.5 bg-slate-950 border border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600 text-slate-200 placeholder:text-slate-600 transition-all"
                    placeholder="Ej. Juan Pérez"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">
                {isRegistering ? 'Email Corporativo' : 'Usuario o Email'}
              </label>
              <div className="relative group">
                {isRegistering || identifier.includes('@') ? (
                   <Mail className="absolute left-3 top-3.5 h-5 w-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                ) : (
                   <KeyRound className="absolute left-3 top-3.5 h-5 w-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                )}
                <input
                  type="text" required
                  value={identifier} onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full pl-10 pr-4 py-3.5 bg-slate-950 border border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600 text-slate-200 placeholder:text-slate-600 transition-all"
                  placeholder={isRegistering ? "admin@empresa.com" : "Email o Usuario"}
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Contraseña</label>
              <div className="relative group">
                <Lock className="absolute left-3 top-3.5 h-5 w-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                <input
                  type="password" required minLength={4}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3.5 bg-slate-950 border border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600 text-slate-200 placeholder:text-slate-600 transition-all"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-indigo-900/20 flex items-center justify-center gap-2 mt-6 relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              {loading ? (
                <>
                   <Loader2 className="h-5 w-5 animate-spin" />
                   <span className="text-xs">Autenticando...</span>
                </>
              ) : (
                <>
                  {isRegistering ? 'Crear Cuenta' : 'Iniciar Sesión'}
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center pt-6 border-t border-slate-800">
            <button 
              onClick={() => { 
                setIsRegistering(!isRegistering); 
                setErrorMsg(null); 
                setIdentifier(''); 
                setPassword('');
              }}
              className="text-slate-400 font-medium hover:text-white transition-colors text-sm"
            >
              {isRegistering ? (
                <>Ya tengo cuenta, <span className="text-indigo-400 hover:underline">Iniciar Sesión</span></>
              ) : (
                <>¿Eres dueño de un garaje? <span className="text-indigo-400 hover:underline">Registrar aquí</span></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
