import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { VehicleType, Tariff, Price, TariffType, VehicleIconKey } from '../types';
import { 
  TableProperties, 
  Car, 
  Clock, 
  CalendarDays, 
  Zap, 
  Loader2, 
  AlertCircle, 
  Plus, 
  Trash2, 
  Bike, 
  Truck, 
  Bus,
  CreditCard, 
  Banknote,
  Lock,
  DollarSign,
  Info,
  Save,
  Timer,
  RefreshCw,
  MoreVertical
} from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// --- Constants & Mapping ---
type TabType = 'matrix' | 'tariffs' | 'vehicles';
type PriceListType = 'standard' | 'electronic';

const VEHICLE_ICONS: Record<VehicleIconKey, React.ElementType> = {
  car: Car,
  bike: Bike,
  truck: Truck,
  bus: Bus
};

// CRITICAL: Map UI values to DB Enum values ('hora', 'turno', 'abono')
const UI_TO_DB_TYPE_MAP: Record<string, TariffType> = {
  'hour': 'hora',
  'stay': 'turno',
  'subscription': 'abono'
};

const REQUIRED_ABONOS = ['Movil', 'Fija', 'Exclusiva'];

export default function PriceManagement() {
  const { garageId } = useParams<{ garageId: string }>();
  
  // --- Global State ---
  const [activeTab, setActiveTab] = useState<TabType>('matrix');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Data State ---
  const [vehicles, setVehicles] = useState<VehicleType[]>([]);
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  
  // --- UI State ---
  const [selectedList, setSelectedList] = useState<PriceListType>('standard');
  const [savingCells, setSavingCells] = useState<Set<string>>(new Set());

  // --- 1. Initialization & Seeding ---
  
  const initData = useCallback(async () => {
    if (!garageId) {
      setError("No se ha identificado el garaje. Verifica la URL.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await ensureSeededAbonos(garageId);
      await fetchAllData(garageId);
    } catch (err: any) {
      console.error("Critical Init Error:", err);
      setError("No se pudo cargar la configuración. " + (err.message || 'Error de red.'));
    } finally {
      setLoading(false);
    }
  }, [garageId]);

  useEffect(() => {
    initData();
  }, [initData]);

  // Robust Auto-Seed Logic
  const ensureSeededAbonos = async (gId: string) => {
    try {
      // 1. Fetch existing abonos. DB uses 'abono', so we query for that.
      const { data: existingTariffs } = await supabase
        .from('tariffs')
        .select('name')
        .eq('garage_id', gId)
        .eq('type', 'abono'); 
      
      const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
      const existingNames = new Set(existingTariffs?.map(t => normalize(t.name)) || []);
      
      const missing = REQUIRED_ABONOS.filter(req => !existingNames.has(normalize(req)));

      if (missing.length > 0) {
        console.log(`[AutoSeed] Injecting missing abonos: ${missing.join(', ')}`);
        
        const payload = missing.map((name, idx) => ({
          garage_id: gId,
          name: name,
          type: 'abono', // DB ENUM
          is_protected: true,
          sort_order: 900 + idx,
          days: 30, 
          hours: 0, 
          minutes: 0, 
          tolerance: 0
        }));
        
        const { error } = await supabase.from('tariffs').insert(payload);
        if (error) console.error("[AutoSeed] Insert failed:", error);
      }
    } catch (err) {
      console.warn("[AutoSeed] Non-blocking error:", err);
    }
  };

  const fetchAllData = async (gId: string) => {
    const [resVehicles, resTariffs, resPrices] = await Promise.all([
      supabase.from('vehicle_types').select('*').eq('garage_id', gId).order('sort_order'),
      supabase.from('tariffs').select('*').eq('garage_id', gId).order('sort_order'),
      supabase.from('prices').select('*').eq('garage_id', gId)
    ]);

    if (resVehicles.error) throw resVehicles.error;
    if (resTariffs.error) throw resTariffs.error;
    if (resPrices.error) throw resPrices.error;

    setVehicles(resVehicles.data || []);
    setTariffs(resTariffs.data || []);
    setPrices(resPrices.data || []);
  };

  // --- 2. Logic: Matrix Price Editing ---

  const getPriceValue = useCallback((tariffId: string, vehicleTypeId: string): string => {
    const price = prices.find(p => 
      p.tariff_id === tariffId && 
      p.vehicle_type_id === vehicleTypeId && 
      p.price_list === selectedList // FIX: Use price_list
    );
    return price ? price.amount.toString() : '';
  }, [prices, selectedList]);

  const handlePriceUpsert = async (tariffId: string, vehicleTypeId: string, newValue: string) => {
    if (!garageId) return;
    
    const amount = parseFloat(newValue);
    if (isNaN(amount) && newValue !== '') return; 
    
    const cellKey = `${tariffId}-${vehicleTypeId}`;
    const currentValue = getPriceValue(tariffId, vehicleTypeId);
    
    if (newValue === currentValue) return;

    setSavingCells(prev => new Set(prev).add(cellKey));

    try {
      // FIX: Correct payload structure matching DB columns
      const payload = {
        garage_id: garageId,
        tariff_id: tariffId,
        vehicle_type_id: vehicleTypeId,
        price_list: selectedList, // FIX: Renamed from price_list_id
        amount: amount || 0,
        // Removed updated_at to rely on DB default/trigger and avoid column errors
      };

      // FIX: Correct onConflict constraint
      const { error } = await supabase
        .from('prices')
        .upsert(payload, { onConflict: 'garage_id,tariff_id,vehicle_type_id,price_list' });

      if (error) throw error;

      // Optimistic Update
      setPrices(prev => {
        // Remove old entry
        const filtered = prev.filter(p => 
          !(p.tariff_id === tariffId && p.vehicle_type_id === vehicleTypeId && p.price_list === selectedList)
        );
        // Add new entry (cast to Price to satisfy TS)
        return [...filtered, { ...payload, id: 'temp-' + Date.now() } as Price];
      });

    } catch (err: any) {
      console.error("Upsert failed:", err);
      // Alert user visually
      alert('Error al guardar precio: ' + err.message);
    } finally {
      // CRITICAL: Ensure cell is unlocked even on error
      setSavingCells(prev => {
        const next = new Set(prev);
        next.delete(cellKey);
        return next;
      });
    }
  };

  // --- 3. UI Components ---

  const TabNavigator = () => (
    <div className="flex p-1 gap-1 bg-slate-200/50 rounded-xl mb-8 border border-slate-200 shadow-inner overflow-x-auto">
      {[
        { id: 'matrix', label: 'Matriz de Precios', icon: DollarSign },
        { id: 'tariffs', label: 'Config. Tarifas', icon: Clock },
        { id: 'vehicles', label: 'Vehículos', icon: Car },
      ].map(tab => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-bold transition-all duration-300 whitespace-nowrap",
              isActive 
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 ring-1 ring-white/20" 
                : "text-slate-500 hover:bg-white hover:text-slate-700 hover:shadow-sm"
            )}
          >
            <Icon className={cn("h-4 w-4", isActive ? "text-indigo-200" : "text-slate-400")} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );

  const MatrixSection = ({ title, type, icon: Icon, colorClass }: { title: string, type: TariffType, icon: any, colorClass: string }) => {
    const sectionTariffs = tariffs.filter(t => t.type === type);
    if (sectionTariffs.length === 0) return null;

    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-8 animate-in fade-in slide-in-from-bottom-4">
        <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center gap-3 backdrop-blur-sm">
          <div className={cn("p-2 rounded-lg shadow-sm", colorClass)}>
            <Icon className="h-5 w-5" />
          </div>
          <h3 className="font-bold text-slate-800 text-lg tracking-tight">{title}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50/50">
              <tr>
                <th className="px-6 py-4 font-bold tracking-wider w-1/3 text-slate-400">Concepto</th>
                {vehicles.map(v => {
                   const VIcon = VEHICLE_ICONS[v.icon_key as VehicleIconKey] || Car;
                   return (
                    <th key={v.id} className="px-4 py-3 font-bold text-center text-slate-700 min-w-[120px]">
                      <div className="flex flex-col items-center gap-1.5 group">
                          <div className="p-1.5 rounded-md bg-slate-100 group-hover:bg-indigo-50 transition-colors">
                            <VIcon className="h-4 w-4 text-slate-400 group-hover:text-indigo-500"/>
                          </div>
                          <span className="text-[10px] uppercase tracking-wide">{v.name}</span>
                      </div>
                    </th>
                   );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sectionTariffs.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4 font-bold text-slate-700 flex items-center gap-2">
                    {t.name}
                    {t.is_protected && (
                      <div className="tooltip" title="Tarifa protegida por sistema">
                        <Lock className="h-3 w-3 text-amber-400" />
                      </div>
                    )}
                  </td>
                  {vehicles.map((v) => {
                    const cellKey = `${t.id}-${v.id}`;
                    const isSaving = savingCells.has(cellKey);
                    return (
                      <td key={v.id} className="px-2 py-2">
                         <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-light text-xs pointer-events-none">$</span>
                            <input
                              type="number"
                              min="0"
                              defaultValue={getPriceValue(t.id, v.id)}
                              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                              onBlur={(e) => handlePriceUpsert(t.id, v.id, e.target.value)}
                              className={cn(
                                "no-spinner w-full pl-6 pr-3 py-2.5 text-right font-mono font-bold text-sm rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500",
                                isSaving 
                                  ? "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-inner" 
                                  : "bg-transparent border-transparent hover:bg-white hover:border-slate-300 focus:bg-white focus:border-indigo-500 text-slate-700"
                              )}
                              placeholder="-"
                            />
                            {isSaving && (
                              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                <Loader2 className="h-3 w-3 animate-spin text-indigo-500" />
                              </div>
                            )}
                         </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // --- 4. Sub-Tabs Logic ---

  const VehiclesTab = () => {
    const [newName, setNewName] = useState('');
    const [selectedIcon, setSelectedIcon] = useState<VehicleIconKey>('car');
    const [isCreating, setIsCreating] = useState(false);

    const handleCreateVehicle = async () => {
      if (!newName.trim() || !garageId) return;
      
      setIsCreating(true);
      try {
        const payload = {
          garage_id: garageId,
          name: newName.trim(),
          icon_key: selectedIcon,
          sort_order: vehicles.length + 10 // Safe sort order
        };
        
        const { error } = await supabase.from('vehicle_types').insert(payload);
        
        if (error) throw error;
        
        setNewName('');
        await fetchAllData(garageId);
      } catch (err: any) {
        console.error('Error creating vehicle:', err);
        alert('Error al crear: ' + err.message);
      } finally {
        setIsCreating(false);
      }
    };

    const deleteVehicle = async (id: string) => {
      const hasPrices = prices.some(p => p.vehicle_type_id === id && p.amount > 0);
      if (hasPrices) {
        alert("No se puede eliminar: existen precios activos para este vehículo.");
        return;
      }
      if (confirm('¿Eliminar vehículo permanentemente?')) {
        await supabase.from('vehicle_types').delete().eq('id', id);
        if (garageId) fetchAllData(garageId);
      }
    };

    return (
      <div className="flex flex-col gap-8 animate-in fade-in">
        {/* Creation Panel */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-lg shadow-indigo-500/5 relative overflow-hidden">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2 relative z-10">
            <Plus className="h-5 w-5 text-indigo-600" />
            Nuevo Vehículo
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end relative z-10">
             <div className="md:col-span-5">
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Nombre</label>
                <input 
                  type="text" 
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ej. Cuatriciclo, Minivan..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
                />
             </div>
             <div className="md:col-span-5">
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Icono Visual</label>
                <div className="flex gap-3">
                  {(Object.keys(VEHICLE_ICONS) as VehicleIconKey[]).map((key) => {
                    const Icon = VEHICLE_ICONS[key];
                    const isSelected = selectedIcon === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setSelectedIcon(key)}
                        className={cn(
                          "flex-1 p-3 rounded-xl transition-all border flex items-center justify-center",
                          isSelected
                            ? "bg-indigo-600 border-indigo-500 text-white shadow-md transform scale-105" 
                            : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50 hover:border-slate-300"
                        )}
                        title={key}
                      >
                        <Icon className="h-6 w-6" />
                      </button>
                    )
                  })}
                </div>
             </div>
             <div className="md:col-span-2">
               <button 
                  onClick={handleCreateVehicle}
                  disabled={!newName || isCreating}
                  className="w-full h-[50px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreating ? <Loader2 className="h-5 w-5 animate-spin"/> : <Save className="h-5 w-5" />}
                  Crear
                </button>
             </div>
          </div>
        </div>

        {/* Vertical List */}
        <div className="flex flex-col gap-3">
           {vehicles.length > 0 && <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide px-1">Vehículos Activos</h3>}
           {vehicles.map((v) => {
             const Icon = VEHICLE_ICONS[v.icon_key as VehicleIconKey] || Car;
             return (
               <div key={v.id} className="group bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all flex items-center justify-between">
                 <div className="flex items-center gap-5">
                   <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors text-slate-500">
                     <Icon className="h-6 w-6" />
                   </div>
                   <div>
                     <h4 className="font-bold text-slate-900 text-lg">{v.name}</h4>
                     <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">ID: {v.id.slice(0, 4)}</span>
                     </div>
                   </div>
                 </div>
                 
                 <button 
                  onClick={() => deleteVehicle(v.id)}
                  className="p-3 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                  title="Eliminar categoría"
                 >
                   <Trash2 className="h-5 w-5" />
                 </button>
               </div>
             )
           })}
           {vehicles.length === 0 && (
             <div className="flex flex-col items-center justify-center py-16 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
               <Car className="h-10 w-10 mb-3 opacity-30" />
               <p className="font-medium">No hay vehículos registrados</p>
             </div>
           )}
        </div>
      </div>
    );
  };

  const TariffsTab = () => {
    // UI State for inputs. Note 'type' here is the UI value key (English).
    const [newTariff, setNewTariff] = useState<{
      name: string;
      typeKey: string; // 'hour', 'stay', 'subscription'
      days: number;
      hours: number;
      minutes: number;
      tolerance: number;
    }>({ 
      name: '', 
      typeKey: 'hour', 
      days: 0, 
      hours: 0, 
      minutes: 0, 
      tolerance: 0 
    });
    
    const [isSaving, setIsSaving] = useState(false);

    const handleSaveTariff = async () => {
      if (!newTariff.name.trim() || !garageId) return;
      
      setIsSaving(true);
      try {
        // Data Mapping: Translate UI English keys to DB ENUMs (Spanish)
        const dbType = UI_TO_DB_TYPE_MAP[newTariff.typeKey];

        const payload = {
          garage_id: garageId,
          name: newTariff.name.trim(),
          type: dbType, // 'hora', 'turno', 'abono'
          sort_order: tariffs.length + 10,
          days: Number(newTariff.days) || 0,
          hours: Number(newTariff.hours) || 0,
          minutes: Number(newTariff.minutes) || 0,
          tolerance: Number(newTariff.tolerance) || 0,
          is_protected: false
        };
        
        const { error } = await supabase.from('tariffs').insert(payload);
        
        if (error) throw error;
        
        // Reset
        setNewTariff({ name: '', typeKey: 'hour', days: 0, hours: 0, minutes: 0, tolerance: 0 });
        await fetchAllData(garageId);

      } catch (err: any) {
        console.error('Error saving tariff:', err);
        let msg = err.message;
        if (msg.includes('check constraint')) msg = 'Error de validación en la base de datos (Check Constraint).';
        alert('Error al guardar: ' + msg);
      } finally {
        setIsSaving(false); // CRITICAL: Ensure button unblocks
      }
    };

    const deleteTariff = async (t: Tariff) => {
      if (t.is_protected) {
        alert("Esta tarifa es fundamental para el sistema y no puede eliminarse.");
        return;
      }
      if (confirm('¿Eliminar bloque de tiempo?')) {
        await supabase.from('tariffs').delete().eq('id', t.id);
        if (garageId) fetchAllData(garageId);
      }
    };

    return (
      <div className="space-y-8 animate-in fade-in">
        {/* Creator Form */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>

          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Clock className="h-5 w-5 text-indigo-600" />
            Nuevo Bloque de Tiempo
          </h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
            {/* Name & Type */}
            <div className="lg:col-span-4 space-y-4">
               <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Nombre</label>
                  <input 
                    type="text" 
                    placeholder="Ej. Estadía 12hs" 
                    value={newTariff.name}
                    onChange={e => setNewTariff({...newTariff, name: e.target.value})}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                  />
               </div>
               <div>
                 <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Tipo Lógico</label>
                 <select 
                  value={newTariff.typeKey}
                  onChange={e => setNewTariff({...newTariff, typeKey: e.target.value})}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium"
                >
                  <option value="hour">Hora</option>
                  <option value="stay">Turno</option>
                </select>
               </div>
            </div>

            {/* Time Configuration */}
            <div className="lg:col-span-6 bg-slate-50 p-5 rounded-xl border border-slate-200">
               <div className="flex items-center gap-2 mb-4 text-slate-600 border-b border-slate-200 pb-2">
                 <Timer className="h-4 w-4 text-indigo-500" />
                 <span className="text-xs font-bold uppercase tracking-wide">Duración</span>
               </div>
               <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block text-center">Días</label>
                    <input type="number" min="0" className="no-spinner w-full text-center p-2.5 rounded-lg border border-slate-300 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" 
                      value={newTariff.days} onChange={e => setNewTariff({...newTariff, days: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block text-center">Horas</label>
                    <input type="number" min="0" max="23" className="no-spinner w-full text-center p-2.5 rounded-lg border border-slate-300 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" 
                      value={newTariff.hours} onChange={e => setNewTariff({...newTariff, hours: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block text-center">Minutos</label>
                    <input type="number" min="0" max="59" className="no-spinner w-full text-center p-2.5 rounded-lg border border-slate-300 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" 
                      value={newTariff.minutes} onChange={e => setNewTariff({...newTariff, minutes: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-green-600 uppercase mb-1.5 block text-center">Tolerancia</label>
                    <input type="number" min="0" className="no-spinner w-full text-center p-2.5 rounded-lg border border-green-200 text-sm font-bold text-green-700 bg-green-50 focus:ring-2 focus:ring-green-500 outline-none" 
                      value={newTariff.tolerance} onChange={e => setNewTariff({...newTariff, tolerance: parseInt(e.target.value) || 0})}
                    />
                  </div>
               </div>
            </div>

            {/* Action */}
            <div className="lg:col-span-2">
              <button 
                onClick={handleSaveTariff}
                disabled={!newTariff.name || isSaving}
                className="w-full h-[106px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex flex-col items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? <Loader2 className="h-6 w-6 animate-spin"/> : <Save className="h-6 w-6" />}
                <span>Guardar</span>
              </button>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="grid grid-cols-1 gap-3">
          {tariffs.map(t => (
            <div key={t.id} className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between shadow-sm hover:border-indigo-200 transition-colors">
              <div className="flex items-center gap-4">
                <div className={cn("p-3 rounded-xl", 
                  t.type === 'hora' ? 'bg-blue-50 text-blue-600' : 
                  t.type === 'turno' ? 'bg-indigo-50 text-indigo-600' : 
                  'bg-emerald-50 text-emerald-600'
                )}>
                  {t.type === 'hora' ? <Clock className="h-6 w-6"/> : t.type === 'turno' ? <CalendarDays className="h-6 w-6"/> : <Zap className="h-6 w-6"/>}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-slate-900 text-lg">{t.name}</p>
                    {t.is_protected && <span className="px-2 py-0.5 rounded-md bg-amber-100 text-[10px] font-bold text-amber-700 border border-amber-200 uppercase tracking-wide flex items-center gap-1"><Lock className="h-3 w-3"/> Sistema</span>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                     <span className="uppercase font-bold tracking-wider">{t.type}</span>
                     <span className="text-slate-300">|</span>
                     <span className="font-mono">{t.days}d {t.hours}h {t.minutes}m</span>
                     {t.tolerance > 0 && <span className="text-green-600 font-bold ml-1">+ {t.tolerance}m tol</span>}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => deleteTariff(t)}
                disabled={t.is_protected}
                className="text-slate-300 hover:text-red-600 p-3 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-0 disabled:pointer-events-none"
              >
                 <Trash2 className="h-5 w-5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // --- Main Render ---

  if (loading) return (
    <div className="flex h-[50vh] items-center justify-center flex-col gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
      <p className="text-slate-500 font-medium">Sincronizando Precios...</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto pb-20">
      
      {/* Page Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <TableProperties className="h-8 w-8 text-indigo-600" />
            Configuración de Precios
          </h1>
          <p className="text-slate-500 mt-2 text-lg">Administra las reglas de cobro para tu establecimiento.</p>
        </div>

        {/* List Switcher */}
        {activeTab === 'matrix' && (
          <div className="bg-white p-1 rounded-xl border border-slate-200 shadow-sm flex items-center">
             <button 
              onClick={() => setSelectedList('standard')}
              className={cn("px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all", selectedList === 'standard' ? 'bg-green-100 text-green-700' : 'text-slate-500 hover:bg-slate-50')}
             >
               <Banknote className="h-4 w-4" /> Efectivo
             </button>
             <div className="w-px h-6 bg-slate-200 mx-1"></div>
             <button 
              onClick={() => setSelectedList('electronic')}
              className={cn("px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all", selectedList === 'electronic' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-50')}
             >
               <CreditCard className="h-4 w-4" /> Bancario
             </button>
          </div>
        )}
      </div>

      <TabNavigator />

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex justify-between items-center animate-in slide-in-from-top-2 shadow-sm">
          <div className="flex gap-3 items-center">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="font-medium">{error}</p>
          </div>
          <button onClick={() => window.location.reload()} className="text-sm font-bold underline hover:text-red-900 flex items-center gap-1">
             <RefreshCw className="h-3 w-3" /> Reintentar
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="min-h-[500px]">
        {activeTab === 'matrix' && (
          (tariffs.length === 0 || vehicles.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border-2 border-dashed border-slate-200 shadow-sm">
               <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                  <Info className="h-10 w-10 text-slate-400" />
               </div>
               <h3 className="text-2xl font-bold text-slate-900 mb-2">Matriz Vacía</h3>
               <p className="text-slate-500 mb-8 text-center max-w-sm text-lg">
                 Para ver la matriz de precios, primero debes configurar tus vehículos y tarifas.
               </p>
               <div className="flex gap-4">
                 <button 
                    onClick={() => setActiveTab('vehicles')} 
                    className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-300 hover:border-indigo-300 hover:text-indigo-600 text-slate-700 rounded-xl font-bold transition-all"
                 >
                    <Car className="h-5 w-5" /> Ir a Vehículos
                 </button>
                 <button 
                    onClick={() => setActiveTab('tariffs')} 
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-200"
                 >
                    <Clock className="h-5 w-5" /> Ir a Tarifas
                 </button>
               </div>
            </div>
          ) : (
            <>
              {/* Note: We map DB type back to UI Logic for the sections */}
              <MatrixSection title="Valores por Hora y Fracción" type="hora" icon={Clock} colorClass="bg-blue-100 text-blue-600" />
              <MatrixSection title="Estadías y Turnos" type="turno" icon={CalendarDays} colorClass="bg-indigo-100 text-indigo-600" />
              <MatrixSection title="Abonos Mensuales" type="abono" icon={Zap} colorClass="bg-emerald-100 text-emerald-600" />
            </>
          )
        )}
        {activeTab === 'tariffs' && <TariffsTab />}
        {activeTab === 'vehicles' && <VehiclesTab />}
      </div>
    </div>
  );
}