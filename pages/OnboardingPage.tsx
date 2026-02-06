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
  LayoutDashboard 
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Garage } from '../types';

export default function OnboardingPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  
  // --- States ---
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [garages, setGarages] = useState<Garage[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'create'>('list');

  // Form Data
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    cuit: ''
  });

  // --- 1. Fetch Garages on Mount ---
  useEffect(() => {
    if (!user) return;

    const fetchGarages = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('garages')
          .select('*')
          .eq('owner_id', user.id); // Manager logic can be added here with OR

        if (error) throw error;

        const userGarages = data as Garage[] || [];
        setGarages(userGarages);

        // Logic: If no garages, force create mode. If garages exist, show list.
        if (userGarages.length === 0) {
          setViewMode('create');
        } else {
          setViewMode('list');
        }

      } catch (err) {
        console.error("Error fetching garages:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchGarages();
  }, [user]);

  // --- 2. Handlers ---

  const handleCreateGarage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setSubmitting(true);
    
    try {
      // Create the garage
      const { data, error } = await supabase
        .from('garages')
        .insert({
          owner_id: user.id,
          name: formData.name,
          address: formData.address,
          cuit: formData.cuit
        })
        .select()
        .single();

      if (error) throw error;

      // Initialize configs
      await supabase.from('building_configs').insert({ garage_id: data.id });
      await supabase.from('financial_configs').insert({ garage_id: data.id });

      // Navigate to the dashboard of the new garage
      navigate(`/${data.id}/dashboard`, { replace: true });

    } catch (err: any) {
      console.error(err);
      alert('Error al crear el garaje: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectGarage = (garageId: string) => {
    navigate(`/${garageId}/dashboard`);
  };

  // --- Render: Loading ---
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // --- Render: Create Form Mode ---
  if (viewMode === 'create') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="text-center mb-8">
            <div className="inline-flex p-4 bg-white rounded-full shadow-sm mb-4">
              <Building2 className="h-10 w-10 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Nuevo Establecimiento</h1>
            <p className="text-slate-500 mt-2 text-lg">
              Registra los datos fiscales y de ubicación de tu garaje.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 px-8 py-4 flex items-center justify-between">
              <span className="text-slate-300 text-sm font-medium">Configuración Inicial</span>
              {garages.length > 0 ? (
                <button onClick={() => setViewMode('list')} className="text-slate-400 hover:text-white text-xs flex items-center gap-1 transition-colors">
                   Cancelar
                </button>
              ) : (
                <button onClick={() => signOut()} className="text-slate-400 hover:text-white text-xs flex items-center gap-1 transition-colors">
                  <LogOut className="h-3 w-3" /> Cerrar Sesión
                </button>
              )}
            </div>
            
            <form onSubmit={handleCreateGarage} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Nombre del Garaje</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      placeholder="Ej. Estacionamiento Central"
                      className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Dirección</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={formData.address}
                      onChange={e => setFormData({...formData, address: e.target.value})}
                      placeholder="Av. Corrientes 1234"
                      className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">CUIT</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={formData.cuit}
                      onChange={e => setFormData({...formData, cuit: e.target.value})}
                      placeholder="30-12345678-9"
                      className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center gap-2 transform active:scale-[0.98]"
                >
                  {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                  {submitting ? 'Creando...' : 'Registrar Garaje'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // --- Render: List Mode (Selector) ---
  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Mis Garajes</h1>
            <p className="text-slate-500 mt-2">Selecciona un establecimiento para gestionar.</p>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={() => signOut()} className="px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors font-medium text-sm flex items-center gap-2">
                <LogOut className="h-4 w-4" /> Cerrar Sesión
             </button>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
          
          {/* Create New Card */}
          <div 
            onClick={() => setViewMode('create')}
            className="group flex flex-col items-center justify-center min-h-[200px] border-2 border-dashed border-slate-300 rounded-2xl p-6 cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition-all"
          >
            <div className="p-4 bg-slate-100 rounded-full group-hover:bg-blue-100 transition-colors mb-4">
              <Plus className="h-8 w-8 text-slate-400 group-hover:text-blue-600" />
            </div>
            <h3 className="font-semibold text-slate-600 group-hover:text-blue-700">Registrar Nuevo</h3>
            <p className="text-sm text-slate-400 mt-1">Añadir otra sucursal</p>
          </div>

          {/* Garage Cards */}
          {garages.map((garage) => (
            <div 
              key={garage.id}
              onClick={() => handleSelectGarage(garage.id)}
              className="group relative bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-xl hover:ring-2 hover:ring-blue-500/50 transition-all cursor-pointer overflow-hidden"
            >
               <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">
                  <ArrowRight className="h-5 w-5 text-blue-500" />
               </div>

               <div className="flex items-start gap-4 mb-4">
                 <div className="p-3 bg-blue-50 rounded-xl group-hover:bg-blue-600 transition-colors duration-300">
                    <Building2 className="h-8 w-8 text-blue-600 group-hover:text-white" />
                 </div>
                 <div>
                   <h3 className="font-bold text-lg text-slate-900 leading-tight mb-1">{garage.name}</h3>
                   <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                      Activo
                   </span>
                 </div>
               </div>

               <div className="space-y-2 mt-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    <span className="truncate">{garage.address || 'Sin dirección'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <LayoutDashboard className="h-4 w-4 text-slate-400" />
                    <span>Panel Administrativo</span>
                  </div>
               </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}