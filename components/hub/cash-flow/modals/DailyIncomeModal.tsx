import React, { useState, useEffect } from 'react';
import { X, Calendar, Wallet, ChevronDown, ChevronUp } from 'lucide-react';
import { cn, formatCurrency, VariationBadge } from '../CashFlowShared';
import { useBodyScrollLock } from '../../../../hooks/useBodyScrollLock';

interface DailyIncomeItem {
    fullDate: string;
    dayNum: number;
    amount: number;
    expenses: number;
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

const formatCompact = (val: number) => {
    if (val >= 1_000_000) {
        const m = val / 1_000_000;
        const formatted = m.toLocaleString('es-AR', { maximumFractionDigits: 2 });
        return `$${formatted}M`;
    }
    if (val >= 1_000) {
        const k = val / 1_000;
        const formatted = k.toLocaleString('es-AR', { maximumFractionDigits: 1 });
        return `$${formatted}K`;
    }
    return `$${val}`;
};

export default function DailyIncomeModal({
    isOpen,
    onClose,
    dailyIncomeData,
    dailyIncomeMonthOffset,
    setDailyIncomeMonthOffset
}: DailyIncomeModalProps) {
    const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);

    useBodyScrollLock(isOpen);

    useEffect(() => {
        setSelectedDayIndex(null);
    }, [dailyIncomeData?.monthLabel]);

    if (!isOpen) return null;

    const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    const selectedDay = selectedDayIndex !== null ? dailyIncomeData.days[selectedDayIndex] : null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />
            <div className="fixed inset-0 md:relative bg-white rounded-none md:rounded-2xl shadow-xl w-full h-[100dvh] md:h-auto md:w-full md:max-w-4xl md:max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="daily-income-title">
                {/* Header */}
                <div className="flex items-center justify-between p-4 md:px-6 md:py-4 border-b border-slate-100 shrink-0 flex-wrap md:flex-nowrap gap-4">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600"><Wallet className="h-4 w-4" /></div>
                        <div>
                            <h3 id="daily-income-title" className="text-sm font-bold text-slate-800">Ingresos Diarios</h3>
                            <p className="text-[10px] text-slate-400 capitalize">{dailyIncomeData.monthLabel}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
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
                            <div className="w-full flex flex-col h-full">
                                {/* Days Header */}
                                <div className="grid grid-cols-7 gap-0.5 md:gap-4 p-1 md:px-6 md:pt-6 md:pb-3 shrink-0 bg-white z-10 border-b border-slate-50">
                                    {WEEKDAYS.map(dayName => (
                                        <div key={dayName} className="text-[10px] md:text-sm font-bold text-slate-400 uppercase text-center">
                                            {dayName}
                                        </div>
                                    ))}
                                </div>
                                {/* Scrollable Grid */}
                                <div className="flex-1 overflow-y-auto overscroll-contain p-1 md:px-6 md:pt-4 md:pb-6 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                                    <div className="grid grid-cols-7 gap-1 md:gap-4">
                                        {dailyIncomeData.days.map((day, i) => (
                                            <div key={i} 
                                                onClick={() => {
                                                    if (!day.isFuture && !day.isPadding) {
                                                        setSelectedDayIndex(prev => prev === i ? null : i);
                                                    }
                                                }}
                                                className={cn(
                                                "min-h-[60px] md:min-h-[100px] border rounded-lg md:rounded-2xl py-1 px-0.5 md:p-3 flex flex-col items-center justify-center transition-all",
                                                day.isFuture
                                                    ? "bg-transparent border-transparent opacity-20 grayscale pointer-events-none"
                                                    : day.isPadding
                                                        ? "bg-slate-50/50 border-transparent opacity-40 grayscale pointer-events-none"
                                                        : cn(
                                                            "bg-white border-slate-200/60 shadow-sm hover:shadow-md hover:border-emerald-200 cursor-pointer",
                                                            selectedDayIndex === i && "ring-2 ring-emerald-400 border-emerald-400 bg-emerald-50/10"
                                                        )
                                            )}>
                                                <span className="text-[10px] md:text-xs font-bold text-slate-400 mb-0.5 md:mb-1">{day.dayNum}</span>

                                                {!day.isFuture && (
                                                    <>
                                                        {/* MOBILE COMPACT VIEW */}
                                                        <div className="md:hidden flex flex-col items-center w-full overflow-hidden">
                                                            <span className="text-[9px] font-bold font-mono text-emerald-600 mb-0.5 truncate w-full text-center">
                                                                {formatCompact(day.amount)}
                                                            </span>
                                                            {!day.isPadding && (
                                                                day.variation !== 0 ? (
                                                                    <div className="scale-[0.65] origin-center -mt-1">
                                                                        <VariationBadge value={day.variation} />
                                                                    </div>
                                                                ) : (
                                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-slate-100 text-slate-400 mt-0.5">
                                                                        0%
                                                                    </span>
                                                                )
                                                            )}
                                                        </div>

                                                        {/* DESKTOP FULL VIEW */}
                                                        <div className="hidden md:flex flex-col items-center w-full">
                                                            <span className="text-[12px] font-bold font-mono text-emerald-600 mb-1">
                                                                {formatCurrency(day.amount)}
                                                            </span>
                                                            <span className="text-[10px] font-medium text-rose-500/90 mb-1.5 leading-tight text-center">
                                                                Egresos: {formatCurrency(day.expenses ?? 0)}
                                                            </span>
                                                            {!day.isPadding && (
                                                                day.variation !== 0 ? (
                                                                    <VariationBadge value={day.variation} />
                                                                ) : (
                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-400">
                                                                        0%
                                                                    </span>
                                                                )
                                                            )}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                
                                {/* Detail Card Mobile */}
                                {selectedDay && (
                                    <div className="md:hidden p-3 border-t border-slate-100 bg-slate-50 shrink-0 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)] z-20">
                                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 flex flex-col gap-2">
                                            <div className="flex justify-between items-center border-b border-slate-50 pb-1.5">
                                                <span className="text-xs font-bold text-slate-600 capitalize">{selectedDay.fullDate}</span>
                                                <VariationBadge value={selectedDay.variation} />
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-slate-500">Ingresos</span>
                                                <span className="text-xs font-mono font-bold text-emerald-600">{formatCurrency(selectedDay.amount)}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-slate-500">Egresos</span>
                                                <span className="text-xs font-mono font-bold text-rose-500">{formatCurrency(selectedDay.expenses ?? 0)}</span>
                                            </div>
                                            <div className="flex justify-between items-center pt-1.5 border-t border-slate-50">
                                                <span className="text-xs font-bold text-slate-700">Neto</span>
                                                <span className="text-xs font-mono font-bold text-slate-800">{formatCurrency(selectedDay.amount - (selectedDay.expenses ?? 0))}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
