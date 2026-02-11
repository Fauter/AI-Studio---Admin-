
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
  Globe
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Garage, EmployeeAccount, UserRole } from '../types';
import clsx from 'clsx';

// --- SUB-COMPONENT: CASHFLOW SECTION (Placeholder) ---
const CashFlowSection = ({ garageCount }: { garageCount: number }) => (
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Users className="h-24 w-24 text-emerald-600" />
        </div>
        <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">Personal Total</p>
        <h3 className="text-3xl font-bold text-slate-900 mt-2">--</h3>
        <p className="text-xs text-slate-400 mt-1">Gestión centralizada</p>
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

// --- SUB-COMPONENT: GLOBAL ACCESS SECTION ---
const GlobalAccessSection = () => {
  const { user } = useAuth();
  const [staff, setStaff] = useState<EmployeeAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
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
      // Fetches employees and joins with garages table to get the name if a garage_id exists
      // CRITICAL: Explicitly using 'garages!fk_garage' to solve ambiguous embedding (PGRST201)
      const { data, error } = await supabase
        .from('employee_accounts')
        .select('*, garages!fk_garage(name)')
        .eq('owner_id', user?.id)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setStaff(data as EmployeeAccount[] || []);
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

      // Logic: Create user under Owner scope. 
      // garage_id is NOT sent, so it defaults to NULL (Global Employee)
      const { error } = await supabase.from('employee_accounts').insert({
        owner_id: user.id,
        first_name: newUser.firstName.trim(),
        last_name: newUser.lastName.trim(),
        username: newUser.username.toLowerCase().trim(),
        password_hash: newUser.password,
        role: newUser.role
        // garage_id is omitted intentionally
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
    // 1. Trazabilidad
    console.log("[Delete] Intentando borrar empleado:", id);

    try {
      // 2. Ejecución directa sin confirmación
      const { error } = await supabase.from('employee_accounts').delete().eq('id', id);
      
      if (error) throw error;
      
      // 3. Actualizar lista
      fetchStaff();
    } catch (err) {
      // 4. Reporte de error
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
            <h3 className="font-bold text-slate-800">Alta de Empleado Global</h3>
          </div>
          <form onSubmit={handleCreateUser} className="p-6 space-y-4">
            {status && (
              <div className={`p-3 rounded-lg text-sm flex gap-2 ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {status.type === 'success' ? <CheckCircle2 className="h-4 w-4"/> : <AlertCircle className="h-4 w-4"/>}
                {status.text}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <input type="text" placeholder="Nombre" required value={newUser.firstName} onChange={e => setNewUser({...newUser, firstName: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              <input type="text" placeholder="Apellido" required value={newUser.lastName} onChange={e => setNewUser({...newUser, lastName: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div className="relative">
              <Key className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input type="text" placeholder="usuario.sistema" required value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value.replace(/\s/g, '').toLowerCase()})} className="w-full pl-9 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" />
            </div>
            <input type="text" placeholder="Contraseña" required value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" />
            <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
              <option value={UserRole.MANAGER}>Gerente Administrativo</option>
              <option value={UserRole.OPERATOR}>Operador</option>
            </select>
            <button type="submit" disabled={isCreating} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-lg flex justify-center gap-2 text-sm transition-all">
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin"/> : <Plus className="h-4 w-4"/>} Crear Cuenta
            </button>
          </form>
        </div>
      </div>

      {/* List */}
      <div className="xl:col-span-8">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[300px]">
          {loading ? (
            <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-500"/></div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="px-6 py-4">Nombre</th>
                  <th className="px-6 py-4">Usuario</th>
                  <th className="px-6 py-4">Rol</th>
                  <th className="px-6 py-4">Alcance</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staff.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-bold text-slate-800">{s.first_name} {s.last_name}</td>
                    <td className="px-6 py-4 font-mono text-slate-500">{s.username}</td>
                    <td className="px-6 py-4"><span className="bg-slate-100 px-2 py-1 rounded border border-slate-200 text-xs font-bold uppercase">{s.role}</span></td>
                    <td className="px-6 py-4">
                      {!s.garage_id ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                           <Globe className="h-3 w-3" /> Global
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                           <MapPin className="h-3 w-3" /> {s.garages?.name || 'Local'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleDeleteUser(s.id)} 
                        className="text-slate-400 hover:text-red-600 p-2 hover:bg-red-50 rounded transition-colors"
                        title="Eliminar empleado"
                      >
                        <Trash2 className="h-4 w-4"/>
                      </button>
                    </td>
                  </tr>
                ))}
                {staff.length === 0 && (
                  <tr><td colSpan={5} className="p-12 text-center text-slate-400">Sin empleados registrados.</td></tr>
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
               { id: 'cashflow', label: 'Resumen Global', icon: BarChart3 },
               { id: 'garages', label: 'Red de Garajes', icon: Building2 },
               { id: 'access', label: 'Equipo Global', icon: Users },
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
            {activeTab === 'cashflow' && 'Centro de Comando'}
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
