import React, { useMemo } from 'react';
import { X, CheckCircle2, User, Car, Clock } from 'lucide-react';
import { Cochera, Stay, getTimeElapsed } from '../CashFlowShared';

interface OccupancyModalProps {
    isOpen: boolean;
    onClose: () => void;
    cocheras: Cochera[];
    activeStays: Stay[];
}

export default function OccupancyModal({ isOpen, onClose, cocheras, activeStays }: OccupancyModalProps) {
    if (!isOpen) return null;

    // Cocheras that are available
    const libres = useMemo(() => cocheras.filter(c => c.status === 'Disponible' || c.status === 'Libre'), [cocheras]);
    
    // Cocheras that are occupied (Fijas/Abonados)
    const ocupadas = useMemo(() => cocheras.filter(c => c.status === 'Ocupada'), [cocheras]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="fixed inset-0 md:relative bg-white rounded-none md:rounded-2xl w-full h-full md:h-auto md:w-full md:max-w-4xl md:max-h-[80vh] flex flex-col shadow-xl border-0 md:border border-slate-200/60 overflow-hidden">
                {/* Header */}
                <div className="sticky top-0 z-10 flex items-center justify-between p-4 md:p-6 bg-white/80 backdrop-blur-md border-b border-slate-100">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Ocupación Real</h2>
                        <p className="text-sm text-slate-500 mt-1">
                            {libres.length} Libres | {ocupadas.length} Fijas | {activeStays.length} Estadías
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-xl transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8">
                    
                    {/* Section 1: Cocheras Libres */}
                    <section>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="h-6 w-1.5 bg-emerald-400 rounded-full"></div>
                            <h3 className="text-lg font-semibold text-slate-800">Cocheras Libres</h3>
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-xs font-bold font-mono">
                                {libres.length}
                            </span>
                        </div>
                        {libres.length === 0 ? (
                            <p className="text-sm text-slate-500 italic">No hay cocheras libres en este momento.</p>
                        ) : (
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                                {libres.map((c) => (
                                    <div key={c.id} className="flex flex-col items-center justify-center p-3 rounded-xl border border-emerald-100 bg-emerald-50/50 shadow-sm">
                                        <CheckCircle2 className="h-5 w-5 text-emerald-500 mb-1" />
                                        <span className="text-sm font-bold font-mono text-emerald-700">#{c.numero || c.id.slice(0,4)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Section 2: Cocheras Ocupadas (Fijas/Abonados) */}
                    <section>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="h-6 w-1.5 bg-indigo-400 rounded-full"></div>
                            <h3 className="text-lg font-semibold text-slate-800">Cocheras Ocupadas (Fijas)</h3>
                            <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold font-mono">
                                {ocupadas.length}
                            </span>
                        </div>
                        {ocupadas.length === 0 ? (
                            <p className="text-sm text-slate-500 italic">No hay cocheras fijas ocupadas.</p>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                {ocupadas.map((c) => (
                                    <div key={c.id} className="flex flex-col p-3 rounded-xl border border-indigo-100 bg-indigo-50/50 shadow-sm relative overflow-hidden group">
                                        <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                            <User className="h-16 w-16 text-indigo-900" />
                                        </div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-bold font-mono text-indigo-700">#{c.numero || c.id.slice(0,4)}</span>
                                            <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500 bg-indigo-100 px-1.5 py-0.5 rounded-md">
                                                Fija
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs text-indigo-800 font-medium truncate">
                                            <Car className="h-3.5 w-3.5 shrink-0" />
                                            <span className="truncate">
                                                {c.vehiculos && c.vehiculos.length > 0 ? c.vehiculos[0] : (c.cliente_id ? 'Cliente Asignado' : 'Sin Datos')}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Section 3: Estadías Activas (Rotativas) */}
                    <section>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="h-6 w-1.5 bg-amber-400 rounded-full"></div>
                            <h3 className="text-lg font-semibold text-slate-800">Estadías Activas (Rotativas)</h3>
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-600 text-xs font-bold font-mono">
                                {activeStays.length}
                            </span>
                        </div>
                        {activeStays.length === 0 ? (
                            <p className="text-sm text-slate-500 italic">No hay estadías activas en este momento.</p>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                {activeStays.map((stay) => (
                                    <div key={stay.id} className="flex flex-col p-3 rounded-xl border border-amber-100 bg-amber-50/50 shadow-sm">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-bold font-mono text-slate-800 uppercase bg-white px-2 py-0.5 rounded shadow-sm border border-slate-100">
                                                {stay.plate || 'S/P'}
                                            </span>
                                            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-md truncate max-w-[80px]">
                                                {stay.vehicle_type || 'Vehículo'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                            <Clock className="h-3.5 w-3.5 shrink-0" />
                                            <span>
                                                Ingreso: {new Date(stay.entry_time).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            <span className="ml-auto font-medium text-amber-600 bg-amber-100/50 px-1.5 rounded">
                                                {getTimeElapsed(stay.entry_time)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                </div>
            </div>
        </div>
    );
}
