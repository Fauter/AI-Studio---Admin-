import React from 'react';
import { X, TrendingUp, Calendar, Loader2 } from 'lucide-react';
import { cn, formatCurrency, VariationBadge } from '../CashFlowShared';
import { useBodyScrollLock } from '../../../../hooks/useBodyScrollLock';

interface HistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    monthlyHistory: { label: string; total: number; expenses: number; variation: number; isOldest: boolean }[];
    loading?: boolean;
}

export default function HistoryModal({ isOpen, onClose, monthlyHistory, loading }: HistoryModalProps) {
    useBodyScrollLock(isOpen);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />
            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-xl w-[95%] md:w-full md:max-w-lg max-h-[80vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="history-modal-title">
                {/* Header */}
                <div className="flex items-center justify-between p-4 md:px-6 md:py-4 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600"><TrendingUp className="h-4 w-4" /></div>
                        <div>
                            <h3 id="history-modal-title" className="text-sm font-bold text-slate-800">Historial de Facturación</h3>
                            <p className="text-[10px] text-slate-400">Desglose mensual de ingresos</p>
                        </div>
                    </div>
                    <button onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                {/* Content */}
                <div className="overflow-y-auto overscroll-contain flex-1 p-4 md:px-6 md:py-3">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                            <p className="text-sm font-medium text-slate-600">Cargando datos históricos completos...</p>
                        </div>
                    ) : monthlyHistory.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                            <Calendar className="h-8 w-8 opacity-20" />
                            <p className="text-xs">Sin datos históricos</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {monthlyHistory.map((entry, i) => (
                                <div key={i} className={cn(
                                    "flex items-center justify-between py-3.5 gap-4",
                                    i === 0 && "bg-indigo-50/40 -mx-4 px-4 md:-mx-6 md:px-6 rounded-xl"
                                )}>
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold",
                                            i === 0 ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"
                                        )}>
                                            {entry.label.slice(0, 3)}
                                        </div>
                                        <span className={cn("text-sm font-medium truncate",
                                            i === 0 ? "text-indigo-800 font-semibold" : "text-slate-700"
                                        )}>
                                            {entry.label}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <div className="flex flex-col items-end justify-center">
                                            <span className={cn("text-sm font-bold font-mono tabular-nums leading-none",
                                                i === 0 ? "text-indigo-800" : "text-slate-800"
                                            )}>
                                                {formatCurrency(entry.total)}
                                            </span>
                                            <span className="text-[10px] font-medium text-rose-500/90 mt-1 leading-none">
                                                Egresos: {formatCurrency(entry.expenses ?? 0)}
                                            </span>
                                        </div>
                                        {!entry.isOldest && <VariationBadge value={entry.variation} />}
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
