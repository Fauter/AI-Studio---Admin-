
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { 
  Users, 
  Plus, 
  Shield, 
  UserPlus, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Briefcase,
  Trash2,
  Key,
  RefreshCw
} from 'lucide-react';
import { UserRole, EmployeeAccount } from '../types';

interface NewUserForm {
  firstName: string;
  lastName: string;
  username: string;
  password: string;
  role: UserRole;
}

export default function AccessControlPage() {
  const { garageId } = useParams<{ garageId: string }>();
  const { user } = useAuth(); // Dueño autenticado
  
  // --- States ---
  const [staff, setStaff] = useState<EmployeeAccount[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [isCreating, setIsCreating] = useState(false);
  const [newUser, setNewUser] = useState<NewUserForm>({
    firstName: '',
    lastName: '',
    username: '',
    password: '',
    role: UserRole.MANAGER 
  });
  
  const [formStatus, setFormStatus] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (garageId) fetchStaff();
  }, [garageId]);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('employee_accounts')
        .select('*')
        .eq('garage_id', garageId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStaff(data as EmployeeAccount[] || []);

    } catch (err: any) {
      console.error("Error cargando personal:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!garageId || !user) {
      setFormStatus({ type: 'error', text: 'Sesión no válida. Recarga la página.' });
      return;
    }

    setIsCreating(true);
    setFormStatus(null);

    try {
      // 1. Validaciones básicas
      if (newUser.password.length < 4) throw new Error("La contraseña debe tener al menos 4 caracteres.");
      if (newUser.username.length < 3) throw new Error("El usuario debe tener al menos 3 caracteres.");

      // 2. Preparar Payload (Shadow Auth)
      const payload = {
        garage_id: garageId,
        owner_id: user.id, // Requerido por RLS
        first_name: newUser.firstName.trim(),
        last_name: newUser.lastName.trim(),
        username: newUser.username.toLowerCase().trim(),
        password_hash: newUser.password, // Se envía plano, el Trigger SQL lo encripta
        role: newUser.role
      };

      // 3. Inserción Directa
      const { error } = await supabase
        .from('employee_accounts')
        .insert(payload);

      if (error) throw error;

      // 4. Éxito
      setFormStatus({ type: 'success', text: 'Empleado registrado correctamente.' });
      setNewUser({ 
        firstName: '', 
        lastName: '', 
        username: '', 
        password: '', 
        role: UserRole.MANAGER 
      });
      
      await fetchStaff();

    } catch (err: any) {
      console.error("Error creando usuario:", err);
      let msg = err.message || 'Error al crear usuario.';
      
      // Manejo de errores específicos de BD
      if (err.code === '42501') {
        msg = 'Permiso denegado: No eres el dueño de este garaje.';
      } else if (err.code === '23505' || msg.includes('unique_username_global')) {
        msg = 'El nombre de usuario ya está en uso.';
      }
      
      setFormStatus({ type: 'error', text: msg });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('¿Revocar acceso a este empleado? Esta acción es irreversible.')) return;
    
    try {
      const { error } = await supabase
        .from('employee_accounts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setStaff(prev => prev.filter(p => p.id !== id));
      
    } catch (err: any) {
      alert("Error al eliminar: " + err.message);
    }
  };

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-indigo-600" />
            Control de Personal
          </h1>
          <p className="text-slate-500 mt-1">
            Gestión de cuentas locales para Gerentes, Auditores y Operadores.
          </p>
        </div>
        <button 
          onClick={fetchStaff} 
          className="text-slate-500 hover:text-indigo-600 p-2 rounded-full hover:bg-slate-100 transition-colors"
          title="Actualizar lista"
        >
          <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* Panel de Creación */}
        <div className="xl:col-span-4">
           <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden sticky top-6">
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                 <UserPlus className="h-5 w-5 text-slate-500" />
                 <h3 className="font-bold text-slate-800">Registrar Empleado</h3>
              </div>
              
              <form onSubmit={handleCreateUser} className="p-6 space-y-5">
                 
                 {formStatus && (
                    <div className={`p-4 rounded-lg text-sm flex items-start gap-3 ${formStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                       {formStatus.type === 'success' ? <CheckCircle2 className="h-5 w-5 flex-shrink-0"/> : <AlertCircle className="h-5 w-5 flex-shrink-0"/>}
                       <p className="leading-snug">{formStatus.text}</p>
                    </div>
                 )}

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                       <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nombre</label>
                       <input 
                         type="text" required 
                         value={newUser.firstName}
                         onChange={e => setNewUser({...newUser, firstName: e.target.value})}
                         className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                         placeholder="Ej. Juan"
                       />
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Apellido</label>
                       <input 
                         type="text" required 
                         value={newUser.lastName}
                         onChange={e => setNewUser({...newUser, lastName: e.target.value})}
                         className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                         placeholder="Pérez"
                       />
                    </div>
                 </div>

                 <div className="space-y-1.5">
                   <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Usuario</label>
                   <div className="relative">
                      <Key className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input 
                        type="text" required 
                        value={newUser.username}
                        onChange={e => setNewUser({...newUser, username: e.target.value.replace(/\s/g, '').toLowerCase()})}
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
                        placeholder="juan.perez"
                        autoComplete="off"
                      />
                   </div>
                   <p className="text-[10px] text-slate-400">Sin espacios. Único globalmente.</p>
                 </div>

                 <div className="space-y-1.5">
                   <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Contraseña</label>
                   <input 
                     type="text" required minLength={4}
                     value={newUser.password}
                     onChange={e => setNewUser({...newUser, password: e.target.value})}
                     className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
                     placeholder="••••••"
                     autoComplete="off"
                   />
                 </div>

                 <div className="space-y-1.5">
                   <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Rol</label>
                   <select 
                     value={newUser.role}
                     onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}
                     className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                   >
                     <option value={UserRole.MANAGER}>Gerente</option>
                     <option value={UserRole.AUDITOR}>Auditor</option>
                     <option value={UserRole.OPERATOR}>Operador</option>
                   </select>
                 </div>

                 <div className="pt-2">
                    <button 
                      type="submit"
                      disabled={isCreating}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98]"
                    >
                       {isCreating ? <Loader2 className="h-4 w-4 animate-spin"/> : <Plus className="h-4 w-4"/>}
                       {isCreating ? 'Registrando...' : 'Crear Cuenta'}
                    </button>
                 </div>
              </form>
           </div>
        </div>

        {/* Lista de Personal */}
        <div className="xl:col-span-8">
           <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
             {loading ? (
               <div className="h-full flex flex-col items-center justify-center p-12 text-slate-400">
                  <Loader2 className="h-8 w-8 animate-spin mb-4 text-indigo-500"/>
                  <p>Cargando personal...</p>
               </div>
             ) : (
               <table className="w-full text-sm text-left">
                 <thead className="bg-slate-50 border-b border-slate-200">
                   <tr>
                     <th className="px-6 py-4 font-semibold text-slate-600">Empleado</th>
                     <th className="px-6 py-4 font-semibold text-slate-600">Credenciales</th>
                     <th className="px-6 py-4 font-semibold text-slate-600">Rol</th>
                     <th className="px-6 py-4 font-semibold text-slate-600 text-right">Acciones</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                   {staff.length === 0 ? (
                     <tr>
                       <td colSpan={4} className="px-6 py-16 text-center text-slate-500 italic flex flex-col items-center justify-center gap-2">
                         <div className="bg-slate-50 p-3 rounded-full">
                            <Users className="h-6 w-6 text-slate-300" />
                         </div>
                         <p>No hay empleados registrados en este garaje.</p>
                       </td>
                     </tr>
                   ) : (
                     staff.map((s) => (
                       <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                         <td className="px-6 py-4">
                           <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200 font-bold">
                                 {s.first_name.charAt(0)}{s.last_name.charAt(0)}
                              </div>
                              <div>
                                 <p className="font-bold text-slate-900">{s.first_name} {s.last_name}</p>
                                 <p className="text-xs text-slate-500">Alta: {new Date(s.created_at || '').toLocaleDateString()}</p>
                              </div>
                           </div>
                         </td>
                         <td className="px-6 py-4">
                            <div className="flex items-center gap-2 font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded w-fit text-xs border border-slate-200">
                               <Key className="h-3 w-3 text-slate-400" /> 
                               {s.username}
                            </div>
                         </td>
                         <td className="px-6 py-4">
                            <span className={`
                              inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide border
                              ${s.role === UserRole.MANAGER ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : ''}
                              ${s.role === UserRole.AUDITOR ? 'bg-amber-50 text-amber-700 border-amber-200' : ''}
                              ${s.role === UserRole.OPERATOR ? 'bg-slate-100 text-slate-600 border-slate-200' : ''}
                            `}>
                               {s.role === UserRole.MANAGER && <Shield className="h-3 w-3 mr-1"/>}
                               {s.role}
                            </span>
                         </td>
                         <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => handleDeleteUser(s.id)}
                              className="text-slate-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors group"
                              title="Revocar acceso"
                            >
                              <Trash2 className="h-4 w-4 group-hover:scale-110 transition-transform" />
                            </button>
                         </td>
                       </tr>
                     ))
                   )}
                 </tbody>
               </table>
             )}
           </div>
        </div>
      </div>
    </div>
  );
}
