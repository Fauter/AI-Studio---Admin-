import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { VehicleType, Tariff, Price, TariffType } from '../types';
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
  CreditCard, 
  Banknote,
  Rocket,
  Settings2
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

type TabType = 'matrix' | 'vehicles' | 'tariffs';

export default function PriceMatrixPage() {
  const { garageId } = useParams<{ garageId: string }>();
  
  // --- Global State ---
  const [activeTab, setActiveTab] = useState<TabType>('matrix');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Data State ---
  const [vehicles, setVehicles] = useState<VehicleType[]>([]);
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  
  // --- Matrix UI State ---
  const [selectedList, setSelectedList] = useState<'standard' | 'electronic'>('standard');
  const [savingCells, setSavingCells] = useState<Set<string>>(new Set());

  // --- Initial Load ---
  useEffect(() => {
    if (garageId) fetchAllData();
  }, [garageId]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [resVehicles, resTariffs, resPrices] = await Promise.all([
        supabase.from('vehicle_types').select('*').eq('garage_id', garageId).order('sort_order'),
        supabase.from('tariffs').select('*').eq('garage_id', garageId).order('sort_order'),
        supabase.from('prices').select('*').eq('garage_id', garageId)
      ]);

      if (resVehicles.error) throw resVehicles.error;
      if (resTariffs.error) throw resTariffs.error;
      if (resPrices.error) throw resPrices.error;

      setVehicles(resVehicles.data || []);
      setTariffs(resTariffs.data || []);
      setPrices(resPrices.data || []);

    } catch (err: any) {
      console.error("Error fetching data:", err);
      setError("Error al cargar datos. Verifica tu conexión.");
    } finally {
      setLoading(false);
    }
  };

  // --- Default Data Seeder ---
  const handleLoadDefaults = async () => {
    if (!garageId) return;
    setLoading(true);
    try {
      // 1. Insert Default Vehicles
      const defaultVehicles = [
        { garage_id: garageId, name: 'Auto', icon_key: 'car', sort_order: 1 },
        { garage_id: garageId, name: 'Moto', icon_key: 'bike', sort_order: 2 },
        { garage_id: garageId, name: 'Camioneta', icon_key: 'truck', sort_order: 3 },
      ];
      await supabase.from('vehicle_types').insert(defaultVehicles);

      // 2. Insert Default Tariffs
      const defaultTariffs = [
        { garage_id: garageId, name: 'Hora', type: 'hora', sort_order: 1 },
        { garage_id: garageId, name: 'Estadía 12hs', type: 'turno', sort_order: 2 },
        { garage_id: garageId, name: 'Estadía 24hs', type: 'turno', sort_order: 3 },
        { garage_id: garageId, name: 'Abono Mensual', type: 'abono', sort_order: 4 },
      ];
      await supabase.from('tariffs').insert(defaultTariffs);

      await fetchAllData(); // Refresh
    } catch (err: any) {
      alert("Error cargando defaults: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- Matrix Logic ---
  const getPriceValue = (tariffId: string, vehicleTypeId: string): string => {
    const price = prices.find(p => 
      p.tariff_id === tariffId && 
      p.vehicle_type_id === vehicleTypeId && 
      p.price_list === selectedList
    );
    return price ? price.amount.toString() : '';
  };

  const handlePriceBlur = async (tariffId: string, vehicleTypeId: string, newValue: string) => {
    if (!garageId) return;
    const amount = parseFloat(newValue);
    if (isNaN(amount) && newValue !== '') return;

    const cellKey = `${tariffId}-${vehicleTypeId}`;
    const currentValue = getPriceValue(tariffId, vehicleTypeId);
    if (newValue === currentValue) return;

    setSavingCells(prev => new Set(prev).add(cellKey));

    try {
      const payload = {
        garage_id: garageId,
        tariff_id: tariffId,
        vehicle_type_id: vehicleTypeId,
        price_list: selectedList,
        amount: amount || 0,
      };

      const { error } = await supabase
        .from('prices')
        .upsert(payload, { onConflict: 'garage_id,tariff_id,vehicle_type_id,price_list' });

      if (error) throw error;

      // Update local state optimistically
      setPrices(prev => {
        const filtered = prev.filter(p => 
          !(p.tariff_id === tariffId && p.vehicle_type_id === vehicleTypeId && p.price_list === selectedList)
        );
        return [...filtered, { ...payload, id: 'temp' }];
      });

    } catch (err) {
      console.error("Save error", err);
    } finally {
      setSavingCells(prev => {
        const next = new Set(prev);
        next.delete(cellKey);
        return next;
      });
    }
  };

  // --- CRUD Handlers (Generic) ---
  const handleDeleteItem = async (table: 'vehicle_types' | 'tariffs', id: string) => {
    if (!confirm('¿Estás seguro de eliminar este ítem? Se borrarán sus precios asociados.')) return;
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      fetchAllData();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const handleAddItem = async (table: 'vehicle_types' | 'tariffs', payload: any) => {
    try {
      const { error } = await supabase.from(table).insert({ ...payload, garage_id: garageId });
      if (error) throw error;
      fetchAllData();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  // --- Sub-Components for Tabs ---

  const VehiclesTab = () => {
    const [newName, setNewName] = useState('');
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Agregar Vehículo</h3>
          <div className="flex gap-4">
            <input 
              type="text" 
              placeholder="Nombre (Ej: Moto, Pickup)" 
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <button 
              onClick={() => {
                if (newName) handleAddItem('vehicle_types', { name: newName, sort_order: vehicles.length + 1 });
                setNewName('');
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2"
            >
              <Plus className="h-4 w-4" /> Agregar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehicles.map(v => (
            <div key={v.id} className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                  {v.icon_key === 'bike' ? <Bike className="h-5 w-5"/> : v.icon_key === 'truck' ? <Truck className="h-5 w-5"/> : <Car className="h-5 w-5"/>}
                </div>
                <span className="font-medium text-slate-900">{v.name}</span>
              </div>
              <button 
                onClick={() => handleDeleteItem('vehicle_types', v.id)}
                className="text-slate-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const TariffsTab = () => {
    const [newTariff, setNewTariff] = useState({ name: '', type: 'hora' as TariffType });
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Agregar Tarifa</h3>
          <div className="flex flex-col md:flex-row gap-4">
            <input 
              type="text" 
              placeholder="Nombre (Ej: Estadía 12hs)" 
              value={newTariff.name}
              onChange={e => setNewTariff({...newTariff, name: e.target.value})}
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <select 
              value={newTariff.type}
              onChange={e => setNewTariff({...newTariff, type: e.target.value as TariffType})}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
            >
              <option value="hora">Por Hora/Minutos</option>
              <option value="turno">Estadía Fija</option>
              <option value="abono">Abono Mensual</option>
            </select>
            <button 
              onClick={() => {
                if (newTariff.name) handleAddItem('tariffs', { ...newTariff, sort_order: tariffs.length + 1 });
                setNewTariff({...newTariff, name: ''});
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 whitespace-nowrap"
            >
              <Plus className="h-4 w-4" /> Agregar Tarifa
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {tariffs.map(t => (
            <div key={t.id} className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg", 
                  t.type === 'hora' ? 'bg-blue-50 text-blue-600' : 
                  t.type === 'turno' ? 'bg-indigo-50 text-indigo-600' : 
                  'bg-emerald-50 text-emerald-600'
                )}>
                  {t.type === 'hora' ? <Clock className="h-5 w-5"/> : t.type === 'turno' ? <CalendarDays className="h-5 w-5"/> : <Zap className="h-5 w-5"/>}
                </div>
                <div>
                  <p className="font-medium text-slate-900">{t.name}</p>
                  <p className="text-xs text-slate-500 uppercase">{t.type}</p>
                </div>
              </div>
              <button 
                onClick={() => handleDeleteItem('tariffs', t.id)}
                className="text-slate-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const MatrixTab = () => {
    // Group Tariffs
    const groupedTariffs = tariffs.reduce((acc, tariff) => {
      if (!acc[tariff.type]) acc[tariff.type] = [];
      acc[tariff.type].push(tariff);
      return acc;
    }, {} as Record<TariffType, Tariff[]>);

    const tariffConfig = {
      'hora': { label: 'Fracciones y Horas', icon: Clock, color: 'text-blue-600 bg-blue-50' },
      'turno': { label: 'Estadías Fijas', icon: CalendarDays, color: 'text-indigo-600 bg-indigo-50' },
      'abono': { label: 'Abonos Mensuales', icon: Zap, color: 'text-emerald-600 bg-emerald-50' }
    };

    if (vehicles.length === 0 || tariffs.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
          <Rocket className="h-12 w-12 text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-900">Garaje sin configurar</h3>
          <p className="text-slate-500 mb-6 text-center max-w-sm">No hay vehículos ni tarifas definidos. ¿Deseas cargar una configuración base recomendada?</p>
          <button 
            onClick={handleLoadDefaults}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all"
          >
            <Settings2 className="h-5 w-5" /> Cargar Configuración Inicial
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
        {['hora', 'turno', 'abono'].map((typeKey) => {
          const typeTariffs = groupedTariffs[typeKey as TariffType];
          if (!typeTariffs || typeTariffs.length === 0) return null;

          const conf = tariffConfig[typeKey as keyof typeof tariffConfig];
          const Icon = conf.icon;

          return (
            <div key={typeKey} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${conf.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-slate-800 text-lg">{conf.label}</h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50/50">
                    <tr>
                      <th className="px-6 py-3 font-medium tracking-wider w-1/3">Concepto</th>
                      {vehicles.map(v => (
                        <th key={v.id} className="px-4 py-3 font-bold text-center text-slate-700 min-w-[120px]">
                          <div className="flex flex-col items-center gap-1">
                            {v.icon_key === 'bike' ? <Bike className="h-4 w-4 text-slate-400"/> : v.icon_key === 'truck' ? <Truck className="h-4 w-4 text-slate-400"/> : <Car className="h-4 w-4 text-slate-400"/>}
                            {v.name}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {typeTariffs.map((tariff) => (
                      <tr key={tariff.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-3 font-medium text-slate-700">{tariff.name}</td>
                        {vehicles.map((v) => {
                          const cellKey = `${tariff.id}-${v.id}`;
                          const isSaving = savingCells.has(cellKey);
                          return (
                            <td key={v.id} className="px-2 py-2">
                              <div className="relative group">
                                <span className="absolute left-3 top-2 text-slate-400 font-light text-xs">$</span>
                                <input
                                  type="number"
                                  defaultValue={getPriceValue(tariff.id, v.id)}
                                  onBlur={(e) => handlePriceBlur(tariff.id, v.id, e.target.value)}
                                  className={cn(
                                    "w-full pl-6 pr-3 py-1.5 text-right font-mono font-medium rounded-md border transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500",
                                    isSaving 
                                      ? "bg-indigo-50 border-indigo-200 text-indigo-700" 
                                      : "bg-white border-slate-200 text-slate-900 focus:bg-white group-hover:border-slate-300"
                                  )}
                                  placeholder="-"
                                />
                                {isSaving && (
                                  <div className="absolute right-2 top-2">
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
        })}
      </div>
    );
  };

  if (loading) return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;

  return (
    <div className="space-y-6 pb-20">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <TableProperties className="h-6 w-6 text-indigo-600" />
            Gestión de Precios
          </h1>
          <p className="text-slate-500 mt-1">Configura tipos de vehículos, tarifas y la matriz de precios.</p>
        </div>

        {/* List Selector (Only visible in Matrix) */}
        {activeTab === 'matrix' && (
          <div className="flex bg-slate-200/50 p-1 rounded-lg">
             <button 
              onClick={() => setSelectedList('standard')}
              className={cn("px-4 py-1.5 rounded-md text-sm font-semibold flex items-center gap-2 transition-all", selectedList === 'standard' ? 'bg-white shadow-sm text-green-700' : 'text-slate-500 hover:text-slate-700')}
             >
               <Banknote className="h-4 w-4" /> Efectivo
             </button>
             <button 
              onClick={() => setSelectedList('electronic')}
              className={cn("px-4 py-1.5 rounded-md text-sm font-semibold flex items-center gap-2 transition-all", selectedList === 'electronic' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700')}
             >
               <CreditCard className="h-4 w-4" /> Tarjeta/Otros
             </button>
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200 flex gap-6">
        <button 
          onClick={() => setActiveTab('matrix')}
          className={cn("pb-3 text-sm font-medium border-b-2 transition-colors", activeTab === 'matrix' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800')}
        >
          Matriz de Precios
        </button>
        <button 
          onClick={() => setActiveTab('vehicles')}
          className={cn("pb-3 text-sm font-medium border-b-2 transition-colors", activeTab === 'vehicles' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800')}
        >
          Config. Vehículos
        </button>
        <button 
          onClick={() => setActiveTab('tariffs')}
          className={cn("pb-3 text-sm font-medium border-b-2 transition-colors", activeTab === 'tariffs' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800')}
        >
          Config. Tarifas
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex gap-2 items-center">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      {/* Content Area */}
      <div className="min-h-[400px]">
        {activeTab === 'matrix' && <MatrixTab />}
        {activeTab === 'vehicles' && <VehiclesTab />}
        {activeTab === 'tariffs' && <TariffsTab />}
      </div>
    </div>
  );
}