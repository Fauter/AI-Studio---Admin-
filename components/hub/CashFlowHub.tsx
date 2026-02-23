
import React, { useState, useEffect, useMemo } from 'react';
import {
    Building2,
    Wallet,
    TrendingUp,
    ArrowUpRight,
    ArrowDownRight,
    CreditCard,
    Calendar,
    Loader2,
    Filter,
    Car,
    Clock,
    AlertCircle,
    Inbox
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Garage } from '../../types';
import { twMerge } from 'tailwind-merge';
import clsx from 'clsx';
import SectionHeader from './SectionHeader';

function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

// --- Tipos Locales (Inferred Schema) ---

interface Movement {
    id: string;
    garage_id: string;
    type: 'CobroEstadia' | 'INGRESO' | 'EGRESO' | 'COBRO' | 'PAGO' | 'CAJA_INICIAL' | 'RETIRO';
    plate?: string;
    amount: number;
    payment_method?: string; // 'EFECTIVO', 'MERCADOPAGO', etc.
    timestamp: string; // ISO String
    ticket_number?: string;
    operator_name?: string; // Nombre del operador que hizo el cobro (si existe)
    vehicle_type?: string;
    notes?: string;
    related_entity_id?: string | null;
    invoice_type?: string | null;
}

interface Stay {
    id: string;
    garage_id: string;
    plate: string;
    entry_time: string; // ISO String
    exit_time?: string;
    vehicle_type: string; // Ahora es un string directo, no un objeto
    active: boolean;
}

interface CashFlowHubProps {
    garages: Garage[];
}

