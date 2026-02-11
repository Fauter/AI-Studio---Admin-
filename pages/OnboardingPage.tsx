
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, 
  MapPin, 
  FileText, 
  CheckCircle2, 
  Loader2, 
  LogOut, 
  Plus, 
  ArrowRight,
  LayoutDashboard,
  BarChart3,
  Users,
  Wallet,
  TrendingUp,
  AlertCircle,
  Shield,
  Key,
  UserPlus,
  Trash2,
  RefreshCw,
  Search,
  Globe,
  Briefcase
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Garage, EmployeeAccount, UserRole } from '../types';
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

    {garageCount === 0 && (
      <div className="p-8 text-center bg-indigo-50/50 border border-indigo-100 rounded-2xl">
        <h4 className="text-lg font-bold text-indigo-900">Comienza tu Imperio</h4>
        <p className="text-indigo-600/80 mb-4 max-w-md mx-auto">
          Aún no tienes garajes registrados. Ve a la pestaña "Red de Garajes" para configurar tu primer establecimiento.
        </p>
      </div>
    )}
  </div>
);

// --- CONFIGURACIÓN DE ROLES UI (JERARQUÍA Y ESTILO) ---
const ROLE_UI_CONFIG: Record<string, { label: string; weight: number; style: string; icon?: any }> = {
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
  // Fallbacks
  [UserRole.AUDITOR]: { label: 'Auditor', weight: 4, style: 'bg-slate-100 text-slate-600 border-slate-200' },
  [UserRole.OWNER]: { label: 'Dueño', weight: 0, style: 'bg-slate-900 text-white border-slate-700' },
};

