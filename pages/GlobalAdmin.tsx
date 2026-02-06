import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
  ShieldCheck, 
  Search, 
  Building2, 
  Mail, 
  User as UserIcon, 
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { UserRole } from '../types';

interface AdminUserView {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  created_at?: string;
  garages?: { name: string }[]; // Joined data
}

export default function GlobalAdminPage() {
  const [users, setUsers] = useState<AdminUserView[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      // Fetch profiles with their garages (assuming owner_id relation)
      // Note: Relation name 'garages' assumes foreign key owner_id on garages table
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id, 
          email, 
          full_name, 
          role,
          garages (name)
        `)
        .order('role'); // Superadmins first usually due to enum order, or use sort

      if (error) throw error;
      
      setUsers(data as any || []);

    } catch (err) {
      console.error("Error fetching admin data:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(u => 
    (u.full_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (u.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-8 w-8 text-indigo-600" />
            Administración Global
          </h1>
          <p className="text-slate-500 mt-1">
            Vista técnica de todos los inquilinos y roles del sistema SaaS.
          </p>
        </div>
        
        {/* Search Bar */}
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar usuario..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-semibold text-slate-600">Usuario</th>
                  <th className="px-6 py-4 font-semibold text-slate-600">Rol Sistema</th>
                  <th className="px-6 py-4 font-semibold text-slate-600">Garajes Vinculados</th>
                  <th className="px-6 py-4 font-semibold text-slate-600 text-right">ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                          <UserIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{user.full_name || 'Sin Nombre'}</p>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Mail className="h-3 w-3" />
                            {user.email || 'No email'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`
                        inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize border
                        ${user.role === 'superadmin' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : ''}
                        ${user.role === 'owner' ? 'bg-blue-50 text-blue-700 border-blue-200' : ''}
                        ${user.role === 'manager' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ''}
                        ${!user.role ? 'bg-slate-100 text-slate-600 border-slate-200' : ''}
                      `}>
                        {user.role || 'user'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {user.garages && user.garages.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {user.garages.map((g, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 text-slate-700">
                              <Building2 className="h-3.5 w-3.5 text-slate-400" />
                              <span className="truncate max-w-[200px]">{g.name}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-xs flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Sin Garajes
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-mono text-xs text-slate-400">{user.id.slice(0, 8)}...</span>
                    </td>
                  </tr>
                ))}
                
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500 italic">
                      No se encontraron usuarios con ese criterio.
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