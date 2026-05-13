import React from 'react';
import { GitBranch, Building2 } from 'lucide-react';
import { cn, formatCurrency } from './CashFlowShared';

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
}

interface BranchTableProps {
    branchBreakdown: BranchBreakdown[];
}

export default function BranchTable({ branchBreakdown }: BranchTableProps) {
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
                    <thead className="text-[10px] text-slate-500 uppercase bg-slate-50/80 sticky top-0 backdrop-blur-sm">
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
                    <tbody className="divide-y divide-slate-100">
                        {branchBreakdown.length === 0 ? (
                            <tr><td colSpan={7} className="p-12 text-center text-slate-400 text-sm">
                                <div className="flex flex-col items-center gap-2"><Building2 className="h-8 w-8 opacity-20" /><p>No hay sucursales configuradas.</p></div>
                            </td></tr>
                        ) : (
                            branchBreakdown.map(branch => (
                                <tr key={branch.id} className="hover:bg-indigo-50/40 transition-colors cursor-default">
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center"><Building2 className="h-4 w-4" /></div>
                                            <div>
                                                <p className="font-semibold text-slate-800 text-sm">{branch.name}</p>
                                                <p className="text-[10px] text-slate-400">{branch.occupied}/{branch.spots} cocheras</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4 text-right font-mono font-bold text-slate-700">{formatCurrency(branch.effectivo)}</td>
                                    <td className="px-5 py-4 text-right font-mono font-bold text-slate-700">{formatCurrency(branch.digital)}</td>
                                    <td className="px-5 py-4 text-right font-mono font-bold text-slate-800">{formatCurrency(branch.total)}</td>
                                    <td className="px-5 py-4 text-center">
                                        <div className="inline-flex items-center gap-2">
                                            <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                <div className={cn("h-full rounded-full transition-all", branch.occupancy > 85 ? "bg-red-500" : branch.occupancy > 60 ? "bg-amber-500" : "bg-indigo-500")}
                                                    style={{ width: `${Math.min(branch.occupancy, 100)}%` }} />
                                            </div>
                                            <span className="text-xs font-bold font-mono text-slate-600">{branch.occupancy}%</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4 text-center font-mono font-bold text-violet-600">{branch.activeSubs}</td>
                                    <td className="px-5 py-4 text-right">
                                        <span className={cn("font-mono font-bold text-sm", branch.deuda > 0 ? "text-amber-600" : "text-slate-400")}>{formatCurrency(branch.deuda)}</span>
                                    </td>
                                </tr>
                            ))
                        )}
                        {branchBreakdown.length > 1 && (
                            <tr className="bg-slate-50/80 font-bold border-t border-slate-200">
                                <td className="px-5 py-3 text-sm text-slate-700">Total General</td>
                                <td className="px-5 py-3 text-right font-mono text-slate-800">{formatCurrency(branchBreakdown.reduce((a, b) => a + b.effectivo, 0))}</td>
                                <td className="px-5 py-3 text-right font-mono text-slate-800">{formatCurrency(branchBreakdown.reduce((a, b) => a + b.digital, 0))}</td>
                                <td className="px-5 py-3 text-right font-mono text-slate-800">{formatCurrency(branchBreakdown.reduce((a, b) => a + b.total, 0))}</td>
                                <td className="px-5 py-3 text-center"><span className="text-xs font-mono text-slate-600">{(() => { const t = branchBreakdown.reduce((a, b) => a + b.spots, 0); const o = branchBreakdown.reduce((a, b) => a + b.occupied, 0); return t === 0 ? '0%' : `${Math.round((o / t) * 100)}%`; })()}</span></td>
                                <td className="px-5 py-3 text-center font-mono text-violet-600">{branchBreakdown.reduce((a, b) => a + b.activeSubs, 0)}</td>
                                <td className="px-5 py-3 text-right font-mono text-amber-700">{formatCurrency(branchBreakdown.reduce((a, b) => a + b.deuda, 0))}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
