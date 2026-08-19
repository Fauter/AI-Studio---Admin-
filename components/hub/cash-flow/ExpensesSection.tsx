import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X, CheckCircle2, BadgeDollarSign, Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, ReceiptText, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { Garage } from '../../../types';
import { cn, formatCurrency, Expense } from './CashFlowShared';
import { formatDateTime24h } from '../../../lib/dateFormatters';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function buildExpenseDetail(imputation: string | null | undefined, observations: string | null | undefined): string {
    const i = imputation?.trim();
    const o = observations?.trim();

    if (i && o) return `${i} - ${o}`;
    if (i) return i;
    if (o) return o;

    return '—';
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
    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseRecipient, setExpenseRecipient] = useState('');
    const [expenseNotes, setExpenseNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [expenseFormError, setExpenseFormError] = useState<string | null>(null);

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

    const showSuccess = (msg: string) => {
        setSuccessMessage(msg);
        setTimeout(() => setSuccessMessage(''), 3000);
    };

    const resetForm = () => {
        setFormGarageId(selectedGarageId !== 'all' ? selectedGarageId : '');
        setExpenseAmount('');
        setExpenseRecipient('');
        setExpenseNotes('');
        setExpenseFormError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (saving) return;

        setExpenseFormError(null);

        if (!formGarageId) {
            setExpenseFormError('Por favor, seleccioná un garaje.');
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

        setSaving(true);
        try {
            const nowIso = new Date().toISOString();
            const payload = {
                garage_id: formGarageId,
                operator: operatorName,
                amount: parsedAmount,
                recipient_name: recipient,
                notes: notes,
                movement_type: 'expense',
                timestamp: nowIso
            };

            const { data, error } = await supabase
                .from('partial_closes')
                .insert(payload)
                .select('*')
                .single();

            if (error) throw error;
            if (data) {
                const mappedExpense: Expense = {
                    id: data.id,
                    garage_id: data.garage_id,
                    owner_id: '',
                    template_id: undefined,
                    description: data.notes || '',
                    imputation: data.recipient_name || '',
                    custom_garage_name: '',
                    amount: data.amount,
                    expense_type: data.movement_type,
                    expense_date: data.timestamp || data.created_at,
                    created_at: data.created_at,
                    created_by: data.operator
                };
                onExpenseCreated(mappedExpense);
                showSuccess('Egreso registrado correctamente');
                resetForm();
                setIsModalOpen(false);
            }
        } catch (err) {
            console.error('Error creating expense:', err);
            setExpenseFormError('No se pudo guardar el egreso. Intentá nuevamente.');
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
    // Render
    // ─────────────────────────────────────────────────────────

    return (
        <>
            <div className="animate-in fade-in duration-300">
                <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">

                    {/* ── Header: Search + Filters + Register Button ── */}
                    <div className="px-4 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3 w-full">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0 flex-1 w-full">
                            <div className="relative flex-1 min-w-[180px] sm:max-w-sm w-full">
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
                            <div className="relative w-full sm:w-auto">
                                <select
                                    value={tableGarageFilter}
                                    onChange={e => setTableGarageFilter(e.target.value)}
                                    className="appearance-none bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 pl-3 pr-8 py-1.5 w-full cursor-pointer transition-all"
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
                            className="shrink-0 flex justify-center items-center gap-2 px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-900 shadow-sm shadow-slate-200 transition-all w-full sm:w-auto"
                        >
                            <Plus className="w-4 h-4" />
                            Registrar Egreso
                        </button>
                    </div>

                    {/* ── Expense History Table ── */}
                    <div>
                        <table className="w-full text-sm text-left">
                            <thead className="text-[10px] text-slate-500 uppercase bg-slate-50/95 hidden md:table-header-group">
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
                                        <div className="flex items-center gap-1">Imputación / Observaciones <SortIcon column="imputation" /></div>
                                    </th>
                                    <th
                                        className="px-4 py-2 font-semibold text-right cursor-pointer hover:bg-slate-100 transition-colors"
                                        onClick={() => handleSort('amount')}
                                    >
                                        <div className="flex items-center justify-end gap-1">Importe <SortIcon column="amount" /></div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 block md:table-row-group">
                                {filteredExpenses.length === 0 ? (
                                    <>
                                        <tr className="h-[52px] border-b border-slate-100">
                                            <td colSpan={4} className="text-center">
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
                                            <tr key={expense.id} className="flex flex-col md:table-row py-3 px-4 md:py-0 md:px-0 border-b border-slate-100 bg-white hover:bg-slate-50/80 transition-colors group">
                                                {/* Mobile Wrap */}
                                                <td className="md:hidden flex flex-col w-full">
                                                    {/* Renglón 1 */}
                                                    <div className="flex justify-start gap-2 items-center mb-2">
                                                        <span className="text-rose-600 font-mono font-bold shrink-0 text-sm">
                                                            -{formatCurrency(expense.amount)}
                                                        </span>
                                                        <span className="text-slate-300 font-light">|</span>
                                                        <span className="font-bold text-slate-800 text-sm truncate">
                                                            {buildExpenseDetail(expense.imputation, expense.description)}
                                                        </span>
                                                    </div>
                                                    {/* Renglón 2 */}
                                                    <div className="flex flex-col text-xs space-y-1">
                                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                            {getGarageName(expense.garage_id, expense.custom_garage_name)}
                                                        </span>
                                                        <span className="text-slate-400">
                                                            {formatDateTime24h(expense.expense_date)}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Desktop Cells */}
                                                <td className="hidden md:table-cell px-4 h-[52px]">
                                                    <span className="text-xs font-mono font-medium text-slate-500">
                                                        {formatDateTime24h(expense.expense_date)}
                                                    </span>
                                                </td>
                                                <td className="hidden md:table-cell px-4 h-[52px]">
                                                    <span className="text-xs font-semibold text-slate-600">
                                                        {getGarageName(expense.garage_id, expense.custom_garage_name)}
                                                    </span>
                                                </td>
                                                <td className="hidden md:table-cell px-4 h-[52px]">
                                                    <span className="inline-flex items-center gap-1.5 text-sm text-slate-700">
                                                        <ClipboardList className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                        <span className="truncate max-w-[350px]">
                                                            {buildExpenseDetail(expense.imputation, expense.description)}
                                                        </span>
                                                    </span>
                                                </td>
                                                <td className="hidden md:table-cell px-4 h-[52px] text-right">
                                                    <span className="font-mono font-bold text-rose-600/90 text-sm bg-rose-50/50 group-hover:bg-rose-50 px-2 py-0.5 rounded-lg transition-colors inline-block whitespace-nowrap">
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
            {isModalOpen && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                    <div className="absolute inset-0 bg-slate-950/35 backdrop-blur-[1px]" onClick={() => { if (!saving) { setIsModalOpen(false); resetForm(); } }} />
                    <div className="relative z-10 bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">

                        {/* Modal Header */}
                        <div className="flex justify-between items-center p-5 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <ReceiptText className="h-5 w-5 text-red-600" />
                                <h3 className="font-bold text-lg text-slate-800">Agregar Gasto</h3>
                            </div>
                            <button
                                onClick={() => { setIsModalOpen(false); resetForm(); }}
                                disabled={saving}
                                className="text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
                                aria-label="Cerrar modal"
                                type="button"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Modal Body — Form */}
                        <div className="p-5 overflow-y-auto flex-1">
                            {successMessage && (
                                <div className="mb-4 flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 font-medium animate-in fade-in duration-200">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                                    {successMessage}
                                </div>
                            )}

                            {expenseFormError && (
                                <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100 flex items-start gap-2">
                                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                    <span>{expenseFormError}</span>
                                </div>
                            )}

                            <form id="expenseForm" onSubmit={handleSubmit} className="space-y-4">
                                {/* 1. Garaje Asignado (solo requerido si el global es 'all') */}
                                {selectedGarageId === 'all' && (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Garaje Asignado</label>
                                        <select
                                            value={formGarageId}
                                            onChange={e => setFormGarageId(e.target.value)}
                                            disabled={saving}
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-60 appearance-none cursor-pointer"
                                        >
                                            <option value="" disabled hidden>Seleccionar garaje…</option>
                                            {garages.map(g => (
                                                <option key={g.id} value={g.id}>{g.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* 2. Monto */}
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
                                            disabled={saving}
                                            className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-60"
                                        />
                                    </div>
                                </div>

                                {/* 3. Beneficiario */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Pagado a / Beneficiario</label>
                                    <input
                                        type="text"
                                        value={expenseRecipient}
                                        onChange={e => setExpenseRecipient(e.target.value)}
                                        placeholder="Ej. Proveedor, empleado, comercio..."
                                        disabled={saving}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-60"
                                    />
                                </div>

                                {/* 4. Notas */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Concepto / Notas del egreso</label>
                                    <textarea
                                        value={expenseNotes}
                                        onChange={e => setExpenseNotes(e.target.value)}
                                        placeholder="Detalle o motivo del gasto..."
                                        rows={3}
                                        disabled={saving}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none disabled:opacity-60"
                                    />
                                </div>
                            </form>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-5 border-t border-slate-100 bg-slate-50 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                            <button
                                type="button"
                                onClick={() => { setIsModalOpen(false); resetForm(); }}
                                disabled={saving}
                                className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50 text-center"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                form="expenseForm"
                                disabled={saving}
                                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-60 shadow-sm"
                            >
                                {saving ? (
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
        </>
    );
}
