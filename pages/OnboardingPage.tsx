
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, 
  MapPin, 
  CheckCircle2, 
  Loader2, 
  LogOut, 
  Plus, 
  BarChart3,
  Users,
  Wallet,
  TrendingUp,
  AlertCircle,
  Shield,
  Key,
  UserPlus,
  Trash2,
  Briefcase,
  Lock,
  Unlock,
  CheckSquare,
  Save,
  LayoutGrid,
  CircleDot
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Garage, EmployeeAccount, UserRole, EmployeePermissions } from '../types';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// --- SUB-COMPONENT: CASHFLOW SECTION ---
const CashFlowSection = ({ garageCount }: { garageCount: number }) => (
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Wallet className="h-24 w-24 text-indigo-600" />
        </div>
        <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">Ingresos Globales (Mes)</p>
        <h3 className="text-3xl font-bold text-slate-900 mt-2">$ 0.00</h3>
        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
          <TrendingUp className="h-3 w-3 text-emerald-500" /> 0% vs mes anterior
        </p>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Building2 className="h-24 w-24 text-blue-600" />
        </div>
        <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">Garajes Activos</p>
        <h3 className="text-3xl font-bold text-slate-900 mt-2">{garageCount}</h3>
        <p className="text-xs text-slate-400 mt-1">Infraestructura operativa</p>
      </div>
    </div>
  </div>
);

// --- ROLE CONFIG ---
const ROLE_UI_CONFIG: Record<string, { label: string; weight: number; style: string }> = {
  [UserRole.MANAGER]: { 
    label: 'Gerente', 
    weight: 1, 
    style: 'bg-indigo-50 text-indigo-700 border-indigo-200 ring-1 ring-indigo-500/10' 
  },
  [UserRole.ADMINISTRATIVE]: { 
    label: 'Administrativo', 
    weight: 2, 
    style: 'bg-amber-50 text-amber-700 border-amber-200 ring-1 ring-amber-500/10' 
  },
  [UserRole.OPERATOR]: { 
    label: 'Operador', 
    weight: 3, 
    style: 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-1 ring-emerald-500/10' 
  },
  [UserRole.OWNER]: { label: 'Dueño', weight: 0, style: 'bg-slate-900 text-white border-slate-700' },
};

