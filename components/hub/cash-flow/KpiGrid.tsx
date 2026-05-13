import React from 'react';
import { Wallet, TrendingUp, Building2, CreditCard, AlertCircle, Target, ArrowUpRight, ArrowDownRight, Eye } from 'lucide-react';
import { cn, formatCurrency, ProgressRing, VariationBadge } from './CashFlowShared';

interface KpiGridProps {
    kpiIngresos: { today: number; yesterday: number; variation: number };
    kpiFacturacion: { current: number; previous: number; variation: number };
    kpiOcupacion: { ocupadas: number; cocherasOcupadas: number; estadiasActivas: number; totalSpots: number; porcentaje: number };
    kpiSubs: { altas: number; bajas: number; total: number };
    kpiDeuda: { total: number; isAlert: boolean; count: number };
    kpiEficacia: { percentage: number; monthRev: number; potencialTotal: number };
    setIsHistoryModalOpen: (val: boolean) => void;
    setIsDebtModalOpen: (val: boolean) => void;
    setIsEficaciaModalOpen: (val: boolean) => void;
    setIsDailyIncomeModalOpen: (val: boolean) => void;
}

export default function KpiGrid({
    kpiIngresos,
    kpiFacturacion,
    kpiOcupacion,
    kpiSubs,
    kpiDeuda,
    kpiEficacia,
    setIsHistoryModalOpen,
    setIsDebtModalOpen,
    setIsEficaciaModalOpen,
    setIsDailyIncomeModalOpen
}: KpiGridProps) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {/* Ingresos Hoy */}
            <div onClick={() => setIsDailyIncomeModalOpen(true)}
                className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-emerald-300 active:scale-[0.98] transition-all cursor-pointer">
                <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600"><Wallet className="h-4 w-4" /></div>
                    <div className="flex items-center gap-2">
                        <VariationBadge value={kpiIngresos.variation} />
                        <Eye className="h-3.5 w-3.5 text-slate-300" />
                    </div>
                </div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Ingresos Hoy</p>
                <p className="text-2xl font-bold font-mono text-slate-800 tracking-tight">{formatCurrency(kpiIngresos.today)}</p>
                <p className="text-[10px] text-slate-400 mt-1">Ayer: {formatCurrency(kpiIngresos.yesterday)}</p>
            </div>
            {/* Facturación Mes */}
            <div onClick={() => setIsHistoryModalOpen(true)}
                className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-indigo-300 active:scale-[0.98] transition-all cursor-pointer">
                <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600"><TrendingUp className="h-4 w-4" /></div>
                    <Eye className="h-3.5 w-3.5 text-slate-300" />
                </div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Facturación Mes</p>
                <p className="text-2xl font-bold font-mono text-slate-800 tracking-tight">{formatCurrency(kpiFacturacion.current)}</p>
                <p className="text-[10px] text-slate-400 mt-1">Anterior: {formatCurrency(kpiFacturacion.previous)}</p>
            </div>
            {/* Ocupación */}
            <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600"><Building2 className="h-4 w-4" /></div>
                    <ProgressRing percentage={kpiOcupacion.porcentaje} size={36} strokeWidth={3.5} />
                </div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Ocupación Real</p>
                <p className="text-2xl font-bold font-mono text-slate-800 tracking-tight">{kpiOcupacion.porcentaje}%</p>
                <p className="text-[10px] text-slate-400 mt-1">{kpiOcupacion.ocupadas} / {kpiOcupacion.totalSpots} plazas</p>
                <p className="text-[9px] text-slate-400">{kpiOcupacion.cocherasOcupadas} fijas + {kpiOcupacion.estadiasActivas} estadías</p>
            </div>
            {/* Abonos */}
            <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-lg bg-violet-50 text-violet-600"><CreditCard className="h-4 w-4" /></div>
                </div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Abonos Activos</p>
                <p className="text-2xl font-bold font-mono text-slate-800 tracking-tight">{kpiSubs.total}</p>
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-emerald-600 flex items-center gap-0.5"><ArrowUpRight className="h-2.5 w-2.5" />{kpiSubs.altas}</span>
                    <span className="text-[10px] text-red-500 flex items-center gap-0.5"><ArrowDownRight className="h-2.5 w-2.5" />{kpiSubs.bajas}</span>
                </div>
            </div>
            {/* Deuda */}
            <div onClick={() => kpiDeuda.count > 0 && setIsDebtModalOpen(true)}
                className={cn("bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all",
                    kpiDeuda.isAlert ? "border-amber-300" : "border-slate-200/60",
                    kpiDeuda.count > 0 ? "cursor-pointer hover:border-amber-400 active:scale-[0.98]" : "cursor-default")}>
                <div className="flex items-center justify-between mb-3">
                    <div className={cn("p-2 rounded-lg", kpiDeuda.isAlert ? "bg-amber-50 text-amber-600" : "bg-slate-50 text-slate-500")}><AlertCircle className="h-4 w-4" /></div>
                    {kpiDeuda.count > 0 ? (
                        <Eye className="h-3.5 w-3.5 text-slate-300" />
                    ) : kpiDeuda.isAlert ? (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[9px] font-bold uppercase animate-pulse">Alerta</span>
                    ) : null}
                </div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Deuda Pendiente</p>
                <p className={cn("text-2xl font-bold font-mono tracking-tight", kpiDeuda.isAlert ? "text-amber-700" : "text-slate-800")}>{formatCurrency(kpiDeuda.total)}</p>
                <p className="text-[10px] text-slate-400 mt-1">{kpiDeuda.count} pendiente{kpiDeuda.count !== 1 ? 's' : ''}</p>
            </div>
            {/* Eficacia */}
            <div onClick={() => setIsEficaciaModalOpen(true)}
                className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-indigo-300 active:scale-[0.98] transition-all cursor-pointer">
                <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600"><Target className="h-4 w-4" /></div>
                    <Eye className="h-3.5 w-3.5 text-slate-300" />
                </div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Eficacia Cobranza</p>
                <p className="text-2xl font-bold font-mono text-slate-800 tracking-tight">{kpiEficacia.percentage}%</p>
                <p className="text-[10px] text-slate-400 mt-1">{formatCurrency(kpiEficacia.monthRev)} / {formatCurrency(kpiEficacia.potencialTotal)}</p>
            </div>
        </div>
    );
}
