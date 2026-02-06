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
  Save 
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utility: Merge classes ---
function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// --- Component ---
export default function PriceMatrixPage() {
  const { garageId } = useParams<{ garageId: string }>();

  // Core Data
  const [vehicles, setVehicles] = useState<VehicleType[]>([]);
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [prices, setPrices] = useState<Price[]>([]); // Flat list from DB

  // UI State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingCells, setSavingCells] = useState<Set<string>>(new Set()); // Track which cells are saving

  useEffect(() => {
    if (!garageId) return;

    const fetchMatrixData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Parallel fetching
        const [resVehicles, resTariffs, resPrices] = await Promise.all([
          supabase.from('vehicle_types').select('*').order('sort_order'),
          supabase.from('tariffs').select('*').order('sort_order'),
          supabase.from('prices').select('*').eq('garage_id', garageId)
        ]);

        if (resVehicles.error) throw resVehicles.error;
        if (resTariffs.error) throw resTariffs.error;
        if (resPrices.error) throw resPrices.error;

        setVehicles(resVehicles.data || []);
        setTariffs(resTariffs.data || []);
        setPrices(resPrices.data || []);

      } catch (err: any) {
        console.error("Error fetching matrix:", err);
        setError("Error al cargar la matriz de precios. Verifica tu conexión o permisos.");
      } finally {
        setLoading(false);
      }
    };

    fetchMatrixData();
  }, [garageId]);

  // --- Logic: Get price for a specific cell ---
  const getPriceValue = (tariffId: string, vehicleTypeId: string): string => {
    const price = prices.find(p => p.tariff_id === tariffId && p.vehicle_type_id === vehicleTypeId);
    return price ? price.amount.toString() : '';
  };

  // --- Logic: Handle Blur (Save) ---
  const handleBlur = async (tariffId: string, vehicleTypeId: string, newValue: string) => {
    if (!garageId) return;

    const amount = parseFloat(newValue);
    if (isNaN(amount) && newValue !== '') return; // Validate

    const cellKey = `${tariffId}-${vehicleTypeId}`;
    const currentValue = getPriceValue(tariffId, vehicleTypeId);
    
    // Only save if changed
    if (newValue === currentValue) return;

    setSavingCells(prev => new Set(prev).add(cellKey));

    try {
      const payload = {
        garage_id: garageId,
        tariff_id: tariffId,
        vehicle_type_id: vehicleTypeId,
        amount: amount || 0,
        price_list_id: 'standard' // Default list
      };

      // UPSERT using composite unique key constraint
      const { error } = await supabase
        .from('prices')
        .upsert(payload, { onConflict: 'garage_id,tariff_id,vehicle_type_id' });

      if (error) throw error;

      // Update local state to reflect successful save without refetching everything
      setPrices(prev => {
        // Remove existing if present
        const filtered = prev.filter(p => !(p.tariff_id === tariffId && p.vehicle_type_id === vehicleTypeId));
        return [...filtered, { ...payload, id: 'temp-id' }]; // ID doesn't matter for display
      });

    } catch (err: any) {
      console.error("Save failed:", err);
      // Optional: Show toast error
    } finally {
      setSavingCells(prev => {
        const next = new Set(prev);
        next.delete(cellKey);
        return next;
      });
    }
  };

  // --- Group Tariffs by Type ---
  const groupedTariffs = tariffs.reduce((acc, tariff) => {
    if (!acc[tariff.type]) acc[tariff.type] = [];
    acc[tariff.type].push(tariff);
    return acc;
  }, {} as Record<TariffType, Tariff[]>);

  const tariffTypeConfig: Record<string, { label: string, icon: React.ElementType, color: string }> = {
    'hour': { label: 'Por Tiempo', icon: Clock, color: 'text-blue-600 bg-blue-50' },
    'stay': { label: 'Estadías', icon: CalendarDays, color: 'text-indigo-600 bg-indigo-50' },
    'subscription': { label: 'Abonos Mensuales', icon: Car, color: 'text-emerald-600 bg-emerald-50' },
    'service': { label: 'Adicionales', icon: Zap, color: 'text-amber-600 bg-amber-50' }
  };

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-blue-600 h-8 w-8" /></div>;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <TableProperties className="h-6 w-6 text-blue-600" />
            Matriz de Precios
          </h1>
          <p className="text-slate-500 mt-1">
            Gestiona las tarifas cruzadas entre tipos de vehículos y conceptos de cobro.
            <span className="ml-2 text-xs font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-500">Autoguardado activo</span>
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex gap-2 items-center">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      {vehicles.length === 0 && !loading && (
        <div className="p-8 text-center bg-white rounded-xl border border-dashed border-slate-300">
          <p className="text-slate-500">No hay tipos de vehículos definidos en el sistema.</p>
        </div>
      )}

      {/* RENDER GROUPS */}
      {['hour', 'stay', 'subscription', 'service'].map((typeKey) => {
        const typeTariffs = groupedTariffs[typeKey as TariffType];
        if (!typeTariffs || typeTariffs.length === 0) return null;

        const config = tariffTypeConfig[typeKey] || { label: typeKey, icon: Zap, color: 'text-slate-600' };
        const Icon = config.icon;

        return (
          <div key={typeKey} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            {/* Header Group */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${config.color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-slate-800 text-lg">{config.label}</h3>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50/50">
                  <tr>
                    <th className="px-6 py-3 font-medium tracking-wider w-1/3">Concepto</th>
                    {vehicles.map(v => (
                      <th key={v.id} className="px-4 py-3 font-bold text-center text-slate-700 min-w-[120px]">
                        {v.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {typeTariffs.map((tariff) => (
                    <tr key={tariff.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-3 font-medium text-slate-700">
                        {tariff.name}
                      </td>
                      {vehicles.map((v) => {
                        const cellKey = `${tariff.id}-${v.id}`;
                        const isSaving = savingCells.has(cellKey);

                        return (
                          <td key={v.id} className="px-2 py-2">
                            <div className="relative">
                              <span className="absolute left-3 top-2 text-slate-400 font-light">$</span>
                              <input
                                type="number"
                                defaultValue={getPriceValue(tariff.id, v.id)}
                                onBlur={(e) => handleBlur(tariff.id, v.id, e.target.value)}
                                className={cn(
                                  "w-full pl-6 pr-3 py-1.5 text-right font-mono font-medium rounded-md border transition-all focus:outline-none focus:ring-2 focus:ring-blue-500",
                                  isSaving 
                                    ? "bg-blue-50 border-blue-200 text-blue-700" 
                                    : "bg-white border-slate-200 text-slate-900 focus:bg-white"
                                )}
                                placeholder="0.00"
                              />
                              {isSaving && (
                                <div className="absolute right-2 top-2">
                                  <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
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
}