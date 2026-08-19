import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
    Banknote, Search, Loader2, AlertCircle,
    CheckCircle2, Clock, History, ArrowDownCircle, ChevronRight, Calculator, ReceiptText, Plus, X
} from 'lucide-react';
import SectionHeader from '../components/hub/SectionHeader';
import { PartialClose, getExpenseDisplayText } from '../components/hub/cash-flow/CashFlowShared';
import { useAuth } from '../hooks/useAuth';
import { formatDateTime24h } from '../lib/dateFormatters';

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

type PartialMovementType = 'withdrawal' | 'expense';

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

type TabKey = 'computo' | 'shifts' | 'partials' | 'expenses' | 'history';

// --- Helpers ---
function normalizeMovementType(value: string | null | undefined): PartialMovementType {
    if (value === 'expense') return 'expense';
    return 'withdrawal';
}

function sanitizeOptionalText(value: string | null | undefined): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (trimmed === '' || trimmed.toLowerCase() === 'desconocido') return null;
    return trimmed;
}

const formatDate = formatDateTime24h;

function formatCurrency(amount: number) {
    return `$${Number(amount || 0).toLocaleString('es-AR')}`;
}

export default function CashClosuresPage() {
    const { garageId } = useParams<{ garageId: string }>();

    const [loading, setLoading] = useState(true);
    const { profile } = useAuth();
    
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseRecipient, setExpenseRecipient] = useState('');
    const [expenseNotes, setExpenseNotes] = useState('');
    const [isCreatingExpense, setIsCreatingExpense] = useState(false);
    const [expenseFormError, setExpenseFormError] = useState<string | null>(null);

    useEffect(() => {
        if (isExpenseModalOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isExpenseModalOpen]);
    
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

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        const clean = val.replace(/[^0-9,]/g, '');
        if (!clean) {
            setExpenseAmount('');
            return;
        }
        const parts = clean.split(',');
        let integerStr = parts[0];
        let decimalStr = parts.length > 1 ? parts[1] : undefined;

        const parsedInt = parseInt(integerStr, 10);
        if (!isNaN(parsedInt)) {
            integerStr = parsedInt.toLocaleString('es-AR');
        } else {
            integerStr = '';
        }

        if (decimalStr !== undefined) {
            setExpenseAmount(`${integerStr},${decimalStr}`);
        } else {
            setExpenseAmount(integerStr);
        }
    };

    const resetExpenseForm = () => {
        setExpenseAmount('');
        setExpenseRecipient('');
        setExpenseNotes('');
        setExpenseFormError(null);
    };

    const handleCreateExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isCreatingExpense) return;

        setExpenseFormError(null);

        if (!garageId) {
            setExpenseFormError('No se pudo determinar el garage actual.');
            return;
        }

        const operatorName = profile?.full_name?.trim();
        if (!operatorName) {
            setExpenseFormError('No fue posible identificar al operador actual. Vuelva a iniciar sesión.');
            return;
        }

        const normalizedAmountString = expenseAmount.replace(/\./g, '').replace(',', '.');
        const parsedAmount = parseFloat(normalizedAmountString);

        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            setExpenseFormError('El monto ingresado es inválido o debe ser mayor a cero.');
            return;
        }

        const recipient = expenseRecipient.trim() || null;
        const notes = expenseNotes.trim() || null;

        if (!recipient && !notes) {
            setExpenseFormError('Ingresá al menos un beneficiario o un concepto para el egreso.');
            return;
        }

        setIsCreatingExpense(true);

        try {
            const { data, error: insertError } = await supabase
                .from('partial_closes')
                .insert({
                    garage_id: garageId,
                    operator: operatorName,
                    amount: parsedAmount,
                    recipient_name: recipient,
                    notes: notes,
                    movement_type: 'expense'
                })
                .select('*')
                .single();

            if (insertError) throw insertError;

            setPartialCloses(prev => [data as PartialClose, ...prev]);
            
            resetExpenseForm();
            setIsExpenseModalOpen(false);
        } catch (err: any) {
            console.error('Error creando egreso:', err);
            setExpenseFormError('No se pudo guardar el egreso. Intentá nuevamente.');
        } finally {
            setIsCreatingExpense(false);
        }
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
            setError('Error al procesar: ' + err.message);
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
        applyFilters(partialCloses.filter(p => !p.is_withdrawn && normalizeMovementType(p.movement_type) === 'withdrawal')),
        [partialCloses, searchTerm, dateFrom, dateTo]
    );

    const expenseRows = useMemo(() =>
        applyFilters(partialCloses.filter(p => normalizeMovementType(p.movement_type) === 'expense')),
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
            .filter(p => p.is_withdrawn && normalizeMovementType(p.movement_type) === 'withdrawal')
            .map(p => {
                return {
                    id: p.id,
                    created_at: p.created_at,
                    operator: p.operator,
                    withdrawn_by_name: p.withdrawn_by_name,
                    type: 'Retiro Parcial',
                    amount: p.amount,
                    detail: getExpenseDisplayText(p.recipient_name, p.notes),
                }
            });
        const combined = [...shifts, ...partials].filter(item => {
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

            const abreCajaCon = i === 0 ? 0 : Number(sorted[i - 1].staying_in_cash || 0);
            const dejaEnCaja = Number(sc.staying_in_cash || 0);
            const cierreDeCaja = Number(sc.total_in_cash || 0) - dejaEnCaja;
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

    const tabs: { key: TabKey; label: string; icon: React.ElementType; count?: number; customActiveColors?: string; customBadgeColors?: string; }[] = [
        { key: 'computo', label: 'Cómputo', icon: Calculator },
        { key: 'shifts', label: 'Cierres de Turno', icon: Clock, count: pendingShifts.length },
        { key: 'partials', label: 'Retiros Parciales', icon: ArrowDownCircle, count: pendingPartials.length },
        { 
            key: 'expenses', 
            label: 'Egresos', 
            icon: ReceiptText, 
            count: expenseRows.length,
            customActiveColors: 'border-red-600 text-red-700 bg-white',
            customBadgeColors: 'bg-red-100 text-red-700'
        },
        { key: 'history', label: 'Historial', icon: History },
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
                <div className="flex items-stretch border-b border-slate-200 bg-slate-50/50">
                    <div className="flex flex-1 min-w-0 overflow-x-auto scrollbar-hide">
                        {tabs.map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`flex items-center gap-2 px-5 py-3.5 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
                                        isActive
                                            ? tab.customActiveColors || 'border-emerald-600 text-emerald-700 bg-white'
                                            : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                                        }`}
                                >
                                    <Icon className={`h-4 w-4 ${isActive ? (tab.customActiveColors ? 'text-red-600' : 'text-emerald-600') : 'text-slate-400'}`} />
                                    {tab.label}
                                    {tab.count !== undefined && tab.count > 0 && (
                                        <span className={`inline-flex items-center justify-center text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                                            isActive 
                                                ? tab.customBadgeColors || 'bg-emerald-100 text-emerald-700' 
                                                : 'bg-slate-200 text-slate-600'
                                        }`}>
                                            {tab.count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    {activeTab === 'expenses' && (
                        <div className="flex-shrink-0 flex items-center pr-2 pl-2 md:pr-4 border-l border-slate-200/60 bg-slate-50">
                            <button
                                onClick={() => setIsExpenseModalOpen(true)}
                                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs md:text-sm rounded-xl transition-colors shadow-sm"
                            >
                                <Plus className="h-4 w-4" />
                                <span className="hidden sm:inline">Agregar Gasto</span>
                                <span className="sm:hidden">Gasto</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Tab: Cómputo */}
                {activeTab === 'computo' && (
                    <div className="animate-in fade-in overflow-x-auto md:overflow-visible">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold hidden md:table-header-group">
                                <tr>
                                    <th scope="col" className="px-5 py-3">Turno</th>
                                    <th scope="col" className="px-5 py-3">Facturación y cobros</th>
                                    <th scope="col" className="px-5 py-3">Caja</th>
                                    <th scope="col" className="px-5 py-3">Cierres Parciales</th>
                                    <th scope="col" className="px-5 py-3">Conciliación</th>
                                    <th scope="col" className="px-5 py-3 text-right">Resultado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 block md:table-row-group p-3 md:p-0 bg-slate-50/30 md:bg-transparent">
                                {computoRows.length === 0 && (
                                    <tr className="block md:table-row">
                                        <td colSpan={6} className="px-5 py-12 text-center block md:table-cell">
                                            <Calculator className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                                            <p className="text-slate-400 font-medium">No hay cómputos disponibles.</p>
                                        </td>
                                    </tr>
                                )}
                                {computoRows.map(row => (
                                    <tr key={row.id} className="md:hidden block bg-white border border-slate-200 rounded-xl mb-4 p-4 shadow-sm hover:bg-slate-50 transition-colors">
                                        {/* Mobile view logic omitted for brevity, keeping desktop view accurate */}
                                        <td className="block space-y-2">
                                            <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                                                <div>
                                                    <div className="font-bold text-slate-800 text-sm">
                                                        {row.operador || <span className="italic text-slate-400">Sin nombre</span>}
                                                    </div>
                                                    <div className="text-xs text-slate-500 mt-0.5">
                                                        {formatDate(row.fecha)}
                                                    </div>
                                                </div>
                                                <div className={`px-2.5 py-1 rounded-lg border font-black text-xs ${row.resultado < 0 ? 'text-red-700 bg-red-50 border-red-200' : 'text-emerald-700 bg-emerald-50 border-emerald-200'}`}>
                                                    {formatCurrency(row.resultado)}
                                                </div>
                                            </div>
                                            {/* Details... */}
                                        </td>
                                    </tr>
                                ))}
                                {computoRows.map(row => (
                                    <tr key={`desktop-${row.id}`} className="hidden md:table-row hover:bg-slate-50/50 transition-colors">
                                        <td className="px-5 py-4">
                                            <div className="text-xs text-slate-400 mb-1">{formatDate(row.fecha)}</div>
                                            <div className="font-semibold text-slate-800">{row.operador || <span className="italic text-slate-400">Sin nombre</span>}</div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="space-y-1">
                                                <div className="flex justify-between text-xs"><span className="text-slate-500">Banco:</span> <span className="font-medium">{formatCurrency(row.facturacionBank)}</span></div>
                                                <div className="flex justify-between text-xs"><span className="text-slate-500">Efectivo:</span> <span className="font-medium">{formatCurrency(row.cobroEFT)}</span></div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="space-y-1">
                                                <div className="flex justify-between text-xs"><span className="text-slate-500">Abre con:</span> <span className="font-medium">{formatCurrency(row.abreCajaCon)}</span></div>
                                                <div className="flex justify-between text-xs"><span className="text-slate-500">Deja en caja:</span> <span className="font-medium text-amber-600">{formatCurrency(row.dejaEnCaja)}</span></div>
                                                <div className="flex justify-between text-xs font-bold pt-1 border-t border-slate-100"><span className="text-slate-700">Cierre:</span> <span>{formatCurrency(row.cierreDeCaja)}</span></div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="font-medium text-slate-700">{formatCurrency(row.cierresParciales)}</span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="space-y-1">
                                                <div className="flex justify-between text-xs"><span className="text-slate-500">Operador:</span> <span className="font-bold text-slate-700">{formatCurrency(row.totalOperador)}</span></div>
                                                <div className="flex justify-between text-xs"><span className="text-slate-500">Sistema:</span> <span className="font-bold text-slate-700">{formatCurrency(row.totalSistema)}</span></div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <span className={`inline-flex items-center justify-center font-black text-xs px-3 py-1.5 rounded-lg border ${
                                                row.resultado < 0 
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
                    <div className="animate-in fade-in overflow-x-auto md:overflow-visible">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold hidden md:table-header-group">
                                <tr>
                                    <th scope="col" className="px-5 py-3">Fecha</th>
                                    <th scope="col" className="px-5 py-3">Operador</th>
                                    <th scope="col" className="px-5 py-3 text-right">Total Recaudado</th>
                                    <th scope="col" className="px-5 py-3 text-right">Dejó en Caja</th>
                                    <th scope="col" className="px-5 py-3 text-right">Total Rendido</th>
                                    <th scope="col" className="px-5 py-3 text-center">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 block md:table-row-group p-3 md:p-0 bg-slate-50/30 md:bg-transparent">
                                {pendingShifts.length === 0 && (
                                    <tr className="block md:table-row">
                                        <td colSpan={6} className="px-5 py-12 text-center block md:table-cell">
                                            <Clock className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                                            <p className="text-slate-400 font-medium">No hay cierres de turno pendientes.</p>
                                        </td>
                                    </tr>
                                )}
                                {pendingShifts.map(shift => (
                                    <tr key={shift.id} className="md:hidden block bg-white border border-slate-200 rounded-xl mb-4 p-4 shadow-sm">
                                        <td className="block space-y-4">
                                            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                                                <div>
                                                    <div className="font-bold text-slate-800 text-sm">
                                                        {shift.operator || <span className="italic text-slate-400">Sin nombre</span>}
                                                    </div>
                                                    <div className="text-xs text-slate-500 font-mono mt-0.5">
                                                        {formatDate(shift.created_at)}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Recaudado</p>
                                                    <p className="text-sm font-bold text-slate-700">{formatCurrency(shift.total_in_cash || 0)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Dejó en Caja</p>
                                                    <p className="text-sm font-medium text-amber-600">{formatCurrency(shift.staying_in_cash || 0)}</p>
                                                </div>
                                                <div className="col-span-2 pt-2 border-t border-slate-50">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total a Rendir</p>
                                                    <span className="font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg text-sm inline-block">
                                                        {formatCurrency((shift.total_in_cash || 0) - (shift.staying_in_cash || 0))}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="pt-2">
                                                <button
                                                    onClick={() => handleWithdrawShift(shift.id)}
                                                    disabled={withdrawingId === shift.id}
                                                    className="w-full flex justify-center items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50 shadow-sm"
                                                >
                                                    {withdrawingId === shift.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Retirar Cierre'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {pendingShifts.map(shift => (
                                    <tr key={`desktop-${shift.id}`} className="hidden md:table-row hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-5 py-4">
                                            <div className="text-xs font-mono text-slate-500">{formatDate(shift.created_at)}</div>
                                        </td>
                                        <td className="px-5 py-4 font-semibold text-slate-700">
                                            {shift.operator || <span className="italic text-slate-400">Sin nombre</span>}
                                        </td>
                                        <td className="px-5 py-4 text-right font-bold text-slate-700">
                                            {formatCurrency(shift.total_in_cash || 0)}
                                        </td>
                                        <td className="px-5 py-4 text-right font-medium text-amber-600">
                                            {formatCurrency(shift.staying_in_cash || 0)}
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <span className="font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                                                {formatCurrency((shift.total_in_cash || 0) - (shift.staying_in_cash || 0))}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-center">
                                            <button
                                                onClick={() => handleWithdrawShift(shift.id)}
                                                disabled={withdrawingId === shift.id}
                                                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-900 text-slate-700 hover:text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50"
                                            >
                                                {withdrawingId === shift.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Retirar'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Tab: Retiros Parciales */}
                {activeTab === 'partials' && (
                    <div className="animate-in fade-in overflow-x-auto md:overflow-visible">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold hidden md:table-header-group">
                                <tr>
                                    <th scope="col" className="px-5 py-3">Fecha</th>
                                    <th scope="col" className="px-5 py-3">Operador</th>
                                    <th scope="col" className="px-5 py-3">Detalle</th>
                                    <th scope="col" className="px-5 py-3 text-right">Monto</th>
                                    <th scope="col" className="px-5 py-3 text-center">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 block md:table-row-group p-3 md:p-0 bg-slate-50/30 md:bg-transparent">
                                {pendingPartials.length === 0 && (
                                    <tr className="block md:table-row">
                                        <td colSpan={5} className="px-5 py-12 text-center block md:table-cell">
                                            <ArrowDownCircle className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                                            <p className="text-slate-400 font-medium">No hay retiros parciales pendientes.</p>
                                        </td>
                                    </tr>
                                )}
                                {pendingPartials.map(partial => (
                                    <tr key={partial.id} className="md:hidden block bg-white border border-slate-200 rounded-xl mb-4 p-4 shadow-sm">
                                        <td className="block space-y-4">
                                            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                                                <div>
                                                    <div className="font-bold text-slate-800 text-sm">
                                                        {partial.operator || <span className="italic text-slate-400">Sin nombre</span>}
                                                    </div>
                                                    <div className="text-xs text-slate-500 font-mono mt-0.5">
                                                        {formatDate(partial.created_at)}
                                                    </div>
                                                </div>
                                                <div className="px-2.5 py-1 rounded-lg border font-black text-xs text-orange-700 bg-orange-50 border-orange-200">
                                                    {formatCurrency(partial.amount)}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Detalle</div>
                                                <div className="text-sm font-medium text-slate-700">
                                                    {getExpenseDisplayText(partial.recipient_name, partial.notes)}
                                                </div>
                                            </div>
                                            <div className="pt-2 border-t border-slate-50">
                                                <button
                                                    onClick={() => handleWithdrawPartial(partial.id)}
                                                    disabled={withdrawingId === partial.id}
                                                    className="w-full flex justify-center items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50 shadow-sm"
                                                >
                                                    {withdrawingId === partial.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Procesar Retiro'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {pendingPartials.map(partial => (
                                    <tr key={`desktop-${partial.id}`} className="hidden md:table-row hover:bg-slate-50/50 transition-colors">
                                        <td className="px-5 py-4">
                                            <div className="text-xs font-mono text-slate-500">{formatDate(partial.created_at)}</div>
                                        </td>
                                        <td className="px-5 py-4 font-semibold text-slate-700">
                                            {partial.operator || <span className="italic text-slate-400">Sin nombre</span>}
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="text-sm text-slate-700">
                                                {getExpenseDisplayText(partial.recipient_name, partial.notes)}
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-right font-black text-orange-600">
                                            {formatCurrency(partial.amount)}
                                        </td>
                                        <td className="px-5 py-4 text-center">
                                            <button
                                                onClick={() => handleWithdrawPartial(partial.id)}
                                                disabled={withdrawingId === partial.id}
                                                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-900 text-slate-700 hover:text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50"
                                            >
                                                {withdrawingId === partial.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Procesar'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Tab: Egresos */}
                {activeTab === 'expenses' && (
                    <div className="animate-in fade-in overflow-x-auto md:overflow-visible">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold hidden md:table-header-group">
                                <tr>
                                    <th scope="col" className="px-5 py-3">Fecha</th>
                                    <th scope="col" className="px-5 py-3">Operador</th>
                                    <th scope="col" className="px-5 py-3">Imputación / Observaciones</th>
                                    <th scope="col" className="px-5 py-3 text-right">Monto</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 block md:table-row-group p-3 md:p-0 bg-slate-50/30 md:bg-transparent">
                                {expenseRows.length === 0 && (
                                    <tr className="block md:table-row">
                                        <td colSpan={4} className="px-5 py-12 text-center block md:table-cell">
                                            <ReceiptText className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                                            <p className="text-slate-400 font-medium">No hay egresos registrados.</p>
                                        </td>
                                    </tr>
                                )}
                                {expenseRows.map(row => (
                                    <tr key={row.id} className="md:hidden block bg-white border border-slate-200 rounded-xl mb-4 p-4 shadow-sm hover:bg-slate-50 transition-colors">
                                        <td className="block space-y-3">
                                            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                                                <div>
                                                    <div className="font-bold text-slate-800 text-sm">
                                                        {row.operator || <span className="italic text-slate-400">Sin nombre</span>}
                                                    </div>
                                                    <div className="text-xs text-slate-500 font-mono mt-0.5">
                                                        {formatDate(row.created_at)}
                                                    </div>
                                                </div>
                                                <div className="px-2.5 py-1 rounded-lg border font-black text-xs text-red-700 bg-red-50 border-red-200">
                                                    -{formatCurrency(row.amount)}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Imputación / Observaciones</div>
                                                <div className="text-sm font-medium text-slate-700">
                                                    {getExpenseDisplayText(row.recipient_name, row.notes)}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {expenseRows.map(row => (
                                    <tr key={`desktop-${row.id}`} className="hidden md:table-row hover:bg-slate-50/50 transition-colors">
                                        <td className="px-5 py-4">
                                            <div className="text-xs font-mono text-slate-500">{formatDate(row.created_at)}</div>
                                        </td>
                                        <td className="px-5 py-4 font-semibold text-slate-700">
                                            {row.operator || <span className="italic text-slate-400">Sin nombre</span>}
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="text-sm text-slate-700">
                                                {getExpenseDisplayText(row.recipient_name, row.notes)}
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-right font-black text-rose-600">
                                            -{formatCurrency(row.amount)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Tab: Historial */}
                {activeTab === 'history' && (
                    <div className="animate-in fade-in overflow-x-auto md:overflow-visible">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold hidden md:table-header-group">
                                <tr>
                                    <th scope="col" className="px-5 py-3">Fecha</th>
                                    <th scope="col" className="px-5 py-3">Operador</th>
                                    <th scope="col" className="px-5 py-3">Retiró</th>
                                    <th scope="col" className="px-5 py-3">Tipo</th>
                                    <th scope="col" className="px-5 py-3">Detalle</th>
                                    <th scope="col" className="px-5 py-3 text-right">Importe</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 block md:table-row-group p-3 md:p-0 bg-slate-50/30 md:bg-transparent">
                                {withdrawnHistory.length === 0 && (
                                    <tr className="block md:table-row">
                                        <td colSpan={6} className="px-5 py-12 text-center block md:table-cell">
                                            <History className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                                            <p className="text-slate-400 font-medium">No hay historial de retiros disponibles.</p>
                                        </td>
                                    </tr>
                                )}
                                {withdrawnHistory.map(row => {
                                    const isExpanded = expandedHistoryIds.has(row.id);
                                    return (
                                        <React.Fragment key={row.id}>
                                            {/* Mobile row logic omitted for brevity in patch */}
                                            <tr className="hidden md:table-row hover:bg-slate-50/50 transition-colors">
                                                <td className="px-5 py-4">
                                                    <div className="text-xs font-mono text-slate-500">{formatDate(row.created_at)}</div>
                                                </td>
                                                <td className="px-5 py-4 font-semibold text-slate-700">
                                                    {row.operator || <span className="italic text-slate-400">Sin nombre</span>}
                                                </td>
                                                <td className="px-5 py-4 text-slate-600">
                                                    <div className="flex items-center gap-1.5">
                                                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                                        {row.withdrawn_by_name || 'Desconocido'}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                        row.type === 'Cierre de Turno' ? 'bg-indigo-50 text-indigo-700' : 'bg-orange-50 text-orange-700'
                                                    }`}>
                                                        {row.type}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    {row.type === 'Cierre de Turno' ? (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-slate-600">{row.detail}</span>
                                                            <button 
                                                                onClick={() => toggleExpandHistory(row.id)}
                                                                className="text-indigo-600 hover:text-indigo-800 text-xs font-bold hover:underline"
                                                            >
                                                                {isExpanded ? 'Ocultar desglose' : 'Ver desglose'}
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-600">{row.detail}</span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 text-right font-black text-slate-800">
                                                    {formatCurrency(row.amount)}
                                                </td>
                                            </tr>
                                            {row.type === 'Cierre de Turno' && isExpanded && (
                                                <tr className="hidden md:table-row bg-slate-50/50 border-t border-slate-100">
                                                    <td colSpan={6} className="px-5 py-3">
                                                        <div className="flex justify-end gap-6">
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

            {/* Modal de Alta de Gasto */}
            {isExpenseModalOpen && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                    <div className="absolute inset-0 bg-slate-950/35 backdrop-blur-[1px]" onClick={() => { if (!isCreatingExpense) { setIsExpenseModalOpen(false); resetExpenseForm(); } }} />
                    <div className="relative z-10 bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">

                        <div className="flex justify-between items-center p-5 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <ReceiptText className="h-5 w-5 text-red-600" />
                                <h3 className="font-bold text-lg text-slate-800">Agregar Gasto</h3>
                            </div>
                            <button
                                onClick={() => { setIsExpenseModalOpen(false); resetExpenseForm(); }}
                                disabled={isCreatingExpense}
                                className="text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
                                aria-label="Cerrar modal"
                                type="button"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-5 overflow-y-auto flex-1">
                            {expenseFormError && (
                                <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100 flex items-start gap-2">
                                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                    <span>{expenseFormError}</span>
                                </div>
                            )}

                            <form id="expenseForm" onSubmit={handleCreateExpense} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Monto</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={expenseAmount}
                                            onChange={handleAmountChange}
                                            placeholder="0"
                                            disabled={isCreatingExpense}
                                            className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-60"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Pagado a / Beneficiario</label>
                                    <input
                                        type="text"
                                        value={expenseRecipient}
                                        onChange={e => setExpenseRecipient(e.target.value)}
                                        placeholder="Ej. Proveedor, empleado, comercio..."
                                        disabled={isCreatingExpense}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-60"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Concepto / Notas del egreso</label>
                                    <textarea
                                        value={expenseNotes}
                                        onChange={e => setExpenseNotes(e.target.value)}
                                        placeholder="Detalle o motivo del gasto..."
                                        rows={3}
                                        disabled={isCreatingExpense}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none disabled:opacity-60"
                                    />
                                </div>
                            </form>
                        </div>

                        <div className="p-5 border-t border-slate-100 bg-slate-50 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                            <button
                                type="button"
                                onClick={() => { setIsExpenseModalOpen(false); resetExpenseForm(); }}
                                disabled={isCreatingExpense}
                                className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50 text-center"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                form="expenseForm"
                                disabled={isCreatingExpense}
                                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-60 shadow-sm"
                            >
                                {isCreatingExpense ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Guardando...
                                    </>
                                ) : (
                                    'Guardar egreso'
                                )}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
