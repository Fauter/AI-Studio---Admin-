import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
    Wallet,
    Car,
    Clock,
    Inbox,
    Activity,
    Search,
    FilterX,
    ChevronDown,
} from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

// ─── Interfaces ────────────────────────────────────────────────────
interface Movement {
    id: string;
    type: string;
    plate?: string;
    amount: number;
    payment_method?: string;
    timestamp: string;
    operator?: string;
    operator_name?: string;
}

interface Stay {
    id: string;
    plate: string;
    entry_time: string;
    exit_time?: string;
    vehicle_type: string;
    active: boolean;
}

interface MovementFilters {
    date: string;
    plate: string;
    vehicleType: string;
    tariffType: string;
    operator: string;
    method: string;
    amountMin: string;
    amountMax: string;
}

interface StayFilters {
    plate: string;
    vehicleType: string;
    timeRange: string; // '' | '<1h' | '1h-4h' | '4h-12h' | '>12h'
}

const EMPTY_MOV_FILTERS: MovementFilters = { date: '', plate: '', vehicleType: '', tariffType: '', operator: '', method: '', amountMin: '', amountMax: '' };
const EMPTY_STAY_FILTERS: StayFilters = { plate: '', vehicleType: '', timeRange: '' };

// ─── Helpers ───────────────────────────────────────────────────────
const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);

const getTimeElapsed = (entryTime: string) => {
    const diffMs = Date.now() - new Date(entryTime).getTime();
    const diffHrs = Math.floor(diffMs / 3_600_000);
    const diffMins = Math.floor((diffMs % 3_600_000) / 60_000);
    if (diffHrs > 24) return `+${Math.floor(diffHrs / 24)}d`;
    if (diffHrs > 0) return `${diffHrs}h ${diffMins}m`;
    return `${diffMins}m`;
};

const getTimeElapsedHours = (entryTime: string) => (Date.now() - new Date(entryTime).getTime()) / 3_600_000;

const isToday = (dateString: string) => {
    if (!dateString) return false;
    const d = new Date(dateString), t = new Date();
    return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
};

const formatTime24 = (dateString: string) =>
    new Date(dateString).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

const formatDateDM = (dateString: string) => {
    const d = new Date(dateString);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
};

// ─── useDebounce Hook ──────────────────────────────────────────────
function useDebounce(value: string, delay: number) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const id = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(id);
    }, [value, delay]);
    return debounced;
}

