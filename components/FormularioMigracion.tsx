import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
    Save,
    Loader2,
    User,
    Car,
    MapPin,
    Phone,
    Mail,
    CheckCircle2,
    AlertCircle,
    Banknote,
    Database
} from 'lucide-react';
import { VehicleType, Tariff, Price } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface FormularioMigracionProps {
    garageId: string;
}

export default function FormularioMigracion({ garageId }: FormularioMigracionProps) {
    // --- STATE ---
    const [loading, setLoading] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Data Loading
    const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
    const [allAbonoTariffs, setAllAbonoTariffs] = useState<Tariff[]>([]);
    const [prices, setPrices] = useState<Price[]>([]);

    // Form State
    const [formData, setFormData] = useState({
        tipoCochera: 'Movil',
        numeroCochera: '',
        exclusivaOverride: false,

        nombre: '',
        dni: '',
        email: '',
        domicilio: '',
        localidad: '',
        telParticular: '',

        patente: '',
        marca: '',
        modelo: '',
        color: '',
        year: '',
        insurance: '',
        vehicleTypeId: '',

        initialDebtAmount: 0
    });

    const [ownerId, setOwnerId] = useState<string | null>(null);

    const [basePriceDisplay, setBasePriceDisplay] = useState(0);
    const [proratedPrice, setProratedPrice] = useState(0);

    // --- INIT ---
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch User Session for Owner ID
                const { data: { session } } = await supabase.auth.getSession();
                let userOwnerId = null;
                if (session?.user?.id) {
                    const { data: account } = await supabase.from('employee_accounts').select('owner_id').eq('id', session.user.id).single();
                    userOwnerId = account?.owner_id || session.user.id; // Fallback to user id if no account found (e.g. they are the owner)
                }
                setOwnerId(userOwnerId);

                const [resVehicles, resTariffs, resPrices] = await Promise.all([
                    supabase.from('vehicle_types').select('*').eq('garage_id', garageId).order('sort_order'),
                    supabase.from('tariffs').select('*').eq('garage_id', garageId).eq('type', 'abono'),
                    supabase.from('prices').select('*').eq('garage_id', garageId).eq('price_list', 'standard')
                ]);

                if (resVehicles.data) setVehicleTypes(resVehicles.data);
                if (resTariffs.data) setAllAbonoTariffs(resTariffs.data);
                if (resPrices.data) setPrices(resPrices.data);

            } catch (err) {
                console.error("Error loading config:", err);
            }
        };
        if (garageId) fetchData();
    }, [garageId]);

    // --- PRICE CALCULATION ---
    useEffect(() => {
        const targetTariffName = formData.exclusivaOverride ? 'Exclusiva' : formData.tipoCochera;
        const activeTariff = allAbonoTariffs.find(t => t.name.toLowerCase().includes(targetTariffName.toLowerCase()));

        if (!formData.vehicleTypeId || !activeTariff) {
            setBasePriceDisplay(0);
            setProratedPrice(0);
            return;
        }

        // Find base price configured in Matrix
        const priceRecord = prices.find(p => p.tariff_id === activeTariff.id && p.vehicle_type_id === formData.vehicleTypeId);
        const standardPrice = priceRecord ? Number(priceRecord.amount) : 0;

        setBasePriceDisplay(standardPrice);

        if (standardPrice > 0) {
            const now = new Date();
            const currentDay = now.getDate();
            const ultimoDiaMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            const diasRestantes = (ultimoDiaMes - currentDay) + 1;

            const exactCalc = (standardPrice / ultimoDiaMes) * diasRestantes;
            const roundedDown = Math.floor(exactCalc / 100) * 100;

            setProratedPrice(roundedDown);
        } else {
            setProratedPrice(0);
        }

    }, [formData.vehicleTypeId, formData.tipoCochera, formData.exclusivaOverride, allAbonoTariffs, prices]);

    // --- HELPERS ---
    const handleInputChange = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setFeedback(null);
    };

    // --- SUBMIT: THE MIGRATION LOGIC ---
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setFeedback(null);

        try {
            if (!formData.tipoCochera) throw new Error("Seleccione un tipo de cochera.");
            if ((formData.tipoCochera === 'Fija' || formData.exclusivaOverride) && !formData.numeroCochera) {
                throw new Error("Especifique el número de la cochera.");
            }
            if (!formData.dni || !formData.nombre || !formData.patente || !formData.vehicleTypeId) {
                throw new Error("Complete los datos mínimos obligatorios (DNI, Nombre, Patente, Tipo V.).");
            }

            // Cleanup
            const cleanedDni = formData.dni.trim();
            const cleanedPlate = formData.patente.trim().toUpperCase();
            const finalType = formData.exclusivaOverride ? 'Exclusiva' : formData.tipoCochera;

            // 1. Upsert Customer
            let customerId: string;
            const { data: existingCustomer } = await supabase
                .from('customers')
                .select('id')
                .eq('garage_id', garageId)
                .eq('dni', cleanedDni)
                .maybeSingle();

            const customerPayload: any = {
                garage_id: garageId,
                dni: cleanedDni,
                name: formData.nombre,
                email: formData.email,
                phone: formData.telParticular,
                address: formData.domicilio,
                localidad: formData.localidad
            };
            if (ownerId) customerPayload.owner_id = ownerId;

            if (existingCustomer) {
                const { data, error } = await supabase.from('customers').update(customerPayload).eq('id', existingCustomer.id).select().single();
                if (error) throw error;
                customerId = data.id;
            } else {
                const { data, error } = await supabase.from('customers').insert(customerPayload).select().single();
                if (error) throw error;
                customerId = data.id;
            }

            // 2. Upsert Vehicle
            let vehicleId: string;
            const { data: existingVehicle } = await supabase
                .from('vehicles')
                .select('id')
                .eq('garage_id', garageId)
                .eq('plate', cleanedPlate)
                .maybeSingle();

            const vehiclePayload: any = {
                garage_id: garageId,
                customer_id: customerId,
                plate: cleanedPlate,
                type: vehicleTypes.find(v => v.id === formData.vehicleTypeId)?.name || 'Auto',
                brand: formData.marca,
                model: formData.modelo,
                color: formData.color,
                year: formData.year,
                insurance: formData.insurance,
                is_subscriber: true
            };
            if (ownerId) vehiclePayload.owner_id = ownerId;

            if (existingVehicle) {
                const { data, error } = await supabase.from('vehicles').update(vehiclePayload).eq('id', existingVehicle.id).select().single();
                if (error) throw error;
                vehicleId = data.id;
            } else {
                const { data, error } = await supabase.from('vehicles').insert(vehiclePayload).select().single();
                if (error) throw error;
                vehicleId = data.id;
            }

            // 3. Update/Insert Cochera
            let cocheraId: string;
            const cocheraPayload: any = {
                garage_id: garageId,
                cliente_id: customerId,
                tipo: finalType,
                numero: finalType === 'Movil' ? `M-${cleanedPlate}` : formData.numeroCochera,
                vehiculos: [cleanedPlate],
                status: 'Ocupada',
                precio_base: basePriceDisplay // Saving standard value as instructed
            };

            if (finalType === 'Movil') {
                // Always create new for Movil, maybe checking if one already mapping this plate exists
                const { data, error } = await supabase.from('cocheras').insert(cocheraPayload).select().single();
                if (error) throw error;
                cocheraId = data.id;
            } else {
                // Fija/Exclusiva: Lookup by number
                const { data: existingCochera } = await supabase
                    .from('cocheras')
                    .select('id')
                    .eq('garage_id', garageId)
                    .eq('numero', formData.numeroCochera)
                    .maybeSingle();

                if (existingCochera) {
                    const { data, error } = await supabase.from('cocheras').update(cocheraPayload).eq('id', existingCochera.id).select().single();
                    if (error) throw error;
                    cocheraId = data.id;
                } else {
                    const { data, error } = await supabase.from('cocheras').insert(cocheraPayload).select().single();
                    if (error) throw error;
                    cocheraId = data.id;
                }
            }

            // 4. Insert Subscription (With Prorated Price)
            const now = new Date();
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

            const subPayload: any = {
                garage_id: garageId,
                customer_id: customerId,
                vehicle_id: vehicleId,
                type: finalType,
                price: proratedPrice,
                start_date: now.toISOString(),
                end_date: endOfMonth.toISOString(), // Standard expiry
                active: true
            };
            if (ownerId) subPayload.owner_id = ownerId;

            const { data: subData, error: subError } = await supabase.from('subscriptions').insert(subPayload).select().single();
            if (subError) throw subError;

            // 5. Insert Debt Optionally (NO movements created)
            if (formData.initialDebtAmount > 0) {
                const debtPayload = {
                    garage_id: garageId,
                    subscription_id: subData.id,
                    customer_id: customerId,
                    amount: formData.initialDebtAmount,
                    status: 'PENDING',
                    due_date: now.toISOString(), // due_date to now()
                    surcharge_applied: 0
                };
                const { error: debtError } = await supabase.from('debts').insert(debtPayload);
                if (debtError) console.warn("Error creating debt:", debtError); // Non-blocking
            }

            setFeedback({ type: 'success', text: 'Datos cargados exitosamente.' });

            // Clear specific form states
            setFormData(prev => ({
                ...prev,
                numeroCochera: '',
                nombre: '',
                dni: '',
                email: '',
                domicilio: '',
                localidad: '',
                telParticular: '',
                patente: '',
                marca: '',
                modelo: '',
                color: '',
                year: '',
                insurance: '',
                initialDebtAmount: 0
            }));

            setTimeout(() => setFeedback(null), 4000);

        } catch (err: any) {
            console.error("Migration Error:", err);
            setFeedback({ type: 'error', text: err.message || 'Error al procesar la carga de datos.' });
        } finally {
            setLoading(false);
        }
    };

    const inputClass = "w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-900 font-medium placeholder:text-slate-400";
    const labelClass = "text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block";

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 max-w-5xl mx-auto space-y-6 flex flex-col items-center">

            {/* Informative Alert */}
            <div className="w-full bg-indigo-50 border border-indigo-200 p-4 rounded-xl flex gap-3 text-indigo-800 shadow-sm">
                <Database className="h-5 w-5 shrink-0 text-indigo-600" />
                <div>
                    <h4 className="font-bold text-sm">Carga Silenciosa de Datos</h4>
                    <p className="text-sm mt-1 opacity-90">
                        Esta herramienta permite poblar la base de datos de <strong>Clientes, Vehículos, Cocheras y Suscripciones.</strong>
                        Su propósito es la migración inicial de abonados. <strong>NO genera movimientos en caja.</strong>
                    </p>
                </div>
            </div>

            <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row">

                {/* Main Form Area */}
                <form onSubmit={handleSubmit} className="flex-1 p-6 md:p-8 border-b md:border-b-0 md:border-r border-slate-100 space-y-8">

                    {feedback && (
                        <div className={cn(
                            "p-3 rounded-lg border flex items-center gap-3 animate-in fade-in zoom-in-95",
                            feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'
                        )}>
                            {feedback.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                            <p className="font-medium text-sm">{feedback.text}</p>
                        </div>
                    )}

                    {/* Config Cochera */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-wrap items-center gap-6">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Tipo de Abono</label>
                            <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                                {['Movil', 'Fija'].map(type => (
                                    <button type="button" key={type}
                                        onClick={() => {
                                            if (type === 'Movil') {
                                                setFormData({ ...formData, tipoCochera: 'Movil', exclusivaOverride: false, numeroCochera: '' });
                                            } else {
                                                setFormData({ ...formData, tipoCochera: 'Fija' });
                                            }
                                        }}
                                        className={`px-4 py-1.5 rounded-md text-sm font-bold uppercase transition-all ${formData.tipoCochera === type ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}>
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className={cn("flex items-center gap-3 transition-opacity", formData.tipoCochera !== 'Fija' && "opacity-30 pointer-events-none")}>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Número</label>
                                <input
                                    placeholder="N° Cochera"
                                    className="px-3 py-1.5 text-center bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-bold w-28 h-9"
                                    value={formData.numeroCochera}
                                    onChange={e => handleInputChange('numeroCochera', e.target.value)}
                                    disabled={formData.tipoCochera !== 'Fija'}
                                />
                            </div>
                            <div className="mt-6 flex items-center">
                                <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-slate-200 hover:border-indigo-300 transition-colors h-9">
                                    <input
                                        type="checkbox"
                                        className="accent-indigo-600 w-4 h-4 rounded"
                                        checked={formData.exclusivaOverride}
                                        onChange={e => handleInputChange('exclusivaOverride', e.target.checked)}
                                        disabled={formData.tipoCochera !== 'Fija'}
                                    />
                                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">EXCLUSIVA</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">

                        {/* Persona */}
                        <div className="space-y-4">
                            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">
                                <User className="h-4 w-4 text-indigo-500" />
                                Datos del Cliente
                            </h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 relative">
                                    <label className={labelClass}>Nombre Completo *</label>
                                    <User className="h-5 w-5 absolute left-3 top-[32px] text-slate-400" />
                                    <input className={inputClass} value={formData.nombre} onChange={e => handleInputChange('nombre', e.target.value)} required />
                                </div>
                                <div className="relative">
                                    <label className={labelClass}>DNI / CUIT *</label>
                                    <User className="h-5 w-5 absolute left-3 top-[32px] text-slate-400" />
                                    <input className={inputClass} value={formData.dni} onChange={e => handleInputChange('dni', e.target.value)} required />
                                </div>
                                <div className="relative">
                                    <label className={labelClass}>Teléfono</label>
                                    <Phone className="h-5 w-5 absolute left-3 top-[32px] text-slate-400" />
                                    <input className={inputClass} value={formData.telParticular} onChange={e => handleInputChange('telParticular', e.target.value)} />
                                </div>
                                <div className="relative col-span-2">
                                    <label className={labelClass}>Email</label>
                                    <Mail className="h-5 w-5 absolute left-3 top-[32px] text-slate-400" />
                                    <input className={inputClass} value={formData.email} onChange={e => handleInputChange('email', e.target.value)} />
                                </div>
                                <div className="relative col-span-2">
                                    <label className={labelClass}>Domicilio</label>
                                    <MapPin className="h-5 w-5 absolute left-3 top-[32px] text-slate-400" />
                                    <input className={inputClass} value={formData.domicilio} onChange={e => handleInputChange('domicilio', e.target.value)} />
                                </div>
                                <div className="relative col-span-2">
                                    <label className={labelClass}>Localidad</label>
                                    <MapPin className="h-5 w-5 absolute left-3 top-[32px] text-slate-400" />
                                    <input className={inputClass} value={formData.localidad} onChange={e => handleInputChange('localidad', e.target.value)} />
                                </div>
                            </div>
                        </div>

                        {/* Vehiculo */}
                        <div className="space-y-4">
                            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">
                                <Car className="h-4 w-4 text-indigo-500" />
                                Datos del Vehículo
                            </h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="relative col-span-2">
                                    <label className={labelClass}>Patente *</label>
                                    <input
                                        className={cn(inputClass, "pl-4 font-mono font-bold tracking-widest uppercase border-y-2 border-r-2 border-l-[4px] border-l-indigo-500 text-center")}
                                        placeholder="AAA000 / AA000AA"
                                        value={formData.patente}
                                        onChange={e => handleInputChange('patente', e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className={labelClass}>Tipo de Vehículo *</label>
                                    <select
                                        className={cn(inputClass, "pl-4 aspect-none bg-slate-50")}
                                        value={formData.vehicleTypeId}
                                        onChange={e => handleInputChange('vehicleTypeId', e.target.value)}
                                        required
                                    >
                                        <option value="" disabled hidden>Seleccione tipo...</option>
                                        {vehicleTypes.map(v => (
                                            <option key={v.id} value={v.id}>{v.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>Marca</label>
                                    <input className={cn(inputClass, "pl-4")} value={formData.marca} onChange={e => handleInputChange('marca', e.target.value)} />
                                </div>
                                <div>
                                    <label className={labelClass}>Modelo</label>
                                    <input className={cn(inputClass, "pl-4")} value={formData.modelo} onChange={e => handleInputChange('modelo', e.target.value)} />
                                </div>
                                <div>
                                    <label className={labelClass}>Color</label>
                                    <input className={cn(inputClass, "pl-4")} value={formData.color} onChange={e => handleInputChange('color', e.target.value)} />
                                </div>
                                <div className="grid grid-cols-2 gap-4 col-span-2">
                                    <div>
                                        <label className={labelClass}>Año</label>
                                        <input className={cn(inputClass, "pl-4")} value={formData.year} onChange={e => handleInputChange('year', e.target.value)} placeholder="Ej. 2024" />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Compañía de Seguro</label>
                                        <input className={cn(inputClass, "pl-4")} value={formData.insurance} onChange={e => handleInputChange('insurance', e.target.value)} placeholder="Ej. La Caja" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </form>

                {/* Sidebar Summary Area */}
                <div className="w-full md:w-80 bg-slate-50 flex flex-col p-6 md:p-8">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 uppercase tracking-wider mb-6">
                        <Banknote className="h-5 w-5 text-indigo-600" />
                        Validación de Valores
                    </h3>

                    <div className="space-y-4 flex-1">
                        <div className="bg-white p-4 rounded-xl border border-slate-200">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-2">
                                <span className="text-xs text-slate-500 font-bold uppercase">Base Mensual</span>
                                <span className="font-mono font-bold text-slate-800">${basePriceDisplay.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-500 font-bold uppercase">Restante Mes</span>
                                <span className="font-bold text-indigo-600">
                                    {(() => {
                                        const now = new Date();
                                        const maxDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                                        const remaining = maxDays - now.getDate() + 1;
                                        return `${remaining}d`;
                                    })()}
                                </span>
                            </div>
                        </div>

                        <div className="mt-4 bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                            <div>
                                <h4 className="text-sm font-bold text-slate-800">Generar Deuda Histórica</h4>
                                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                    Útil si migrás con saldos pendientes por abonar. Ingresá el monto exacto de la deuda a importar.
                                </p>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Monto de Deuda Inicial</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-[10px] text-slate-400 font-bold">$</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className={cn(inputClass, "pl-8 text-lg font-bold text-slate-900 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none")}
                                        value={formData.initialDebtAmount || ''}
                                        onChange={e => handleInputChange('initialDebtAmount', parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleSubmit}
                        className="mt-6 w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-black uppercase tracking-widest rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                        disabled={loading || !formData.vehicleTypeId || !formData.patente || !formData.dni}
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        Guardar Migración
                    </button>
                </div>
            </div>
        </div>
    );
}
