import React, { useState, useMemo } from 'react';
import { List, Filter, ChevronUp, ChevronDown, X, Inbox, ArrowUpRight, ArrowDownRight, ArrowUpDown, ArrowDown, ArrowUp } from 'lucide-react';
import { cn, formatCurrency, getAmountColor, formatDate, Movement, Stay, UnifiedTransaction } from './CashFlowShared';

interface MovementsTableProps {
    unifiedTransactions: UnifiedTransaction[];
    totalCaja: number;
    filters: any;
    setFilters: React.Dispatch<React.SetStateAction<any>>;
    filtersOpen: boolean;
    setFiltersOpen: React.Dispatch<React.SetStateAction<boolean>>;
    employees: { id: string; full_name: string }[];
    uniqueVehicleTypes: string[];
    vehicleTypesMap: Record<string, string>;
    staysLookup: Record<string, Stay>;
    getGarageName: (id: string | null, customName?: string | null) => string;
    GarageFilter: React.ReactNode;
}

type SortMode = 'default' | 'desc' | 'asc';

export default function MovementsTable({
    unifiedTransactions,
    totalCaja,
    filters,
    setFilters,
    filtersOpen,
    setFiltersOpen,
    employees,
    uniqueVehicleTypes,
    vehicleTypesMap,
    staysLookup,
    getGarageName,
    GarageFilter
}: MovementsTableProps) {
    const [sortMode, setSortMode] = useState<SortMode>('default');

    const sortedTransactions = useMemo(() => {
        if (sortMode === 'default') return unifiedTransactions;
        
        return [...unifiedTransactions].sort((a, b) => {
            const valA = a.source === 'expense' ? -Math.abs(a.amount) : a.amount;
            const valB = b.source === 'expense' ? -Math.abs(b.amount) : b.amount;
            
            if (sortMode === 'desc') {
                if (valA !== valB) return valB - valA;
            } else {
                if (valA !== valB) return valA - valB;
            }
            
            // Stable sort for ties preserving the default order (chronological)
            return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        });
    }, [unifiedTransactions, sortMode]);

    const handleSortMonto = () => {
        setSortMode(prev => prev === 'default' ? 'desc' : prev === 'desc' ? 'asc' : 'default');
    };

    const SortIcon = sortMode === 'default' ? ArrowUpDown : sortMode === 'desc' ? ArrowDown : ArrowUp;

    return (
        <div className="animate-in fade-in duration-300 bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-slate-100 relative z-20 bg-white">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-slate-100 text-slate-600"><List className="h-4 w-4" /></div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-800">Registro de Movimientos</h3>
                        <p className="text-[10px] text-slate-400">{unifiedTransactions.length} registros</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {GarageFilter}
                    <div className="text-xs text-slate-600 font-mono bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                        {formatCurrency(totalCaja)}
                    </div>
                    <button onClick={() => setFiltersOpen(!filtersOpen)}
                        className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                            filtersOpen ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-white text-slate-500 border-slate-200 hover:text-slate-700 hover:border-slate-300")}>
                        <Filter className="h-3.5 w-3.5" />
                        Filtros
                        {filtersOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                </div>
            </div>

            {/* Collapsible Filters */}
            {filtersOpen && (
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 animate-in slide-in-from-top-2 duration-200 relative z-20">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-semibold text-slate-600 flex items-center gap-1.5"><Filter className="h-3.5 w-3.5 text-indigo-500" /> Filtros Avanzados</h4>
                        {Object.values(filters).some(v => v !== '') && (
                            <button onClick={() => setFilters({ operatorId: '', paymentMethod: '', vehicleType: '', tariffType: '', exactDate: '', startDate: '', endDate: '' })}
                                className="text-[10px] text-slate-500 hover:text-indigo-600 font-medium transition-colors flex items-center gap-0.5"><X className="h-3 w-3" /> Limpiar</button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-wider">Operador</label>
                            <select value={filters.operatorId} onChange={(e) => setFilters((p: any) => ({ ...p, operatorId: e.target.value }))}
                                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/50">
                                <option value="">Todos</option>
                                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-wider">Método Pago</label>
                            <select value={filters.paymentMethod} onChange={(e) => setFilters((p: any) => ({ ...p, paymentMethod: e.target.value }))}
                                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/50">
                                <option value="">Todos</option>
                                <option value="EFECTIVO">Efectivo</option>
                                <option value="TRANSFERENCIA">Transferencia</option>
                                <option value="DEBITO">Débito</option>
                                <option value="CREDITO">Crédito</option>
                                <option value="QR">QR</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-wider">Tipo Vehículo</label>
                            <select value={filters.vehicleType} onChange={(e) => setFilters((p: any) => ({ ...p, vehicleType: e.target.value }))}
                                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/50">
                                <option value="">Todos</option>
                                {uniqueVehicleTypes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-wider">Tipo Tarifa</label>
                            <select value={filters.tariffType} onChange={(e) => setFilters((p: any) => ({ ...p, tariffType: e.target.value }))}
                                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/50">
                                <option value="">Todas</option>
                                <option value="Hora">Hora / Estadía</option>
                                <option value="Abono">Abono</option>
                                <option value="Anticipado">Anticipado</option>
                                <option value="Egreso">Solo Egresos</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-wider">Fecha Exacta</label>
                            <input type="date" value={filters.exactDate} onChange={(e) => setFilters((p: any) => ({ ...p, exactDate: e.target.value, startDate: '', endDate: '' }))}
                                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/50" />
                        </div>
                        {!filters.exactDate && (
                            <>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Desde</label>
                                    <input type="date" value={filters.startDate} onChange={(e) => setFilters((p: any) => ({ ...p, startDate: e.target.value }))}
                                        className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/50" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Hasta</label>
                                    <input type="date" value={filters.endDate} onChange={(e) => setFilters((p: any) => ({ ...p, endDate: e.target.value }))}
                                        className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/50" />
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Movements Table */}
            <div className="h-[500px] overflow-auto relative">
                <table className="w-full text-sm text-left border-separate border-spacing-0">
                    <thead className="text-[10px] text-slate-500 uppercase bg-slate-50 sticky top-0 z-10 hidden md:table-header-group">
                        <tr>
                            <th className="px-4 py-3 font-semibold border-b border-slate-100 shadow-[0_1px_0_0_#f1f5f9]">Garaje</th>
                            <th className="px-4 py-3 font-semibold border-b border-slate-100 shadow-[0_1px_0_0_#f1f5f9]">Patente</th>
                            <th className="px-4 py-3 font-semibold border-b border-slate-100 shadow-[0_1px_0_0_#f1f5f9]">Hora</th>
                            <th className="px-4 py-3 font-semibold border-b border-slate-100 shadow-[0_1px_0_0_#f1f5f9]">Descripción</th>
                            <th className="px-4 py-3 font-semibold border-b border-slate-100 shadow-[0_1px_0_0_#f1f5f9]">Operador</th>
                            <th className="px-4 py-3 font-semibold border-b border-slate-100 shadow-[0_1px_0_0_#f1f5f9]">Método</th>
                            <th 
                                className="px-4 py-3 font-semibold text-right border-b border-slate-100 shadow-[0_1px_0_0_#f1f5f9] cursor-pointer hover:bg-slate-100/80 transition-colors group"
                                onClick={handleSortMonto}
                                title="Ordenar por monto"
                            >
                                <div className="flex items-center justify-end gap-1.5">
                                    <span>Monto</span>
                                    <SortIcon className={cn("h-3 w-3", sortMode === 'default' ? "opacity-40 group-hover:opacity-60" : "text-indigo-500")} />
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="block md:table-row-group">
                        {sortedTransactions.length === 0 ? (
                            <tr><td colSpan={7} className="p-12 text-center text-slate-400 text-sm">
                                <div className="flex flex-col items-center gap-2"><Inbox className="h-8 w-8 opacity-20" /><p>No hay movimientos en este período.</p></div>
                            </td></tr>
                        ) : (
                            sortedTransactions.slice(0, 500).map(txn => (
                                <tr key={txn.id} className={cn("hover:bg-indigo-50/40 transition-colors cursor-default flex flex-col md:table-row py-3 px-4 md:py-0 md:px-0", txn.source === 'expense' && "bg-red-50/30")}>
                                    {/* MOBILE ONLY COMPOSITE ROW */}
                                    <td className="md:hidden flex flex-col w-full">
                                        {/* Renglón 1 */}
                                        <div className="flex w-full items-center justify-start gap-2 mb-1">
                                            <span className={cn("font-bold font-mono text-sm shrink-0", txn.source === 'expense' ? 'text-red-600' : getAmountColor(txn.type))}>
                                                {txn.source === 'expense' ? `-${formatCurrency(txn.amount)}` : formatCurrency(txn.amount)}
                                            </span>
                                            <span className="text-slate-300 font-light">|</span>
                                            <span className="font-bold text-slate-800 text-sm truncate">
                                                {txn.source === 'expense' ? 'EGRESO' : (txn.plate || '---')}
                                            </span>
                                        </div>
                                        {/* Renglón 2 */}
                                        <div className="flex justify-between items-center mt-1">
                                            <span className="text-xs text-slate-600 truncate mr-2 flex-1">
                                                {txn.description || 'Sin descripción'} • <span className="font-medium text-indigo-600">{getGarageName(txn.garage_id)}</span>
                                            </span>
                                            <span className="text-[10px] uppercase font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                                {txn.source === 'expense' ? '---' : (txn.payment_method || '---')}
                                            </span>
                                        </div>
                                        {/* Renglón 3 */}
                                        <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                                            {txn.source === 'movement' && txn.type === 'CobroEstadia' && txn.related_entity_id && staysLookup[txn.related_entity_id] ? (
                                                <span>
                                                    {formatDate(staysLookup[txn.related_entity_id].entry_time)} - {formatDate(staysLookup[txn.related_entity_id].exit_time || txn.timestamp)}
                                                </span>
                                            ) : (
                                                <span>{formatDate(txn.timestamp)}</span>
                                            )}
                                            <span>•</span>
                                            <span>{txn.operator ? txn.operator.substring(0, 3).toUpperCase() : 'SYS'}</span>
                                        </div>
                                    </td>

                                    {/* DESKTOP CELLS (Hidden on mobile) */}
                                    <td className="hidden md:table-cell px-4 py-3.5 border-b border-slate-100/50"><span className="font-medium text-slate-600 text-xs">{getGarageName(txn.garage_id)}</span></td>
                                    <td className="hidden md:table-cell px-4 py-3.5 border-b border-slate-100/50">
                                        {txn.source === 'expense' ? (
                                            <div className="flex flex-col">
                                                <span className="font-bold font-mono text-slate-400 tracking-wide">N/A</span>
                                                <span className="text-[10px] text-red-400 font-semibold uppercase">Egreso</span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col">
                                                <span className="font-bold font-mono text-slate-800 tracking-wide">{txn.plate || '---'}</span>
                                                <span className="text-[10px] text-slate-400 uppercase">
                                                    {(txn.plate && vehicleTypesMap[txn.plate]) ? vehicleTypesMap[txn.plate] : (txn.vehicle_type || 'Vehículo')}
                                                </span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="hidden md:table-cell px-4 py-3.5 text-left text-xs font-medium border-b border-slate-100/50">
                                        {txn.source === 'movement' && txn.type === 'CobroEstadia' && txn.related_entity_id && staysLookup[txn.related_entity_id] ? (
                                            <div className="flex flex-col items-start gap-0.5">
                                                <div className="flex items-center gap-1 text-slate-500 text-[10px]">
                                                    <ArrowUpRight className="h-3 w-3 opacity-60" />
                                                    <span>{formatDate(staysLookup[txn.related_entity_id].entry_time)}</span>
                                                </div>
                                                <div className="flex items-center gap-1 text-slate-700">
                                                    <ArrowDownRight className="h-3 w-3 opacity-60" />
                                                    <span>{formatDate(staysLookup[txn.related_entity_id].exit_time || txn.timestamp)}</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-slate-500">{formatDate(txn.timestamp)}</span>
                                        )}
                                    </td>
                                    <td className="hidden md:table-cell px-4 py-3.5 border-b border-slate-100/50">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-xs text-slate-600">{txn.description || '---'}</span>
                                        </div>
                                    </td>
                                    <td className="hidden md:table-cell px-4 py-3.5 border-b border-slate-100/50">
                                        <span className={cn("text-xs font-medium", (!txn.operator || txn.operator === 'Sistema') ? "text-slate-400" : "text-slate-600")}>
                                            {txn.operator || 'Sistema'}
                                        </span>
                                    </td>
                                    <td className="hidden md:table-cell px-4 py-3.5 border-b border-slate-100/50">
                                        <span className="text-xs text-slate-500 font-medium font-mono">
                                            {txn.source === 'expense' ? '---' : (txn.payment_method?.toUpperCase() || '---')}
                                        </span>
                                    </td>
                                    <td className={cn("hidden md:table-cell px-4 py-3.5 text-right font-bold font-mono border-b border-slate-100/50",
                                        txn.source === 'expense' ? 'text-red-600' : getAmountColor(txn.type)
                                    )}>
                                        {txn.source === 'expense' ? `-${formatCurrency(txn.amount)}` : formatCurrency(txn.amount)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
