import React, { useState, useMemo } from 'react';
import { X, CreditCard, Search, AlertTriangle } from 'lucide-react';
import { cn, formatCurrency, formatDate, Subscription, Cochera, Customer } from '../CashFlowShared';
import { enhanceSubscription, filterEnhancedSubscription } from '../subscriptionUtils';

import { Garage } from '../../../../types';
import { Filter, MapPin } from 'lucide-react';

interface SubscriptionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    activeSubscriptions: Subscription[];
    inactiveSubscriptions: Subscription[];
    customers: Customer[];
    vehicles: { id?: string; plate: string; garage_id?: string; type?: string }[];
    cocheras: Cochera[];
    garages: Garage[];
    initialGarageId: string;
}

export default function SubscriptionsModal({
    isOpen,
    onClose,
    activeSubscriptions,
    inactiveSubscriptions,
    customers,
    vehicles,
    cocheras,
    garages,
    initialGarageId
}: SubscriptionsModalProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [modalGarageId, setModalGarageId] = useState(initialGarageId);

    // Sync initialGarageId when modal opens
    React.useEffect(() => {
        if (isOpen) {
            setModalGarageId(initialGarageId);
            setSearchTerm('');
        }
    }, [isOpen, initialGarageId]);

    const customerById = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers]);
    const vehicleById = useMemo(() => new Map(vehicles.map(v => [v.id, v])), [vehicles]);
    
    const vehicleByNormalizedPlate = useMemo(() => {
        const map = new Map<string, typeof vehicles[0]>();
        vehicles.forEach(v => {
            if (v.plate) {
                map.set(v.plate.trim().toUpperCase(), v);
            }
        });
        return map;
    }, [vehicles]);
    
    const garageById = useMemo(() => new Map(garages.map(g => [g.id, g])), [garages]);

    // Group cocheras by garage_id + cliente_id for fast lookup
    const cocherasByGarageCustomer = useMemo(() => {
        const map = new Map<string, Cochera[]>();
        cocheras.forEach(c => {
            if (!c.cliente_id) return;
            const key = c.garage_id + '_' + c.cliente_id;
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(c);
        });
        return map;
    }, [cocheras]);

    // Local filtering by garage BEFORE any enrichment
    const localActiveSubscriptions = useMemo(() => {
        return modalGarageId === 'all' 
            ? activeSubscriptions 
            : activeSubscriptions.filter(s => s.garage_id === modalGarageId);
    }, [activeSubscriptions, modalGarageId]);

    const localInactiveSubscriptions = useMemo(() => {
        return modalGarageId === 'all' 
            ? inactiveSubscriptions 
            : inactiveSubscriptions.filter(s => s.garage_id === modalGarageId);
    }, [inactiveSubscriptions, modalGarageId]);

    // Track active vehicle_ids to detect duplicates
    const activeGarageVehicleCounts = useMemo(() => {
        const counts = new Map<string, number>();
        localActiveSubscriptions.forEach(sub => {
            if (!sub.vehicle_id || !sub.garage_id) return;
            const key = sub.garage_id + '_' + sub.vehicle_id;
            counts.set(key, (counts.get(key) || 0) + 1);
        });
        return counts;
    }, [localActiveSubscriptions]);

    const activeEnhanced = useMemo(() => localActiveSubscriptions.map(s => enhanceSubscription(s, true, customerById, vehicleById, cocherasByGarageCustomer, activeGarageVehicleCounts)), [localActiveSubscriptions, customerById, vehicleById, cocherasByGarageCustomer, activeGarageVehicleCounts]);
    const inactiveEnhanced = useMemo(() => localInactiveSubscriptions.map(s => enhanceSubscription(s, false, customerById, vehicleById, cocherasByGarageCustomer, activeGarageVehicleCounts)), [localInactiveSubscriptions, customerById, vehicleById, cocherasByGarageCustomer, activeGarageVehicleCounts]);

    interface CustomerGroup {
        key: string;
        customer: Customer | undefined;
        garageId: string;
        cocheras: Map<string, { cochera: Cochera; subscriptions: ReturnType<typeof enhanceSubscription>[] }>;
        unresolvedSubscriptions: ReturnType<typeof enhanceSubscription>[];
    }

    const buildActiveCustomerGroups = (enhancedSubs: ReturnType<typeof enhanceSubscription>[]) => {
        const groups = new Map<string, CustomerGroup>();
        
        // 1. Ensure all customers from active subscriptions are registered
        enhancedSubs.forEach(item => {
            const { sub, customer } = item;
            const customerId = sub.customer_id || 'unknown';
            const garageId = sub.garage_id || 'unknown';
            const key = `${garageId}_${customerId}`;
            if (!groups.has(key)) {
                groups.set(key, {
                    key,
                    customer,
                    garageId,
                    cocheras: new Map(),
                    unresolvedSubscriptions: []
                });
            }
        });

        // 2. For each active customer, fetch ALL currently assigned cocheras (Ocupada)
        groups.forEach(group => {
            const customerCocheras = cocherasByGarageCustomer.get(group.key) || [];
            const assignedCocheras = customerCocheras.filter(c => c.status === 'Ocupada');
            
            assignedCocheras.forEach(cochera => {
                if (cochera.id) {
                    group.cocheras.set(cochera.id, {
                        cochera,
                        subscriptions: []
                    });
                }
            });
        });

        // 3. Distribute the subscriptions into the cocheras
        enhancedSubs.forEach(item => {
            const { sub, targetCochera } = item;
            const customerId = sub.customer_id || 'unknown';
            const garageId = sub.garage_id || 'unknown';
            const key = `${garageId}_${customerId}`;
            const group = groups.get(key)!;
            
            if (targetCochera && targetCochera.id && group.cocheras.has(targetCochera.id)) {
                group.cocheras.get(targetCochera.id)!.subscriptions.push(item);
            } else {
                group.unresolvedSubscriptions.push(item);
            }
        });

        return Array.from(groups.values());
    };

    const buildInactiveCustomerGroups = (enhancedSubs: ReturnType<typeof enhanceSubscription>[]) => {
        const groups = new Map<string, CustomerGroup>();
        enhancedSubs.forEach(item => {
            const { sub, customer, targetCochera } = item;
            const customerId = sub.customer_id || 'unknown';
            const garageId = sub.garage_id || 'unknown';
            const key = `${garageId}_${customerId}`;
            if (!groups.has(key)) {
                groups.set(key, {
                    key,
                    customer,
                    garageId,
                    cocheras: new Map(),
                    unresolvedSubscriptions: []
                });
            }
            const group = groups.get(key)!;
            
            // For inactives, ONLY use cocheras resolved from the subscription historically
            if (targetCochera && targetCochera.id) {
                if (!group.cocheras.has(targetCochera.id)) {
                    group.cocheras.set(targetCochera.id, {
                        cochera: targetCochera,
                        subscriptions: []
                    });
                }
                group.cocheras.get(targetCochera.id)!.subscriptions.push(item);
            } else {
                group.unresolvedSubscriptions.push(item);
            }
        });
        
        return Array.from(groups.values());
    };

    const allActiveGroups = useMemo(() => buildActiveCustomerGroups(activeEnhanced), [activeEnhanced, cocherasByGarageCustomer]);
    const allInactiveGroups = useMemo(() => buildInactiveCustomerGroups(inactiveEnhanced), [inactiveEnhanced]);

    const filterGroup = (group: CustomerGroup, searchTerm: string) => {
        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        
        if (group.customer?.name?.toLowerCase().includes(q)) return true;
        if (group.customer?.dni?.toLowerCase().includes(q)) return true;
        
        const garageName = garageById.get(group.garageId)?.name ?? 'Garage desconocido';
        if (garageName.toLowerCase().includes(q)) return true;
        
        for (const { cochera, subscriptions } of group.cocheras.values()) {
            if (cochera.numero?.toLowerCase().includes(q)) return true;
            if (cochera.vehiculos?.some(v => v.toLowerCase().includes(q))) return true;
            if (cochera.tipo?.toLowerCase().includes(q)) return true;
            if (subscriptions.some(s => s.sub.id?.toLowerCase().includes(q) || s.mainVehicle?.plate?.toLowerCase().includes(q) || s.mainVehicle?.type?.toLowerCase().includes(q))) return true;
        }
        
        for (const s of group.unresolvedSubscriptions) {
            if (s.sub.id?.toLowerCase().includes(q) || s.mainVehicle?.plate?.toLowerCase().includes(q) || s.mainVehicle?.type?.toLowerCase().includes(q)) return true;
        }
        
        return false;
    };

    const groupedActive = useMemo(() => {
        return allActiveGroups
            .filter(g => filterGroup(g, searchTerm))
            .sort((a, b) => (a.customer?.name || '').localeCompare(b.customer?.name || ''));
    }, [allActiveGroups, searchTerm]);

    const groupedInactive = useMemo(() => {
        return allInactiveGroups
            .filter(g => filterGroup(g, searchTerm))
            .sort((a, b) => (a.customer?.name || '').localeCompare(b.customer?.name || ''));
    }, [allInactiveGroups, searchTerm]);

    const activeFilteredSubCount = useMemo(() => {
        return groupedActive.reduce((sum, g) => {
            let count = g.unresolvedSubscriptions.length;
            for (const { subscriptions } of g.cocheras.values()) count += subscriptions.length;
            return sum + count;
        }, 0);
    }, [groupedActive]);

    const inactiveFilteredSubCount = useMemo(() => {
        return groupedInactive.reduce((sum, g) => {
            let count = g.unresolvedSubscriptions.length;
            for (const { subscriptions } of g.cocheras.values()) count += subscriptions.length;
            return sum + count;
        }, 0);
    }, [groupedInactive]);

    if (!isOpen) return null;

    const renderPlate = (plateStr: string, relevantSubs: ReturnType<typeof enhanceSubscription>[]) => {
        const normalized = plateStr.trim().toUpperCase();
        const v = vehicleByNormalizedPlate.get(normalized);
        const vType = v?.type ? v.type.toUpperCase() : null;
        
        const isDup = relevantSubs.some(s => 
            s.isDuplicate && s.mainVehicle?.plate?.trim().toUpperCase() === normalized
        );

        return (
            <div key={plateStr} className="flex items-center gap-2">
                <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono text-[10px] flex items-center gap-1 border border-slate-200">
                    {normalized}
                    {vType && <span className="text-slate-400 font-sans text-[9px] tracking-wider">· {vType}</span>}
                </span>
                {isDup && (
                    <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded flex items-center gap-1" title="El mismo vehículo está asociado a más de un abono activo en este garage">
                        <AlertTriangle className="w-3 h-3" /> Vehículo en 2 abonos activos
                    </span>
                )}
            </div>
        );
    };

    const CustomerGroupCard = ({ group, isActive }: { group: CustomerGroup, isActive: boolean }) => {
        const garageName = garageById.get(group.garageId)?.name ?? 'Garage desconocido';
        
        return (
            <div className={cn("bg-white rounded-xl border p-4 hover:shadow-sm transition-all", isActive ? "border-slate-200" : "border-slate-100 opacity-80")}>
                {/* Customer Header */}
                <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-2 flex-wrap">
                    <h4 className="text-sm font-bold text-slate-800">
                        {group.customer ? group.customer.name : <span className="text-slate-400 italic">Cliente no encontrado</span>}
                    </h4>
                    {group.customer?.dni && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">DNI {group.customer.dni}</span>}
                    {!group.customer && <span className="text-[10px] text-slate-400 font-mono" title="Customer ID">{group.key.split('_')[1]}</span>}
                    
                    {modalGarageId === 'all' && (
                        <span className="text-[10px] bg-slate-50 text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded-md font-medium flex items-center gap-1 ml-auto md:ml-0">
                            <MapPin className="w-3 h-3" />
                            {garageName}
                        </span>
                    )}
                </div>
                
                <div className="space-y-4">
                    {/* Resolved Cocheras */}
                    {Array.from(group.cocheras.values()).map(({ cochera, subscriptions }) => (
                        <div key={cochera.id} className="flex flex-col md:flex-row justify-between gap-4">
                            <div className="flex-1 space-y-2">
                                <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-md px-2 py-0.5">
                                    <span className="text-xs font-semibold text-slate-700">Cochera {cochera.numero || 'Móvil'}</span>
                                    {cochera.tipo && <span className="text-[10px] text-slate-500 font-medium">· {cochera.tipo}</span>}
                                </div>
                                
                                <div className="flex flex-col gap-1.5 pl-1">
                                    {cochera.vehiculos && cochera.vehiculos.length > 0 ? (
                                        cochera.vehiculos.map(v => renderPlate(v, subscriptions))
                                    ) : (
                                        subscriptions.map(item => item.mainVehicle?.plate ? renderPlate(item.mainVehicle.plate, [item]) : <span key={item.sub.id} className="text-xs text-slate-400 italic">No asociado</span>)
                                    )}
                                </div>
                            </div>
                            
                            <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-2 md:gap-1 pl-0 md:pl-4 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 shrink-0">
                                <div className="text-base font-bold font-mono text-slate-800">
                                    {cochera.precio_base != null ? (
                                        <div className="flex flex-col items-end">
                                            <span className="text-[10px] text-slate-400 font-sans normal-case tracking-normal mb-0.5">Precio base</span>
                                            <span>{formatCurrency(Number(cochera.precio_base))}</span>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-slate-400 italic font-sans">No determinado</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Unresolved Subscriptions */}
                    {group.unresolvedSubscriptions.map(item => (
                        <div key={item.sub.id} className="flex flex-col md:flex-row justify-between gap-4 opacity-75">
                            <div className="flex-1 space-y-2">
                                <div className="inline-flex items-center gap-1.5 text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-2 py-0.5">
                                    <span className="text-xs font-semibold">{item.multipleCandidates ? 'Coincidencia múltiple' : 'Cochera no determinada'}</span>
                                </div>
                                
                                <div className="flex flex-col gap-1.5 pl-1">
                                    {item.mainVehicle?.plate ? renderPlate(item.mainVehicle.plate, [item]) : <span className="text-xs text-slate-400 italic">Vehículo no asociado</span>}
                                </div>
                            </div>
                            
                            <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-2 md:gap-1 pl-0 md:pl-4 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 shrink-0">
                                <div className="text-base font-bold font-mono text-slate-800">
                                    <span className="text-xs text-slate-400 italic font-sans">Precio base no disponible</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const currentGarageName = modalGarageId === 'all' ? 'Todos los Garajes' : (garages.find(g => g.id === modalGarageId)?.name || 'Todos los Garajes');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />
            <div className="relative bg-slate-50 rounded-2xl shadow-xl w-[95%] md:w-full md:max-w-4xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="subscriptions-modal-title">
                
                {/* Header */}
                <div className="flex flex-col gap-3 p-4 md:px-6 md:py-4 border-b border-slate-200 bg-white rounded-t-2xl shrink-0">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-violet-50 text-violet-600 hidden sm:block"><CreditCard className="h-5 w-5" /></div>
                            <div>
                                <h3 id="subscriptions-modal-title" className="text-base font-bold text-slate-800">Detalle de Abonos</h3>
                                <p className="text-xs text-slate-500 font-medium">{currentGarageName}</p>
                            </div>
                        </div>
                        <button onClick={onClose}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors shrink-0">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-center gap-4 text-sm bg-slate-50 p-2 rounded-lg border border-slate-100 overflow-x-auto whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                <span className="text-slate-600">Activos <strong className="text-emerald-700 ml-0.5">{localActiveSubscriptions.length}</strong></span>
                            </div>
                            <div className="w-px h-4 bg-slate-200 shrink-0"></div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                                <span className="text-slate-500">Inactivos <strong className="text-slate-700 ml-0.5">{localInactiveSubscriptions.length}</strong></span>
                            </div>
                            <div className="w-px h-4 bg-slate-200 shrink-0 hidden sm:block"></div>
                            <div className="items-center gap-1.5 hidden sm:flex">
                                <span className="text-slate-500">Total <strong className="text-slate-700 ml-0.5">{localActiveSubscriptions.length + localInactiveSubscriptions.length}</strong></span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap md:flex-nowrap flex-1 justify-end">
                            <div className="relative shrink-0 w-full md:w-auto">
                                <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <select
                                    value={modalGarageId}
                                    onChange={(e) => setModalGarageId(e.target.value)}
                                    className="w-full md:w-auto pl-8 pr-4 py-1.5 text-sm h-[34px] bg-white border border-slate-200 rounded-lg text-slate-700 focus:ring-2 focus:ring-violet-500 shadow-sm cursor-pointer outline-none appearance-none"
                                    aria-label="Filtrar por garage"
                                >
                                    <option value="all">Todos los Garages</option>
                                    {garages.map(g => (
                                        <option key={g.id} value={g.id}>{g.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="relative flex-1 max-w-xs shrink-0 w-full md:w-auto">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder="Buscar cliente, DNI, cochera, patente..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-4 py-1.5 text-sm h-[34px] border border-slate-200 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none transition-shadow"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="overflow-y-auto flex-1 p-4 md:p-6 scroll-smooth">
                    {searchTerm && (
                        <p className="text-xs font-medium text-slate-500 mb-4 bg-white py-1 px-3 inline-block rounded-full border border-slate-200 shadow-sm">
                            Mostrando {activeFilteredSubCount} de {localActiveSubscriptions.length} abonos activos
                        </p>
                    )}

                    <div className="space-y-6">
                        {/* Activos Section */}
                        <section>
                            <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                Abonos Activos
                                <span className="text-xs font-medium text-slate-400 font-mono bg-slate-200 px-1.5 rounded">{localActiveSubscriptions.length}</span>
                            </h4>
                            
                            {groupedActive.length === 0 ? (
                                <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                                    {searchTerm ? 'No se encontraron resultados en abonos activos.' : 'No hay abonos activos para este garage.'}
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {groupedActive.map((group) => (
                                        <CustomerGroupCard key={group.key} group={group} isActive={true} />
                                    ))}
                                </div>
                            )}
                        </section>

                        <hr className="border-slate-200" />

                        {/* Inactivos Section */}
                        <section>
                            <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                                Abonos Inactivos
                                <span className="text-xs font-medium text-slate-400 font-mono bg-slate-200 px-1.5 rounded">{localInactiveSubscriptions.length}</span>
                            </h4>

                            {groupedInactive.length === 0 ? (
                                <div className="bg-white rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-400">
                                    {searchTerm ? 'No se encontraron resultados en abonos inactivos.' : 'No hay abonos inactivos registrados.'}
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {groupedInactive.map((group) => (
                                        <CustomerGroupCard key={group.key} group={group} isActive={false} />
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}
