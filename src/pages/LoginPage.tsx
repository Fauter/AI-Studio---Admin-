import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Car, Loader2, Lock, Mail, AlertTriangle, User, ArrowRight, ShieldCheck, KeyRound } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const { signInShadow } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  
  // Form State
  const [identifier, setIdentifier] = useState(''); // Email or Username
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState(''); // For registration only
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const ensureProfileExists = async (userId: string, userEmail: string, name: string) => {
    try {
      await supabase.from('profiles').upsert({
        id: userId,
        email: userEmail,
        full_name: name,
        role: 'owner' 
      });
    } catch (e) {
      console.warn("Profile sync warning:", e);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const isEmail = identifier.includes('@');

    try {
      if (isRegistering) {
        // --- REGISTER FLOW (Always Email) ---
        if (!isEmail) throw new Error("El registro requiere un correo electrónico válido.");

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: identifier,
          password,
          options: { data: { full_name: fullName } }
        });

        if (signUpError) throw signUpError;
        
        const userId = signUpData.user?.id;
        if (userId) {
           await ensureProfileExists(userId, identifier, fullName);
           if (!signUpData.session) {
              const { error: signInError } = await supabase.auth.signInWithPassword({
                email: identifier,
                password
              });
              if (signInError) throw signInError;
           }
        }
        navigate('/setup/onboarding', { replace: true });

      } else {
        // --- LOGIN FLOW (Hybrid) ---
        
        if (isEmail) {
            // A. Standard Auth (Superadmin / Owner)
            const { error } = await supabase.auth.signInWithPassword({
              email: identifier,
              password,
            });
            if (error) throw error;
            // Supabase auth state listener handles redirect
            navigate('/setup/onboarding', { replace: true });
            
        } else {
            // B. Shadow Auth (Manager / Auditor / Operator)
            // Use RPC to check credentials against employee_accounts
            const { data, error } = await supabase.rpc('login_employee', {
              p_username: identifier,
              p_password: password
            });

            if (error) throw error;
            if (!data) throw new Error("Credenciales inválidas.");

            // Manual Session Injection
            signInShadow(data);
            
            // Redirect based on role
            // Shadow users are bound to a garage, so we route them directly
            if (data.garage_id) {
               navigate(`/${data.garage_id}/dashboard`, { replace: true });
            } else {
               throw new Error("Error de integridad: Usuario sin garaje asignado.");
            }
        }
      }
      
    } catch (err: any) {
      console.error("Auth Error:", err);
      let msg = err.message || 'Error desconocido.';
      if (msg.includes('Invalid login')) msg = 'Credenciales incorrectas.';
      else if (msg.includes('JSON object requested')) msg = 'Error interno en RPC de login.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      {/* Background Ambience */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] bg-indigo-900/20 rounded-full blur-3xl opacity-50"></div>
        <div className="absolute top-[40%] -right-[10%] w-[60%] h-[60%] bg-blue-900/20 rounded-full blur-3xl opacity-50"></div>
      </div>

      <div className="w-full max-w-lg bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl shadow-black/50 border border-slate-700/50 overflow-hidden relative z-10 transition-all duration-300">
        
        {/* Header Section */}
        <div className="bg-slate-950 p-8 text-center relative overflow-hidden border-b border-slate-800">
          <div className="relative z-10 flex flex-col items-center">
            <div className={`p-3 rounded-2xl mb-4 shadow-lg shadow-indigo-500/20 transition-all duration-500 ${isRegistering ? 'bg-indigo-600' : 'bg-slate-800'}`}>
              {isRegistering ? <Car className="h-8 w-8 text-white" /> : <ShieldCheck className="h-8 w-8 text-indigo-400" />}
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">GarageIA</h1>
            <p className="text-slate-400 text-sm mt-2 font-medium">
              {isRegistering ? 'Alta de Nuevo Propietario' : 'Acceso al Sistema'}
            </p>
          </div>
        </div>

        {/* Form Section */}
        <div className="p-8 bg-white">
          <form onSubmit={handleAuth} className="space-y-5">
            
            {errorMsg && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 flex items-start gap-3 animate-in slide-in-from-top-2">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <p className="text-sm font-medium">{errorMsg}</p>
              </div>
            )}

            {isRegistering && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-4 duration-300">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Nombre Completo</label>
                <div className="relative group">
                  <User className="absolute left-3 top-3 h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all text-slate-900 font-medium placeholder:text-slate-400"
                    placeholder="Ej. Juan Pérez"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">
                {isRegistering ? 'Email Corporativo' : 'Usuario o Email'}
              </label>
              <div className="relative group">
                {isRegistering || identifier.includes('@') ? (
                   <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                ) : (
                   <KeyRound className="absolute left-3 top-3 h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                )}
                
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all text-slate-900 font-medium placeholder:text-slate-400"
                  placeholder={isRegistering ? "admin@empresa.com" : "Email o Usuario de empleado"}
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Contraseña</label>
              <div className="relative group">
                <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <input
                  type="password"
                  required
                  minLength={4}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all text-slate-900 font-medium placeholder:text-slate-400"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 mt-4 disabled:opacity-70 disabled:cursor-not-allowed transform active:scale-[0.99]"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                <>
                  {isRegistering ? 'Crear Cuenta' : 'Iniciar Sesión'}
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <button 
              onClick={() => { 
                setIsRegistering(!isRegistering); 
                setErrorMsg(null); 
                setIdentifier(''); 
                setPassword('');
              }}
              className="text-slate-500 font-medium hover:text-indigo-600 transition-colors text-sm hover:underline underline-offset-4"
            >
              {isRegistering ? '¿Ya tienes cuenta? Ingresa aquí' : '¿Eres dueño? Registra tu garaje aquí'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}