// --- SUB-COMPONENT: GLOBAL ACCESS SECTION ---
const GlobalAccessSection = () => {
  const { user } = useAuth();
  const [staff, setStaff] = useState<EmployeeAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  
  // Default to MANAGER
  const [newUser, setNewUser] = useState({
    firstName: '',
    lastName: '',
    username: '',
    password: '',
    role: UserRole.MANAGER 
  });
  
  const [status, setStatus] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (user) fetchStaff();
  }, [user]);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      // 1. Fetch Data
      const { data, error } = await supabase
        .from('employee_accounts')
        .select('*, garages!fk_garage(name)')
        .eq('owner_id', user?.id);
        
      if (error) throw error;
      
      const rawStaff = data as EmployeeAccount[] || [];

      // 2. Sort Logic: Hierarchy (Weight) -> then Created At
      const sortedStaff = rawStaff.sort((a, b) => {
        const weightA = ROLE_UI_CONFIG[a.role]?.weight ?? 99;
        const weightB = ROLE_UI_CONFIG[b.role]?.weight ?? 99;
        
        if (weightA !== weightB) return weightA - weightB;
        
        // Secondary Sort: Newest first
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      });

      setStaff(sortedStaff);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsCreating(true);
    setStatus(null);

    try {
      if (newUser.password.length < 4) throw new Error("Contraseña muy corta (min 4).");
      if (newUser.username.length < 3) throw new Error("Usuario muy corto (min 3).");

      const { error } = await supabase.from('employee_accounts').insert({
        owner_id: user.id,
        first_name: newUser.firstName.trim(),
        last_name: newUser.lastName.trim(),
        username: newUser.username.toLowerCase().trim(),
        password_hash: newUser.password,
        role: newUser.role
        // garage_id is omitted intentionally (Global by default)
      });

      if (error) {
        if (error.code === '23505') throw new Error("El usuario ya existe globalmente.");
        throw error;
      }

      setStatus({ type: 'success', text: 'Empleado registrado exitosamente.' });
      setNewUser({ firstName: '', lastName: '', username: '', password: '', role: UserRole.MANAGER });
      fetchStaff();
    } catch (err: any) {
      setStatus({ type: 'error', text: err.message });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    console.log("[Delete] Intentando borrar empleado:", id);
    try {
      const { error } = await supabase.from('employee_accounts').delete().eq('id', id);
      if (error) throw error;
      fetchStaff();
    } catch (err) {
      console.error("Error al eliminar empleado:", err);
      setStatus({ type: 'error', text: 'Error al intentar eliminar el empleado.' });
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-2">
      {/* Create Form */}
      <div className="xl:col-span-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden sticky top-6">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-slate-500" />
            <h3 className="font-bold text-slate-800">Alta de Personal</h3>
          </div>
          <form onSubmit={handleCreateUser} className="p-6 space-y-5">
            {status && (
              <div className={cn("p-3 rounded-lg text-sm flex gap-2 font-medium", 
                status.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
              )}>
                {status.type === 'success' ? <CheckCircle2 className="h-4 w-4"/> : <AlertCircle className="h-4 w-4"/>}
                {status.text}
              </div>
            )}
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input type="text" placeholder="Nombre" required value={newUser.firstName} onChange={e => setNewUser({...newUser, firstName: e.target.value})} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                <input type="text" placeholder="Apellido" required value={newUser.lastName} onChange={e => setNewUser({...newUser, lastName: e.target.value})} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
              </div>
              
              <div className="relative">
                <Key className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input type="text" placeholder="usuario.sistema" required value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value.replace(/\s/g, '').toLowerCase()})} className="w-full pl-9 px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
              </div>
              
              <input type="text" placeholder="Contraseña de Acceso" required value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
              
              <div className="relative">
                <Briefcase className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <select 
                  value={newUser.role} 
                  onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})} 
                  className="w-full pl-9 px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none cursor-pointer"
                >
                  <option value={UserRole.MANAGER}>Gerente</option>
                  <option value={UserRole.ADMINISTRATIVE}>Administrativo</option>
                  <option value={UserRole.OPERATOR}>Operador</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
            </div>

            <button type="submit" disabled={isCreating} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl flex justify-center gap-2 text-sm transition-all shadow-md shadow-indigo-200">
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin"/> : <Plus className="h-4 w-4"/>} 
              Registrar Empleado
            </button>
          </form>
        </div>
      </div>

      {/* List */}
      <div className="xl:col-span-8">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
          {loading ? (
            <div className="flex h-64 items-center justify-center flex-col gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500"/>
              <p className="text-sm text-slate-400">Cargando equipo...</p>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4">Empleado</th>
                  <th className="px-6 py-4">Credenciales</th>
                  <th className="px-6 py-4">Rol Jerárquico</th>
                  <th className="px-6 py-4">Alcance</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staff.map(s => {
                  const roleConfig = ROLE_UI_CONFIG[s.role] || { label: s.role, style: 'bg-slate-100 text-slate-500' };
                  
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={cn("h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs border", 
                            s.role === UserRole.MANAGER ? "bg-indigo-100 text-indigo-700 border-indigo-200" : "bg-slate-100 text-slate-500 border-slate-200"
                          )}>
                             {s.first_name.charAt(0)}{s.last_name.charAt(0)}
                          </div>
                          <span className="font-bold text-slate-800">{s.first_name} {s.last_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-500 text-xs">{s.username}</td>
                      <td className="px-6 py-4">
                        <span className={cn("inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-tight border shadow-sm", roleConfig.style)}>
                          {roleConfig.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {!s.garage_id ? (
                          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                             <Globe className="h-3.5 w-3.5 text-indigo-500" />
                             <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100">Global</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                             <MapPin className="h-3.5 w-3.5 text-slate-400" />
                             <span>{s.garages?.name || 'Local'}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => handleDeleteUser(s.id)} 
                          className="text-slate-300 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar acceso"
                        >
                          <Trash2 className="h-4 w-4"/>
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {staff.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-20 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                         <div className="p-4 bg-slate-50 rounded-full border border-slate-100">
                           <Users className="h-8 w-8 text-slate-300" />
                         </div>
                         <p className="text-slate-400 font-medium">No hay personal registrado.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

// --- SUB-COMPONENT: GARAGE SELECTOR SECTION ---
const GarageSelectorSection = ({ garages, onRefresh }: { garages: Garage[], onRefresh: () => void }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'list' | 'create'>('list');
  const [formData, setFormData] = useState({ name: '', address: '', cuit: '' });
  const [submitting, setSubmitting] = useState(false);

  // Auto-switch to list if garages exist
  useEffect(() => {
    if (garages.length > 0 && viewMode === 'create' && !submitting) {
        // Optional: logic to auto-switch back, but let's keep manual control for UX unless forced
    }
  }, [garages]);

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
      
      onRefresh(); // Refresh parent state
      navigate(`/${data.id}/dashboard`, { replace: true });
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (viewMode === 'create') {
    return (
      <div className="max-w-2xl mx-auto animate-in fade-in zoom-in-95 duration-300">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-900 px-8 py-4 flex items-center justify-between">
            <span className="text-white font-bold flex items-center gap-2"><Building2 className="h-5 w-5"/> Nuevo Garaje</span>
            <button onClick={() => setViewMode('list')} className="text-slate-400 hover:text-white text-xs">Cancelar</button>
          </div>
          <form onSubmit={handleCreateGarage} className="p-8 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="col-span-2">
                <label className="block text-sm font-bold text-slate-700 mb-2">Nombre</label>
                <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Estacionamiento Central" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Dirección</label>
                <input type="text" required value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none" placeholder="Calle 123" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">CUIT</label>
                <input type="text" required value={formData.cuit} onChange={e => setFormData({...formData, cuit: e.target.value})} className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none" placeholder="30-..." />
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
      <div onClick={() => setViewMode('create')} className="group flex flex-col items-center justify-center min-h-[200px] border-2 border-dashed border-slate-300 rounded-2xl p-6 cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition-all">
        <div className="p-4 bg-slate-100 rounded-full group-hover:bg-blue-100 transition-colors mb-4">
          <Plus className="h-8 w-8 text-slate-400 group-hover:text-blue-600" />
        </div>
        <h3 className="font-semibold text-slate-600 group-hover:text-blue-700">Registrar Nuevo</h3>
      </div>
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
              <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-400" /><span className="truncate">{garage.address}</span></div>
              <div className="flex items-center gap-2"><LayoutDashboard className="h-4 w-4 text-slate-400" /><span>Panel Administrativo</span></div>
           </div>
        </div>
      ))}
    </div>
  );
};

// --- MAIN COMPONENT: GLOBAL HUB ---
type HubSection = 'cashflow' | 'garages' | 'access';

export default function OnboardingPage() {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<HubSection>('cashflow');
  const [garages, setGarages] = useState<Garage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGarages = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase.from('garages').select('*').eq('owner_id', user.id);
      setGarages(data as Garage[] || []);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchGarages(); }, [user]);

  if (loading) return <div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="h-8 w-8 animate-spin text-indigo-600"/></div>;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg"><Shield className="h-5 w-5 text-white" /></div>
            <span className="font-bold text-slate-900 text-lg tracking-tight hidden md:block">GarageIA Hub</span>
          </div>
          
          <nav className="flex space-x-1 bg-slate-100 p-1 rounded-xl">
             {[
               { id: 'cashflow', label: 'Flujo de Caja', icon: BarChart3 },
               { id: 'garages', label: 'Red de Garajes', icon: Building2 },
               { id: 'access', label: 'Personal & Accesos', icon: Users },
             ].map((tab) => {
               const Icon = tab.icon;
               const isActive = activeTab === tab.id;
               return (
                 <button
                   key={tab.id}
                   onClick={() => setActiveTab(tab.id as HubSection)}
                   className={clsx(
                     "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
                     isActive ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-900"
                   )}
                 >
                   <Icon className={clsx("h-4 w-4", isActive ? "text-indigo-600" : "text-slate-400")} />
                   <span className="hidden sm:inline">{tab.label}</span>
                 </button>
               )
             })}
          </nav>

          <button onClick={() => signOut()} className="text-slate-400 hover:text-red-600 p-2 rounded-lg transition-colors" title="Cerrar Sesión">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {activeTab === 'cashflow' && 'Flujo de Caja'}
            {activeTab === 'garages' && 'Infraestructura'}
            {activeTab === 'access' && 'Gestión de Personal'}
          </h1>
          <p className="text-slate-500 mt-1">
            {activeTab === 'cashflow' && `Bienvenido, ${user?.user_metadata?.full_name || 'Propietario'}. Aquí tienes el pulso de tu negocio.`}
            {activeTab === 'garages' && 'Administra tus establecimientos o expande tu red.'}
            {activeTab === 'access' && 'Controla quién tiene acceso a tu organización.'}
          </p>
        </div>

        {activeTab === 'cashflow' && <CashFlowSection garageCount={garages.length} />}
        {activeTab === 'garages' && <GarageSelectorSection garages={garages} onRefresh={fetchGarages} />}
        {activeTab === 'access' && <GlobalAccessSection />}
      </main>
    </div>
  );
}