// --- GESTIÓN DE PERSONAL (MISSION 1 & 2) ---
const GlobalAccessSection = ({ garages }: { garages: Garage[] }) => {
  const { user, profile, shadowUser } = useAuth();
  const [subTab, setSubTab] = useState<'create' | 'permissions'>('create');
  const [staff, setStaff] = useState<EmployeeAccount[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Logic: Determine who is the "Boss" (Organization Owner)
  // If I am Owner -> user.id is the Boss ID
  // If I am Manager -> shadowUser.owner_id is the Boss ID
  const isManager = shadowUser?.role === UserRole.MANAGER;
  const effectiveOwnerId = user?.id || shadowUser?.owner_id;

  // Create State
  const [isCreating, setIsCreating] = useState(false);
  const [newUser, setNewUser] = useState({
    firstName: '', 
    lastName: '', 
    username: '', 
    password: '', 
    role: isManager ? UserRole.ADMINISTRATIVE : UserRole.MANAGER // Default depends on creator role
  });
  const [status, setStatus] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Permissions State
  const [selectedEmp, setSelectedEmp] = useState<EmployeeAccount | null>(null);
  const [permDraft, setPermDraft] = useState<EmployeePermissions>({ sections: [], allowed_garages: [] });
  const [savingPerms, setSavingPerms] = useState(false);

  // MISSION 1: FETCH VISIBILITY VIA RPC
  useEffect(() => {
    // Only fetch if Owner OR (Manager with 'access' permission)
    const canView = 
      profile?.role === UserRole.OWNER || 
      (isManager && shadowUser?.permissions?.sections?.includes('access'));

    if (canView && effectiveOwnerId) {
      fetchStaff();
    }
  }, [user, profile, shadowUser, effectiveOwnerId]);

  const fetchStaff = async () => {
    if (!effectiveOwnerId) return;
    setLoading(true);
    try {
      // Cambio Crítico: Usar RPC para saltar restricciones RLS complejas y ver todo el staff del owner
      // Si el RPC falla (no existe), el fallback captura el error.
      const { data, error } = await supabase.rpc('get_staff_by_owner', { 
        p_owner_id: effectiveOwnerId 
      });
        
      if (error) {
         // Fallback a select directo si RPC no está desplegado aún (retrocompatibilidad)
         console.warn("RPC fetch failed, falling back to direct select", error);
         const { data: fallbackData, error: fallbackError } = await supabase
            .from('employee_accounts')
            .select('*')
            .eq('owner_id', effectiveOwnerId);
         
         if (fallbackError) throw fallbackError;
         processStaffData(fallbackData as EmployeeAccount[]);
      } else {
         processStaffData(data as EmployeeAccount[]);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const processStaffData = (data: EmployeeAccount[]) => {
    const rawStaff = data || [];
    const sortedStaff = rawStaff.sort((a, b) => {
      const weightA = ROLE_UI_CONFIG[a.role]?.weight ?? 99;
      const weightB = ROLE_UI_CONFIG[b.role]?.weight ?? 99;
      return weightA - weightB;
    });
    setStaff(sortedStaff);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveOwnerId) return;

    setIsCreating(true);
    setStatus(null);

    try {
      if (newUser.password.length < 4) throw new Error("Contraseña muy corta (min 4).");
      if (newUser.username.length < 3) throw new Error("Usuario muy corto (min 3).");

      // MISSION 2: Safety Check - Managers cannot create Managers
      if (isManager && newUser.role === UserRole.MANAGER) {
        throw new Error("Privilegios insuficientes para crear Gerentes.");
      }

      const { error } = await supabase.from('employee_accounts').insert({
        owner_id: effectiveOwnerId, // CRITICAL: Always link to the Organization Owner
        first_name: newUser.firstName.trim(),
        last_name: newUser.lastName.trim(),
        username: newUser.username.toLowerCase().trim(),
        password_hash: newUser.password,
        role: newUser.role,
        permissions: { sections: [], allowed_garages: [] } 
      });

      if (error) {
        if (error.code === '23505') throw new Error("El usuario ya existe globalmente.");
        throw error;
      }

      setStatus({ type: 'success', text: 'Empleado registrado exitosamente.' });
      setNewUser({ 
        firstName: '', 
        lastName: '', 
        username: '', 
        password: '', 
        role: isManager ? UserRole.ADMINISTRATIVE : UserRole.MANAGER 
      });
      fetchStaff();
    } catch (err: any) {
      setStatus({ type: 'error', text: err.message });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este usuario?')) return;
    try {
      const { error } = await supabase.from('employee_accounts').delete().eq('id', id);
      if (error) throw error;
      fetchStaff();
      if (selectedEmp?.id === id) setSelectedEmp(null);
    } catch (err) {
      console.error(err);
    }
  };

  // --- PERMISSION HANDLERS ---

  const initPermissions = (emp: EmployeeAccount) => {
    setSelectedEmp(emp);
    setPermDraft(emp.permissions || { sections: [], allowed_garages: [] });
  };

  const toggleGarage = (garageId: string, singleMode: boolean) => {
    setPermDraft(prev => {
      if (singleMode) {
        return { ...prev, allowed_garages: [garageId] };
      } else {
        const exists = prev.allowed_garages.includes(garageId);
        return {
          ...prev,
          allowed_garages: exists 
            ? prev.allowed_garages.filter(id => id !== garageId)
            : [...prev.allowed_garages, garageId]
        };
      }
    });
  };

  const toggleSection = (section: string) => {
    setPermDraft(prev => {
      const exists = prev.sections.includes(section);
      return {
        ...prev,
        sections: exists ? prev.sections.filter(s => s !== section) : [...prev.sections, section]
      };
    });
  };

  const savePermissions = async () => {
    if (!selectedEmp) return;
    setSavingPerms(true);
    try {
      const { error } = await supabase
        .from('employee_accounts')
        .update({ permissions: permDraft })
        .eq('id', selectedEmp.id);

      if (error) throw error;
      
      setStaff(prev => prev.map(s => s.id === selectedEmp.id ? { ...s, permissions: permDraft } : s));
      setStatus({ type: 'success', text: `Permisos actualizados para ${selectedEmp.first_name}` });
      setTimeout(() => setStatus(null), 3000);

    } catch (err: any) {
      setStatus({ type: 'error', text: 'Error guardando permisos: ' + err.message });
    } finally {
      setSavingPerms(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex space-x-4 border-b border-slate-200 pb-1">
        <button onClick={() => setSubTab('create')} className={cn("pb-2 px-2 text-sm font-bold border-b-2 transition-colors", subTab === 'create' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800")}>Alta de Empleados</button>
        <button onClick={() => setSubTab('permissions')} className={cn("pb-2 px-2 text-sm font-bold border-b-2 transition-colors", subTab === 'permissions' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800")}>Roles y Permisos</button>
      </div>

      {status && (
        <div className={cn("p-4 rounded-xl border flex items-center gap-3 animate-in fade-in", status.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700')}>
          {status.type === 'success' ? <CheckCircle2 className="h-5 w-5"/> : <AlertCircle className="h-5 w-5"/>}
          <p className="font-medium text-sm">{status.text}</p>
        </div>
      )}

      {subTab === 'create' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          <div className="xl:col-span-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden sticky top-6">
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-slate-500" />
                <h3 className="font-bold text-slate-800">Registrar Personal</h3>
              </div>
              <form onSubmit={handleCreateUser} className="p-6 space-y-5">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <input type="text" placeholder="Nombre" required value={newUser.firstName} onChange={e => setNewUser({...newUser, firstName: e.target.value})} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                    <input type="text" placeholder="Apellido" required value={newUser.lastName} onChange={e => setNewUser({...newUser, lastName: e.target.value})} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div className="relative">
                    <Key className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <input type="text" placeholder="usuario.sistema" required value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value.replace(/\s/g, '').toLowerCase()})} className="w-full pl-9 px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <input type="text" placeholder="Contraseña Inicial" required value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500" />
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})} className="w-full pl-9 px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500">
                      {/* MISSION 2: Role Filtering - Managers cannot create Managers */}
                      {!isManager && <option value={UserRole.MANAGER}>Gerente</option>}
                      <option value={UserRole.ADMINISTRATIVE}>Administrativo</option>
                      <option value={UserRole.OPERATOR}>Operador</option>
                    </select>
                  </div>
                </div>
                <button type="submit" disabled={isCreating} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl flex justify-center gap-2 text-sm transition-all shadow-md shadow-indigo-200">
                  {isCreating ? <Loader2 className="h-4 w-4 animate-spin"/> : <Plus className="h-4 w-4"/>} Crear Cuenta
                </button>
              </form>
            </div>
          </div>
          <div className="xl:col-span-8">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
               <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-xs font-semibold">
                    <tr>
                      <th className="px-6 py-4">Empleado</th>
                      <th className="px-6 py-4">Usuario</th>
                      <th className="px-6 py-4">Rol</th>
                      <th className="px-6 py-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {staff.map(s => {
                      const roleConfig = ROLE_UI_CONFIG[s.role] || { label: s.role, style: 'bg-slate-100' };
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/50">
                          <td className="px-6 py-4 font-bold text-slate-800">{s.first_name} {s.last_name}</td>
                          <td className="px-6 py-4 font-mono text-slate-500">{s.username}</td>
                          <td className="px-6 py-4"><span className={cn("px-2 py-1 rounded text-xs font-bold uppercase", roleConfig.style)}>{roleConfig.label}</span></td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => handleDeleteUser(s.id)} className="text-slate-300 hover:text-red-600 p-2"><Trash2 className="h-4 w-4"/></button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
               </table>
            </div>
          </div>
        </div>
      )}

      {subTab === 'permissions' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 min-h-[500px]">
          <div className="xl:col-span-4 flex flex-col gap-4">
             <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Seleccionar Empleado</h3>
             <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-1">
                <div className="overflow-y-auto max-h-[600px] divide-y divide-slate-100">
                  {staff.filter(s => s.role !== UserRole.OPERATOR).map(s => (
                    <button key={s.id} onClick={() => initPermissions(s)} className={cn("w-full text-left px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors", selectedEmp?.id === s.id ? "bg-indigo-50 border-l-4 border-indigo-600" : "border-l-4 border-transparent")}>
                       <div>
                          <p className={cn("font-bold text-sm", selectedEmp?.id === s.id ? "text-indigo-900" : "text-slate-700")}>{s.first_name} {s.last_name}</p>
                          <p className="text-xs text-slate-500 mt-0.5 font-mono">@{s.username}</p>
                       </div>
                       <span className={cn("text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border", ROLE_UI_CONFIG[s.role]?.style)}>{ROLE_UI_CONFIG[s.role]?.label}</span>
                    </button>
                  ))}
                  {staff.filter(s => s.role !== UserRole.OPERATOR).length === 0 && <div className="p-8 text-center text-slate-400 text-sm">No hay empleados configurables.</div>}
                </div>
             </div>
          </div>

          <div className="xl:col-span-8">
            {selectedEmp ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm h-full flex flex-col">
                 <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div>
                      <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                        <Shield className="h-5 w-5 text-indigo-600" />
                        Configurando a {selectedEmp.first_name}
                      </h2>
                      <p className="text-slate-500 text-sm mt-1">{selectedEmp.role === UserRole.MANAGER ? 'Acceso Gerencial: Multi-Garaje y Reportes.' : 'Acceso Administrativo: Operación Local.'}</p>
                    </div>
                    <button onClick={savePermissions} disabled={savingPerms} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all disabled:opacity-50">
                       {savingPerms ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>} Guardar Cambios
                    </button>
                 </div>

                 <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-10 flex-1 overflow-y-auto">
                    <div className="space-y-4">
                       <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                         <Building2 className="h-4 w-4 text-slate-400"/>
                         {selectedEmp.role === UserRole.MANAGER ? 'Garajes Asignados (Multi)' : 'Garaje Asignado (Único)'}
                       </h4>
                       <div className="bg-slate-50 rounded-xl border border-slate-200 p-2 space-y-1">
                          {garages.map(g => {
                            const isSelected = permDraft.allowed_garages.includes(g.id);
                            const isManagerTarget = selectedEmp.role === UserRole.MANAGER;
                            
                            return (
                              <button key={g.id} onClick={() => toggleGarage(g.id, !isManagerTarget)} className={cn("w-full flex items-center justify-between p-3 rounded-lg transition-all border", isSelected ? "bg-white border-indigo-200 shadow-sm ring-1 ring-indigo-500/20" : "border-transparent hover:bg-white hover:border-slate-200")}>
                                 <div className="flex items-center gap-3">
                                    <div className={cn("h-4 w-4 rounded-full border flex items-center justify-center transition-colors", isSelected ? "bg-indigo-600 border-indigo-600" : "bg-white border-slate-300")}>
                                      {isSelected && (isManagerTarget ? <CheckSquare className="h-2.5 w-2.5 text-white" /> : <CircleDot className="h-2.5 w-2.5 text-white" />)}
                                    </div>
                                    <span className={cn("text-sm font-medium", isSelected ? "text-indigo-900" : "text-slate-600")}>{g.name}</span>
                                 </div>
                              </button>
                            )
                          })}
                          {garages.length === 0 && <p className="text-xs text-slate-400 p-4 text-center">No hay garajes disponibles.</p>}
                       </div>
                    </div>

                    <div className="space-y-4">
                       <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                         <LayoutGrid className="h-4 w-4 text-slate-400"/>
                         {selectedEmp.role === UserRole.MANAGER ? 'Permisos Globales (Hub)' : 'Permisos Operativos (Dashboard)'}
                       </h4>
                       <div className="grid grid-cols-1 gap-3">
                          {selectedEmp.role === UserRole.MANAGER ? (
                            ['cashflow', 'access'].map(sec => (
                                <button key={sec} onClick={() => toggleSection(sec)} className={cn("flex items-center gap-3 p-4 rounded-xl border transition-all text-left", permDraft.sections.includes(sec) ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-white border-slate-200 text-slate-500")}>
                                   {permDraft.sections.includes(sec) ? <Unlock className="h-5 w-5"/> : <Lock className="h-5 w-5"/>}
                                   <div>
                                      <p className="font-bold text-sm uppercase">{sec === 'cashflow' ? 'Finanzas Globales' : 'Gestionar Accesos'}</p>
                                   </div>
                                </button>
                            ))
                          ) : (
                             ['precios', 'finanzas', 'ajustes'].map(sec => (
                                 <button key={sec} onClick={() => toggleSection(sec)} className={cn("flex items-center gap-3 p-3 rounded-lg border transition-all text-left", permDraft.sections.includes(sec) ? "bg-blue-50 border-blue-200 text-blue-800" : "bg-white border-slate-200 text-slate-500")}>
                                    <div className={cn("h-5 w-5 rounded border flex items-center justify-center", permDraft.sections.includes(sec) ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-slate-300")}>
                                       {permDraft.sections.includes(sec) && <CheckSquare className="h-3.5 w-3.5" />}
                                    </div>
                                    <span className="font-bold text-sm capitalize">{sec}</span>
                                 </button>
                             ))
                          )}
                       </div>
                    </div>
                 </div>
              </div>
            ) : (
              <div className="h-full bg-slate-50 border border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center text-slate-400 p-10">
                 <Shield className="h-12 w-12 mb-4 opacity-20" />
                 <p className="font-medium text-lg">Selecciona un empleado</p>
                 <p className="text-sm">Configura sus accesos a garajes y permisos.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// --- GARAGE SELECTOR SECTION ---
const GarageSelectorSection = ({ garages, onRefresh }: { garages: Garage[], onRefresh: () => void }) => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [viewMode, setViewMode] = useState<'list' | 'create'>('list');
  const [formData, setFormData] = useState({ name: '', address: '', cuit: '' });
  const [submitting, setSubmitting] = useState(false);

  const isOwner = profile?.role === UserRole.OWNER;

  const handleCreateGarage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.from('garages').insert({
        owner_id: user.id, name: formData.name, address: formData.address, cuit: formData.cuit
      }).select().single();
      if (error) throw error;
      
      await supabase.from('building_configs').insert({ garage_id: data.id });
      await supabase.from('financial_configs').insert({ garage_id: data.id });
      onRefresh(); 
      navigate(`/${data.id}/dashboard`, { replace: true });
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (viewMode === 'create') {
    return (
      <div className="max-w-2xl mx-auto animate-in fade-in zoom-in-95">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-900 px-8 py-4 flex items-center justify-between">
            <span className="text-white font-bold flex items-center gap-2"><Building2 className="h-5 w-5"/> Nuevo Garaje</span>
            <button onClick={() => setViewMode('list')} className="text-slate-400 hover:text-white text-xs">Cancelar</button>
          </div>
          <form onSubmit={handleCreateGarage} className="p-8 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="col-span-2">
                <label className="block text-sm font-bold text-slate-700 mb-2">Nombre</label>
                <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Dirección</label>
                <input type="text" required value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">CUIT</label>
                <input type="text" required value={formData.cuit} onChange={e => setFormData({...formData, cuit: e.target.value})} className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none" />
              </div>
            </div>
            <button type="submit" disabled={submitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl flex justify-center gap-2 transition-all">
              {submitting ? <Loader2 className="animate-spin"/> : <CheckCircle2/>} Registrar Garaje
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2">
      {/* Create Card - Only for Owners */}
      {isOwner && (
        <div onClick={() => setViewMode('create')} className="group flex flex-col items-center justify-center min-h-[200px] border-2 border-dashed border-slate-300 rounded-2xl p-6 cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition-all">
          <div className="p-4 bg-slate-100 rounded-full group-hover:bg-blue-100 transition-colors mb-4">
            <Plus className="h-8 w-8 text-slate-400 group-hover:text-blue-600" />
          </div>
          <h3 className="font-semibold text-slate-600 group-hover:text-blue-700">Registrar Nuevo</h3>
        </div>
      )}
      
      {garages.map((garage) => (
        <div key={garage.id} onClick={() => navigate(`/${garage.id}/dashboard`)} className="group relative bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-xl hover:ring-2 hover:ring-blue-500/50 transition-all cursor-pointer">
           <div className="flex items-start gap-4 mb-4">
             <div className="p-3 bg-blue-50 rounded-xl group-hover:bg-blue-600 transition-colors duration-300">
                <Building2 className="h-8 w-8 text-blue-600 group-hover:text-white" />
             </div>
             <div>
               <h3 className="font-bold text-lg text-slate-900 leading-tight mb-1">{garage.name}</h3>
               <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-100">Activo</span>
             </div>
           </div>
           <div className="space-y-2 mt-4 pt-4 border-t border-slate-100 text-sm text-slate-500">
              <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-400" /><span className="truncate">{garage.address || 'Sin dirección'}</span></div>
           </div>
        </div>
      ))}
    </div>
  );
};

// --- MAIN PAGE ---
type HubSection = 'cashflow' | 'garages' | 'access';

export default function OnboardingPage() {
  const { user, signOut, shadowUser, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<HubSection>('garages'); 
  const [garages, setGarages] = useState<Garage[]>([]);
  const [loading, setLoading] = useState(true);

  // --- GUARDIÁN DE SEGURIDAD PARA ADMINISTRATIVOS ---
  // Un Administrativo NUNCA debería ver esta página (Hub).
  useEffect(() => {
    if (authLoading) return;
    if (shadowUser?.role === UserRole.ADMINISTRATIVE) {
       const target = shadowUser.permissions?.allowed_garages?.[0];
       if (target) {
          navigate(`/${target}/dashboard`, { replace: true });
       }
    }
  }, [shadowUser, authLoading, navigate]);

  // Filter Tabs based on Permissions
  const allowedTabs = [
    { id: 'cashflow', label: 'Flujo de Caja', icon: BarChart3 },
    { id: 'garages', label: 'Red de Garajes', icon: Building2 },
    { id: 'access', label: 'Personal & Accesos', icon: Users },
  ].filter(tab => {
    // Owners/SuperAdmins see all
    if (profile?.role === UserRole.OWNER || profile?.role === UserRole.SUPERADMIN) return true;
    
    // Shadow Users see only permitted sections in Hub
    if (shadowUser && shadowUser.permissions) {
      // Garages tab is always needed to enter a garage
      if (tab.id === 'garages') return true; 
      // Other tabs (cashflow, access) require explicit permission
      return shadowUser.permissions.sections.includes(tab.id);
    }
    return true; 
  });

  const fetchGarages = async () => {
    // 1. Critical Guard: Do not fetch if auth is not ready
    if (authLoading) return;
    if (!user && !shadowUser) return;

    setLoading(true);
    try {
      let query = supabase.from('garages').select('*');
      
      // LOGIC FOR OWNERS (Standard Auth)
      if (profile?.role === UserRole.OWNER) {
        query = query.eq('owner_id', user?.id);
      
      // LOGIC FOR EMPLOYEES (Shadow Auth)
      } else if (shadowUser) {
        // STRICTLY USE LOCAL PERMISSIONS - NO PROFILE QUERY
        const allowedIds = shadowUser.permissions?.allowed_garages || [];
        
        if (allowedIds.length === 0) {
           setGarages([]); 
           return;
        }
        query = query.in('id', allowedIds);
      
      } else {
         // Fallback safety
         setGarages([]);
         return;
      }

      const { data } = await query;
      setGarages(data as Garage[] || []);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchGarages(); }, [user, shadowUser, authLoading]);

  // Auto-switch tab if current one is not allowed
  useEffect(() => {
    if (!allowedTabs.find(t => t.id === activeTab)) {
      setActiveTab(allowedTabs[0]?.id as HubSection || 'garages');
    }
  }, [allowedTabs, activeTab]);

  if (loading || authLoading) return <div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="h-8 w-8 animate-spin text-indigo-600"/></div>;

  // Si es administrativo, no renderizar nada mientras redirige
  if (shadowUser?.role === UserRole.ADMINISTRATIVE) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg"><Shield className="h-5 w-5 text-white" /></div>
            <span className="font-bold text-slate-900 text-lg tracking-tight hidden md:block">GarageIA Hub</span>
          </div>
          <nav className="flex space-x-1 bg-slate-100 p-1 rounded-xl">
             {allowedTabs.map((tab) => {
               const Icon = tab.icon;
               const isActive = activeTab === tab.id;
               return (
                 <button key={tab.id} onClick={() => setActiveTab(tab.id as HubSection)} className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all", isActive ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-900")}>
                   <Icon className={cn("h-4 w-4", isActive ? "text-indigo-600" : "text-slate-400")} />
                   <span className="hidden sm:inline">{tab.label}</span>
                 </button>
               )
             })}
          </nav>
          <button onClick={() => signOut()} className="text-slate-400 hover:text-red-600 p-2 rounded-lg transition-colors" title="Cerrar Sesión"><LogOut className="h-5 w-5" /></button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {activeTab === 'cashflow' && 'Flujo de Caja'}
            {activeTab === 'garages' && 'Infraestructura'}
            {activeTab === 'access' && 'Gestión de Personal'}
          </h1>
          <p className="text-slate-500 mt-1">
             {activeTab === 'cashflow' && `Bienvenido, ${profile?.full_name || 'Usuario'}.`}
             {activeTab === 'garages' && 'Accede a los establecimientos asignados.'}
             {activeTab === 'access' && 'Controla roles, usuarios y permisos del sistema.'}
          </p>
        </div>
        {activeTab === 'cashflow' && <CashFlowSection garageCount={garages.length} />}
        {activeTab === 'garages' && <GarageSelectorSection garages={garages} onRefresh={fetchGarages} />}
        {activeTab === 'access' && <GlobalAccessSection garages={garages} />}
      </main>
    </div>
  );
}
