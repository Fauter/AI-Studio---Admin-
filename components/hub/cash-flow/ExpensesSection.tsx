import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Clock, CheckCircle2, AlertTriangle, Repeat, X, Calendar, BadgeDollarSign, Trash2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { Garage } from '../../../types';
import { cn, formatCurrency, formatDate, Expense, ExpenseTemplate } from './CashFlowShared';

interface ExpensesSectionProps {
    garages: Garage[];
    expenses: Expense[];
    expenseTemplates: ExpenseTemplate[];
    selectedGarageId: string;
    profile: { id: string; full_name?: string | null; email?: string | null } | null;
    onExpenseCreated: (expense: Expense) => void;
    onTemplateCreated: (template: ExpenseTemplate) => void;
    onTemplateUpdated: (template: ExpenseTemplate) => void;
    getGarageName: (id: string) => string;
    GarageFilter: React.ReactNode; // Can be placed somewhere if needed, maybe above table
}

interface PendingTask {
    id: string; // `${template.id}-${year}-${month}`
    template: ExpenseTemplate;
    periodStr: string; // 'YYYY-MM'
    year: number;
    month: number;
}

export default function ExpensesSection({
    garages,
    expenses,
    expenseTemplates,
    selectedGarageId,
    profile,
    onExpenseCreated,
    onTemplateCreated,
    onTemplateUpdated,
    getGarageName,
    GarageFilter,
}: ExpensesSectionProps) {
    // ── Form state ──
    const [expenseMode, setExpenseMode] = useState<'fixed' | 'recurring'>('fixed');
    const [formGarageId, setFormGarageId] = useState(selectedGarageId !== 'all' ? selectedGarageId : '');
    const [formDescription, setFormDescription] = useState('');
    const [formAmountStr, setFormAmountStr] = useState('');
    const [formRecurrenceDay, setFormRecurrenceDay] = useState('1');
    const [saving, setSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [formErrors, setFormErrors] = useState<{ garageId?: boolean; description?: boolean; amount?: boolean }>({});

    // ── Pending template confirmation state ──
    const [confirmingTaskId, setConfirmingTaskId] = useState<string | null>(null);
    const [revokingId, setRevokingId] = useState<string | null>(null);
    const [confirmedTaskIds, setConfirmedTaskIds] = useState<Set<string>>(new Set());

    // Update garage ID if selected outside changes
    useEffect(() => {
        if (selectedGarageId !== 'all') {
            setFormGarageId(selectedGarageId);
        }
    }, [selectedGarageId]);

    // ── Filtered templates for selected garage ──
    const filteredTemplates = useMemo(() => {
        return expenseTemplates.filter(t => {
            if (!t.is_active) return false;
            if (selectedGarageId !== 'all' && t.garage_id !== selectedGarageId) return false;
            return true;
        });
    }, [expenseTemplates, selectedGarageId]);

    // ── Pending recurring expenses (on-read materialization) ──
    const pendingTasks = useMemo(() => {
        const tasks: PendingTask[] = [];
        const now = new Date();
        const currentY = now.getFullYear();
        const currentM = now.getMonth();
        const currentD = now.getDate();

        filteredTemplates.forEach(t => {
            const created = new Date(t.created_at);
            let y = created.getFullYear();
            let m = created.getMonth();

            // Safety limit (e.g. 2 years back max) to prevent infinite loops on bad data
            if (y < currentY - 2) y = currentY - 2;

            while (y < currentY || (y === currentY && m <= currentM)) {
                let shouldTrigger = false;
                if (y < currentY || m < currentM) {
                    shouldTrigger = true; // Past months
                } else if (y === currentY && m === currentM) {
                    shouldTrigger = currentD >= t.recurrence_day; // Current month
                }

                if (shouldTrigger) {
                    const periodStr = `${y}-${(m + 1).toString().padStart(2, '0')}`;
                    const taskId = `${t.id}-${periodStr}`;
                    const exists = expenses.some(e =>
                        e.template_id === t.id && e.expense_date.startsWith(periodStr)
                    );
                    if (!exists && !confirmedTaskIds.has(taskId)) {
                        tasks.push({ id: taskId, template: t, periodStr, year: y, month: m });
                    }
                }

                m++;
                if (m > 11) {
                    m = 0;
                    y++;
                }
            }
        });

        // Sort oldest first
        return tasks.sort((a, b) => a.periodStr.localeCompare(b.periodStr));
    }, [filteredTemplates, expenses, confirmedTaskIds]);

    // ── Confirm a pending recurring expense ──
    const handleConfirmTask = async (task: PendingTask) => {
        setConfirmingTaskId(task.id);
        try {
            // Create target date handling end-of-month clamp
            const date = new Date(task.year, task.month, task.template.recurrence_day);
            if (date.getMonth() !== task.month) {
                date.setDate(0); // Clamp to last day of intended month
            }

            const { data, error } = await supabase.from('expenses').insert({
                garage_id: task.template.garage_id,
                owner_id: task.template.owner_id,
                template_id: task.template.id,
                description: task.template.description,
                amount: task.template.amount,
                expense_type: 'recurring',
                expense_date: date.toISOString(),
                created_by: profile?.full_name || 'Sistema',
            }).select().single();

            if (error) throw error;
            onExpenseCreated(data as Expense);
            setConfirmedTaskIds(prev => new Set(prev).add(task.id));
        } catch (err) {
            console.error('Error confirming recurring expense:', err);
        } finally {
            setConfirmingTaskId(null);
        }
    };

    // ── Revoke a template ──
    const handleRevokeTemplate = async (templateId: string) => {
        setRevokingId(templateId);
        try {
            const { data, error } = await supabase
                .from('expense_templates')
                .update({ is_active: false })
                .eq('id', templateId)
                .select()
                .single();

            if (error) throw error;
            if (data) {
                onTemplateUpdated(data as ExpenseTemplate);
                showSuccess('Egreso programado revocado exitosamente');
            }
        } catch (err) {
            console.error('Error revoking template:', err);
        } finally {
            setRevokingId(null);
        }
    };

    // ── Form Handling ──
    const showSuccess = (msg: string) => {
        setSuccessMessage(msg);
        setTimeout(() => setSuccessMessage(''), 3000);
    };

    const resetForm = () => {
        setFormDescription('');
        setFormAmountStr('');
        setFormRecurrenceDay('1');
        setFormErrors({});
    };

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

    const handleDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = parseInt(e.target.value, 10);
        if (isNaN(val)) {
            setFormRecurrenceDay('');
            return;
        }
        if (val < 1) val = 1;
        if (val > 31) val = 31;
        setFormRecurrenceDay(val.toString());
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const rawAmount = parseFloat(formAmountStr.replace(/\./g, ''));

        const errors = {
            garageId: !formGarageId,
            description: !formDescription.trim(),
            amount: isNaN(rawAmount) || rawAmount <= 0
        };

        setFormErrors(errors);
        if (Object.values(errors).some(Boolean)) return;

        setSaving(true);
        try {
            if (expenseMode === 'fixed') {
                const { data, error } = await supabase.from('expenses').insert({
                    garage_id: formGarageId,
                    owner_id: profile?.id || '',
                    template_id: null,
                    description: formDescription.trim(),
                    amount: rawAmount,
                    expense_type: 'fixed',
                    expense_date: new Date().toISOString(),
                    created_by: profile?.full_name || 'Sistema',
                }).select().single();

                if (error) throw error;
                onExpenseCreated(data as Expense);
                showSuccess('Egreso registrado correctamente');
            } else {
                const recurrenceDayNum = parseInt(formRecurrenceDay, 10) || 1;
                const { data: templateData, error: templateError } = await supabase.from('expense_templates').insert({
                    garage_id: formGarageId,
                    owner_id: profile?.id || '',
                    description: formDescription.trim(),
                    amount: rawAmount,
                    recurrence_day: recurrenceDayNum,
                    is_active: true,
                }).select().single();

                if (templateError) throw templateError;
                onTemplateCreated(templateData as ExpenseTemplate);

                // Also register current month's expense immediately
                const currentD = new Date().getDate();
                if (currentD >= recurrenceDayNum) {
                    const { data: expenseData, error: expenseError } = await supabase.from('expenses').insert({
                        garage_id: formGarageId,
                        owner_id: profile?.id || '',
                        template_id: templateData.id,
                        description: formDescription.trim(),
                        amount: rawAmount,
                        expense_type: 'recurring',
                        expense_date: new Date().toISOString(),
                        created_by: profile?.full_name || 'Sistema',
                    }).select().single();

                    if (expenseError) throw expenseError;
                    onExpenseCreated(expenseData as Expense);
                }
                showSuccess('Egreso programado configurado exitosamente');
            }
            resetForm();
        } catch (err) {
            console.error('Error creating expense:', err);
        } finally {
            setSaving(false);
        }
    };

    // ── Recent expenses ──
    const recentExpenses = useMemo(() => {
        return [...expenses]
            .sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime())
            .slice(0, 50);
    }, [expenses]);

    // ── Input classes ──
    const getInputClass = (hasError?: boolean) => cn(
        "w-full px-3 py-2.5 bg-slate-50 border rounded-xl text-sm text-slate-800 outline-none transition-all",
        hasError
            ? "border-red-400 ring-2 ring-red-500/20 bg-red-50/50"
            : "border-slate-200 focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"
    );
    const labelClasses = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5';

    // Helper for period strings
    const getPeriodLabel = (year: number, month: number) => {
        const date = new Date(year, month, 1);
        return date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
    };

    return (
        <div className="animate-in fade-in duration-300">

            {/* ═══════════════════════════════════════════════════════════
                §1 — Full Width Pending Banner
               ═══════════════════════════════════════════════════════════ */}
            {pendingTasks.length > 0 && (
                <div className="mb-6 bg-amber-50/70 border border-amber-200/60 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <Repeat className="h-4 w-4 text-amber-600" />
                        <h3 className="text-sm font-bold text-amber-800">Egresos Programados Pendientes</h3>
                        <span className="ml-auto text-[10px] font-bold bg-amber-200/60 text-amber-700 px-2.5 py-0.5 rounded-full">
                            {pendingTasks.length} {pendingTasks.length === 1 ? 'pendiente' : 'pendientes'}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {pendingTasks.map(task => (
                            <div
                                key={task.id}
                                className="flex items-center justify-between gap-3 bg-white border border-amber-200/50 rounded-xl p-3.5 shadow-sm"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="p-2 rounded-lg bg-amber-100/50 text-amber-600 shrink-0">
                                        <AlertTriangle className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-slate-800 truncate">
                                            {task.template.description}
                                        </p>
                                        <div className="flex flex-col text-[10px] text-slate-500">
                                            <span className="capitalize">{getPeriodLabel(task.year, task.month)}</span>
                                            <span className="font-mono font-bold text-red-500 mt-0.5">
                                                {formatCurrency(task.template.amount)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleConfirmTask(task)}
                                    disabled={confirmingTaskId === task.id}
                                    className={cn(
                                        'shrink-0 px-3.5 py-2 rounded-lg text-xs font-bold transition-all',
                                        confirmingTaskId === task.id
                                            ? 'bg-slate-100 text-slate-400 cursor-wait'
                                            : 'bg-amber-500 text-white hover:bg-amber-600 hover:shadow-md'
                                    )}
                                >
                                    {confirmingTaskId === task.id ? '...' : 'Confirmar'}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════
                §2 — CSS Grid Layout
               ═══════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* ── Columna Izquierda: Formulario ── */}
                <div className="lg:col-span-5">
                    <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden sticky top-6">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                <Plus className="h-5 w-5 text-indigo-500" /> Registrar Egreso
                            </h3>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">

                            {/* Segmented Control */}
                            <div className="flex bg-slate-100/80 p-1 rounded-xl shadow-inner">
                                <button
                                    type="button"
                                    onClick={() => setExpenseMode('fixed')}
                                    className={cn(
                                        'flex-1 py-2 rounded-lg text-sm font-bold transition-all',
                                        expenseMode === 'fixed'
                                            ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/50'
                                            : 'text-slate-500 hover:text-slate-700'
                                    )}
                                >
                                    Gasto Fijo
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setExpenseMode('recurring')}
                                    className={cn(
                                        'flex-1 py-2 rounded-lg text-sm font-bold transition-all',
                                        expenseMode === 'recurring'
                                            ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/50'
                                            : 'text-slate-500 hover:text-slate-700'
                                    )}
                                >
                                    Programado
                                </button>
                            </div>

                            {successMessage && (
                                <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 font-medium animate-in fade-in zoom-in duration-300">
                                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                                    {successMessage}
                                    <button type="button" onClick={() => setSuccessMessage('')} className="ml-auto text-emerald-400 hover:text-emerald-600">
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            )}

                            <div className="space-y-4">
                                {/* Garaje */}
                                <div>
                                    <label className={labelClasses}>Garaje Asignado</label>
                                    <select
                                        value={formGarageId}
                                        onChange={e => { setFormGarageId(e.target.value); if (formErrors.garageId) setFormErrors({ ...formErrors, garageId: false }); }}
                                        className={getInputClass(formErrors.garageId)}
                                    >
                                        <option value="">Seleccionar garaje…</option>
                                        {garages.map(g => (
                                            <option key={g.id} value={g.id}>{g.name}</option>
                                        ))}
                                    </select>
                                    {formErrors.garageId && <p className="text-[11px] text-red-500 mt-1 font-medium">Este campo es obligatorio</p>}
                                </div>

                                {/* Descripción */}
                                <div>
                                    <label className={labelClasses}>Motivo o Descripción</label>
                                    <input
                                        type="text"
                                        value={formDescription}
                                        onChange={e => { setFormDescription(e.target.value); if (formErrors.description) setFormErrors({ ...formErrors, description: false }); }}
                                        placeholder="Ej: Mantenimiento mensual"
                                        className={getInputClass(formErrors.description)}
                                    />
                                    {formErrors.description && <p className="text-[11px] text-red-500 mt-1 font-medium">Este campo es obligatorio</p>}
                                </div>

                                {/* Monto */}
                                <div>
                                    <label className={labelClasses}>Monto a Registrar</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <span className="text-slate-400 font-bold">$</span>
                                        </div>
                                        <input
                                            type="text"
                                            value={formAmountStr}
                                            onChange={handleAmountChange}
                                            placeholder="0"
                                            className={cn(getInputClass(formErrors.amount), "pl-8 font-mono font-medium")}
                                        />
                                    </div>
                                    {formErrors.amount && <p className="text-[11px] text-red-500 mt-1 font-medium">Ingrese un monto válido</p>}
                                </div>

                                {/* Día del mes (Organic transition for Recurrente) */}
                                <div className={cn(
                                    "overflow-hidden transition-all duration-300 ease-in-out",
                                    expenseMode === 'recurring' ? "opacity-100 max-h-40" : "opacity-0 max-h-0"
                                )}>
                                    <label className={labelClasses}>Día del mes (Ejecución)</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <Calendar className="h-4 w-4 text-slate-400" />
                                        </div>
                                        <input
                                            type="number"
                                            value={formRecurrenceDay}
                                            onChange={handleDayChange}
                                            className={cn(getInputClass(), "pl-9")}
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1.5 leading-tight">
                                        Si el mes en curso tiene menos días, se aplicará el último día hábil del mes.
                                    </p>
                                </div>
                            </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={saving}
                                className={cn(
                                    'w-full py-3.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2',
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
                                    'Registrar Egreso'
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                {/* ── Columna Derecha: Historial ── */}
                <div className="lg:col-span-7">
                    <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden h-full flex flex-col">
                        <div className="px-5 py-4 flex items-center gap-3 border-b border-slate-100">
                            <div className="p-2.5 rounded-xl bg-slate-50 text-slate-600 border border-slate-100">
                                <Clock className="h-4 w-4" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-base font-bold text-slate-800">Historial de Egresos</h3>
                                <p className="text-xs text-slate-400">Últimos movimientos registrados</p>
                            </div>
                            {GarageFilter}
                        </div>

                        <div className="flex-1 overflow-auto bg-slate-50/30" style={{ maxHeight: '700px' }}>
                            <table className="w-full text-sm text-left">
                                <thead className="text-[10px] text-slate-500 uppercase bg-slate-50/95 sticky top-0 backdrop-blur-sm z-10 shadow-sm">
                                    <tr>
                                        <th className="px-5 py-3.5 font-semibold">Fecha / Garaje</th>
                                        <th className="px-5 py-3.5 font-semibold">Descripción</th>
                                        <th className="px-5 py-3.5 font-semibold text-center">Tipo</th>
                                        <th className="px-5 py-3.5 font-semibold text-right">Monto</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100/80">
                                    {recentExpenses.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="p-16 text-center">
                                                <div className="flex flex-col items-center justify-center gap-3">
                                                    <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
                                                        <BadgeDollarSign className="h-6 w-6 text-slate-300" />
                                                    </div>
                                                    <p className="text-sm font-medium text-slate-400">No hay egresos registrados</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        recentExpenses.map(expense => (
                                            <tr key={expense.id} className="bg-white hover:bg-slate-50/80 transition-colors group">
                                                <td className="px-5 py-3.5">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-xs font-mono font-medium text-slate-500">
                                                            {formatDate(expense.expense_date)}
                                                        </span>
                                                        <span className="text-[11px] font-bold text-slate-400">
                                                            {getGarageName(expense.garage_id)}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <span className="text-sm font-medium text-slate-700">
                                                        {expense.description}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3.5 text-center">
                                                    <span className={cn(
                                                        'inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider',
                                                        expense.expense_type === 'recurring'
                                                            ? 'bg-indigo-50 text-indigo-600'
                                                            : 'bg-slate-100 text-slate-500'
                                                    )}>
                                                        {expense.expense_type === 'recurring' ? (
                                                            <><Repeat className="h-3 w-3" /> Programado</>
                                                        ) : (
                                                            'Fijo'
                                                        )}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3.5 text-right">
                                                    <span className="font-mono font-bold text-slate-800 text-sm bg-slate-50 group-hover:bg-white px-2 py-1 rounded-lg transition-colors">
                                                        -{formatCurrency(expense.amount)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════
                §3 — Active Scheduled Expenses
               ═══════════════════════════════════════════════════════════ */}
            <div className="mt-6 bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                            <Calendar className="h-4 w-4" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-800">Egresos Programados Activos</h3>
                            <p className="text-xs text-slate-400">Plantillas de gasto automático</p>
                        </div>
                    </div>
                </div>
                
                <div className="p-5">
                    {filteredTemplates.length === 0 ? (
                        <div className="text-center py-10 flex flex-col items-center justify-center gap-2">
                            <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center mb-1">
                                <Calendar className="h-5 w-5 text-slate-300" />
                            </div>
                            <p className="text-sm font-medium text-slate-400">No hay egresos programados activos</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredTemplates.map(template => (
                                <div key={template.id} className="flex flex-col bg-white border border-slate-200 rounded-xl p-4 transition-all hover:shadow-sm hover:border-slate-300 shadow-sm">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="min-w-0 pr-2">
                                            <h4 className="font-semibold text-sm text-slate-800 truncate" title={template.description}>
                                                {template.description}
                                            </h4>
                                            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                                                Día {template.recurrence_day} de cada mes
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleRevokeTemplate(template.id)}
                                            disabled={revokingId === template.id}
                                            className="shrink-0 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Revocar"
                                        >
                                            {revokingId === template.id ? (
                                                <div className="h-4 w-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <Trash2 className="h-4 w-4" />
                                            )}
                                        </button>
                                    </div>
                                    <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between">
                                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Monto</span>
                                        <span className="font-mono font-bold text-slate-700 text-sm">{formatCurrency(template.amount)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
