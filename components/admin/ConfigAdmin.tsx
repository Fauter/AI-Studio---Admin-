
import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Database, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  Skull
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { clsx } from 'clsx';

interface ConfigAdminProps {
  onSystemReset: () => void;
}

export default function ConfigAdmin({ onSystemReset }: ConfigAdminProps) {
  const { user } = useAuth();
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorDetails, setErrorDetails] = useState<any>(null); // Stores full error object
  const [success, setSuccess] = useState(false);

  // --- 1. VALIDACIÓN MAESTRA ---
  const MASTER_UUID = 'b7a216ee-f2a6-4739-aa07-1f12a2deb5e5';
  const isMainAdmin = user?.id === MASTER_UUID || user?.email === 'admin@admin.com';

  // --- 2. DEBUGGER DE SEGURIDAD (Verbose) ---
  useEffect(() => {
    // Imprimir contexto de seguridad al montar para depuración rápida
    console.groupCollapsed("[ConfigAdmin] Security Context Check");
    console.log("Current User ID:", user?.id);
    console.log("Current Email:", user?.email);
    console.log("Expected Master UUID:", MASTER_UUID);
    console.log("Access Granted:", isMainAdmin);
    console.groupEnd();
  }, [user, isMainAdmin]);

  const handleReset = async () => {
    // A. Validación de Texto (Redundante por seguridad)
    if (confirmText !== 'REINICIAR') return;
    
    // B. Validación de Identidad (Bloqueo en Ejecución, no en UI)
    if (!isMainAdmin) {
      console.error(`[ConfigAdmin] Access Denied. User ${user?.id} is not Master.`);
      setErrorDetails({ 
        message: "Acceso Denegado por Seguridad", 
        code: "AUTH_VIOLATION",
        details: `El usuario actual (${user?.email || 'Anon'}) no coincide con el ID Maestro del sistema.`,
        hint: "Inicia sesión con la cuenta SuperAdmin principal."
      });
      return;
    }

    // C. Ejecución
    setLoading(true);
    setErrorDetails(null);
    setSuccess(false);

    try {
      // LOG SOLICITADO POR EL USUARIO
      console.log('[RPC Call] Executing public.fn_system_factory_reset (Cache Buster V2)...');
      
      // Llamada RPC sin parámetros (asegurando que no se envíe objeto vacío)
      // Renombrado para evitar PGRST202 por caché
      const { error } = await supabase.rpc('fn_system_factory_reset');

      if (error) {
        console.error("[ConfigAdmin] RPC Error:", error);
        throw error;
      }

      console.log("[ConfigAdmin] Reset completado exitosamente.");
      setSuccess(true);
      setConfirmText('');
      
      // NOTA: Se ha eliminado el setTimeout/onSystemReset para mantener el mensaje en pantalla.

    } catch (err: any) {
      console.error('[ConfigAdmin] Exception:', err);
      // Exponer error completo a la UI para diagnóstico
      setErrorDetails({
        message: err.message || 'Error desconocido al ejecutar reset.',
        code: err.code || 'UNKNOWN_CODE',
        details: err.details || JSON.stringify(err),
        hint: err.hint || 'Verifica la consola para más detalles.'
      });
    } finally {
      // CRITICO: Liberar el botón siempre, ocurra lo que ocurra
      setLoading(false);
    }
  };

  // Logic: Botón habilitado si el texto coincide, independientemente del admin (el error salta al clickar)
  const isReady = confirmText === 'REINICIAR' && !loading;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
      
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Database className="h-6 w-6 text-indigo-600" />
          Administración de Base de Datos
        </h2>
        <p className="text-slate-500 mt-1">Gestión de integridad y mantenimiento del sistema.</p>
        
        {!isMainAdmin && (
           <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs font-mono text-amber-700 flex flex-col gap-1">
             <span className="font-bold">MODO SOLO LECTURA DETECTADO</span>
             <span>ID Actual: {user?.id}</span>
             <span>ID Maestro Requerido: {MASTER_UUID}</span>
           </div>
        )}
      </div>

      {/* FEEDBACK ZONE: Success */}
      {success && (
        <div className="p-6 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-800 flex items-center gap-4 animate-in zoom-in">
          <CheckCircle2 className="h-8 w-8 text-emerald-600 flex-shrink-0" />
          <div>
            <h4 className="font-bold text-lg">Operación Completada</h4>
            <p className="text-sm font-bold mt-1">SISTEMA PURGADO: Datos y cuentas de acceso eliminadas correctamente.</p>
          </div>
        </div>
      )}

      {/* FEEDBACK ZONE: Error (Verbose & Dismissible) */}
      {errorDetails && (
        <div className="p-6 rounded-xl border bg-red-50 border-red-200 text-red-900 animate-in shake">
          <div className="flex items-start gap-4">
            <XCircle className="h-6 w-6 text-red-600 mt-1 flex-shrink-0" />
            <div className="flex-1 overflow-hidden">
              <h4 className="font-bold text-lg text-red-700">Operación Fallida</h4>
              <p className="font-bold mt-1 text-sm">{errorDetails.message}</p>
              
              <div className="mt-3 bg-white/50 p-3 rounded border border-red-100 font-mono text-xs text-red-800 break-all space-y-1">
                <p><span className="font-bold">Code:</span> {errorDetails.code}</p>
                <p><span className="font-bold">Details:</span> {errorDetails.details}</p>
                {errorDetails.hint && <p><span className="font-bold">Hint:</span> {errorDetails.hint}</p>}
              </div>
              
              <button 
                onClick={() => setErrorDetails(null)}
                className="mt-3 text-sm font-bold underline hover:text-red-600"
              >
                Cerrar reporte y reintentar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DANGER ZONE */}
      <div className="bg-red-50 border border-red-100 rounded-3xl overflow-hidden shadow-inner relative">
        <div className="p-6 border-b border-red-200 bg-red-100/50 flex items-center gap-3">
           <div className="p-2 bg-red-200 text-red-700 rounded-lg shadow-sm">
             <AlertTriangle className="h-6 w-6" />
           </div>
           <div>
             <h3 className="text-lg font-bold text-red-900">Zona de Peligro</h3>
             <p className="text-red-700 text-sm font-medium">Reinicio de Fábrica (Irreversible)</p>
           </div>
        </div>

        <div className="p-8 space-y-6">
           <div className="prose prose-sm text-red-800 bg-white/60 p-5 rounded-xl border border-red-200/50 shadow-sm">
             <ul className="list-disc pl-5 space-y-1 text-sm marker:text-red-500 font-medium">
               <li>Elimina <strong>TODOS</strong> los garajes, tarifas y precios.</li>
               <li>Elimina <strong>TODOS</strong> los usuarios (Owners, Managers, Empleados).</li>
               <li>Mantiene únicamente tu cuenta SuperAdmin ({user?.email}).</li>
             </ul>
           </div>

           <div className="bg-white p-6 rounded-xl border border-red-200 shadow-sm space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Confirmación de Seguridad
                </label>
                <input 
                  type="text" 
                  value={confirmText}
                  // NORMALIZACIÓN FORZADA: Mayúsculas y sin espacios extra al vuelo
                  onChange={(e) => setConfirmText(e.target.value.toUpperCase().trim())}
                  placeholder="ESCRIBE AQUÍ: REINICIAR"
                  disabled={loading}
                  className={clsx(
                    "w-full px-4 py-3 border-2 rounded-lg outline-none font-bold text-lg transition-all uppercase placeholder:normal-case placeholder:font-normal placeholder:text-slate-300",
                    confirmText === 'REINICIAR' 
                      ? "border-red-500 text-red-600 bg-red-50 ring-2 ring-red-100" 
                      : "border-slate-300 text-slate-600 focus:border-slate-400"
                  )}
                />
              </div>
              
              <button 
                onClick={handleReset}
                disabled={!isReady}
                className={clsx(
                  "w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all duration-200 shadow-lg",
                  isReady
                    ? "bg-red-600 hover:bg-red-700 text-white shadow-red-900/30 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                    : "bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed",
                  loading && "cursor-wait opacity-80"
                )}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin"/>
                    BORRANDO DATOS...
                  </>
                ) : (
                  <>
                    <Skull className={clsx("h-5 w-5", isReady ? "animate-pulse" : "")} />
                    CONFIRMAR DESTRUCCIÓN TOTAL
                  </>
                )}
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}
