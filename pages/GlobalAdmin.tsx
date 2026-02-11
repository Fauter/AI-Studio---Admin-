
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Search, 
  Building2, 
  Mail, 
  User as UserIcon, 
  Loader2,
  AlertTriangle,
  Briefcase,
  CalendarDays,
  XCircle,
  RefreshCw,
  Server
} from 'lucide-react';
import { UserRole } from '../types';

interface OwnerView {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  created_at?: string;
  garage_count?: number; 
}

export default function GlobalAdminPage() {
  const [owners, setOwners] = useState<OwnerView[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [errorState, setErrorState] = useState<string | null>(null);

  useEffect(() => {
    fetchOwners();
  }, []);

  const fetchOwners = async () => {
    try {
      setLoading(true);
      setErrorState(null);

      // Query: Obtener perfiles 'owner' y contar sus garajes relacionados
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id, 
          email, 
          full_name, 
          role,
          created_at,
          garages (count)
        `)
        .eq('role', 'owner') 
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Mapeo para aplanar la estructura de respuesta de Supabase
      const mappedData = (data as any[] || []).map(item => ({
        ...item,
        garage_count: item.garages?.[0]?.count || 0
      }));

      setOwners(mappedData);

    } catch (err: any) {
      console.error("Global Admin Fetch Error:", err);
      setErrorState(err.message || "Error al sincronizar datos del sistema.");
    } finally {
      setLoading(false);
    }
  };

  const filteredOwners = owners.filter(u => 
    (u.full_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (u.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  return (
    <div className="animate-in fade-in slide-in-from-right-4 space-y-8">
        {/* Header Section (Dark Style Command Center) */}
        <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl relative overflow-hidden text-white">
          {/* Decorative Background */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Centro de Comando
              </h1>
              <p className="text-slate-400 mt-2 text-lg">
                Supervisión de propietarios e infraestructura global.
              </p>
            </div>
            
            <div className="flex gap-3">
              <button 
                  onClick={fetchOwners}
                  className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors"
                  title="Actualizar datos"
              >
                  <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              {/* Search Bar Dark */}
              <div className="relative w-full md:w-80">
                  <Search className="absolute left-3 top-3.5 h-5 w-5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-700 rounded-xl shadow-inner focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-slate-200 placeholder:text-slate-600"
                  />
              </div>
            </div>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-5">
            <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl">
                <Briefcase className="h-8 w-8" />
            </div>
            <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Owners Activos</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{owners.length}</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-5">
            <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl">
                <Building2 className="h-8 w-8" />
            </div>
            <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Garajes Totales</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">
                  {owners.reduce((acc, curr) => acc + (curr.garage_count || 0), 0)}
                </p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-5">
            <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
                <Server className="h-8 w-8" />
            </div>
            <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Estado Sistema</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse"></div>
                  <p className="text-lg font-bold text-slate-900">Operativo</p>
                </div>
            </div>
          </div>
        </div>

        {/* Owners Table */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
          {loading ? (
            <div className="p-24 flex flex-col items-center justify-center text-slate-500">
              <Loader2 className="h-10 w-10 animate-spin text-indigo-500 mb-4" />
              <p className="font-medium animate-pulse">Sincronizando registros...</p>
            </div>
          ) : errorState ? (
            <div className="p-16 text-center">
              <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-900/50">
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-white">Error de Acceso</h3>
              <p className="text-slate-400 mt-2 max-w-md mx-auto">{errorState}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500 font-bold">
                    <th className="px-8 py-5">Propietario</th>
                    <th className="px-8 py-5">Contacto (Email)</th>
                    <th className="px-8 py-5">Registro</th>
                    <th className="px-8 py-5 text-center">Infraestructura</th>
                    <th className="px-8 py-5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {filteredOwners.map((owner) => {
                    const hasGarages = (owner.garage_count || 0) > 0;
                    return (
                      <tr key={owner.id} className="hover:bg-slate-800/50 transition-colors group">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 font-bold border border-slate-700 group-hover:border-indigo-500/50 group-hover:text-indigo-400 transition-all">
                              {owner.full_name?.charAt(0).toUpperCase() || <UserIcon className="h-5 w-5" />}
                            </div>
                            <div>
                              <p className="font-bold text-slate-200">{owner.full_name || 'Sin Nombre'}</p>
                              <p className="text-[10px] text-slate-500 font-mono mt-0.5">ID: {owner.id.split('-')[0]}...</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-2 text-slate-400">
                              <Mail className="h-4 w-4 text-slate-600" />
                              <span className="font-medium text-sm">{owner.email || 'N/A'}</span>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-2 text-slate-500 text-sm">
                              <CalendarDays className="h-4 w-4 text-slate-700" />
                              <span>{owner.created_at ? new Date(owner.created_at).toLocaleDateString() : '-'}</span>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex justify-center">
                              {hasGarages ? (
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-900/20 border border-emerald-900/50 text-emerald-400 text-xs font-bold">
                                  <Building2 className="h-3.5 w-3.5" />
                                  {owner.garage_count} {owner.garage_count === 1 ? 'Garaje' : 'Garajes'}
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-slate-500 text-xs font-bold opacity-70">
                                  <XCircle className="h-3.5 w-3.5" />
                                  Sin Garajes
                                </div>
                              )}
                          </div>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <button className="text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:underline">
                              Ver detalles
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  
                  {filteredOwners.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center justify-center gap-3">
                            <div className="p-4 bg-slate-800 rounded-full">
                              <Search className="h-6 w-6 text-slate-500" />
                            </div>
                            <p className="text-slate-400 font-medium">No se encontraron propietarios.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
    </div>
  );
}