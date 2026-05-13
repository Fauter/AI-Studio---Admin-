import React from 'react';
import { X, TrendingUp, Calendar } from 'lucide-react';
import { cn, formatCurrency, VariationBadge } from '../CashFlowShared';

interface HistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    monthlyHistory: { label: string; total: number; variation: number; isOldest: boolean }[];
}

export default function HistoryModal({ isOpen, onClose, monthlyHistory }: HistoryModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />
            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600"><TrendingUp className="h-4 w-4" /></div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-800">Historial de Facturación</h3>
                            <p className="text-[10px] text-slate-400">Desglose mensual de ingresos</p>
                        </div>
                    </div>
                    <button onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                {/* Content */}
                <div className="overflow-auto flex-1 px-6 py-3">
                    {monthlyHistory.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                            <Calendar className="h-8 w-8 opacity-20" />
                            <p className="text-xs">Sin datos históricos</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {monthlyHistory.map((entry, i) => (
                                <div key={i} className={cn(
                                    "flex items-center justify-between py-3.5 gap-4",
                                    i === 0 && "bg-indigo-50/40 -mx-6 px-6 rounded-xl"
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
                                        <span className={cn("text-sm font-bold font-mono tabular-nums",
                                            i === 0 ? "text-indigo-800" : "text-slate-800"
                                        )}>
                                            {formatCurrency(entry.total)}
                                        </span>
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
