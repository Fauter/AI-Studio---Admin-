const fs = require('fs');
const content = fs.readFileSync('C:/Users/lmfau/OneDrive/Escritorio/Code/ZZZ/AI Studio Admin/pages/CashClosuresPage.tsx', 'utf8');

let newContent = content;

// 1. Imports
newContent = newContent.replace(
    /import {([^}]+)} from 'lucide-react';/,
    `import {$1, ReceiptText, Plus, X} from 'lucide-react';`
);
newContent = newContent.replace(
    /import React, { useState, useEffect, useMemo } from 'react';/,
    `import React, { useState, useEffect, useMemo } from 'react';\nimport { createPortal } from 'react-dom';\nimport { useAuth } from '../hooks/useAuth';\nimport { formatDateTime24h } from '../lib/dateFormatters';`
);

// 2. Types
newContent = newContent.replace(
    /interface PartialClose {[\s\S]*?}/,
    `type PartialMovementType = 'withdrawal' | 'expense';\n\ninterface PartialClose {
    id: string;
    garage_id: string;
    created_at: string;
    operator: string | null;
    amount: number;
    recipient_name: string | null;
    notes: string | null;
    movement_type: PartialMovementType | null;
    is_withdrawn: boolean;
    withdrawn_by_name: string | null;
}`
);

newContent = newContent.replace(
    /type TabKey = 'computo' \| 'shifts' \| 'partials' \| 'history';/,
    `type TabKey = 'computo' | 'shifts' | 'partials' | 'expenses' | 'history';`
);

// 3. Helpers
newContent = newContent.replace(
    /function formatDate\(dateStr: string\) {[\s\S]*?return new Date\(dateStr\)[\s\S]*?\n\}/,
    `function normalizeMovementType(value: string | null | undefined): PartialMovementType {
    if (value === 'expense') return 'expense';
    return 'withdrawal';
}

function sanitizeOptionalText(value: string | null | undefined): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (trimmed === '' || trimmed.toLowerCase() === 'desconocido') return null;
    return trimmed;
}

function buildPartialCloseDetail(recipient: string | null | undefined, notes: string | null | undefined): string {
    const r = sanitizeOptionalText(recipient);
    const n = sanitizeOptionalText(notes);
    if (r && n) return \`\${r} - \${n}\`;
    if (r) return r;
    if (n) return n;
    return '—';
}

const formatDate = formatDateTime24h;`
);

// 4. Component States
newContent = newContent.replace(
    /const { garageId } = useParams<\{ garageId: string \}>.*?;\s+const \[loading, setLoading\] = useState\(true\);/s,
    `const { garageId } = useParams<{ garageId: string }>();

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
    }, [isExpenseModalOpen]);`
);

// 5. Functions
newContent = newContent.replace(
    /const toggleExpandHistory = \(id: string\) => {[\s\S]*?};\n/,
    `const toggleExpandHistory = (id: string) => {
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
            setExpenseAmount(\`\${integerStr},\${decimalStr}\`);
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

        const normalizedAmountString = expenseAmount.replace(/\\./g, '').replace(',', '.');
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
    };\n`
);

// 6. pendingPartials and expenseRows
newContent = newContent.replace(
    /const pendingPartials = useMemo\(\(\) =>[\s\S]*?\[partialCloses, searchTerm, dateFrom, dateTo\]\n    \);/,
    `const pendingPartials = useMemo(() =>
        applyFilters(partialCloses.filter(p => !p.is_withdrawn && normalizeMovementType(p.movement_type) === 'withdrawal')),
        [partialCloses, searchTerm, dateFrom, dateTo]
    );

    const expenseRows = useMemo(() =>
        applyFilters(partialCloses.filter(p => normalizeMovementType(p.movement_type) === 'expense')),
        [partialCloses, searchTerm, dateFrom, dateTo]
    );`
);

// 7. withdrawnHistory
const withdrawnHistoryReplacement = `        const partials: UnifiedWithdrawn[] = partialCloses
            .filter(p => p.is_withdrawn && normalizeMovementType(p.movement_type) === 'withdrawal')
            .map(p => {
                return {
                    id: p.id,
                    created_at: p.created_at,
                    operator: p.operator,
                    withdrawn_by_name: p.withdrawn_by_name,
                    type: 'Retiro Parcial',
                    amount: p.amount,
                    detail: buildPartialCloseDetail(p.recipient_name, p.notes),
                }
            });`;

newContent = newContent.replace(
    /const partials: UnifiedWithdrawn\[\] = partialCloses[\s\S]*?\}\);/,
    withdrawnHistoryReplacement
);

// 8. tabs
newContent = newContent.replace(
    /const tabs: \{ key: TabKey; label: string; icon: React\.ElementType; count\?: number \}\[\] = \[[\s\S]*?\];/,
    `const tabs: { key: TabKey; label: string; icon: React.ElementType; count?: number; customActiveColors?: string; customBadgeColors?: string; }[] = [
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
    ];`
);

// 9. tabs render
newContent = newContent.replace(
    /\{tabs\.map\(tab => \{[\s\S]*?\}\)\}\n                    <\/div>\n                <\/div>/,
    `{tabs.map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={\`flex items-center gap-2 px-5 py-3.5 text-sm font-bold border-b-2 transition-all whitespace-nowrap \${
                                        isActive
                                            ? tab.customActiveColors || 'border-emerald-600 text-emerald-700 bg-white'
                                            : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                                        }\`}
                                >
                                    <Icon className={\`h-4 w-4 \${isActive ? (tab.customActiveColors ? 'text-red-600' : 'text-emerald-600') : 'text-slate-400'}\`} />
                                    {tab.label}
                                    {tab.count !== undefined && tab.count > 0 && (
                                        <span className={\`inline-flex items-center justify-center text-[10px] font-black px-1.5 py-0.5 rounded-full \${
                                            isActive 
                                                ? tab.customBadgeColors || 'bg-emerald-100 text-emerald-700' 
                                                : 'bg-slate-200 text-slate-600'
                                        }\`}>
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
                </div>`
);

// 10. add expenses tab rendering and modal rendering
const historyBlockMatch = newContent.match(/\{activeTab === 'history' && \([\s\S]*?<\/table>\n                    <\/div>\n                \)\}\n            <\/div>\n        <\/div>\n    \);\n\}/);

if (historyBlockMatch) {
    const historyBlock = historyBlockMatch[0];
    const expenseBlock = `
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
                                                    {buildPartialCloseDetail(row.recipient_name, row.notes)}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {expenseRows.map(row => (
                                    <tr key={\`desktop-\${row.id}\`} className="hidden md:table-row hover:bg-slate-50/50 transition-colors">
                                        <td className="px-5 py-4">
                                            <div className="text-xs font-mono text-slate-500">{formatDate(row.created_at)}</div>
                                        </td>
                                        <td className="px-5 py-4 font-semibold text-slate-700">
                                            {row.operator || <span className="italic text-slate-400">Sin nombre</span>}
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="text-sm text-slate-700">
                                                {buildPartialCloseDetail(row.recipient_name, row.notes)}
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
}`;

    const originalBlock = historyBlockMatch[0];
    const newBlock = originalBlock.replace(
        /(\)\}\n            <\/div>\n        <\/div>\n    \);\n\})/,
        `)}\n${expenseBlock}`
    );
    newContent = newContent.replace(originalBlock, newBlock);
}

fs.writeFileSync('C:/Users/lmfau/OneDrive/Escritorio/Code/ZZZ/AI Studio Admin/pages/CashClosuresPage.tsx', newContent);
console.log('Patched CashClosuresPage.tsx');
