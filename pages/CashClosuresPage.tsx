import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
    Banknote, Search, Loader2, AlertCircle,
    CheckCircle2, Clock, History, ArrowDownCircle, ChevronRight, Calculator
} from 'lucide-react';
import SectionHeader from '../components/hub/SectionHeader';

// --- Interfaces ---
interface ShiftClose {
    id: string;
    garage_id: string;
    created_at: string;
    operator: string | null;
    total_in_cash: number;
    staying_in_cash: number;
    is_withdrawn: boolean;
    withdrawn_by_name: string | null;
}

interface PartialClose {
    id: string;
    garage_id: string;
    created_at: string;
    operator: string | null;
    amount: number;
    recipient_name: string | null;
    notes: string | null;
    is_withdrawn: boolean;
    withdrawn_by_name: string | null;
}

interface Movement {
    id: string;
    garage_id: string;
    amount: number;
    payment_method?: string;
    timestamp: string;
}

type UnifiedWithdrawn = {
    id: string;
    created_at: string;
    operator: string | null;
    withdrawn_by_name: string | null;
    type: 'Cierre de Turno' | 'Retiro Parcial';
    amount: number;
    detail: string;
    total_in_cash?: number;
    staying_in_cash?: number;
    rendered_amount?: number;
};

type TabKey = 'computo' | 'shifts' | 'partials' | 'history';

// ---- Helper ----
function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function formatCurrency(amount: number) {
    return `$${Number(amount || 0).toLocaleString('es-AR')}`;
}

