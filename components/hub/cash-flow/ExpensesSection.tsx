import React, { useState, useMemo, useEffect } from 'react';
import { Plus, X, CheckCircle2, BadgeDollarSign, Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Calendar } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { Garage } from '../../../types';
import { cn, formatCurrency, formatDate, Expense } from './CashFlowShared';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const IMPUTATION_OPTIONS = [
    'Artículos de Limpieza',
    'Mantenimiento General',
    'Feriados y otros Cubre-Francos',
    'Gratificación',
    'Gastos de Oficina',
    'Combustible',
    'Movilidad',
    'Librería',
    'Anticipos de Sueldo',
] as const;

const OTHER_GARAGE_VALUE = '__other__';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Returns today's date in YYYY-MM-DD format using local timezone */
function getLocalDateString(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// ─────────────────────────────────────────────────────────────
// Props Interface
// ─────────────────────────────────────────────────────────────

interface ExpensesSectionProps {
    garages: Garage[];
    expenses: Expense[];
    selectedGarageId: string;
    profile: { id: string; full_name?: string | null; email?: string | null } | null;
    onExpenseCreated: (expense: Expense) => void;
    getGarageName: (id: string | null, customName?: string | null) => string;
    GarageFilter?: React.ReactNode;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export default function ExpensesSection({
    garages,
    expenses,
    selectedGarageId,
    profile,
    onExpenseCreated,
    getGarageName,
}: ExpensesSectionProps) {
    // ── Modal state ──
    const [isModalOpen, setIsModalOpen] = useState(false);

    // ── Form state ──
    const [formGarageId, setFormGarageId] = useState(selectedGarageId !== 'all' ? selectedGarageId : '');
    const [formCustomGarageName, setFormCustomGarageName] = useState('');
    const [formDate, setFormDate] = useState(getLocalDateString);
    const [formImputation, setFormImputation] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formAmountStr, setFormAmountStr] = useState('');
    const [saving, setSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [formErrors, setFormErrors] = useState<{ garageId?: boolean; imputation?: boolean; amount?: boolean }>({});

    // ── Table state ──
    const [searchQuery, setSearchQuery] = useState('');
    const [tableGarageFilter, setTableGarageFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<{ key: 'date' | 'garage' | 'imputation' | 'amount'; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
    const ITEMS_PER_PAGE = 25;

    // ── Sync form garage when global filter changes ──
    useEffect(() => {
        if (selectedGarageId !== 'all') {
            setFormGarageId(selectedGarageId);
        }
    }, [selectedGarageId]);

    // ── Lock body scroll when modal is open ──
    useEffect(() => {
        if (isModalOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isModalOpen]);

    // ── Reset page on filter change ──
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, tableGarageFilter]);

    // ─────────────────────────────────────────────────────────
    // Filtered + Sorted Expenses
    // ─────────────────────────────────────────────────────────

    const filteredExpenses = useMemo(() => {
        let filtered = [...expenses];

        if (searchQuery.trim() !== '') {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(e =>
                (e.imputation || '').toLowerCase().includes(q) ||
                (e.description || '').toLowerCase().includes(q) ||
                getGarageName(e.garage_id, e.custom_garage_name).toLowerCase().includes(q)
            );
        }

        if (tableGarageFilter !== 'all') {
            filtered = filtered.filter(e => e.garage_id === tableGarageFilter);
        }

        filtered.sort((a, b) => {
            let valA: any, valB: any;
            if (sortConfig.key === 'date') {
                valA = new Date(a.expense_date).getTime();
                valB = new Date(b.expense_date).getTime();
            } else if (sortConfig.key === 'garage') {
                valA = getGarageName(a.garage_id, a.custom_garage_name).toLowerCase();
                valB = getGarageName(b.garage_id, b.custom_garage_name).toLowerCase();
            } else if (sortConfig.key === 'imputation') {
                valA = (a.imputation || '').toLowerCase();
                valB = (b.imputation || '').toLowerCase();
            } else if (sortConfig.key === 'amount') {
                valA = a.amount;
                valB = b.amount;
            }
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return filtered;
    }, [expenses, searchQuery, tableGarageFilter, sortConfig, getGarageName]);

    const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / ITEMS_PER_PAGE));
    const paginatedExpenses = filteredExpenses.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    const emptyRowsCount = ITEMS_PER_PAGE - paginatedExpenses.length;

    // ─────────────────────────────────────────────────────────
    // Form Handlers
    // ─────────────────────────────────────────────────────────

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        if (!rawValue) {
            setFormAmountStr('');
            return;
        }
        const formatted = new Intl.NumberFormat('es-AR').format(parseInt(rawValue, 10));
        setFormAmountStr(formatted);
        if (formErrors.amount) setFormErrors(prev => ({ ...prev, amount: false }));
    };

    const showSuccess = (msg: string) => {
        setSuccessMessage(msg);
        setTimeout(() => setSuccessMessage(''), 3000);
    };

    const resetForm = () => {
        setFormGarageId(selectedGarageId !== 'all' ? selectedGarageId : '');
        setFormCustomGarageName('');
        setFormDate(getLocalDateString());
        setFormImputation('');
        setFormDescription('');
        setFormAmountStr('');
        setFormErrors({});
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const rawAmount = parseFloat(formAmountStr.replace(/\./g, ''));

        const errors = {
            garageId: !formGarageId,
            imputation: !formImputation,
            amount: isNaN(rawAmount) || rawAmount <= 0,
        };
        setFormErrors(errors);
        if (Object.values(errors).some(Boolean)) return;

        setSaving(true);
        try {
            const isOtherGarage = formGarageId === OTHER_GARAGE_VALUE;

            // Build the expense_date as an ISO string from the local date
            // We parse formDate as local midnight to avoid UTC-3 day shifting
            const [year, month, day] = formDate.split('-').map(Number);
            const localDate = new Date(year, month - 1, day, 12, 0, 0); // noon to avoid any edge

            const payload = {
                garage_id: isOtherGarage ? null : formGarageId,
                custom_garage_name: isOtherGarage ? (formCustomGarageName.trim() || 'Otro') : null,
                owner_id: profile?.id || '',
                template_id: null,
                imputation: formImputation,
                description: formDescription.trim() || null,
                amount: rawAmount,
                expense_type: 'fixed',
                expense_date: localDate.toISOString(),
                created_by: profile?.full_name || 'Sistema',
            };

            const { data, error } = await supabase
                .from('expenses')
                .insert(payload)
                .select('*')
                .single();

            if (error) throw error;
            if (data) {
                onExpenseCreated(data as Expense);
                showSuccess('Egreso registrado correctamente');
                resetForm();
                setIsModalOpen(false);
            }
        } catch (err) {
            console.error('Error creating expense:', err);
        } finally {
            setSaving(false);
        }
    };

    // ─────────────────────────────────────────────────────────
    // Sort handler
    // ─────────────────────────────────────────────────────────

    const handleSort = (key: typeof sortConfig.key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc',
        }));
    };

    const SortIcon = ({ column }: { column: typeof sortConfig.key }) => {
        if (sortConfig.key !== column) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
        return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
    };

    // ─────────────────────────────────────────────────────────
    // Style helpers
    // ─────────────────────────────────────────────────────────

    const getInputClass = (hasError?: boolean) => cn(
        "w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm text-slate-800 outline-none transition-all",
        hasError
            ? "border-red-400 ring-2 ring-red-500/20 bg-red-50/50"
            : "border-slate-200 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10"
    );

    const labelClasses = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1';

    const todayStr = getLocalDateString();

    // ─────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────

    return (
        <>
            <div className="animate-in fade-in duration-300">
                <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">

                    {/* ── Header: Search + Filters + Register Button ── */}
                    <div className="px-4 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="relative flex-1 min-w-[180px] max-w-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search className="w-4 h-4 text-slate-400" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Buscar egresos..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                                />
                            </div>

                            {/* Garage filter — native select */}
                            <div className="relative">
                                <select
                                    value={tableGarageFilter}
                                    onChange={e => setTableGarageFilter(e.target.value)}
                                    className="appearance-none bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 pl-3 pr-8 py-1.5 cursor-pointer transition-all"
                                >
                                    <option value="all">Todos los Garajes</option>
                                    {garages.map(g => (
                                        <option key={g.id} value={g.id}>{g.name}</option>
                                    ))}
                                </select>
                                <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
                                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => { resetForm(); setIsModalOpen(true); }}
                            className="shrink-0 flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-900 shadow-sm shadow-slate-200 transition-all"
                        >
                            <Plus className="w-4 h-4" />
                            Registrar Egreso
                        </button>
                    </div>

                    {/* ── Expense History Table ── */}
                    <div>
                        <table className="w-full text-sm text-left">
                            <thead className="text-[10px] text-slate-500 uppercase bg-slate-50/95">
                                <tr>
                                    <th
                                        className="px-4 py-2 font-semibold cursor-pointer hover:bg-slate-100 transition-colors"
                                        onClick={() => handleSort('date')}
                                    >
                                        <div className="flex items-center gap-1">Fecha <SortIcon column="date" /></div>
                                    </th>
                                    <th
                                        className="px-4 py-2 font-semibold cursor-pointer hover:bg-slate-100 transition-colors"
                                        onClick={() => handleSort('garage')}
                                    >
                                        <div className="flex items-center gap-1">Garaje <SortIcon column="garage" /></div>
                                    </th>
                                    <th
                                        className="px-4 py-2 font-semibold cursor-pointer hover:bg-slate-100 transition-colors"
                                        onClick={() => handleSort('imputation')}
                                    >
                                        <div className="flex items-center gap-1">Imputación <SortIcon column="imputation" /></div>
                                    </th>
                                    <th className="px-4 py-2 font-semibold">Observaciones</th>
                                    <th
                                        className="px-4 py-2 font-semibold text-right cursor-pointer hover:bg-slate-100 transition-colors"
                                        onClick={() => handleSort('amount')}
                                    >
                                        <div className="flex items-center justify-end gap-1">Importe <SortIcon column="amount" /></div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredExpenses.length === 0 ? (
                                    <>
                                        <tr className="h-[52px] border-b border-slate-100">
                                            <td colSpan={5} className="text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <BadgeDollarSign className="h-4 w-4 text-slate-300" />
                                                    <span className="text-sm font-medium text-slate-400">
                                                        {searchQuery ? 'No se encontraron resultados' : 'No hay egresos registrados'}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                        {Array.from({ length: ITEMS_PER_PAGE - 1 }).map((_, i) => (
                                            <tr key={`empty-${i}`} className="h-[52px] bg-transparent border-b border-slate-50 last:border-0" />
                                        ))}
                                    </>
                                ) : (
                                    <>
                                        {paginatedExpenses.map(expense => (
                                            <tr key={expense.id} className="h-[52px] border-b border-slate-100 last:border-0 bg-white hover:bg-slate-50/80 transition-colors group">
                                                <td className="px-4">
                                                    <span className="text-xs font-mono font-medium text-slate-500">
                                                        {formatDate(expense.expense_date, false)}
                                                    </span>
                                                </td>
                                                <td className="px-4">
                                                    <span className="text-xs font-semibold text-slate-600">
                                                        {getGarageName(expense.garage_id, expense.custom_garage_name)}
                                                    </span>
                                                </td>
                                                <td className="px-4">
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600">
                                                        <ClipboardList className="w-3 h-3" />
                                                        {expense.imputation || '—'}
                                                    </span>
                                                </td>
                                                <td className="px-4">
                                                    <span className="text-sm text-slate-500">
                                                        {expense.description || '—'}
                                                    </span>
                                                </td>
                                                <td className="px-4 text-right">
                                                    <span className="font-mono font-bold text-rose-600/90 text-sm bg-rose-50/50 group-hover:bg-rose-50 px-2 py-0.5 rounded-lg transition-colors inline-block">
                                                        -{formatCurrency(expense.amount)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                        {emptyRowsCount > 0 && Array.from({ length: emptyRowsCount }).map((_, i) => (
                                            <tr key={`empty-${i}`} className="h-[52px] bg-transparent border-b border-slate-50 last:border-0" />
                                        ))}
                                    </>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* ── Footer: count + pagination ── */}
                    <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <span className="text-xs text-slate-400">
                            {filteredExpenses.length} {filteredExpenses.length === 1 ? 'egreso' : 'egresos'}
                        </span>
                        {totalPages > 1 && (
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className={cn("p-1 rounded-md transition-colors", currentPage === 1 ? "text-slate-300 cursor-not-allowed" : "text-slate-500 hover:bg-slate-100")}
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className="text-xs font-medium text-slate-500 tabular-nums px-2">
                                    Página {currentPage} de {totalPages}
                                </span>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className={cn("p-1 rounded-md transition-colors", currentPage === totalPages ? "text-slate-300 cursor-not-allowed" : "text-slate-500 hover:bg-slate-100")}
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════
                MODAL — Registrar Egreso
               ═══════════════════════════════════════════════════════════ */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">

                        {/* Modal Header */}
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-slate-800 text-white">
                                    <Plus className="h-4 w-4" />
                                </div>
                                Registrar Egreso
                            </h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body — Form */}
                        <form onSubmit={handleSubmit} className="p-5 space-y-4">

                            {successMessage && (
                                <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 font-medium animate-in fade-in duration-200">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                                    {successMessage}
                                </div>
                            )}

                            {/* 1. Garaje Asignado */}
                            <div>
                                <label className={labelClasses}>Garaje Asignado</label>
                                <div className="flex gap-2">
                                    <select
                                        value={formGarageId}
                                        onChange={e => { setFormGarageId(e.target.value); if (formErrors.garageId) setFormErrors(prev => ({ ...prev, garageId: false })); }}
                                        className={cn(
                                            getInputClass(formErrors.garageId),
                                            formGarageId === OTHER_GARAGE_VALUE ? 'w-1/2' : 'w-full'
                                        )}
                                    >
                                        <option value="" disabled hidden>Seleccionar garaje…</option>
                                        {garages.map(g => (
                                            <option key={g.id} value={g.id}>{g.name}</option>
                                        ))}
                                        <option value={OTHER_GARAGE_VALUE}>Otro</option>
                                    </select>
                                    {formGarageId === OTHER_GARAGE_VALUE && (
                                        <input
                                            type="text"
                                            value={formCustomGarageName}
                                            onChange={e => setFormCustomGarageName(e.target.value)}
                                            placeholder="Nombre de la sucursal"
                                            className={cn(getInputClass(), 'w-1/2 animate-in fade-in slide-in-from-left-2 duration-200')}
                                        />
                                    )}
                                </div>
                                {formErrors.garageId && <p className="text-[11px] text-red-500 mt-1 font-medium">Este campo es obligatorio</p>}
                            </div>

                            {/* 2. Fecha */}
                            <div>
                                <label className={labelClasses}>Fecha</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Calendar className="h-4 w-4 text-slate-400" />
                                    </div>
                                    <input
                                        type="date"
                                        value={formDate}
                                        onChange={e => setFormDate(e.target.value)}
                                        max={todayStr}
                                        className={cn(getInputClass(), 'pl-9')}
                                    />
                                </div>
                            </div>

                            {/* 3. Imputación */}
                            <div>
                                <label className={labelClasses}>Imputación</label>
                                <select
                                    value={formImputation}
                                    onChange={e => { setFormImputation(e.target.value); if (formErrors.imputation) setFormErrors(prev => ({ ...prev, imputation: false })); }}
                                    className={getInputClass(formErrors.imputation)}
                                >
                                    <option value="">Seleccionar imputación…</option>
                                    {IMPUTATION_OPTIONS.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                                {formErrors.imputation && <p className="text-[11px] text-red-500 mt-1 font-medium">Seleccione una imputación</p>}
                            </div>

                            {/* 4. Observaciones (Opcional) */}
                            <div>
                                <label className={labelClasses}>
                                    Observaciones <span className="text-slate-300 font-normal normal-case">(opcional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={formDescription}
                                    onChange={e => setFormDescription(e.target.value)}
                                    placeholder="Detalle adicional..."
                                    className={getInputClass()}
                                />
                            </div>

                            {/* 5. Importe */}
                            <div>
                                <label className={labelClasses}>Importe</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <span className="text-slate-400 font-bold text-sm">$</span>
                                    </div>
                                    <input
                                        type="text"
                                        value={formAmountStr}
                                        onChange={handleAmountChange}
                                        placeholder="0"
                                        className={cn(getInputClass(formErrors.amount), 'pl-8 font-mono font-medium')}
                                    />
                                </div>
                                {formErrors.amount && <p className="text-[11px] text-red-500 mt-1 font-medium">Ingrese un importe válido</p>}
                            </div>

                            {/* Submit */}
                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className={cn(
                                        'w-full py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2',
                                        saving
                                            ? 'bg-slate-100 text-slate-400 cursor-wait'
                                            : 'bg-slate-800 text-white hover:bg-slate-900 shadow-md shadow-slate-200'
                                    )}
                                >
                                    {saving ? (
                                        <>
                                            <div className="h-4 w-4 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
                                            Registrando…
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="w-4 h-4" />
                                            Registrar Egreso
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
