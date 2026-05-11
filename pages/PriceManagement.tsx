import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { VehicleType, Tariff, Price, TariffType, VehicleIconKey, FinancialConfig } from '../types';
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
  Motorbike,
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
  MoreVertical,
  Edit2,
  X,
  Van,
  Users,
  Check
} from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// --- Constants & Mapping ---
type TabType = 'matrix' | 'tariffs' | 'vehicles';
type PriceListType = 'standard' | 'electronic';

const VEHICLE_ICONS: Record<string, React.ElementType> = {
  bicycle: Bike,
  motorcycle: Motorbike,
  car: Car,
  van: Van,
  truck: Truck,
  bus: Bus
};

const VEHICLE_COLORS = ['slate', 'blue', 'indigo', 'purple', 'emerald', 'orange', 'rose'] as const;
export type VehicleColor = (typeof VEHICLE_COLORS)[number];

const getColorClasses = (color: string, isSelected: boolean) => {
  if (isSelected) {
    if (color === 'slate') return "bg-slate-600 border-slate-700 text-white shadow-md transform scale-105 ring-2 ring-offset-2 ring-indigo-500";
    if (color === 'blue') return "bg-blue-600 border-blue-700 text-white shadow-md transform scale-105 ring-2 ring-offset-2 ring-indigo-500";
    if (color === 'indigo') return "bg-indigo-600 border-indigo-700 text-white shadow-md transform scale-105 ring-2 ring-offset-2 ring-indigo-500";
    if (color === 'purple') return "bg-purple-600 border-purple-700 text-white shadow-md transform scale-105 ring-2 ring-offset-2 ring-indigo-500";
    if (color === 'emerald') return "bg-emerald-600 border-emerald-700 text-white shadow-md transform scale-105 ring-2 ring-offset-2 ring-indigo-500";
    if (color === 'orange') return "bg-orange-600 border-orange-700 text-white shadow-md transform scale-105 ring-2 ring-offset-2 ring-indigo-500";
    if (color === 'rose') return "bg-rose-600 border-rose-700 text-white shadow-md transform scale-105 ring-2 ring-offset-2 ring-indigo-500";
    return "bg-slate-600 border-slate-700 text-white shadow-md transform scale-105 ring-2 ring-offset-2 ring-indigo-500";
  } else {
    if (color === 'slate') return "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 hover:border-slate-300";
    if (color === 'blue') return "bg-blue-50 text-blue-500 border-blue-200 hover:bg-blue-100 hover:border-blue-300";
    if (color === 'indigo') return "bg-indigo-50 text-indigo-500 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300";
    if (color === 'purple') return "bg-purple-50 text-purple-500 border-purple-200 hover:bg-purple-100 hover:border-purple-300";
    if (color === 'emerald') return "bg-emerald-50 text-emerald-500 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300";
    if (color === 'orange') return "bg-orange-50 text-orange-500 border-orange-200 hover:bg-orange-100 hover:border-orange-300";
    if (color === 'rose') return "bg-rose-50 text-rose-500 border-rose-200 hover:bg-rose-100 hover:border-rose-300";
    return "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 hover:border-slate-300";
  }
};


// CRITICAL: Map UI values to DB Enum values ('hora', 'turno', 'abono')
const UI_TO_DB_TYPE_MAP: Record<string, TariffType> = {
  'hour': 'hora',
  'stay': 'turno',
  'subscription': 'abono'
};

