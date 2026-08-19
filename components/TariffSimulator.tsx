import React, { useState, useEffect } from 'react';
import { X, Calculator, DollarSign, Clock, Car, CreditCard } from 'lucide-react';
import { buildPriceMatrix, estimateStayCost } from '../lib/tariffEstimation';

export default function TariffSimulator({
  isOpen,
  onClose,
  vehicles,
  tariffs,
  prices,
  financialConfig
}: {
  isOpen: boolean;
  onClose: () => void;
  vehicles: any[];
  tariffs: any[];
  prices: any[];
  financialConfig: any;
}) {
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [days, setDays] = useState<number | ''>('');
  const [hours, setHours] = useState<number | ''>('');
  const [minutes, setMinutes] = useState<number | ''>('');
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    if (vehicles.length > 0 && !selectedVehicle) {
      setSelectedVehicle(vehicles[0].name);
    }
  }, [vehicles, selectedVehicle]);

  useEffect(() => {
    if (!isOpen) return;

    // Transform prices into matrix for PricingEngine
    const matrix = buildPriceMatrix(vehicles, tariffs, prices, paymentMethod);

    const d = typeof days === 'number' ? days : 0;
    const h = typeof hours === 'number' ? hours : 0;
    const m = typeof minutes === 'number' ? minutes : 0;
    const totalMinutes = (d * 1440) + (h * 60) + m;

    if (totalMinutes === 0 || !selectedVehicle) {
      setTotal(0);
      return;
    }

    const now = new Date();
    const entryTime = now;
    const exitTime = new Date(now.getTime() + totalMinutes * 60000);

    const result = estimateStayCost(
      entryTime,
      exitTime,
      selectedVehicle,
      'SIM-123',
      paymentMethod,
      tariffs,
      matrix,
      financialConfig
    );

    setTotal(result.isValid ? result.amount : null);

  }, [days, hours, minutes, selectedVehicle, paymentMethod, tariffs, prices, vehicles, financialConfig, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl relative overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="bg-indigo-600 p-6 text-white flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Calculator className="h-6 w-6 text-indigo-200" />
              <h2 className="text-xl font-bold tracking-tight">Simulador de Tarifas</h2>
            </div>
            <p className="text-indigo-100 text-sm opacity-90">Calcula el costo estimado de una estadía</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors backdrop-blur-sm"
          >
            <X className="h-5 w-5 text-white" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Result Display */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center shadow-inner">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Estimado</span>
            <div className="flex items-start gap-1">
              <DollarSign className="h-6 w-6 text-slate-400 mt-2" />
              <span className="text-5xl font-extrabold text-slate-800 tracking-tight">
                {total === null || total === 0 ? '-' : total.toLocaleString('es-AR')}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {/* Vehicle & Payment Method */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                  <Car className="h-3.5 w-3.5" /> Vehículo
                </label>
                <select
                  value={selectedVehicle}
                  onChange={e => setSelectedVehicle(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                >
                  {vehicles.map(v => (
                    <option key={v.id} value={v.name}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5" /> Método
                </label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                >
                  <option value="Efectivo">Efectivo</option>
                  <option value="MercadoPago">Bancario</option>
                </select>
              </div>
            </div>

            {/* Time Inputs */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Tiempo de Estadía
              </label>
              <div className="grid grid-cols-3 gap-3">
                <div className="relative">
                  <input
                    type="number" min="0" value={days === '' ? '' : days} onChange={e => setDays(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0"
                    className="no-spinner w-full pl-3 pr-7 py-2.5 bg-white border border-slate-300 rounded-xl text-center font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">d</span>
                </div>
                <div className="relative">
                  <input
                    type="number" min="0" value={hours === '' ? '' : hours} onChange={e => setHours(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0"
                    className="no-spinner w-full pl-3 pr-7 py-2.5 bg-white border border-slate-300 rounded-xl text-center font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">h</span>
                </div>
                <div className="relative">
                  <input
                    type="number" min="0" value={minutes === '' ? '' : minutes} onChange={e => setMinutes(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0"
                    className="no-spinner w-full pl-3 pr-7 py-2.5 bg-white border border-slate-300 rounded-xl text-center font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">m</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400 font-medium">Este cálculo utiliza la tolerancia y configuración activa del garaje.</p>
        </div>
      </div>
    </div>
  );
}
