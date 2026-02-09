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
  Key
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
  const { user } = useAuth(); // Current Owner
  
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
      // Query directly to the Shadow Auth table
      const { data, error } = await supabase
        .from('employee_accounts')
        .select('*')
        .eq('garage_id', garageId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStaff(data as EmployeeAccount[] || []);

    } catch (err) {
      console.error("Error fetching staff:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!garageId || !user) return;

    setIsCreating(true);
    setFormStatus(null);

    try {
      // 1. Direct Insert with Plain Password
      // The Database Trigger 'encrypt_employee_password' will hash the password_hash automatically.
      const { error } = await supabase.from('employee_accounts').insert({
        garage_id: garageId,
        owner_id: user.id, // RLS requirement: Owner must match auth.uid()
        first_name: newUser.firstName,
        last_name: newUser.lastName,
        username: newUser.username,
        password_hash: newUser.password, // Sent as plain, stored as hash by DB Trigger
        role: newUser.role
      });

      if (error) throw error;

      // Success
      setFormStatus({ type: 'success', text: 'Empleado registrado exitosamente.' });
      setNewUser({ 
        firstName: '', 
        lastName: '', 
        username: '', 
        password: '', 
        role: UserRole.MANAGER 
      });
      
      fetchStaff();

    } catch (err: any) {
      console.error("Creation Error:", err);
      let msg = err.message || 'Error al crear usuario.';
      
      if (msg.includes('unique_username_global')) {
          msg = 'El nombre de usuario ya está en uso. Intenta con otro.';
      }
      
      setFormStatus({ type: 'error', text: msg });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar a este empleado? Perderá el acceso inmediatamente.')) return;
    
    try {
      const { error } = await supabase
        .from('employee_accounts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchStaff();
    } catch (err: any) {
      alert("Error al eliminar: " + err.message);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Users className="h-6 w-6 text-indigo-600" />
          Accesos & Personal
        </h1>
        <p className="text-slate-500 mt-1">
          Gestiona las cuentas de operación (Shadow Auth) para este garaje.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Creation Form */}
        <div className="lg:col-span-5">
           <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden sticky top-6">
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                 <UserPlus className="h-5 w-5 text-slate-500" />
                 <h3 className="font-bold text-slate-800">Crear Cuenta de Empleado</h3>
              </div>
              
              <form onSubmit={handleCreateUser} className="p-6 space-y-4">
                 
                 {formStatus && (
                    <div className={`p-3 rounded-lg text-sm flex items-start gap-2 ${formStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                       {formStatus.type === 'success' ? <CheckCircle2 className="h-4 w-4 mt-0.5"/> : <AlertCircle className="h-4 w-4 mt-0.5"/>}
                       {formStatus.text}
                    </div>
                 )}

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Nombre</label>
                       <input 
                         type="text" required 
                         value={newUser.firstName}
                         onChange={e => setNewUser({...newUser, firstName: e.target.value})}
                         className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                         placeholder="Ej. Juan"
                       />
                    </div>
                    <div>
                       <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Apellido</label>
                       <input 
                         type="text" required 
                         value={newUser.lastName}
                         onChange={e => setNewUser({...newUser, lastName: e.target.value})}
                         className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                         placeholder="Pérez"
                       />
                    </div>
                 </div>

                 <div>
                   <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Usuario de Acceso</label>
                   <div className="relative">
                      <Key className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input 
                        type="text" required 
                        value={newUser.username}
                        onChange={e => setNewUser({...newUser, username: e.target.value.toLowerCase().replace(/\s/g, '')})}
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
                        placeholder="juan.perez"
                        autoComplete="off"
                      />
                   </div>
                   <p className="text-[10px] text-slate-400 mt-1">
                     Único en el sistema. Sin espacios.
                   </p>
                 </div>

                 <div>
                   <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Contraseña</label>
                   <input 
                     type="text" required minLength={4}
                     value={newUser.password}
                     onChange={e => setNewUser({...newUser, password: e.target.value})}
                     className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
                     placeholder="Clave de acceso"
                     autoComplete="off"
                   />
                 </div>

                 <div>
                   <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Rol Asignado</label>
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
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all"
                    >
                       {isCreating ? <Loader2 className="h-4 w-4 animate-spin"/> : <Plus className="h-4 w-4"/>}
                       {isCreating ? 'Procesando...' : 'Crear Cuenta'}
                    </button>
                 </div>
              </form>
           </div>
        </div>

        {/* Staff List */}
        <div className="lg:col-span-7">
           <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
             {loading ? (
               <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600"/></div>
             ) : (
               <table className="w-full text-sm text-left">
                 <thead className="bg-slate-50 border-b border-slate-200">
                   <tr>
                     <th className="px-6 py-4 font-semibold text-slate-600">Empleado</th>
                     <th className="px-6 py-4 font-semibold text-slate-600">Rol</th>
                     <th className="px-6 py-4 font-semibold text-slate-600 text-right">Acciones</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                   {staff.length === 0 ? (
                     <tr>
                       <td colSpan={3} className="px-6 py-8 text-center text-slate-500 italic">
                         No hay empleados registrados.
                       </td>
                     </tr>
                   ) : (
                     staff.map((s) => (
                       <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                         <td className="px-6 py-4">
                           <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                                 <Briefcase className="h-4 w-4" />
                              </div>
                              <div>
                                 <p className="font-bold text-slate-900">{s.first_name} {s.last_name}</p>
                                 <div className="flex items-center gap-1 text-xs text-slate-500 font-mono">
                                    <Key className="h-3 w-3" /> {s.username}
                                 </div>
                              </div>
                           </div>
                         </td>
                         <td className="px-6 py-4">
                            <span className={`
                              inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide border
                              ${s.role === UserRole.MANAGER ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : ''}
                              ${s.role === UserRole.AUDITOR ? 'bg-amber-50 text-amber-700 border-amber-200' : ''}
                              ${s.role === UserRole.OPERATOR ? 'bg-slate-100 text-slate-600 border-slate-200' : ''}
                            `}>
                               {s.role === UserRole.MANAGER ? <Shield className="h-3 w-3 mr-1"/> : null}
                               {s.role}
                            </span>
                         </td>
                         <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => handleDeleteUser(s.id)}
                              className="text-slate-400 hover:text-red-600 p-2 hover:bg-red-50 rounded transition-colors"
                              title="Eliminar cuenta"
                            >
                              <Trash2 className="h-4 w-4" />
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