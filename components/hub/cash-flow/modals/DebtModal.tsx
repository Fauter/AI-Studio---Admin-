import React from 'react';
import { X, AlertCircle } from 'lucide-react';
import { cn, formatCurrency } from '../CashFlowShared';

interface DebtDetailItem {
    id: string;
    amount: number;
    monthLabel: string;
    cocheraNumero: string;
}

interface CustomerDebt {
    customerId: string;
    customerName: string;
    totalDebt: number;
    items: DebtDetailItem[];
}

interface DebtModalProps {
    isOpen: boolean;
    onClose: () => void;
    debtDetailList: CustomerDebt[];
    kpiDeudaTotal: number;
}

export default function DebtModal({ isOpen, onClose, debtDetailList, kpiDeudaTotal }: DebtModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-amber-50 text-amber-600"><AlertCircle className="h-4 w-4" /></div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-800">Detalle de Deudores</h3>
                            <p className="text-[10px] text-slate-400">{debtDetailList.length} deudor{debtDetailList.length !== 1 ? 'es' : ''}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-lg font-bold font-mono text-amber-700">{formatCurrency(kpiDeudaTotal)}</span>
                        <button onClick={onClose}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>
                {/* Content */}
                <div className="overflow-auto flex-1 px-6 py-3">
                    {debtDetailList.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                            <AlertCircle className="h-8 w-8 opacity-20" />
                            <p className="text-xs">No hay deudas pendientes</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {debtDetailList.map((customer, i) => (
                                <div key={customer.customerId || i} className="bg-slate-50/50 rounded-xl border border-slate-100 p-4">
                                    <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-bold text-slate-800">{customer.customerName}</p>
                                            {customer.items.length > 1 && (
                                                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[9px] font-bold uppercase">
                                                    {customer.items.length} meses
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-sm font-bold font-mono text-amber-600 tabular-nums">
                                            {formatCurrency(customer.totalDebt)}
                                        </span>
                                    </div>
                                    <div className="space-y-1.5">
                                        {customer.items.map(item => (
                                            <div key={item.id} className="flex justify-between items-center text-[10px] text-slate-500">
                                                <span>{item.monthLabel} - Cochera {item.cocheraNumero}</span>
                                                <span className="font-mono text-slate-400">{formatCurrency(item.amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                {/* Footer */}
                <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/80 rounded-b-2xl">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Deuda</span>
                    <span className="text-base font-bold font-mono text-amber-700">{formatCurrency(kpiDeudaTotal)}</span>
                </div>
            </div>
        </div>
    );
}
