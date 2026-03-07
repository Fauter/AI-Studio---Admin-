import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Settings,
  Building2,
  Info,
  Server,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  MapPin,
  FileText,
  Copy,
  Check,
  Fingerprint,
  Database,
  Users,
  Search,
  UserPlus,
  Phone,
  Mail,
  Edit,
  Plus
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import BuildingConfigPage from './BuildingConfig';
import FormularioMigracion from '../components/FormularioMigracion';
import EditorCliente from '../components/EditorCliente';
import { Garage } from '../types';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

type SettingsTab = 'general' | 'building' | 'data';

// --- Sub-Component: General Settings Editor ---

const GeneralSettingsTab = () => {
  const { garageId } = useParams<{ garageId: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [garage, setGarage] = useState<Garage | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    cuit: ''
  });

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [idCopied, setIdCopied] = useState(false);

  // 1. Fetch Garage Data
  useEffect(() => {
    if (!garageId) return;

    const fetchGarage = async () => {
      setLoading(true);
      setFeedback(null);
      try {
        const { data, error } = await supabase
          .from('garages')
          .select('*')
          .eq('id', garageId)
          .single();

        if (error) throw error;

        setGarage(data as Garage);
        setFormData({
          name: data.name || '',
          address: data.address || '',
          cuit: data.cuit || ''
        });
      } catch (err: any) {
        console.error('Error fetching garage:', err);
        setFeedback({ type: 'error', text: 'No se pudo cargar la información del garaje.' });
      } finally {
        setLoading(false);
      }
    };

    fetchGarage();
  }, [garageId]);

  // 2. Handlers
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!garageId) return;

    setSaving(true);
    setFeedback(null);

    try {
      const { error } = await supabase
        .from('garages')
        .update({
          name: formData.name,
          address: formData.address,
          cuit: formData.cuit
        })
        .eq('id', garageId);

      if (error) throw error;

      setGarage(prev => prev ? { ...prev, ...formData } : null);
      setFeedback({ type: 'success', text: 'Datos actualizados correctamente.' });

      // Auto-dismiss success message
      setTimeout(() => setFeedback(null), 3000);

    } catch (err: any) {
      console.error('Error updating garage:', err);
      setFeedback({ type: 'error', text: 'Error al guardar los cambios.' });
    } finally {
      setSaving(false);
    }
  };

  const handleCopyId = () => {
    if (garageId) {
      navigator.clipboard.writeText(garageId);
      setIdCopied(true);
      setTimeout(() => setIdCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center flex-col gap-4 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        <p className="animate-pulse font-medium">Cargando información...</p>
      </div>
    );
  }

  if (!garage) return null;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        {/* Card Header */}
        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Datos del Establecimiento</h2>
            <p className="text-sm text-slate-500">Información comercial y fiscal visible en reportes.</p>
          </div>
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
            <Server className="h-6 w-6 text-indigo-600" />
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-8 space-y-8">

          {feedback && (
            <div className={cn(
              "p-4 rounded-xl border flex items-center gap-3 animate-in slide-in-from-top-2",
              feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'
            )}>
              {feedback.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
              <p className="font-medium text-sm">{feedback.text}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left Column: Basic Info */}
            <div className="space-y-6">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Nombre Comercial</label>
                <div className="relative group">
                  <div className="absolute left-3 top-3 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-900 font-medium placeholder:text-slate-400"
                    placeholder="Ej. Estacionamiento Central"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Dirección</label>
                <div className="relative group">
                  <div className="absolute left-3 top-3 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-900 font-medium placeholder:text-slate-400"
                    placeholder="Ej. Av. Corrientes 1234"
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Fiscal & ID */}
            <div className="space-y-6">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">CUIT / Identificación Fiscal</label>
                <div className="relative group">
                  <div className="absolute left-3 top-3 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                    <FileText className="h-5 w-5" />
                  </div>
                  <input
                    type="text"
                    value={formData.cuit}
                    onChange={(e) => setFormData(prev => ({ ...prev, cuit: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-900 font-medium placeholder:text-slate-400"
                    placeholder="Ej. 30-12345678-9"
                  />
                </div>
              </div>

              {/* Read-Only ID */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block flex items-center justify-between">
                  <span>ID del Garaje (Sistema)</span>
                  {idCopied && <span className="text-emerald-600 flex items-center gap-1 normal-case animate-in fade-in slide-in-from-right-2"><Check className="h-3 w-3" /> Copiado</span>}
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3 text-slate-400">
                    <Fingerprint className="h-5 w-5" />
                  </div>
                  <input
                    type="text"
                    readOnly
                    value={garageId}
                    className="w-full pl-10 pr-24 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-mono text-sm focus:outline-none cursor-copy"
                    onClick={handleCopyId}
                  />
                  <button
                    type="button"
                    onClick={handleCopyId}
                    className="absolute right-2 top-2 bottom-2 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-all flex items-center gap-1.5 shadow-sm"
                  >
                    {idCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {idCopied ? 'Listo' : 'Copiar'}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-2 ml-1">
                  Este identificador es único para tu garaje. Úsalo para contactar a soporte.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white transition-all shadow-lg shadow-indigo-900/10",
                saving
                  ? "bg-slate-800 cursor-wait text-slate-400"
                  : "bg-indigo-600 hover:bg-indigo-700 hover:scale-105 active:scale-95"
              )}
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

// --- Sub-Component: Data Loading & Customer Master-Detail ---
const DataLoadingTab = () => {
  const { garageId } = useParams<{ garageId: string }>();
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'form' | 'editor'>('list');

  const fetchCustomers = async () => {
    if (!garageId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('garage_id', garageId)
        .order('created_at', { ascending: false });
      if (!error && data) {
        setCustomers(data);
      }
    } catch (err) {
      console.error("Error fetching customers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [garageId]);

  const filteredCustomers = customers.filter(c =>
    (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.dni || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (view === 'form') {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm animate-in fade-in zoom-in-95 w-full">
        <FormularioMigracion
          garageId={garageId || ''}
          preloadedCustomer={selectedCustomer}
          onSuccess={() => {
            fetchCustomers();
            setSelectedCustomer(null);
            setView('list');
          }}
          onBack={() => {
            setSelectedCustomer(null);
            setView('list');
          }}
        />
      </div>
    );
  }

  if (view === 'editor' && selectedCustomer) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm animate-in fade-in zoom-in-95 w-full">
        <EditorCliente
          garageId={garageId || ''}
          customer={selectedCustomer}
          onSuccess={() => {
            fetchCustomers();
            setSelectedCustomer(null);
            setView('list');
          }}
          onBack={() => {
            setSelectedCustomer(null);
            setView('list');
          }}
        />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden min-h-[600px] shadow-sm animate-in fade-in w-full flex flex-col">
      {/* Header Vista de Lista */}
      <div className="p-6 md:p-8 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h3 className="font-black text-slate-800 text-lg flex items-center gap-3">
            <Users className="h-6 w-6 text-indigo-500" /> Directorio Maestro de Clientes
          </h3>
          <p className="text-sm text-slate-500 mt-1">Seleccione un cliente para gestionar sus cocheras o registre uno nuevo.</p>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              placeholder="Buscar por nombre o DNI..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
            />
          </div>
          <button
            onClick={() => {
              setSelectedCustomer(null);
              setView('form');
            }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg hover:shadow-xl transition-all active:scale-95 whitespace-nowrap"
          >
            <UserPlus className="h-4 w-4" /> Nuevo Cliente
          </button>
        </div>
      </div>

      {/* Contenido Vista de Lista */}
      <div className="flex-1 overflow-y-auto w-full">
        {loading ? (
          <div className="p-20 text-center text-slate-400 flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin mb-4 text-indigo-400" />
            <span className="text-sm font-medium">Cargando directorio...</span>
          </div>
        ) : filteredCustomers.length > 0 ? (
          <div className="bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-y border-slate-200 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    <th className="py-3 px-6 font-bold w-[35%]">Propietario / Cliente</th>
                    <th className="py-3 px-6 font-bold w-[25%]">DNI / CUIT</th>
                    <th className="py-3 px-6 font-bold w-[25%]">Contacto</th>
                    <th className="py-3 px-6 font-bold text-right w-[15%]">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCustomers.map(c => (
                    <tr
                      key={c.id}
                      className="group hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3 px-6">
                        <span className="font-bold text-slate-800 text-sm group-hover:text-indigo-700 transition-colors block">{c.name}</span>
                      </td>
                      <td className="py-3 px-6">
                        <span className="text-xs text-slate-500 font-mono bg-white px-2 py-0.5 rounded border border-slate-200 shadow-sm">{c.dni}</span>
                      </td>
                      <td className="py-3 px-6">
                        <div className="flex flex-col gap-1 justify-center">
                          {c.email ? (
                            <div className="text-[11px] text-slate-500 flex items-center gap-1.5"><Mail className="w-3 h-3 text-slate-400" /> <span className="truncate max-w-[150px]">{c.email}</span></div>
                          ) : (
                            <div className="text-[11px] text-slate-400 opacity-60 flex items-center gap-1.5"><Mail className="w-3 h-3" /> <em>Sin email</em></div>
                          )}
                          {c.phone ? (
                            <div className="text-[11px] text-slate-500 flex items-center gap-1.5"><Phone className="w-3 h-3 text-slate-400" /> <span>{c.phone}</span></div>
                          ) : (
                            <div className="text-[11px] text-slate-400 opacity-60 flex items-center gap-1.5"><Phone className="w-3 h-3" /> <em>Sin teléfono</em></div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-6 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setSelectedCustomer(c);
                              setView('form');
                            }}
                            className="p-2 text-slate-400 hover:text-indigo-600 bg-white border border-slate-200 rounded-lg hover:border-indigo-300 transition-all shadow-sm"
                            title="Añadir Cochera"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedCustomer(c);
                              setView('editor');
                            }}
                            className="p-2 text-slate-400 hover:text-emerald-600 bg-white border border-slate-200 rounded-lg hover:border-emerald-300 transition-all shadow-sm"
                            title="Editar/Gestionar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="p-20 text-center text-slate-400 flex flex-col items-center justify-center">
            <div className="bg-slate-100 p-4 rounded-full mb-4">
              <Search className="h-8 w-8 text-slate-300" />
            </div>
            <p className="text-base font-bold text-slate-600 mb-1">No se encontraron resultados</p>
            <p className="text-sm">Intenta con otro término de búsqueda o registra un cliente nuevo.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Main Page Component ---

export default function SettingsPage() {
  const { garageId } = useParams<{ garageId: string }>();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  return (
    <div className="space-y-6 pb-20">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Settings className="h-6 w-6 text-indigo-600" />
            Configuración
          </h1>
          <p className="text-slate-500 mt-1">Administra los parámetros generales y estructurales del establecimiento.</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200 flex gap-6">
        <button
          onClick={() => setActiveTab('general')}
          className={cn(
            "pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
            activeTab === 'general' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          )}
        >
          <Info className="h-4 w-4" />
          General
        </button>
        <button
          onClick={() => setActiveTab('building')}
          className={cn(
            "pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
            activeTab === 'building' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          )}
        >
          <Building2 className="h-4 w-4" />
          Estructura del Edificio
        </button>
        <button
          onClick={() => setActiveTab('data')}
          className={cn(
            "pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
            activeTab === 'data' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          )}
        >
          <Database className="h-4 w-4" />
          Carga Datos
        </button>
      </div>

      {/* Content Area */}
      <div className="min-h-[400px] mt-6">
        {activeTab === 'general' && <GeneralSettingsTab />}

        {/* Building Config Embedded */}
        {activeTab === 'building' && (
          <div className="animate-in fade-in slide-in-from-bottom-2">
            <BuildingConfigPage />
          </div>
        )}

        {/* Data Loading Embedded */}
        {activeTab === 'data' && (
          <div className="animate-in fade-in slide-in-from-bottom-2">
            <DataLoadingTab />
          </div>
        )}
      </div>
    </div>
  );
}