const DB_TO_UI_TYPE_MAP: Record<string, string> = {
  'hora': 'hour',
  'turno': 'stay',
  'abono': 'subscription'
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
  const [financialConfig, setFinancialConfig] = useState<FinancialConfig | null>(null);

  // --- UI State ---
  const [selectedList, setSelectedList] = useState<PriceListType>('standard');
  const [savingCells, setSavingCells] = useState<Set<string>>(new Set());
  const [isSavingGlobalConfig, setIsSavingGlobalConfig] = useState(false);
  const [saveStatus, setSaveStatus] = useState<Record<string, 'idle' | 'saving' | 'saved' | 'error'>>({});

  const setStatus = useCallback((key: string, status: 'idle' | 'saving' | 'saved' | 'error', autoClearMs = 2000) => {
    setSaveStatus(prev => ({ ...prev, [key]: status }));
    if (status === 'saved' || status === 'error') {
      setTimeout(() => {
        setSaveStatus(prev => ({ ...prev, [key]: 'idle' }));
      }, autoClearMs);
    }
  }, []);

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

        const payload = missing.map((name, idx) => {
          let defaultMaxVehicles = 1;
          const nv = normalize(name);
          if (nv === 'fija') defaultMaxVehicles = 3;
          if (nv === 'exclusiva') defaultMaxVehicles = 5;

          return {
            garage_id: gId,
            name: name,
            type: 'abono', // DB ENUM
            is_protected: true,
            sort_order: 900 + idx,
            days: 30,
            hours: 0,
            minutes: 0,
            tolerance: 0,
            max_vehicles: defaultMaxVehicles
          };
        });

        const { error } = await supabase.from('tariffs').insert(payload);
        if (error) console.error("[AutoSeed] Insert failed:", error);
      }
    } catch (err) {
      console.warn("[AutoSeed] Non-blocking error:", err);
    }
  };

  const fetchAllData = async (gId: string) => {
    const [resVehicles, resTariffs, resPrices, resFinancial] = await Promise.all([
      supabase.from('vehicle_types').select('*').eq('garage_id', gId).order('sort_order'),
      supabase.from('tariffs').select('*').eq('garage_id', gId).order('sort_order'),
      supabase.from('prices').select('*').eq('garage_id', gId),
      supabase.from('financial_configs').select('*').eq('garage_id', gId).maybeSingle()
    ]);

    if (resVehicles.error) throw resVehicles.error;
    if (resTariffs.error) throw resTariffs.error;
    if (resPrices.error) throw resPrices.error;
    if (resFinancial.error && resFinancial.code !== 'PGRST116') throw resFinancial.error;

    setVehicles(resVehicles.data || []);
    setTariffs(resTariffs.data || []);
    setPrices(resPrices.data || []);
    setFinancialConfig(resFinancial.data || null);
  };

  const handleUpdateGlobalConfig = async (updates: Partial<FinancialConfig>) => {
    if (!garageId) return;

    setIsSavingGlobalConfig(true);
    setStatus('global_config', 'saving');

    // Check if what toggles is 'fractionate_after' specifically for isolated toast
    const isFractionate = 'fractionate_after' in updates;
    if (isFractionate) {
      setStatus('fractionate_after', 'saving');
    }

    const previousConfig = financialConfig;

    // Optimistic update
    setFinancialConfig(prev => prev ? { ...prev, ...updates } : { garage_id: garageId, ...updates } as FinancialConfig);

    try {
      const mergedPayload = previousConfig
        ? { ...previousConfig, ...updates }
        : { garage_id: garageId, ...updates };

      const { error } = await supabase
        .from('financial_configs')
        .upsert(mergedPayload, { onConflict: 'garage_id' });

      if (error) throw error;

      setStatus('global_config', 'saved');
      if (isFractionate) { setStatus('fractionate_after', 'saved'); }

    } catch (err: any) {
      console.error('Error updating global config:', err);
      alert('Error al guardar configuración global: ' + err.message);
      setFinancialConfig(previousConfig);
      setStatus('global_config', 'error');
      if (isFractionate) { setStatus('fractionate_after', 'error'); }
    } finally {
      setIsSavingGlobalConfig(false);
    }
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
        { id: 'vehicles', label: 'Tipos de Vehículo', icon: Car },
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

    const sortedVehicles = React.useMemo(() => {
      const vehiclesWithWeights = vehicles.map(v => {
        let maxAmount = 0;
        sectionTariffs.forEach(t => {
          const p = prices.find(price => price.tariff_id === t.id && price.vehicle_type_id === v.id && price.price_list === selectedList);
          if (p && p.amount > maxAmount) {
            maxAmount = p.amount;
          }
        });
        return { ...v, _hasPrices: maxAmount > 0, _maxAmount: maxAmount };
      });

      return vehiclesWithWeights.sort((a, b) => {
        // Nivel 1: Presencia
        if (a._hasPrices && !b._hasPrices) return -1;
        if (!a._hasPrices && b._hasPrices) return 1;
        
        // Nivel 2: Valor Monetario (Menor a Mayor)
        if (a._hasPrices && b._hasPrices) {
          if (a._maxAmount !== b._maxAmount) {
            return a._maxAmount - b._maxAmount;
          }
        }
        
        // Nivel 3: Vacíos o Empate -> sort_order / índice original
        return vehicles.findIndex(v => v.id === a.id) - vehicles.findIndex(v => v.id === b.id);
      });
    }, [vehicles, sectionTariffs, prices, selectedList]);

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
                {sortedVehicles.map(v => {
                  const VIcon = VEHICLE_ICONS[v.icon_key as string] || Car;
                  return (
                    <th key={v.id} className={cn("px-4 py-3 font-bold text-center text-slate-700 min-w-[120px] transition-all duration-300", !v._hasPrices && "opacity-60 grayscale-[50%]")}>
                      <div className="flex flex-col items-center gap-1.5 group">
                        <div className={cn("p-1.5 rounded-md transition-colors group-hover:scale-110 flex items-center justify-center", getColorClasses(v.color_key || 'slate', false))}>
                          <VIcon size={20} strokeWidth={2.5} />
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
                  {sortedVehicles.map((v) => {
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
    const [selectedIcon, setSelectedIcon] = useState<VehicleIconKey | string>('car');
    const [selectedColor, setSelectedColor] = useState<VehicleColor>('slate');
    const [isCreating, setIsCreating] = useState(false);

    const handleCreateVehicle = async () => {
      if (!newName.trim() || !garageId) return;

      setIsCreating(true);
      try {
        const payload = {
          garage_id: garageId,
          name: newName.trim(),
          icon_key: selectedIcon,
          color_key: selectedColor,
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
      
      const confirmMsg = hasPrices 
        ? "Este vehículo tiene precios configurados. Si lo eliminas, se borrarán todos sus precios asociados de forma permanente. ¿Continuar?"
        : "¿Eliminar vehículo permanentemente?";

      if (confirm(confirmMsg)) {
        try {
          const { error: pricesError } = await supabase.from('prices').delete().eq('vehicle_type_id', id);
          if (pricesError) throw pricesError;

          const { error: vehicleError } = await supabase.from('vehicle_types').delete().eq('id', id);
          if (vehicleError) throw vehicleError;
          
          if (garageId) fetchAllData(garageId);
        } catch (err: any) {
          console.error('Error deleting vehicle:', err);
          alert('Error al eliminar vehículo: ' + err.message);
        }
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

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto_auto_140px] gap-6 items-end relative z-10">
            <div className="w-full">
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Nombre</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ej. Cuatriciclo, Minivan..."
                className="w-full h-[50px] bg-slate-50 border border-slate-300 rounded-xl px-4 text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
              />
            </div>

            <div className="shrink-0">
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Icono Visual</label>
              <div className="flex gap-2 h-[50px]">
                {Object.keys(VEHICLE_ICONS).map((key) => {
                  const Icon = VEHICLE_ICONS[key];
                  const isSelected = selectedIcon === key;

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedIcon(key as any)}
                      className={cn(
                        "w-[50px] h-[50px] rounded-xl transition-all border flex items-center justify-center",
                        isSelected
                          ? "bg-indigo-600 border-indigo-700 text-white shadow-md ring-2 ring-offset-2 ring-indigo-500"
                          : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
                      )}
                      title={key}
                    >
                      <Icon size={24} strokeWidth={2.5} />
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="shrink-0">
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Color</label>
              <div className="flex gap-2 h-[50px] items-center bg-slate-50 border border-slate-200 px-3 rounded-xl overflow-x-auto">
                {VEHICLE_COLORS.map(c => {
                  const isSelected = selectedColor === c;
                  // Just the raw base colors for the selector swatches
                  let swatchClass = "";
                  if (c === 'slate') swatchClass = "bg-slate-500";
                  if (c === 'blue') swatchClass = "bg-blue-500";
                  if (c === 'indigo') swatchClass = "bg-indigo-500";
                  if (c === 'purple') swatchClass = "bg-purple-500";
                  if (c === 'emerald') swatchClass = "bg-emerald-500";
                  if (c === 'orange') swatchClass = "bg-orange-500";
                  if (c === 'rose') swatchClass = "bg-rose-500";

                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSelectedColor(c)}
                      className={cn(
                        "w-8 h-8 rounded-full transition-all border-2 border-transparent",
                        swatchClass,
                        isSelected ? "ring-2 ring-offset-2 ring-indigo-500 scale-110 shadow-md" : "hover:scale-110 shadow-sm opacity-80 cursor-pointer"
                      )}
                      title={c}
                    />
                  );
                })}
              </div>
            </div>

            <div className="shrink-0 w-full lg:w-[140px]">
              <button
                onClick={handleCreateVehicle}
                disabled={!newName || isCreating}
                className="w-full h-[50px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                Crear
              </button>
            </div>
          </div>
        </div>

        {/* Vertical List */}
        <div className="flex flex-col gap-3">
          {vehicles.length > 0 && <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide px-1">Vehículos Activos</h3>}
          {vehicles.map((v) => {
            const Icon = VEHICLE_ICONS[v.icon_key as string] || Car;
            return (
              <div key={v.id} className="group bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center transition-colors shadow-sm", getColorClasses(v.color_key || 'slate', false))}>
                    <Icon size={24} strokeWidth={2.5} />
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
    // Add Draft States
    const [globalConfigDraft, setGlobalConfigDraft] = useState<FinancialConfig | null>(financialConfig);
    const [maxVehiclesDrafts, setMaxVehiclesDrafts] = useState<Record<string, number>>({});

    useEffect(() => {
      setGlobalConfigDraft(financialConfig);
    }, [financialConfig]);

    useEffect(() => {
      setMaxVehiclesDrafts({});
    }, [tariffs]);

    // Derived states
    const fallbackConfig = financialConfig || { initial_tolerance: 0, fractionate_after: 0 } as FinancialConfig;
    const draftConfig = globalConfigDraft || fallbackConfig;

    const hasGlobalConfigChanges =
      draftConfig.initial_tolerance !== fallbackConfig.initial_tolerance ||
      draftConfig.fractionate_after !== fallbackConfig.fractionate_after;

    const hasMaxVehiclesChanges = Object.keys(maxVehiclesDrafts).some(id => {
      const original = tariffs.find(t => t.id === id)?.max_vehicles;
      return original !== undefined && maxVehiclesDrafts[id] !== original;
    });

    const handleSaveGlobalDraft = () => {
      if (!hasGlobalConfigChanges) return;
      handleUpdateGlobalConfig({
        initial_tolerance: draftConfig.initial_tolerance,
        fractionate_after: draftConfig.fractionate_after
      });
    };

    const handleUpdateAllMaxVehicles = async () => {
      if (!hasMaxVehiclesChanges) return;

      const statusKey = 'max_vehicles_batch';
      setStatus(statusKey, 'saving');
      try {
        const promises = Object.entries(maxVehiclesDrafts).map(([id, val]) =>
          supabase.from('tariffs').update({ max_vehicles: val }).eq('id', id)
        );
        await Promise.all(promises);
        setStatus(statusKey, 'saved');
        setMaxVehiclesDrafts({}); // Clear drafts
        if (garageId) fetchAllData(garageId); // Refresh data
      } catch (err: any) {
        console.error('Error updating all max_vehicles:', err);
        alert('Error al actualizar cupos: ' + err.message);
        setStatus(statusKey, 'error');
      }
    };

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

    // Edit Modal State
    const [editingTariff, setEditingTariff] = useState<Tariff | null>(null);
    const [editForm, setEditForm] = useState({
      name: '',
      typeKey: 'hour',
      days: 0,
      hours: 0,
      minutes: 0,
      tolerance: 0
    });
    const [isUpdating, setIsUpdating] = useState(false);

    const openEditModal = (t: Tariff) => {
      if (t.type === 'abono') return;

      setEditingTariff(t);
      setEditForm({
        name: t.name,
        typeKey: DB_TO_UI_TYPE_MAP[t.type] || 'hour',
        days: t.days,
        hours: t.hours,
        minutes: t.minutes,
        tolerance: t.tolerance
      });
    };

    const handleUpdateTariff = async () => {
      if (!editingTariff || !editForm.name.trim() || !garageId) return;

      setIsUpdating(true);
      try {
        const dbType = UI_TO_DB_TYPE_MAP[editForm.typeKey];

        const payload = {
          name: editForm.name.trim(),
          type: dbType,
          days: Number(editForm.days) || 0,
          hours: Number(editForm.hours) || 0,
          minutes: Number(editForm.minutes) || 0,
          tolerance: Number(editForm.tolerance) || 0,
        };

        const { error } = await supabase
          .from('tariffs')
          .update(payload)
          .eq('id', editingTariff.id);

        if (error) throw error;

        setEditingTariff(null);
        await fetchAllData(garageId);

      } catch (err: any) {
        console.error('Error updating tariff:', err);
        let msg = err.message;
        if (msg.includes('check constraint')) msg = 'Error de validación en la base de datos (Check Constraint).';
        alert('Error al actualizar: ' + msg);
      } finally {
        setIsUpdating(false);
      }
    };

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
        {/* Global Config Card */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-6 relative z-10">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Timer className="h-5 w-5 text-indigo-600" />
                Reglas de Cobro Globales
              </h3>

              {/* Global Save Indicator */}
              <div className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all duration-500",
                saveStatus['global_config'] === 'saving' ? "bg-indigo-50 text-indigo-600 opacity-100" :
                  saveStatus['global_config'] === 'saved' ? "bg-emerald-50 text-emerald-600 opacity-100" :
                    saveStatus['global_config'] === 'error' ? "bg-red-50 text-red-600 opacity-100" :
                      "opacity-0"
              )}>
                {saveStatus['global_config'] === 'saving' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {saveStatus['global_config'] === 'saved' && <Check className="h-3.5 w-3.5" />}
                {saveStatus['global_config'] === 'error' && <AlertCircle className="h-3.5 w-3.5" />}
                <span>
                  {saveStatus['global_config'] === 'saving' ? 'Guardando...' :
                    saveStatus['global_config'] === 'saved' ? '¡Guardado!' :
                      saveStatus['global_config'] === 'error' ? 'Error' : ''}
                </span>
              </div>
            </div>
            {isSavingGlobalConfig && <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
            {/* Initial Tolerance */}
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 flex flex-col justify-between hover:border-indigo-200 transition-colors">
              <div className="mb-4">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-slate-500" />
                  Minutos de Gracia
                </label>
                <p className="text-xs text-slate-500">Minutos de gracia antes de iniciar el cobro.</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    className={cn(
                      "w-24 px-4 py-2 text-right font-bold text-slate-900 bg-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all",
                      draftConfig.initial_tolerance !== fallbackConfig.initial_tolerance
                        ? "border-2 border-amber-400 bg-amber-50"
                        : "border border-slate-300"
                    )}
                    value={draftConfig.initial_tolerance}
                    onChange={(e) => setGlobalConfigDraft(prev => ({ ...(prev || fallbackConfig), initial_tolerance: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <span className="text-sm font-bold text-slate-500">minutos</span>
              </div>
            </div>

            {/* Fractionate After */}
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 flex flex-col justify-between hover:border-indigo-200 transition-colors">
              <div className="mb-4 relative">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-slate-500" />
                    Fraccionar: {draftConfig.fractionate_after > 0 ? 'SÍ' : 'NO'}
                  </label>
                  <button
                    onClick={() => setGlobalConfigDraft(prev => ({ ...(prev || fallbackConfig), fractionate_after: (prev || fallbackConfig).fractionate_after > 0 ? 0 : 60 }))}
                    className={cn(
                      "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
                      draftConfig.fractionate_after > 0 ? "bg-indigo-600 border-transparent" : "bg-slate-200 border-transparent",
                      draftConfig.fractionate_after !== fallbackConfig.fractionate_after ? "border-amber-400 ring-2 ring-amber-400 ring-offset-1" : ""
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        draftConfig.fractionate_after > 0 ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>

                <div className="flex items-start gap-2 mt-4">
                  <Info className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-slate-500">Establece un piso mínimo de tiempo antes de permitir el cobro por fracciones menores.</p>
                </div>
              </div>

              <div className={cn(
                "transition-all duration-300 overflow-hidden",
                draftConfig.fractionate_after > 0 ? "h-10 opacity-100" : "h-0 opacity-0 pointer-events-none"
              )}>
                <select
                  value={draftConfig.fractionate_after || 60}
                  onChange={(e) => setGlobalConfigDraft(prev => ({ ...(prev || fallbackConfig), fractionate_after: parseInt(e.target.value) || 60 }))}
                  className={cn(
                    "w-full h-10 px-4 bg-white rounded-lg text-sm font-bold text-slate-700 outline-none transition-all cursor-pointer focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500",
                    draftConfig.fractionate_after !== fallbackConfig.fractionate_after
                      ? "border-2 border-amber-400 bg-amber-50"
                      : "border border-slate-300"
                  )}
                >
                  <option value={60}>1 Hora</option>
                  <option value={120}>2 Horas</option>
                  <option value={180}>3 Horas</option>
                  <option value={240}>4 Horas</option>
                  <option value={300}>5 Horas</option>
                </select>
              </div>
            </div>
          </div>

          {/* Global Config Save Button */}
          {hasGlobalConfigChanges && (
            <div className="mt-6 flex justify-end animate-in fade-in slide-in-from-top-2">
              <button
                onClick={handleSaveGlobalDraft}
                disabled={saveStatus['global_config'] === 'saving'}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md transition-all disabled:opacity-50"
              >
                {saveStatus['global_config'] === 'saving' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : saveStatus['global_config'] === 'saved' ? (
                  <>
                    <Check className="h-4 w-4" />
                    ¡Guardado!
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Guardar Cambios de Configuración
                  </>
                )}
              </button>
            </div>
          )}
        </div>

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
                  onChange={e => setNewTariff({ ...newTariff, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Tipo Lógico</label>
                <select
                  value={newTariff.typeKey}
                  onChange={e => setNewTariff({ ...newTariff, typeKey: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium"
                >
                  <option value="hour">Hora</option>
                  <option value="stay">Anticipado</option>
                </select>
              </div>
            </div>

            {/* Time Configuration */}
            <div className="lg:col-span-6 bg-slate-50 p-5 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 mb-4 text-slate-600 border-b border-slate-200 pb-2">
                <Timer className="h-4 w-4 text-indigo-500" />
                <span className="text-xs font-bold uppercase tracking-wide">Duración</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block text-center">Días</label>
                  <input type="number" min="0" className="no-spinner w-full text-center p-2.5 rounded-lg border border-slate-300 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newTariff.days} onChange={e => setNewTariff({ ...newTariff, days: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block text-center">Horas</label>
                  <input type="number" min="0" max="23" className="no-spinner w-full text-center p-2.5 rounded-lg border border-slate-300 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newTariff.hours} onChange={e => setNewTariff({ ...newTariff, hours: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block text-center">Minutos</label>
                  <input type="number" min="0" max="59" className="no-spinner w-full text-center p-2.5 rounded-lg border border-slate-300 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newTariff.minutes} onChange={e => setNewTariff({ ...newTariff, minutes: parseInt(e.target.value) || 0 })}
                  />
                </div>
                {/* <div>
                  <label className="text-[10px] font-bold text-green-600 uppercase mb-1.5 block text-center">Tolerancia</label>
                  <input type="number" min="0" className="no-spinner w-full text-center p-2.5 rounded-lg border border-green-200 text-sm font-bold text-green-700 bg-green-50 focus:ring-2 focus:ring-green-500 outline-none"
                    value={newTariff.tolerance} onChange={e => setNewTariff({ ...newTariff, tolerance: parseInt(e.target.value) || 0 })}
                  />
                </div> */}
              </div>
            </div>

            {/* Action */}
            <div className="lg:col-span-2">
              <button
                onClick={handleSaveTariff}
                disabled={!newTariff.name || isSaving}
                className="w-full h-[106px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex flex-col items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? <Loader2 className="h-6 w-6 animate-spin" /> : <Save className="h-6 w-6" />}
                <span>Guardar</span>
              </button>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {([{ type: 'hora', title: 'Por Hora', Icon: Clock }, { type: 'turno', title: 'Estadías/Turnos', Icon: CalendarDays }, { type: 'abono', title: 'Abonos Mensuales', Icon: Zap }] as const).map(({ type, title, Icon }) => {
            const typeTariffs = tariffs.filter(t => t.type === type);
            return (
              <div key={type} className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-1 mb-2">
                  <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wide flex items-center gap-2">
                    <Icon className="h-4 w-4" /> {title}
                  </h4>
                  {type === 'abono' && hasMaxVehiclesChanges && (
                    <button
                      onClick={handleUpdateAllMaxVehicles}
                      disabled={saveStatus['max_vehicles_batch'] === 'saving'}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                    >
                      {saveStatus['max_vehicles_batch'] === 'saving' ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Guardando...
                        </>
                      ) : saveStatus['max_vehicles_batch'] === 'saved' ? (
                        <>
                          <Check className="h-3 w-3" />
                          ¡Guardado!
                        </>
                      ) : (
                        <>
                          <Save className="h-3 w-3" />
                          Actualizar Cupos
                        </>
                      )}
                    </button>
                  )}
                </div>

                {typeTariffs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-6 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                    <p className="text-sm font-medium">No hay tarifas configuradas</p>
                  </div>
                ) : (
                  typeTariffs.map(t => (
                    <div key={t.id} className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between shadow-sm hover:border-indigo-200 transition-colors">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className={cn("p-2.5 rounded-xl shrink-0",
                          t.type === 'hora' ? 'bg-blue-50 text-blue-600' :
                            t.type === 'turno' ? 'bg-indigo-50 text-indigo-600' :
                              'bg-emerald-50 text-emerald-600'
                        )}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-900 text-base truncate" title={t.name}>{t.name}</p>
                            {t.is_protected && <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-[10px] font-bold text-amber-700 border border-amber-200 uppercase tracking-wide flex items-center gap-1 shrink-0"><Lock className="h-3 w-3" /> Sist.</span>}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
                            <span className="font-mono bg-slate-50 px-1 py-0.5 rounded border border-slate-100">{t.days}d {t.hours}h {t.minutes}m</span>
                            {t.tolerance > 0 && <span className="text-green-600 font-bold shrink-0">+ {t.tolerance}m tol</span>}
                          </div>
                          {t.type === 'abono' && (() => {
                            const isDraft = maxVehiclesDrafts[t.id] !== undefined;
                            const currentValue = isDraft ? maxVehiclesDrafts[t.id] : (t.max_vehicles || 1);
                            const hasChanged = isDraft && maxVehiclesDrafts[t.id] !== t.max_vehicles;

                            return (
                              <div className="mt-2 flex items-center gap-2 bg-slate-50/80 p-1.5 rounded-lg border border-slate-100 w-max relative">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                                  <Users className="h-3 w-3" /> Vehículos Máx.
                                </span>

                                <div className="relative flex items-center">
                                  <input
                                    type="number"
                                    min="1"
                                    value={currentValue}
                                    disabled={t.name.toLowerCase().includes('movil') || t.name.toLowerCase().includes('móvil')}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value);
                                      if (!isNaN(val)) {
                                        setMaxVehiclesDrafts(prev => ({ ...prev, [t.id]: val }));
                                      }
                                    }}
                                    className={cn(
                                      "no-spinner w-14 text-center py-0.5 px-1 rounded text-xs font-mono font-bold text-slate-700 outline-none transition-all focus:ring-2 focus:ring-indigo-500",
                                      (t.name.toLowerCase().includes('movil') || t.name.toLowerCase().includes('móvil')) ? "opacity-50 cursor-not-allowed bg-slate-100 border border-slate-300" :
                                        hasChanged ? "bg-amber-50 border-2 border-amber-400" : "bg-white border border-slate-300"
                                    )}
                                  />
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0 ml-2">
                        {(!t.is_protected && t.type !== 'abono') && (
                          <button
                            onClick={() => openEditModal(t)}
                            className="text-slate-400 hover:text-indigo-600 p-2 hover:bg-indigo-50 rounded-xl transition-colors"
                            title="Editar Tarifa"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteTariff(t)}
                          disabled={t.is_protected}
                          className="text-slate-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-0 disabled:pointer-events-none"
                          title="Eliminar Tarifa"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>

        {/* Edit Modal Overlay */}
        {
          editingTariff && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
              <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-4 fade-in">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50 backdrop-blur-md">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-100 rounded-xl text-indigo-600 shadow-inner">
                      <Edit2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 tracking-tight">Editar Tarifa</h2>
                      <p className="text-sm text-slate-500 font-medium">Modifica los detalles del bloque de tiempo</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setEditingTariff(null)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-xl transition-all shadow-sm"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Name */}
                    <div className="col-span-1 md:col-span-2 space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nombre de la Tarifa</label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-sm"
                        placeholder="Ej. Estadía 12hs"
                        value={editForm.name}
                        onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>

                    {/* Type */}
                    {/* <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Tipo Lógicfo</label>
                    <div className="relative">
                      <select
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-sm cursor-pointer"
                        value={editForm.typeKey}
                        onChange={(e) => setEditForm(prev => ({ ...prev, typeKey: e.target.value }))}
                      >
                        <option value="hour">Hora</option>
                        <option value="stay">Anticipado</option>
                        <option value="subscription">Abono</option>
                      </select>
                      <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </div>
                  </div> */}
                  </div>

                  {/* Duration Config */}
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                    <div className="flex items-center gap-2 mb-5">
                      <div className="p-1.5 bg-indigo-100 rounded-lg text-indigo-600">
                        <Timer className="h-4 w-4" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-700">Configuración de Tiempo</h3>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {/* Days */}
                      <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block text-center">Días</label>
                        <input
                          type="number"
                          min="0"
                          className="no-spinner w-full text-center py-2 bg-slate-50 border-0 rounded-lg text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                          value={editForm.days}
                          onChange={(e) => setEditForm(prev => ({ ...prev, days: parseInt(e.target.value) || 0 }))}
                        />
                      </div>

                      {/* Hours */}
                      <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block text-center">Horas</label>
                        <input
                          type="number"
                          min="0"
                          max="23"
                          className="no-spinner w-full text-center py-2 bg-slate-50 border-0 rounded-lg text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                          value={editForm.hours}
                          onChange={(e) => setEditForm(prev => ({ ...prev, hours: parseInt(e.target.value) || 0 }))}
                        />
                      </div>

                      {/* Minutes */}
                      <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block text-center">Minutos</label>
                        <input
                          type="number"
                          min="0"
                          max="59"
                          className="no-spinner w-full text-center py-2 bg-slate-50 border-0 rounded-lg text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                          value={editForm.minutes}
                          onChange={(e) => setEditForm(prev => ({ ...prev, minutes: parseInt(e.target.value) || 0 }))}
                        />
                      </div>

                      {/* Tolerance */}
                      <div className="bg-green-50 p-3 rounded-xl shadow-sm border border-green-200">
                        <label className="text-[10px] font-bold text-green-600 uppercase tracking-wider mb-2 block text-center flex items-center justify-center gap-1">
                          <Zap className="h-3 w-3" />
                          Tolerancia
                        </label>
                        <input
                          type="number"
                          min="0"
                          className="no-spinner w-full text-center py-2 bg-white border border-green-100 rounded-lg text-green-700 font-bold focus:ring-2 focus:ring-green-500 transition-all"
                          value={editForm.tolerance}
                          onChange={(e) => setEditForm(prev => ({ ...prev, tolerance: parseInt(e.target.value) || 0 }))}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 backdrop-blur-md">
                  <button
                    type="button"
                    onClick={() => setEditingTariff(null)}
                    disabled={isUpdating}
                    className="px-6 py-2.5 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleUpdateTariff}
                    disabled={isUpdating || !editForm.name.trim()}
                    className="px-6 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 transition-all shadow-md shadow-indigo-200 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed min-w-[160px]"
                  >
                    {isUpdating ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-5 w-5" />
                        <span>Guardar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )
        }
      </div >
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
              <MatrixSection title="Estadías y Anticipados" type="turno" icon={CalendarDays} colorClass="bg-indigo-100 text-indigo-600" />
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