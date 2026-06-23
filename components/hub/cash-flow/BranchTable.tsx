import React, { useState } from 'react';
import { GitBranch, Building2, ChevronDown, ChevronRight } from 'lucide-react';
import { cn, formatCurrency, formatDate, Expense } from './CashFlowShared';

interface BranchBreakdown {
    id: string;
    name: string;
    effectivo: number;
    digital: number;
    total: number;
    occupancy: number;
    deuda: number;
    spots: number;
    occupied: number;
    activeSubs: number;
    // Expense fields
    monthlyExpenses: number;
    expenseCount: number;
    monthlyRevenue: number;
    expenses: Expense[];
}

interface BranchTableProps {
    branchBreakdown: BranchBreakdown[];
}

export default function BranchTable({ branchBreakdown }: BranchTableProps) {
    const [expandedBranches, setExpandedBranches] = useState<Record<string, boolean>>({});
    const toggleBranch = (id: string) => setExpandedBranches(prev => ({ ...prev, [id]: !prev[id] }));

    return (
        <div className="animate-in fade-in duration-300 bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 pt-5 pb-3 flex items-center gap-2.5 border-b border-slate-100">
                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600"><GitBranch className="h-4 w-4" /></div>
                <div>
                    <h3 className="text-sm font-bold text-slate-800">Rendimiento por Sucursal</h3>
                    <p className="text-[10px] text-slate-400">Ingresos del día actual desglosados</p>
                </div>
            </div>
            <div className="overflow-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-[10px] text-slate-500 uppercase bg-slate-50/80 sticky top-0 backdrop-blur-sm hidden md:table-header-group">
                        <tr>
                            <th className="px-5 py-3 font-semibold">Sucursal</th>
                            <th className="px-5 py-3 font-semibold text-right">Efectivo</th>
                            <th className="px-5 py-3 font-semibold text-right">Digital</th>
                            <th className="px-5 py-3 font-semibold text-right">Total Hoy</th>
                            <th className="px-5 py-3 font-semibold text-center">Ocupación</th>
                            <th className="px-5 py-3 font-semibold text-center">Abonos</th>
                            <th className="px-5 py-3 font-semibold text-right">Deuda</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 block md:table-row-group">
                        {branchBreakdown.length === 0 ? (
                            <tr><td colSpan={7} className="p-12 text-center text-slate-400 text-sm">
                                <div className="flex flex-col items-center gap-2"><Building2 className="h-8 w-8 opacity-20" /><p>No hay sucursales configuradas.</p></div>
                            </td></tr>
                        ) : (
                            branchBreakdown.map(branch => {
                                const isExpanded = !!expandedBranches[branch.id];
                                const hasExpenses = branch.monthlyExpenses > 0;

                                return (
                                    <React.Fragment key={branch.id}>
                                        {/* ── CONTENEDOR MÓVIL (Tarjeta Única) ── */}
                                        <tr className="md:hidden block">
                                            <td colSpan={7} className="block p-0 border-none">
                                                <div className="flex flex-col bg-white border border-slate-200 rounded-xl mb-3 shadow-sm">
                                                    {/* Fila de la sucursal (Datos) */}
                                                    <div className="p-4 flex flex-col gap-0 divide-y divide-slate-100/60">
                                                        <div className="flex justify-between items-center pb-2 border-slate-100/60">
                                                            <span className="font-semibold text-xs text-slate-500 uppercase">Sucursal</span>
                                                            <div className="flex items-center gap-3">
                                                                <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center"><Building2 className="h-4 w-4" /></div>
                                                                <div className="text-right">
                                                                    <p className="font-semibold text-slate-800 text-sm">{branch.name}</p>
                                                                    <p className="text-[10px] text-slate-400">{branch.occupied}/{branch.spots} cocheras</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex justify-between items-center py-2">
                                                            <span className="font-semibold text-xs text-slate-500 uppercase">Efectivo</span>
                                                            <span className="font-mono font-bold text-slate-700">{formatCurrency(branch.effectivo)}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center py-2">
                                                            <span className="font-semibold text-xs text-slate-500 uppercase">Digital</span>
                                                            <span className="font-mono font-bold text-slate-700">{formatCurrency(branch.digital)}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center py-2">
                                                            <span className="font-semibold text-xs text-slate-500 uppercase">Total Hoy</span>
                                                            <span className="font-mono font-bold text-slate-800">{formatCurrency(branch.total)}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center py-2">
                                                            <span className="font-semibold text-xs text-slate-500 uppercase">Ocupación</span>
                                                            <div className="inline-flex items-center gap-2">
                                                                <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                                    <div className={cn("h-full rounded-full transition-all", branch.occupancy > 85 ? "bg-red-500" : branch.occupancy > 60 ? "bg-amber-500" : "bg-indigo-500")}
                                                                        style={{ width: `${Math.min(branch.occupancy, 100)}%` }} />
                                                                </div>
                                                                <span className="text-xs font-bold font-mono text-slate-600">{branch.occupancy}%</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex justify-between items-center py-2">
                                                            <span className="font-semibold text-xs text-slate-500 uppercase">Abonos</span>
                                                            <span className="font-mono font-bold text-violet-600">{branch.activeSubs}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center pt-2">
                                                            <span className="font-semibold text-xs text-slate-500 uppercase">Deuda</span>
                                                            <span className={cn("font-mono font-bold text-sm", branch.deuda > 0 ? "text-amber-600" : "text-slate-400")}>{formatCurrency(branch.deuda)}</span>
                                                        </div>
                                                    </div>

                                                    {/* Fila de Egresos Mes (Pegada a la tarjeta) */}
                                                    {hasExpenses && (
                                                        <div className={cn("w-full px-4 py-2 bg-slate-50 border-t border-slate-100", !isExpanded && "rounded-b-xl")}>
                                                            <div className="flex items-center justify-between">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleBranch(branch.id)}
                                                                    className="flex items-center gap-1.5 text-[11px] text-slate-600 hover:text-slate-800 transition-colors w-full"
                                                                >
                                                                    {isExpanded
                                                                        ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                                                                        : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                                                                    }
                                                                    <span>
                                                                        Egresos Mes: <span className="font-semibold font-mono text-rose-500/90">{formatCurrency(branch.monthlyExpenses)}</span>
                                                                        {' '}<span className="text-slate-400">({branch.expenseCount} gastos)</span>
                                                                    </span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Egresos Expandidos (Móvil) */}
                                                    {hasExpenses && isExpanded && (
                                                        <div className="bg-slate-50/40 p-4 border-t border-slate-100 rounded-b-xl">
                                                            <div className="flex flex-col gap-2">
                                                                {[...branch.expenses]
                                                                    .sort((a, b) => new Date(a.expense_date).getTime() - new Date(b.expense_date).getTime())
                                                                    .map(exp => (
                                                                        <div key={exp.id} className="flex flex-col px-3 py-1.5 bg-white border border-slate-200/60 rounded-xl shadow-sm leading-tight">
                                                                            <span className="text-[9px] text-slate-400 font-mono">
                                                                                {formatDate(exp.expense_date).replace(',', '')} hs
                                                                            </span>
                                                                            <div className="flex items-center justify-between gap-3 text-[11px] text-slate-600">
                                                                                <span className="truncate font-medium">{exp.description || exp.expense_type || 'Egreso'}</span>
                                                                                <span className="font-mono font-medium text-rose-500/80">{formatCurrency(Number(exp.amount))}</span>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>

                                        {/* ── FILAS DE ESCRITORIO (Ocultas en móvil) ── */}
                                        <tr className="hidden md:table-row hover:bg-indigo-50/40 transition-colors cursor-default bg-white border-b border-slate-100">
                                            <td className="py-4 px-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center"><Building2 className="h-4 w-4" /></div>
                                                    <div>
                                                        <p className="font-semibold text-slate-800 text-sm">{branch.name}</p>
                                                        <p className="text-[10px] text-slate-400">{branch.occupied}/{branch.spots} cocheras</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4 px-5 text-right font-mono font-bold text-slate-700">
                                                {formatCurrency(branch.effectivo)}
                                            </td>
                                            <td className="py-4 px-5 text-right font-mono font-bold text-slate-700">
                                                {formatCurrency(branch.digital)}
                                            </td>
                                            <td className="py-4 px-5 text-right font-mono font-bold text-slate-800">
                                                {formatCurrency(branch.total)}
                                            </td>
                                            <td className="py-4 px-5 text-center">
                                                <div className="inline-flex items-center gap-2">
                                                    <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                        <div className={cn("h-full rounded-full transition-all", branch.occupancy > 85 ? "bg-red-500" : branch.occupancy > 60 ? "bg-amber-500" : "bg-indigo-500")}
                                                            style={{ width: `${Math.min(branch.occupancy, 100)}%` }} />
                                                    </div>
                                                    <span className="text-xs font-bold font-mono text-slate-600">{branch.occupancy}%</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-5 text-center font-mono font-bold text-violet-600">
                                                {branch.activeSubs}
                                            </td>
                                            <td className="py-4 px-5 text-right">
                                                <span className={cn("font-mono font-bold text-sm", branch.deuda > 0 ? "text-amber-600" : "text-slate-400")}>{formatCurrency(branch.deuda)}</span>
                                            </td>
                                        </tr>

                                        {/* ── Expense summary row (Desktop) ── */}
                                        {hasExpenses && (
                                            <tr className="hidden md:table-row bg-slate-50/60 border-b border-slate-100">
                                                <td colSpan={7} className="px-5 py-1.5">
                                                    <div className="flex items-center justify-between">
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleBranch(branch.id)}
                                                            className="flex items-center gap-1.5 text-[11px] text-slate-600 hover:text-slate-800 transition-colors"
                                                        >
                                                            {isExpanded
                                                                ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                                                                : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                                                            }
                                                            <span>
                                                                Egresos Mes: <span className="font-semibold font-mono text-rose-500/90">{formatCurrency(branch.monthlyExpenses)}</span>
                                                                {' '}<span className="text-slate-400">({branch.expenseCount} gastos)</span>
                                                            </span>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}

                                        {/* ── Expanded details (Desktop) ── */}
                                        {hasExpenses && isExpanded && (
                                            <tr className="hidden md:table-row bg-slate-50/40">
                                                <td colSpan={7} className="px-5 py-4">
                                                    <div className="flex flex-wrap gap-3">
                                                        {[...branch.expenses]
                                                            .sort((a, b) => new Date(a.expense_date).getTime() - new Date(b.expense_date).getTime())
                                                            .map(exp => (
                                                                <div key={exp.id} className="flex flex-col px-3 py-1.5 bg-white border border-slate-200/60 rounded-xl min-w-[160px] shadow-sm leading-tight">
                                                                    <span className="text-[9px] text-slate-400 font-mono">
                                                                        {formatDate(exp.expense_date).replace(',', '')} hs
                                                                    </span>
                                                                    <div className="flex items-center justify-between gap-3 text-[11px] text-slate-600">
                                                                        <span className="truncate max-w-[160px] font-medium">{exp.description || exp.expense_type || 'Egreso'}</span>
                                                                        <span className="font-mono font-medium text-rose-500/80">{formatCurrency(Number(exp.amount))}</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })
                        )}
                        {branchBreakdown.length > 1 && (
                            <tr className="bg-slate-50/80 font-bold border-t border-slate-200 block md:table-row rounded-xl md:rounded-none p-4 md:p-0 shadow-sm md:shadow-none mt-4 md:mt-0">
                                <td className="flex justify-between items-center md:table-cell py-2 md:py-3 px-0 md:px-5 border-b border-slate-100 md:border-0 text-sm text-slate-700">
                                    <span className="md:hidden font-semibold text-xs text-slate-500 uppercase">Total General</span>
                                    <span className="hidden md:inline">Total General</span>
                                </td>
                                <td className="flex justify-between items-center md:table-cell py-2 md:py-3 px-0 md:px-5 border-b border-slate-100 md:border-0 text-right font-mono text-slate-800">
                                    <span className="md:hidden font-semibold text-xs text-slate-500 uppercase">Efectivo</span>
                                    {formatCurrency(branchBreakdown.reduce((a, b) => a + b.effectivo, 0))}
                                </td>
                                <td className="flex justify-between items-center md:table-cell py-2 md:py-3 px-0 md:px-5 border-b border-slate-100 md:border-0 text-right font-mono text-slate-800">
                                    <span className="md:hidden font-semibold text-xs text-slate-500 uppercase">Digital</span>
                                    {formatCurrency(branchBreakdown.reduce((a, b) => a + b.digital, 0))}
                                </td>
                                <td className="flex justify-between items-center md:table-cell py-2 md:py-3 px-0 md:px-5 border-b border-slate-100 md:border-0 text-right font-mono text-slate-800">
                                    <span className="md:hidden font-semibold text-xs text-slate-500 uppercase">Total Hoy</span>
                                    {formatCurrency(branchBreakdown.reduce((a, b) => a + b.total, 0))}
                                </td>
                                <td className="flex justify-between items-center md:table-cell py-2 md:py-3 px-0 md:px-5 border-b border-slate-100 md:border-0 text-center">
                                    <span className="md:hidden font-semibold text-xs text-slate-500 uppercase">Ocupación</span>
                                    <span className="text-xs font-mono text-slate-600">{(() => { const t = branchBreakdown.reduce((a, b) => a + b.spots, 0); const o = branchBreakdown.reduce((a, b) => a + b.occupied, 0); return t === 0 ? '0%' : `${Math.round((o / t) * 100)}%`; })()}</span>
                                </td>
                                <td className="flex justify-between items-center md:table-cell py-2 md:py-3 px-0 md:px-5 border-b border-slate-100 md:border-0 text-center font-mono text-violet-600">
                                    <span className="md:hidden font-semibold text-xs text-slate-500 uppercase">Abonos</span>
                                    {branchBreakdown.reduce((a, b) => a + b.activeSubs, 0)}
                                </td>
                                <td className="flex justify-between items-center md:table-cell py-2 md:py-3 px-0 md:px-5 text-right font-mono text-amber-700">
                                    <span className="md:hidden font-semibold text-xs text-slate-500 uppercase">Deuda</span>
                                    {formatCurrency(branchBreakdown.reduce((a, b) => a + b.deuda, 0))}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
