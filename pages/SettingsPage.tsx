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
  Database
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import BuildingConfigPage from './BuildingConfig';
import FormularioMigracion from '../components/FormularioMigracion';
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
            <FormularioMigracion garageId={garageId || ''} />
          </div>
        )}
      </div>
    </div>
  );
}