export default function CashClosuresPage() {
    const { garageId } = useParams<{ garageId: string }>();

    const [loading, setLoading] = useState(true);
    const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [shiftCloses, setShiftCloses] = useState<ShiftClose[]>([]);
    const [partialCloses, setPartialCloses] = useState<PartialClose[]>([]);
    const [movements, setMovements] = useState<Movement[]>([]);

    const [activeTab, setActiveTab] = useState<TabKey>('computo');
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [expandedHistoryIds, setExpandedHistoryIds] = useState<Set<string>>(new Set());

    const toggleExpandHistory = (id: string) => {
        setExpandedHistoryIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // --- Data Fetching ---
    const fetchData = async () => {
        if (!garageId) return;
        setLoading(true);
        setError(null);
        try {
            const [shiftsRes, partialsRes, movementsRes] = await Promise.all([
                supabase.from('shift_closes').select('*').eq('garage_id', garageId).order('created_at', { ascending: false }),
                supabase.from('partial_closes').select('*').eq('garage_id', garageId).order('created_at', { ascending: false }),
                supabase.from('movements').select('id, garage_id, amount, payment_method, timestamp').eq('garage_id', garageId).order('timestamp', { ascending: false }),
            ]);
            if (shiftsRes.error) throw shiftsRes.error;
            if (partialsRes.error) throw partialsRes.error;
            if (movementsRes.error) throw movementsRes.error;
            setShiftCloses(shiftsRes.data as ShiftClose[] || []);
            setPartialCloses(partialsRes.data as PartialClose[] || []);
            setMovements(movementsRes.data as Movement[] || []);
        } catch (err: any) {
            setError('Error al cargar los datos: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [garageId]);

    // --- Withdraw Actions ---
    const handleWithdrawShift = async (id: string) => {
        setWithdrawingId(id);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const withdrawnByName = user?.user_metadata?.full_name || user?.email || 'Administrador';

            const { error } = await supabase
                .from('shift_closes')
                .update({ is_withdrawn: true, withdrawn_by_name: withdrawnByName })
                .eq('id', id)
                .eq('garage_id', garageId);
            if (error) throw error;
            setShiftCloses(prev => prev.map(s => s.id === id ? { ...s, is_withdrawn: true, withdrawn_by_name: withdrawnByName } : s));
        } catch (err: any) {
            setError('Error al retirar: ' + err.message);
        } finally {
            setWithdrawingId(null);
        }
    };

    const handleWithdrawPartial = async (id: string) => {
        setWithdrawingId(id);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const withdrawnByName = user?.user_metadata?.full_name || user?.email || 'Administrador';

            const { error } = await supabase
                .from('partial_closes')
                .update({ is_withdrawn: true, withdrawn_by_name: withdrawnByName })
                .eq('id', id)
                .eq('garage_id', garageId);
            if (error) throw error;
            setPartialCloses(prev => prev.map(p => p.id === id ? { ...p, is_withdrawn: true, withdrawn_by_name: withdrawnByName } : p));
        } catch (err: any) {
            setError('Error al retirar: ' + err.message);
        } finally {
            setWithdrawingId(null);
        }
    };

    // --- Filtering helpers ---
    const applyFilters = <T extends { operator: string | null; created_at: string }>(items: T[]) => {
        return items.filter(item => {
            const matchesSearch = !searchTerm ||
                (item.operator || '').toLowerCase().includes(searchTerm.toLowerCase());
            const itemDate = new Date(item.created_at);
            const matchesFrom = !dateFrom || itemDate >= new Date(dateFrom);
            const matchesTo = !dateTo || itemDate <= new Date(dateTo + 'T23:59:59');
            return matchesSearch && matchesFrom && matchesTo;
        });
    };

    const pendingShifts = useMemo(() =>
        applyFilters(shiftCloses.filter(s => !s.is_withdrawn)),
        [shiftCloses, searchTerm, dateFrom, dateTo]
    );

    const pendingPartials = useMemo(() =>
        applyFilters(partialCloses.filter(p => !p.is_withdrawn)),
        [partialCloses, searchTerm, dateFrom, dateTo]
    );

    const withdrawnHistory = useMemo((): UnifiedWithdrawn[] => {
        const shifts: UnifiedWithdrawn[] = shiftCloses
            .filter(s => s.is_withdrawn)
            .map(s => ({
                id: s.id,
                created_at: s.created_at,
                operator: s.operator,
                withdrawn_by_name: s.withdrawn_by_name,
                type: 'Cierre de Turno',
                amount: s.total_in_cash - s.staying_in_cash,
                detail: `Total recaudado: ${formatCurrency(s.total_in_cash)}`,
                total_in_cash: s.total_in_cash,
                staying_in_cash: s.staying_in_cash,
                rendered_amount: s.total_in_cash - s.staying_in_cash,
            }));
        const partials: UnifiedWithdrawn[] = partialCloses
            .filter(p => p.is_withdrawn)
            .map(p => ({
                id: p.id,
                created_at: p.created_at,
                operator: p.operator,
                withdrawn_by_name: p.withdrawn_by_name,
                type: 'Retiro Parcial',
                amount: p.amount,
                detail: (p.recipient_name && p.notes) ? `${p.recipient_name} - ${p.notes}` : p.recipient_name ? `Nombre: ${p.recipient_name}` : (p.notes || '-'),
            }));
        const combined = [...shifts, ...partials]
            .filter(item => {
                const matchesSearch = !searchTerm ||
                    (item.operator || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (item.withdrawn_by_name || '').toLowerCase().includes(searchTerm.toLowerCase());
                const itemDate = new Date(item.created_at);
                const matchesFrom = !dateFrom || itemDate >= new Date(dateFrom);
                const matchesTo = !dateTo || itemDate <= new Date(dateTo + 'T23:59:59');
                return matchesSearch && matchesFrom && matchesTo;
            });
        return combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [shiftCloses, partialCloses, searchTerm, dateFrom, dateTo]);

    // --- Cómputo Rows ---
    const computoRows = useMemo(() => {
        // Sort shift closes ascending to calculate "Abre Caja Con" correctly
        const sorted = [...shiftCloses].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

        const rows = sorted.map((sc, i) => {
            const inicio = i === 0 ? 0 : new Date(sorted[i - 1].created_at).getTime();
            const fin = new Date(sc.created_at).getTime();

            // Filter movements: > previo && <= actual
            const turnoMovements = movements.filter(m => {
                const t = new Date(m.timestamp).getTime();
                return t > inicio && t <= fin;
            });

            // Filter partial closes: > previo && <= actual
            const turnoPartials = partialCloses.filter(p => {
                const t = new Date(p.created_at).getTime();
                return t > inicio && t <= fin;
            });

            const facturacionBank = turnoMovements
                .filter(m => (m.payment_method || '').toUpperCase() !== 'EFECTIVO')
                .reduce((sum, m) => sum + (Number(m.amount) || 0), 0);

            const cobroEFT = turnoMovements
                .filter(m => (m.payment_method || '').toUpperCase() === 'EFECTIVO')
                .reduce((sum, m) => sum + (Number(m.amount) || 0), 0);

            const abreCajaCon = i === 0 ? 0 : sorted[i - 1].staying_in_cash;
            const dejaEnCaja = sc.staying_in_cash;
            const cierreDeCaja = sc.total_in_cash - sc.staying_in_cash;
            const cierresParciales = turnoPartials.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
            const totalOperador = cierreDeCaja + cierresParciales;
            const totalSistema = cobroEFT + abreCajaCon - dejaEnCaja;
            const resultado = totalOperador - totalSistema;

            return {
                id: sc.id,
                fecha: sc.created_at,
                operador: sc.operator,
                facturacionBank,
                cobroEFT,
                abreCajaCon,
                dejaEnCaja,
                cierreDeCaja,
                cierresParciales,
                totalOperador,
                totalSistema,
                resultado,
            };
        });

        // Display descending (most recent first), then apply filters
        return rows.reverse().filter(row => {
            const matchesSearch = !searchTerm ||
                (row.operador || '').toLowerCase().includes(searchTerm.toLowerCase());
            const rowDate = new Date(row.fecha);
            const matchesFrom = !dateFrom || rowDate >= new Date(dateFrom);
            const matchesTo = !dateTo || rowDate <= new Date(dateTo + 'T23:59:59');
            return matchesSearch && matchesFrom && matchesTo;
        });
    }, [shiftCloses, partialCloses, movements, searchTerm, dateFrom, dateTo]);

    const tabs: { key: TabKey; label: string; icon: React.ElementType; count?: number }[] = [
        { key: 'computo', label: 'Cómputo', icon: Calculator },
        { key: 'shifts', label: 'Cierres de Turno', icon: Clock, count: pendingShifts.length },
        { key: 'partials', label: 'Retiros Parciales', icon: ArrowDownCircle, count: pendingPartials.length },
        { key: 'history', label: 'Historial de Retirados', icon: History },
    ];

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <SectionHeader title="Cierres de Caja" icon={Banknote} iconColor="emerald" />

            {/* Error Banner */}
            {error && (
                <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {error}
                </div>
            )}

            {/* Filters Bar */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <div className="relative flex-1 min-w-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por operador..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                    />
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">Desde</label>
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={e => setDateFrom(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                    />
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">Hasta</label>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={e => setDateTo(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                    />
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Tab Header */}
                <div className="flex border-b border-slate-200 bg-slate-50/50 overflow-x-auto">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${isActive
                                    ? 'border-emerald-600 text-emerald-700 bg-white'
                                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                                    }`}
                            >
                                <Icon className={`h-4 w-4 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                                {tab.label}
                                {tab.count !== undefined && tab.count > 0 && (
                                    <span className={`inline-flex items-center justify-center text-[10px] font-black px-1.5 py-0.5 rounded-full ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Tab: Cómputo */}
                {activeTab === 'computo' && (
                    <div className="animate-in fade-in overflow-x-auto">
                        <table className="w-full text-sm text-left min-w-[1100px]">
                            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                                <tr>
                                    <th className="px-4 py-3">Fecha</th>
                                    <th className="px-4 py-3">Operador</th>
                                    <th className="px-4 py-3 text-right">Fact. Bank</th>
                                    <th className="px-4 py-3 text-right">Cobro EFT</th>
                                    <th className="px-4 py-3 text-right">Abre Caja Con</th>
                                    <th className="px-4 py-3 text-right">Deja en Caja</th>
                                    <th className="px-4 py-3 text-right">Cierre De Caja</th>
                                    <th className="px-4 py-3 text-right">Cierres Parciales</th>
                                    <th className="px-4 py-3 text-right">Total Operador</th>
                                    <th className="px-4 py-3 text-right">Total Sistema</th>
                                    <th className="px-4 py-3 text-right">Resultado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {computoRows.length === 0 && (
                                    <tr>
                                        <td colSpan={11} className="px-5 py-12 text-center">
                                            <Calculator className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                                            <p className="text-slate-400 font-medium">No hay cómputos disponibles.</p>
                                        </td>
                                    </tr>
                                )}
                                {computoRows.map(row => (
                                    <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                                        <td className="px-4 py-3.5 text-slate-600 text-xs whitespace-nowrap">{formatDate(row.fecha)}</td>
                                        <td className="px-4 py-3.5">
                                            <span className="font-semibold text-slate-800">{row.operador || <span className="text-slate-400 italic">Sin nombre</span>}</span>
                                        </td>
                                        <td className="px-4 py-3.5 text-right text-slate-500 text-xs">{formatCurrency(row.facturacionBank)}</td>
                                        <td className="px-4 py-3.5 text-right text-slate-700 font-semibold text-xs">{formatCurrency(row.cobroEFT)}</td>
                                        <td className="px-4 py-3.5 text-right text-slate-500 text-xs">{formatCurrency(row.abreCajaCon)}</td>
                                        <td className="px-4 py-3.5 text-right text-slate-500 text-xs">{formatCurrency(row.dejaEnCaja)}</td>
                                        <td className="px-4 py-3.5 text-right font-bold text-slate-700 text-xs">{formatCurrency(row.cierreDeCaja)}</td>
                                        <td className="px-4 py-3.5 text-right text-slate-500 text-xs">{formatCurrency(row.cierresParciales)}</td>
                                        <td className="px-4 py-3.5 text-right font-bold text-slate-800 text-xs">{formatCurrency(row.totalOperador)}</td>
                                        <td className="px-4 py-3.5 text-right font-bold text-slate-800 text-xs">{formatCurrency(row.totalSistema)}</td>
                                        <td className="px-4 py-3.5 text-right">
                                            <span className={`font-black text-xs px-2.5 py-1 rounded-lg border ${row.resultado < 0
                                                    ? 'text-red-700 bg-red-50 border-red-200'
                                                    : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                                }`}>
                                                {formatCurrency(row.resultado)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Tab: Cierres de Turno */}
                {activeTab === 'shifts' && (
                    <div className="animate-in fade-in overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                                <tr>
                                    <th className="px-5 py-3">Fecha</th>
                                    <th className="px-5 py-3">Operador</th>
                                    <th className="px-5 py-3 text-right">Total Recaudado</th>
                                    <th className="px-5 py-3 text-right">Dejó en Caja</th>
                                    <th className="px-5 py-3 text-right">Total Rendido</th>
                                    <th className="px-5 py-3 text-center">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {pendingShifts.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-5 py-12 text-center">
                                            <CheckCircle2 className="h-10 w-10 text-emerald-300 mx-auto mb-3" />
                                            <p className="text-slate-400 font-medium">No hay cierres de turno pendientes de retiro.</p>
                                        </td>
                                    </tr>
                                )}
                                {pendingShifts.map(row => {
                                    const totalRendido = row.total_in_cash - row.staying_in_cash;
                                    const isWithdrawing = withdrawingId === row.id;
                                    return (
                                        <tr key={row.id} className="hover:bg-slate-50/70 transition-colors group">
                                            <td className="px-5 py-3.5 text-slate-600 text-xs whitespace-nowrap">{formatDate(row.created_at)}</td>
                                            <td className="px-5 py-3.5">
                                                <span className="font-semibold text-slate-800">{row.operator || <span className="text-slate-400 italic">Sin nombre</span>}</span>
                                            </td>
                                            <td className="px-5 py-3.5 text-right font-bold text-slate-700">{formatCurrency(row.total_in_cash)}</td>
                                            <td className="px-5 py-3.5 text-right text-slate-500">{formatCurrency(row.staying_in_cash)}</td>
                                            <td className="px-5 py-3.5 text-right">
                                                <span className="font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg text-xs">
                                                    {formatCurrency(totalRendido)}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-center">
                                                <button
                                                    onClick={() => handleWithdrawShift(row.id)}
                                                    disabled={isWithdrawing}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                                                >
                                                    {isWithdrawing
                                                        ? <Loader2 className="h-3 w-3 animate-spin" />
                                                        : <ChevronRight className="h-3 w-3" />
                                                    }
                                                    Retirar
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Tab: Retiros Parciales */}
                {activeTab === 'partials' && (
                    <div className="animate-in fade-in overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                                <tr>
                                    <th className="px-5 py-3">Fecha</th>
                                    <th className="px-5 py-3">Operador</th>
                                    <th className="px-5 py-3 text-right">Monto</th>
                                    <th className="px-5 py-3">Receptor</th>
                                    <th className="px-5 py-3">Notas</th>
                                    <th className="px-5 py-3 text-center">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {pendingPartials.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-5 py-12 text-center">
                                            <CheckCircle2 className="h-10 w-10 text-emerald-300 mx-auto mb-3" />
                                            <p className="text-slate-400 font-medium">No hay retiros parciales pendientes.</p>
                                        </td>
                                    </tr>
                                )}
                                {pendingPartials.map(row => {
                                    const isWithdrawing = withdrawingId === row.id;
                                    return (
                                        <tr key={row.id} className="hover:bg-slate-50/70 transition-colors group">
                                            <td className="px-5 py-3.5 text-slate-600 text-xs whitespace-nowrap">{formatDate(row.created_at)}</td>
                                            <td className="px-5 py-3.5">
                                                <span className="font-semibold text-slate-800">{row.operator || <span className="text-slate-400 italic">Sin nombre</span>}</span>
                                            </td>
                                            <td className="px-5 py-3.5 text-right font-black text-emerald-700">{formatCurrency(row.amount)}</td>
                                            <td className="px-5 py-3.5 text-slate-600">{row.recipient_name || <span className="text-slate-400">—</span>}</td>
                                            <td className="px-5 py-3.5 text-slate-500 text-xs max-w-[200px] truncate">{row.notes || <span className="text-slate-300">—</span>}</td>
                                            <td className="px-5 py-3.5 text-center">
                                                <button
                                                    onClick={() => handleWithdrawPartial(row.id)}
                                                    disabled={isWithdrawing}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                                                >
                                                    {isWithdrawing
                                                        ? <Loader2 className="h-3 w-3 animate-spin" />
                                                        : <ChevronRight className="h-3 w-3" />
                                                    }
                                                    Retirar
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Tab: Historial de Retirados */}
                {activeTab === 'history' && (
                    <div className="animate-in fade-in overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                                <tr>
                                    <th className="px-5 py-3">Fecha</th>
                                    <th className="px-5 py-3">Tipo</th>
                                    <th className="px-5 py-3">Retiró</th>
                                    <th className="px-5 py-3 text-right">Monto Retirado</th>
                                    <th className="px-5 py-3">Detalle</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {withdrawnHistory.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-5 py-12 text-center">
                                            <History className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                                            <p className="text-slate-400 font-medium">No hay registros retirados aún.</p>
                                        </td>
                                    </tr>
                                )}
                                {withdrawnHistory.map(row => {
                                    const isExpanded = expandedHistoryIds.has(row.id);
                                    return (
                                        <React.Fragment key={`${row.type}-${row.id}`}>
                                            <tr className="hover:bg-slate-50/70 transition-colors">
                                                <td className="px-5 py-3.5 text-slate-600 text-xs whitespace-nowrap">{formatDate(row.created_at)}</td>
                                                <td className="px-5 py-3.5">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${row.type === 'Cierre de Turno'
                                                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                        : 'bg-amber-50 text-amber-700 border-amber-200'
                                                        }`}>
                                                        {row.type}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3.5 font-semibold text-slate-800">
                                                    {row.withdrawn_by_name || <span className="text-slate-400 italic">Sin nombre</span>}
                                                </td>
                                                <td className="px-5 py-3.5 text-right font-black text-slate-700">{formatCurrency(row.amount)}</td>
                                                <td className="px-5 py-3.5 text-slate-500 text-xs">
                                                    <div className="flex items-center justify-between">
                                                        <span className="truncate max-w-[200px] inline-block">{row.detail || <span className="text-slate-300">—</span>}</span>
                                                        {row.type === 'Cierre de Turno' && (
                                                            <button
                                                                onClick={() => toggleExpandHistory(row.id)}
                                                                className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 transition-colors ml-2"
                                                                title={isExpanded ? "Ocultar detalles" : "Ver detalles"}
                                                            >
                                                                <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                            {isExpanded && row.type === 'Cierre de Turno' && (
                                                <tr className="bg-slate-50/50 border-t border-slate-100">
                                                    <td colSpan={5} className="px-5 py-4">
                                                        <div className="flex flex-wrap items-center justify-start sm:justify-end gap-x-8 gap-y-4 px-4 border-l-2 border-emerald-500 bg-white p-3 rounded-lg shadow-sm border border-slate-200 ml-4 sm:ml-0">
                                                            <div>
                                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Operador Original</p>
                                                                <p className="text-sm font-semibold text-slate-700">{row.operator || <span className="text-slate-400 italic">Sin nombre</span>}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Recaudado</p>
                                                                <p className="text-sm font-bold text-slate-700">{formatCurrency(row.total_in_cash || 0)}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Dejó en Caja</p>
                                                                <p className="text-sm font-medium text-slate-500">{formatCurrency(row.staying_in_cash || 0)}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Rendido</p>
                                                                <span className="font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-xs inline-block">
                                                                    {formatCurrency(row.rendered_amount || 0)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