// ─── Small Select Component ────────────────────────────────────────
function FilterSelect({ value, onChange, options, placeholder }: {
    value: string; onChange: (v: string) => void; options: string[]; placeholder: string;
}) {
    return (
        <div className="relative">
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                className="w-full appearance-none text-xs bg-white border border-slate-200 rounded-md pl-2 pr-6 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer truncate"
            >
                <option value="">{placeholder}</option>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════
export default function DashboardHome() {
    const { garageId } = useParams();

    // ── Data state ──
    const [movements, setMovements] = useState<Movement[]>([]);
    const [stays, setStays] = useState<Stay[]>([]);
    const [vehicleMap, setVehicleMap] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'movements' | 'stays'>('movements');

    // ── Filter state ──
    const [movFilters, setMovFilters] = useState<MovementFilters>(EMPTY_MOV_FILTERS);
    const [stayFilters, setStayFilters] = useState<StayFilters>(EMPTY_STAY_FILTERS);

    // Debounced plate searches (300ms)
    const debouncedMovPlate = useDebounce(movFilters.plate, 300);
    const debouncedStayPlate = useDebounce(stayFilters.plate, 300);

    // ── Helpers to check if filters are active ──
    const movFiltersActive = movFilters.date || debouncedMovPlate || movFilters.vehicleType || movFilters.tariffType || movFilters.operator || movFilters.method || movFilters.amountMin || movFilters.amountMax;
    const stayFiltersActive = debouncedStayPlate || stayFilters.vehicleType || stayFilters.timeRange;

    // ── Data fetching ──
    useEffect(() => {
        if (!garageId) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const { data: movesData } = await supabase
                    .from('movements')
                    .select('*')
                    .eq('garage_id', garageId)
                    .order('timestamp', { ascending: false })
                    .limit(200);

                const { data: activeStaysData } = await supabase
                    .from('stays')
                    .select('*')
                    .eq('garage_id', garageId)
                    .eq('active', true)
                    .order('entry_time', { ascending: false });

                const { data: recentStaysData } = await supabase
                    .from('stays')
                    .select('*')
                    .eq('garage_id', garageId)
                    .order('entry_time', { ascending: false })
                    .limit(200);

                if (movesData) setMovements(movesData as Movement[]);

                const staysMap = new Map<string, Stay>();
                if (recentStaysData) recentStaysData.forEach(s => staysMap.set(s.id, s as Stay));
                if (activeStaysData) activeStaysData.forEach(s => staysMap.set(s.id, s as Stay));
                setStays(Array.from(staysMap.values()));

                const { data: vData } = await supabase
                    .from('vehicles')
                    .select('plate, type')
                    .eq('garage_id', garageId);

                if (vData) {
                    const vMap: Record<string, string> = {};
                    vData.forEach(v => { if (v.plate) vMap[v.plate] = v.type; });
                    setVehicleMap(vMap);
                }
            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 60000);
        return () => clearInterval(interval);
    }, [garageId]);

    // ── Derived (global, unfiltered for KPIs) ──
    const todayMovements = useMemo(() => movements.filter(m => isToday(m.timestamp)), [movements]);
    const todayTotalRevenue = useMemo(() => todayMovements.reduce((a, m) => a + (Number(m.amount) || 0), 0), [todayMovements]);
    const activeStays = useMemo(() => stays.filter(s => s.active).sort((a, b) => new Date(b.entry_time).getTime() - new Date(a.entry_time).getTime()), [stays]);
    const entriesToday = useMemo(() => stays.filter(s => isToday(s.entry_time)).length, [stays]);
    const exitsToday = useMemo(() => stays.filter(s => !s.active && s.exit_time && isToday(s.exit_time)).length, [stays]);

    // ── Dropdown options (derived from data) ──
    const operatorOptions = useMemo(() => {
        const set = new Set<string>();
        movements.forEach(m => { const op = m.operator || m.operator_name; if (op) set.add(op); });
        return Array.from(set).sort();
    }, [movements]);

    const methodOptions = useMemo(() => {
        const set = new Set<string>();
        movements.forEach(m => { if (m.payment_method) set.add(m.payment_method); });
        return Array.from(set).sort();
    }, [movements]);

    const vehicleTypeOptions = useMemo(() => {
        const set = new Set<string>();
        activeStays.forEach(s => { if (s.vehicle_type) set.add(s.vehicle_type); });
        return Array.from(set).sort();
    }, [activeStays]);

    const movVehicleTypeOptions = useMemo(() => {
        const set = new Set<string>();
        movements.forEach(m => {
            if (m.plate && vehicleMap[m.plate]) set.add(vehicleMap[m.plate]);
        });
        return Array.from(set).sort();
    }, [movements, vehicleMap]);

    // ── Filtered lists ──
    const filteredMovements = useMemo(() => {
        let list = movements;
        if (movFilters.date) {
            list = list.filter(m => m.timestamp.startsWith(movFilters.date));
        }
        if (debouncedMovPlate) {
            const q = debouncedMovPlate.toUpperCase();
            list = list.filter(m => (m.plate || '').toUpperCase().includes(q));
        }
        if (movFilters.vehicleType) {
            list = list.filter(m => m.plate && vehicleMap[m.plate] === movFilters.vehicleType);
        }
        if (movFilters.tariffType) {
            list = list.filter(m => m.type === movFilters.tariffType);
        }
        if (movFilters.operator) {
            list = list.filter(m => (m.operator || m.operator_name) === movFilters.operator);
        }
        if (movFilters.method) {
            list = list.filter(m => m.payment_method === movFilters.method);
        }
        if (movFilters.amountMin) {
            const min = Number(movFilters.amountMin);
            if (!isNaN(min)) list = list.filter(m => (Number(m.amount) || 0) >= min);
        }
        if (movFilters.amountMax) {
            const max = Number(movFilters.amountMax);
            if (!isNaN(max)) list = list.filter(m => (Number(m.amount) || 0) <= max);
        }
        return list.slice(0, 100);
    }, [movements, movFilters.date, debouncedMovPlate, movFilters.vehicleType, movFilters.tariffType, movFilters.operator, movFilters.method, movFilters.amountMin, movFilters.amountMax, vehicleMap]);

    const filteredStays = useMemo(() => {
        let list = activeStays;
        if (debouncedStayPlate) {
            const q = debouncedStayPlate.toUpperCase();
            list = list.filter(s => s.plate.toUpperCase().includes(q));
        }
        if (stayFilters.vehicleType) {
            list = list.filter(s => s.vehicle_type === stayFilters.vehicleType);
        }
        if (stayFilters.timeRange) {
            list = list.filter(s => {
                const hrs = getTimeElapsedHours(s.entry_time);
                switch (stayFilters.timeRange) {
                    case '<1h': return hrs < 1;
                    case '1h-4h': return hrs >= 1 && hrs < 4;
                    case '4h-12h': return hrs >= 4 && hrs < 12;
                    case '>12h': return hrs >= 12;
                    default: return true;
                }
            });
        }
        return list;
    }, [activeStays, debouncedStayPlate, stayFilters.vehicleType, stayFilters.timeRange]);

    // ── Filter helpers ──
    const updateMovFilter = useCallback((key: keyof MovementFilters, value: string) => {
        setMovFilters(prev => ({ ...prev, [key]: value }));
    }, []);

    const updateStayFilter = useCallback((key: keyof StayFilters, value: string) => {
        setStayFilters(prev => ({ ...prev, [key]: value }));
    }, []);

    const resetMovFilters = useCallback(() => setMovFilters(EMPTY_MOV_FILTERS), []);
    const resetStayFilters = useCallback(() => setStayFilters(EMPTY_STAY_FILTERS), []);

    // ── Loading ──
    if (loading && movements.length === 0) {
        return (
            <div className="flex items-center justify-center h-full min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    // ═════════════════════════════════════════════════════════════════
    // RENDER
    // ═════════════════════════════════════════════════════════════════
    return (
        <div className="px-3 py-2 space-y-2 max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500">

            {/* ── Header compacto ── */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 min-w-0">
                    <Activity className="h-5 w-5 text-indigo-600 shrink-0" />
                    <h1 className="text-lg font-bold text-slate-900 truncate">Dashboard Operativo</h1>
                    <span className="hidden sm:inline text-slate-400 text-xs">·</span>
                    <span className="hidden sm:inline text-xs text-slate-400 truncate">Resumen en tiempo real</span>
                </div>
                <span className="text-[11px] text-slate-400 whitespace-nowrap shrink-0">
                    {new Date().toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
            </div>

            {/* ── Tabla Principal ── */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[calc(100vh-140px)]">

                {/* Tabs Header */}
                <div className="flex border-b border-slate-200 bg-slate-50/80 shrink-0">
                    <button
                        onClick={() => setActiveTab('movements')}
                        className={cn(
                            "flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all relative",
                            activeTab === 'movements'
                                ? "text-indigo-700 bg-white"
                                : "text-slate-500 hover:text-slate-700 hover:bg-slate-100/50"
                        )}
                    >
                        {activeTab === 'movements' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
                        <Wallet className="h-3.5 w-3.5" />
                        Movimientos
                        <span className={cn(
                            "py-0.5 px-1.5 rounded-full text-[9px] font-bold",
                            activeTab === 'movements' ? "bg-indigo-100 text-indigo-700" : "bg-slate-200 text-slate-500"
                        )}>
                            {filteredMovements.length}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('stays')}
                        className={cn(
                            "flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all relative border-l border-slate-200",
                            activeTab === 'stays'
                                ? "text-blue-700 bg-white"
                                : "text-slate-500 hover:text-slate-700 hover:bg-slate-100/50"
                        )}
                    >
                        {activeTab === 'stays' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
                        <Car className="h-3.5 w-3.5" />
                        En Playa
                        <span className={cn(
                            "py-0.5 px-1.5 rounded-full text-[9px] font-bold",
                            activeTab === 'stays' ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-500"
                        )}>
                            {activeStays.length}
                        </span>
                    </button>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-auto scrollbar-thin">
                    {activeTab === 'movements' ? (
                        <table className="w-full text-sm text-left">
                            <thead className="sticky top-0 z-20">
                                {/* Column names */}
                                <tr className="text-[10px] text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                                    <th className="px-4 py-2 font-semibold w-[90px]">Hora</th>
                                    <th className="px-4 py-2 font-semibold">Patente / Detalle</th>
                                    <th className="px-4 py-2 font-semibold">Operador</th>
                                    <th className="px-4 py-2 font-semibold">Método</th>
                                    <th className="px-4 py-2 font-semibold text-right">Monto</th>
                                </tr>
                                {/* Filter row — also sticky */}
                                <tr className="bg-white border-b border-slate-100">
                                    <td className="px-4 py-1.5 align-top">
                                        <input
                                            type="date"
                                            value={movFilters.date}
                                            onChange={e => updateMovFilter('date', e.target.value)}
                                            className="w-full text-xs bg-slate-50 border-none rounded-md px-1 py-1 text-slate-700 cursor-pointer focus:ring-1 focus:ring-indigo-500"
                                            title="Filtrar por fecha"
                                        />
                                    </td>
                                    <td className="px-4 py-1.5 align-top space-y-1.5">
                                        <div className="relative">
                                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                                            <input
                                                type="text"
                                                value={movFilters.plate}
                                                onChange={e => updateMovFilter('plate', e.target.value)}
                                                placeholder="Buscar patente…"
                                                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-md pl-7 pr-2 py-1 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                            />
                                        </div>
                                        <FilterSelect
                                            value={movFilters.vehicleType}
                                            onChange={v => updateMovFilter('vehicleType', v)}
                                            options={movVehicleTypeOptions}
                                            placeholder="Tipo de Vehículo"
                                        />
                                    </td>
                                    <td className="px-4 py-1.5 align-top">
                                        <FilterSelect
                                            value={movFilters.operator}
                                            onChange={v => updateMovFilter('operator', v)}
                                            options={operatorOptions}
                                            placeholder="Todos"
                                        />
                                    </td>
                                    <td className="px-4 py-1.5 align-top space-y-1.5">
                                        <FilterSelect
                                            value={movFilters.method}
                                            onChange={v => updateMovFilter('method', v)}
                                            options={methodOptions}
                                            placeholder="Cualquier Método"
                                        />
                                        <div className="relative">
                                            <select
                                                value={movFilters.tariffType}
                                                onChange={e => updateMovFilter('tariffType', e.target.value)}
                                                className="w-full appearance-none text-xs bg-slate-50 border border-slate-200 rounded-md pl-2 pr-6 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer truncate"
                                            >
                                                <option value="">Tipo de Tarifa</option>
                                                <option value="CobroEstadia">Estadía</option>
                                                <option value="CobroAbono">Abono</option>
                                            </select>
                                            <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                                        </div>
                                    </td>
                                    <td className="px-4 py-1.5 align-top">
                                        <div className="flex items-center gap-1">
                                            <input
                                                type="number"
                                                value={movFilters.amountMin}
                                                onChange={e => updateMovFilter('amountMin', e.target.value)}
                                                placeholder="Min"
                                                className="w-16 text-xs bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-right text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 no-spinner"
                                            />
                                            <span className="text-slate-300 text-[10px]">–</span>
                                            <input
                                                type="number"
                                                value={movFilters.amountMax}
                                                onChange={e => updateMovFilter('amountMax', e.target.value)}
                                                placeholder="Max"
                                                className="w-16 text-xs bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-right text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 no-spinner"
                                            />
                                        </div>
                                    </td>
                                </tr>
                                {/* Reset button row — only when filters active */}
                                {movFiltersActive && (
                                    <tr className="bg-indigo-50/50 border-b border-indigo-100">
                                        <td colSpan={5} className="px-4 py-1">
                                            <button
                                                onClick={resetMovFilters}
                                                className="flex items-center gap-1 text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                                            >
                                                <FilterX className="h-3 w-3" />
                                                Limpiar filtros
                                            </button>
                                        </td>
                                    </tr>
                                )}
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredMovements.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-8 text-center text-slate-400">
                                            <div className="flex flex-col items-center gap-1">
                                                <Inbox className="h-8 w-8 text-slate-200" />
                                                <p className="text-sm font-medium text-slate-500">
                                                    {movFiltersActive
                                                        ? movFilters.date ? 'No hay movimientos para esta fecha con estos filtros' : 'No se encontraron resultados para los filtros aplicados'
                                                        : 'No hay movimientos recientes'}
                                                </p>
                                                <p className="text-[11px] text-slate-400">
                                                    {movFiltersActive
                                                        ? 'Probá ajustar o limpiar los filtros.'
                                                        : 'Los cobros aparecerán aquí automáticamente.'}
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredMovements.map(move => (
                                        <tr key={move.id} className="hover:bg-indigo-50/30 transition-colors">
                                            <td className="px-4 py-2 text-xs text-slate-500 whitespace-nowrap">
                                                <span className="font-semibold text-slate-700">{formatTime24(move.timestamp)}</span>
                                                <span className="block text-[9px] text-slate-400">{formatDateDM(move.timestamp)}</span>
                                            </td>
                                            <td className="px-4 py-2">
                                                <div className="font-bold text-slate-800 font-mono text-[13px]">{move.plate || '---'}</div>
                                                <div className="text-[9px] uppercase text-indigo-600 font-medium">
                                                    {move.plate ? (vehicleMap[move.plate] || 'Vehículo') : move.type}
                                                </div>
                                            </td>
                                            <td className="px-4 py-2">
                                                <div className="flex items-center gap-1.5 text-slate-600 text-xs font-medium">
                                                    <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[9px] uppercase shrink-0">
                                                        {(move.operator || move.operator_name || 'S')[0]}
                                                    </div>
                                                    <span className="truncate max-w-[120px]">{move.operator || move.operator_name || 'Sistema'}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2">
                                                <span className={cn(
                                                    "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border",
                                                    (move.payment_method || '').toUpperCase() === 'EFECTIVO'
                                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                        : "bg-indigo-50 text-indigo-700 border-indigo-200"
                                                )}>
                                                    {move.payment_method || '---'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-right font-bold text-slate-900 font-mono text-sm">
                                                {formatCurrency(move.amount)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="sticky top-0 z-20">
                                {/* Column names */}
                                <tr className="text-[10px] text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                                    <th className="px-4 py-2 font-semibold">Patente</th>
                                    <th className="px-4 py-2 font-semibold">Tipo</th>
                                    <th className="px-4 py-2 font-semibold">Hora de Ingreso</th>
                                    <th className="px-4 py-2 font-semibold text-right">Tiempo</th>
                                </tr>
                                {/* Filter row */}
                                <tr className="bg-white border-b border-slate-100">
                                    <td className="px-4 py-1.5">
                                        <div className="relative">
                                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                                            <input
                                                type="text"
                                                value={stayFilters.plate}
                                                onChange={e => updateStayFilter('plate', e.target.value)}
                                                placeholder="Buscar patente…"
                                                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-md pl-7 pr-2 py-1 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                            />
                                        </div>
                                    </td>
                                    <td className="px-4 py-1.5">
                                        <FilterSelect
                                            value={stayFilters.vehicleType}
                                            onChange={v => updateStayFilter('vehicleType', v)}
                                            options={vehicleTypeOptions}
                                            placeholder="Todos"
                                        />
                                    </td>
                                    <td className="px-4 py-1.5">
                                        {/* No filter for entry time */}
                                    </td>
                                    <td className="px-4 py-1.5">
                                        <FilterSelect
                                            value={stayFilters.timeRange}
                                            onChange={v => updateStayFilter('timeRange', v)}
                                            options={['<1h', '1h-4h', '4h-12h', '>12h']}
                                            placeholder="Todos"
                                        />
                                    </td>
                                </tr>
                                {/* Reset button row */}
                                {stayFiltersActive && (
                                    <tr className="bg-blue-50/50 border-b border-blue-100">
                                        <td colSpan={4} className="px-4 py-1">
                                            <button
                                                onClick={resetStayFilters}
                                                className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                                            >
                                                <FilterX className="h-3 w-3" />
                                                Limpiar filtros
                                            </button>
                                        </td>
                                    </tr>
                                )}
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredStays.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="py-8 text-center text-slate-400">
                                            <div className="flex flex-col items-center gap-1">
                                                <Car className="h-8 w-8 text-slate-200" />
                                                <p className="text-sm font-medium text-slate-500">
                                                    {stayFiltersActive
                                                        ? 'No se encontraron resultados para los filtros aplicados'
                                                        : 'La playa está completamente vacía'}
                                                </p>
                                                <p className="text-[11px] text-slate-400">
                                                    {stayFiltersActive
                                                        ? 'Probá ajustar o limpiar los filtros.'
                                                        : 'Acá verás los vehículos que ingresen al garaje.'}
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredStays.map(stay => (
                                        <tr key={stay.id} className="hover:bg-blue-50/30 transition-colors">
                                            <td className="px-4 py-2">
                                                <span className="font-bold text-slate-800 font-mono text-[13px] px-2 py-0.5 bg-white rounded border border-slate-300 uppercase">
                                                    {stay.plate}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2">
                                                <span className="text-[10px] font-bold text-slate-600 uppercase bg-slate-100 px-1.5 py-0.5 rounded">
                                                    {stay.vehicle_type || 'Vehículo'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-xs text-slate-600 font-medium">
                                                {formatTime24(stay.entry_time)}
                                                <span className="ml-1.5 text-[10px] text-slate-400">{formatDateDM(stay.entry_time)}</span>
                                            </td>
                                            <td className="px-4 py-2 text-right">
                                                <div className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 font-bold text-[11px] rounded border border-blue-100">
                                                    <Clock className="h-3 w-3" />
                                                    {getTimeElapsed(stay.entry_time)}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
