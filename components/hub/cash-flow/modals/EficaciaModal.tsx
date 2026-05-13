import React from 'react';
import { X, Target, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency } from '../CashFlowShared';

interface EficaciaTimelineItem {
    day: string;
    total: number;
    accumulated: number;
    percentage: number;
}

interface EficaciaTimeline {
    monthLabel: string;
    timeline: EficaciaTimelineItem[];
}

interface EficaciaModalProps {
    isOpen: boolean;
    onClose: () => void;
    eficaciaTimeline: EficaciaTimeline;
    kpiEficaciaPotencialTotal: number;
    eficaciaMonthOffset: number;
    setEficaciaMonthOffset: React.Dispatch<React.SetStateAction<number>>;
}

export default function EficaciaModal({
    isOpen,
    onClose,
    eficaciaTimeline,
    kpiEficaciaPotencialTotal,
    eficaciaMonthOffset,
    setEficaciaMonthOffset
}: EficaciaModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg min-h-[550px] max-h-[80vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600"><Target className="h-4 w-4" /></div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-800">Línea de Tiempo - Eficacia</h3>
                            <p className="text-[10px] text-slate-400 capitalize">{eficaciaTimeline.monthLabel}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-between gap-1 bg-slate-100 rounded-lg p-1 min-w-[150px]">
                            <button onClick={() => setEficaciaMonthOffset(prev => prev + 1)} className="p-1.5 rounded hover:bg-white hover:shadow-sm text-slate-500 transition-all shrink-0">
                                <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                            <span className="text-xs font-semibold px-2 text-slate-600 capitalize text-center flex-1">
                                {eficaciaTimeline.monthLabel}
                            </span>
                            <button onClick={() => setEficaciaMonthOffset(prev => Math.max(0, prev - 1))} className="p-1.5 rounded hover:bg-white hover:shadow-sm text-slate-500 transition-all shrink-0" disabled={eficaciaMonthOffset === 0}>
                                <ChevronUp className="h-3.5 w-3.5" />
                            </button>
                        </div>
                        <button onClick={onClose}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>
                {/* Content */}
                <div className="overflow-auto flex-1 px-6 py-3">
                    {eficaciaTimeline.timeline.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                            <Calendar className="h-8 w-8 opacity-20" />
                            <p className="text-xs">Sin cobros de abonos en este mes</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            <div className="flex items-center justify-between py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                <span className="w-16">Día</span>
                                <span className="flex-1 text-right">Recaudado</span>
                                <span className="w-24 text-right">Acumulado</span>
                            </div>
                            {eficaciaTimeline.timeline.reduce<React.ReactNode[]>((acc, entry, i, arr) => {
                                // Insert gap indicator before current entry if there's a day gap
                                if (i > 0) {
                                    const prevDay = parseInt(arr[i - 1].day);
                                    const currDay = parseInt(entry.day);
                                    const gap = currDay - prevDay;

                                    if (gap > 1) {
                                        const missingDays = gap - 1;

                                        acc.push(
                                            <div key={`gap-${i}`} className="flex items-center justify-between py-2 gap-4">
                                                <div className="w-16 flex flex-col gap-2">
                                                    {Array.from({ length: missingDays }).map((_, idx) => (
                                                        <div key={idx} className="w-8 flex justify-center">
                                                            <div className="h-1 w-6 bg-slate-200/50 rounded-full" />
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="flex-1" />
                                                <div className="w-24" />
                                            </div>
                                        );
                                    }
                                }

                                // Render the actual data row
                                acc.push(
                                    <div key={i} className="flex items-center justify-between py-3.5 gap-4">
                                        <div className="w-16 flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold bg-slate-100 text-slate-600">
                                                {entry.day}
                                            </div>
                                        </div>
                                        <div className="flex-1 text-right">
                                            <span className="text-sm font-bold font-mono text-emerald-600 tabular-nums">
                                                +{formatCurrency(entry.total)}
                                            </span>
                                        </div>
                                        <div className="w-24 flex flex-col items-end">
                                            <span className="text-sm font-bold font-mono text-slate-800 tabular-nums">
                                                {entry.percentage}%
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-mono">
                                                {formatCurrency(entry.accumulated)}
                                            </span>
                                        </div>
                                    </div>
                                );

                                return acc;
                            }, [])}
                        </div>
                    )}
                </div>
                {/* Footer */}
                <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/80 rounded-b-2xl">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Potencial Teórico</span>
                    <span className="text-base font-bold font-mono text-slate-700">{formatCurrency(kpiEficaciaPotencialTotal)}</span>
                </div>
            </div>
        </div>
    );
}
