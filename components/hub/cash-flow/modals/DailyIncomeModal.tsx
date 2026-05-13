import React from 'react';
import { X, Calendar, Wallet, ChevronDown, ChevronUp } from 'lucide-react';
import { cn, formatCurrency, VariationBadge } from '../CashFlowShared';

interface DailyIncomeItem {
    fullDate: string;
    dayNum: number;
    amount: number;
    variation: number;
    isFuture: boolean;
    isPadding: boolean;
}

interface DailyIncomeMonth {
    monthLabel: string;
    days: DailyIncomeItem[];
}

interface DailyIncomeModalProps {
    isOpen: boolean;
    onClose: () => void;
    dailyIncomeData: DailyIncomeMonth;
    dailyIncomeMonthOffset: number;
    setDailyIncomeMonthOffset: React.Dispatch<React.SetStateAction<number>>;
}

export default function DailyIncomeModal({
    isOpen,
    onClose,
    dailyIncomeData,
    dailyIncomeMonthOffset,
    setDailyIncomeMonthOffset
}: DailyIncomeModalProps) {
    if (!isOpen) return null;

    const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-6xl h-[100%] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600"><Wallet className="h-4 w-4" /></div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-800">Ingresos Diarios</h3>
                            <p className="text-[10px] text-slate-400 capitalize">{dailyIncomeData.monthLabel}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-between gap-1 bg-slate-100 rounded-lg p-1 min-w-[160px]">
                            <button onClick={() => setDailyIncomeMonthOffset(prev => prev + 1)} className="p-1.5 rounded hover:bg-white hover:shadow-sm text-slate-500 transition-all shrink-0">
                                <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                            <span className="text-xs font-semibold px-2 text-slate-600 capitalize text-center flex-1">
                                {dailyIncomeData.monthLabel}
                            </span>
                            <button onClick={() => setDailyIncomeMonthOffset(prev => Math.max(0, prev - 1))} className="p-1.5 rounded hover:bg-white hover:shadow-sm text-slate-500 transition-all shrink-0" disabled={dailyIncomeMonthOffset === 0}>
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
                <div className="flex-1 flex flex-col overflow-hidden">
                    {!dailyIncomeData || dailyIncomeData.days.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                            <Calendar className="h-8 w-8 opacity-20" />
                            <p className="text-xs">Sin registros de ingresos</p>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col w-full h-full overflow-hidden">
                            {/* Days Header */}
                            <div className="grid grid-cols-7 gap-4 px-6 pt-6 pb-3 shrink-0 bg-white z-10 border-b border-slate-50">
                                {WEEKDAYS.map(dayName => (
                                    <div key={dayName} className="text-[10px] font-bold text-slate-400 uppercase text-center">
                                        {dayName}
                                    </div>
                                ))}
                            </div>
                            {/* Scrollable Grid */}
                            <div className="flex-1 overflow-y-auto px-6 pt-4 pb-6 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                                <div className="grid grid-cols-7 gap-4">
                                    {dailyIncomeData.days.map((day, i) => (
                                        <div key={i} className={cn(
                                            "min-h-[10px] border rounded-2xl p-3 flex flex-col items-center justify-center transition-all",
                                            day.isFuture
                                                ? "bg-transparent border-transparent opacity-20 grayscale pointer-events-none"
                                                : day.isPadding
                                                    ? "bg-slate-50/50 border-transparent opacity-40 grayscale pointer-events-none"
                                                    : "bg-white border-slate-200/60 shadow-sm hover:shadow-md hover:border-emerald-200"
                                        )}>
                                            <span className="text-xs font-bold text-slate-400 mb-1">{day.dayNum}</span>

                                            {!day.isFuture && (
                                                <>
                                                    <span className="text-[12px] font-bold font-mono text-emerald-600 mb-1.5">{formatCurrency(day.amount)}</span>
                                                    {!day.isPadding && (
                                                        day.variation !== 0 ? (
                                                            <VariationBadge value={day.variation} />
                                                        ) : (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-400">
                                                                0%
                                                            </span>
                                                        )
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