export default function CashFlowHub({ garages }: CashFlowHubProps) {
    const [view, setView] = useState<'caja' | 'ingresos'>('caja');
    const [selectedGarageId, setSelectedGarageId] = useState<string>('all');
    const [movements, setMovements] = useState<Movement[]>([]);
    const [stays, setStays] = useState<Stay[]>([]);
    const [historicalStays, setHistoricalStays] = useState<Stay[]>([]);
    const [vehicles, setVehicles] = useState<{ plate: string; type: string; is_subscriber?: boolean }[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // --- 1. Data Fetching ---

    useEffect(() => {
        // Si no hay garajes permitidos, no hacemos fetch
        if (garages.length === 0) {
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const garageIds = garages.map(g => g.id);

                // Fetch Movements
                const { data: movesData, error: movesError } = await supabase
                    .from('movements')
                    .select('*')
                    .in('garage_id', garageIds)
                    .order('timestamp', { ascending: false }) // Del mas reciente al mas antiguo
                    .limit(100);

                if (movesError) throw movesError;

                const loadedMovements = movesData as Movement[];
                const relatedStayIds = Array.from(new Set(
                    loadedMovements
                        .map(m => m.related_entity_id)
                        .filter((id): id is string => id != null)
                ));

                let historicalStaysData: Stay[] = [];
                if (relatedStayIds.length > 0) {
                    const { data: hsData, error: hsError } = await supabase
                        .from('stays')
                        .select('*')
                        .in('id', relatedStayIds);

                    if (hsError) throw hsError;
                    historicalStaysData = hsData as Stay[];
                }

                // Fetch Active Stays (Ocupación)
                // CORRECCIÓN: Eliminado el join erróneo. Se asume que vehicle_type viene plano.
                const { data: staysData, error: staysError } = await supabase
                    .from('stays')
                    .select('*')
                    .in('garage_id', garageIds)
                    .eq('active', true)
                    .order('entry_time', { ascending: false })
                    .limit(50);

                if (staysError) throw staysError;

                // Fetch Vehicles for Types & Subscription info
                const { data: vehiclesData, error: vehiclesError } = await supabase
                    .from('vehicles')
                    .select('plate, type, is_subscriber')
                    .in('garage_id', garageIds);

                if (vehiclesError) throw vehiclesError;

                setVehicles(vehiclesData || []);
                setMovements(loadedMovements);
                setStays(staysData as Stay[]);
                setHistoricalStays(historicalStaysData);

            } catch (err: any) {
                console.error('Error fetching dashboard data:', err);
                setError('No se pudieron cargar los datos financieros.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [garages]); // Re-fetch si cambian los permisos/garajes

    // --- 2. Filtering & Computing KPIs ---

    const staysLookup = useMemo(() => {
        const map: Record<string, Stay> = {};
        historicalStays.forEach(s => {
            map[s.id] = s;
        });
        return map;
    }, [historicalStays]);

    const vehicleTypesMap = useMemo(() => {
        const map: Record<string, string> = {};
        vehicles.forEach(v => {
            if (v.plate && v.type) map[v.plate] = v.type;
        });
        return map;
    }, [vehicles]);

    const subscriberMap = useMemo(() => {
        const map: Record<string, boolean> = {};
        vehicles.forEach(v => {
            if (v.plate) map[v.plate] = !!v.is_subscriber;
        });
        return map;
    }, [vehicles]);

    const filteredMovements = useMemo(() => {
        if (selectedGarageId === 'all') return movements;
        return movements.filter(m => m.garage_id === selectedGarageId);
    }, [selectedGarageId, movements]);

    const filteredStays = useMemo(() => {
        if (selectedGarageId === 'all') return stays;
        return stays.filter(s => s.garage_id === selectedGarageId);
    }, [selectedGarageId, stays]);

    const totalCaja = useMemo(() => {
        return filteredMovements.reduce((acc, move) => acc + Number(move.amount || 0), 0);
    }, [filteredMovements]);

    // --- Utils ---

    const cleanDescription = (notes?: string) => {
        if (!notes) return '---';
        if (notes.includes('-')) {
            return notes.split('-')[0].trim();
        }
        return notes;
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
    };

    const formatDate = (isoString: string) => {
        if (!isoString) return '-';
        const date = new Date(isoString);
        // Verificar si es hoy
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();

        if (isToday) {
            return `Hoy ${date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}hs`;
        }
        return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    };

    const getGarageName = (id: string) => {
        return garages.find(g => g.id === id)?.name || 'Desconocido';
    };

    const getTimeElapsed = (entryTime: string) => {
        const start = new Date(entryTime).getTime();
        const now = new Date().getTime();
        const diffMs = now - start;
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        if (diffHrs > 24) return `+${Math.floor(diffHrs / 24)}d`;
        if (diffHrs > 0) return `${diffHrs}h ${diffMins}m`;
        return `${diffMins}m`;
    };

    // --- Render ---

    if (loading && movements.length === 0) {
        return (
            <div className="flex h-64 items-center justify-center bg-white rounded-2xl border border-slate-200">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-32 items-center justify-center bg-red-50 rounded-2xl border border-red-200 text-red-700 gap-2">
                <AlertCircle className="h-5 w-5" /> {error}
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">

            {/* 1. Header & Filters */}
            <SectionHeader title="Panel Financiero" icon={TrendingUp} iconColor="indigo">

                <div className="flex flex-1 sm:flex-none items-center justify-end gap-2 sm:gap-4">
                    {/* Badge Resumen Rápido (Total Caja) */}
                    <div className="hidden sm:flex items-center bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm">
                        Total Caja: {formatCurrency(totalCaja)}
                    </div>

                    <div className="flex items-center gap-1 bg-slate-200/50 p-1 rounded-xl">
                        <button
                            onClick={() => setView('caja')}
                            className={cn(
                                "px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all",
                                view === 'caja' ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            Caja
                        </button>
                        <button
                            onClick={() => setView('ingresos')}
                            className={cn(
                                "px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all",
                                view === 'ingresos' ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            Ingresos
                        </button>
                    </div>
                    <div className="relative">
                        <Filter className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <select
                            value={selectedGarageId}
                            onChange={(e) => setSelectedGarageId(e.target.value)}
                            className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm cursor-pointer"
                        >
                            <option value="all">Todos los Garajes</option>
                            {garages.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </SectionHeader>

            {/* 2. Contenido Principal Vistas */}
            <div>
                {/* Vista: CAJA */}
                {view === 'caja' && (
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[500px]">
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 uppercase bg-white sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-4 py-2.5 font-semibold">Garaje</th>
                                        <th className="px-4 py-2.5 font-semibold">Patente</th>
                                        <th className="px-4 py-2.5 font-semibold">Hora</th>
                                        <th className="px-4 py-2.5 font-semibold">Descripción</th>
                                        <th className="px-4 py-2.5 font-semibold">Método de Pago</th>
                                        <th className="px-4 py-2.5 font-semibold">Factura</th>
                                        <th className="px-4 py-2.5 font-semibold text-right">Monto</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredMovements.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="p-8 text-center text-slate-400 text-sm">
                                                No hay movimientos registrados en este período.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredMovements.map(move => {
                                            return (
                                                <tr key={move.id} className="hover:bg-indigo-50/30 transition-colors">
                                                    <td className="px-4 py-2">
                                                        <span className="font-medium text-slate-600 text-xs">{getGarageName(move.garage_id)}</span>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <div className="flex flex-col">
                                                            <span className="font-bold font-mono text-slate-800">{move.plate || '---'}</span>
                                                            <span className="text-[10px] text-slate-400 uppercase">
                                                                {(move.plate && vehicleTypesMap[move.plate])
                                                                    ? vehicleTypesMap[move.plate]
                                                                    : (move.vehicle_type || 'Vehículo')}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2 text-left text-xs font-medium">
                                                        {move.type === 'CobroEstadia' && move.related_entity_id && staysLookup[move.related_entity_id] ? (
                                                            <div className="flex flex-col items-start gap-0.5">
                                                                <div className="flex items-center gap-1 text-slate-500 text-[10px]">
                                                                    <ArrowUpRight className="h-3 w-3 opacity-60" />
                                                                    <span>{formatDate(staysLookup[move.related_entity_id].entry_time)}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1 text-slate-700">
                                                                    <ArrowDownRight className="h-3 w-3 opacity-60" />
                                                                    <span>{formatDate(staysLookup[move.related_entity_id].exit_time || move.timestamp)}</span>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-500">{formatDate(move.timestamp)}</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <span className="text-sm text-slate-600">{cleanDescription(move.notes)}</span>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <span className="text-xs text-slate-500 font-medium">{move.payment_method ? move.payment_method.toUpperCase() : '---'}</span>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        {move.invoice_type ? (
                                                            <span className="px-2 py-0.5 bg-slate-100 text-[10px] font-bold text-slate-600 rounded-md uppercase">
                                                                {move.invoice_type}
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-slate-400">---</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2 text-right font-bold font-mono text-slate-800">
                                                        {formatCurrency(move.amount)}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Vista: INGRESOS */}
                {view === 'ingresos' && (
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[500px]">
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 uppercase bg-white sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-4 py-2.5 font-semibold">Garaje</th>
                                        <th className="px-4 py-2.5 font-semibold">Patente</th>
                                        <th className="px-4 py-2.5 font-semibold">Tipo</th>
                                        <th className="px-4 py-2.5 font-semibold">Entrada</th>
                                        <th className="px-4 py-2.5 font-semibold text-center">Abonado</th>
                                        <th className="px-4 py-2.5 font-semibold text-right">Tiempo</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredStays.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-slate-400 text-sm">
                                                <div className="flex flex-col items-center justify-center">
                                                    <Car className="h-8 w-8 mb-2 opacity-20" />
                                                    <p>Todo tranquilo.</p>
                                                    <p className="text-xs">No hay vehículos activos ahora mismo.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredStays.map(stay => (
                                            <tr key={stay.id} className="hover:bg-indigo-50/30 transition-colors">
                                                <td className="px-4 py-3">
                                                    <span className="font-medium text-slate-600 text-xs">{getGarageName(stay.garage_id)}</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="font-bold font-mono text-slate-800">{stay.plate}</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-6 w-6 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-[10px] uppercase">
                                                            {stay.vehicle_type?.[0] || 'V'}
                                                        </div>
                                                        <span className="text-xs text-slate-500 uppercase">
                                                            {(vehicleTypesMap[stay.plate] || stay.vehicle_type || 'Vehículo')}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="text-xs text-slate-600 font-medium">{formatDate(stay.entry_time)}</span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {subscriberMap[stay.plate] ? (
                                                        <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md text-[10px] font-bold">
                                                            SÍ
                                                        </span>
                                                    ) : (
                                                        <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md text-[10px] font-bold">
                                                            NO
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <span className="inline-block text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md text-right">
                                                        {getTimeElapsed(stay.entry_time)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
}
