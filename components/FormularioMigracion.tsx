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
    Database,
    Plus,
    Trash2,
    Fingerprint
} from 'lucide-react';
import { VehicleType, Tariff, Price } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface FormularioMigracionProps {
    garageId: string;
    preloadedCustomer?: any;
    onSuccess?: () => void;
    onBack?: () => void;
}

interface VehicleData {
    patente: string;
    marca: string;
    modelo: string;
    color: string;
    year: string;
    insurance: string;
    vehicleTypeId: string;
}

export default function FormularioMigracion({ garageId, preloadedCustomer, onSuccess, onBack }: FormularioMigracionProps) {
    // --- STATE ---
    const [loading, setLoading] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Data Loading
    const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
    const [allAbonoTariffs, setAllAbonoTariffs] = useState<Tariff[]>([]);
    const [prices, setPrices] = useState<Price[]>([]);
    const [buildingLevels, setBuildingLevels] = useState<any[]>([]);

    const emptyVehicle = { patente: '', marca: '', modelo: '', color: '', year: '', insurance: '', vehicleTypeId: '' };

    // Form State
    const [formData, setFormData] = useState({
        tipoCochera: 'Movil',
        numeroCochera: '',
        piso: '',
        exclusivaOverride: false,

        nombre: '',
        dni: '',
        email: '',
        domicilio: '',
        localidad: '',
        telParticular: '',

        initialDebtAmount: 0
    });

    // Multi-vehicle state
    const [vehicles, setVehicles] = useState<VehicleData[]>([{ ...emptyVehicle }]);

    const [ownerId, setOwnerId] = useState<string | null>(null);

    const [basePriceDisplay, setBasePriceDisplay] = useState(0);
    const [proratedPrice, setProratedPrice] = useState(0);

    const [dniAlreadyExists, setDniAlreadyExists] = useState(false);
    const isAddingToExisting = !!preloadedCustomer;

    // --- PRELOAD CUSTOMER ---
    useEffect(() => {
        if (preloadedCustomer) {
            setFormData(prev => ({
                ...prev,
                nombre: preloadedCustomer.name || '',
                dni: preloadedCustomer.dni || '',
                email: preloadedCustomer.email || '',
                domicilio: preloadedCustomer.address || '',
                localidad: preloadedCustomer.localidad || '',
                telParticular: preloadedCustomer.phone || ''
            }));
            setDniAlreadyExists(false);
        } else {
            setFormData(prev => ({
                ...prev,
                nombre: '',
                dni: '',
                email: '',
                domicilio: '',
                localidad: '',
                telParticular: ''
            }));
            setDniAlreadyExists(false);
        }
    }, [preloadedCustomer]);

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

                const [resVehicles, resTariffs, resPrices, resLevels] = await Promise.all([
                    supabase.from('vehicle_types').select('*').eq('garage_id', garageId).order('sort_order'),
                    supabase.from('tariffs').select('*').eq('garage_id', garageId).eq('type', 'abono'),
                    supabase.from('prices').select('*').eq('garage_id', garageId).in('price_list', ['standard', 'electronic']),
                    supabase.from('building_levels').select('*').eq('garage_id', garageId).order('sort_order')
                ]);

                if (resVehicles.data) setVehicleTypes(resVehicles.data);
                if (resTariffs.data) setAllAbonoTariffs(resTariffs.data);
                if (resPrices.data) setPrices(resPrices.data);
                if (resLevels.data) setBuildingLevels(resLevels.data);

            } catch (err) {
                console.error("Error loading config:", err);
            }
        };
        if (garageId) fetchData();
    }, [garageId]);

    // --- PRICE CALCULATION (Rule of the most expensive) ---
    useEffect(() => {
        const targetTariffName = formData.exclusivaOverride ? 'Exclusiva' : formData.tipoCochera;
        const activeTariff = allAbonoTariffs.find(t => t.name.toLowerCase().includes(targetTariffName.toLowerCase()));

        if (!activeTariff || vehicles.every(v => !v.vehicleTypeId)) {
            setBasePriceDisplay(0);
            setProratedPrice(0);
            return;
        }

        let maxStandardPrice = 0;

        // Find the maximum price among all selected vehicles
        vehicles.forEach(vehicle => {
            if (vehicle.vehicleTypeId) {
                const priceRecord = prices.find(p => p.tariff_id === activeTariff.id && p.vehicle_type_id === vehicle.vehicleTypeId && p.price_list === 'standard');
                const p = priceRecord ? Number(priceRecord.amount) : 0;
                if (p > maxStandardPrice) {
                    maxStandardPrice = p;
                }
            }
        });

        setBasePriceDisplay(maxStandardPrice);

        if (maxStandardPrice > 0) {
            const now = new Date();
            const currentDay = now.getDate();
            const ultimoDiaMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            const diasRestantes = (ultimoDiaMes - currentDay) + 1;

            const exactCalc = (maxStandardPrice / ultimoDiaMes) * diasRestantes;
            const roundedExactly = Math.round(exactCalc); // As per FormularioAbono logic requested

            setProratedPrice(roundedExactly);
        } else {
            setProratedPrice(0);
        }

    }, [vehicles, formData.tipoCochera, formData.exclusivaOverride, allAbonoTariffs, prices]);

    // --- REAL-TIME DNI CHECK ---
    useEffect(() => {
        if (isAddingToExisting) {
            setDniAlreadyExists(false);
            return;
        }

        const checkDni = async () => {
            const currentDni = formData.dni.trim();
            if (currentDni.length >= 7 && garageId) {
                try {
                    const { data, error } = await supabase
                        .from('customers')
                        .select('id')
                        .eq('garage_id', garageId)
                        .eq('dni', currentDni)
                        .maybeSingle();

                    if (data && !error) {
                        setDniAlreadyExists(true);
                    } else {
                        setDniAlreadyExists(false);
                    }
                } catch (err) {
                    console.error("Error checking DNI:", err);
                }
            } else {
                setDniAlreadyExists(false);
            }
        };

        const timer = setTimeout(checkDni, 500);
        return () => clearTimeout(timer);
    }, [formData.dni, garageId, isAddingToExisting]);

    // --- HELPERS ---
    const handleInputChange = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setFeedback(null);
    };

    const handleVehicleChange = (index: number, field: keyof VehicleData, value: string) => {
        setVehicles(prev => {
            const newVehicles = [...prev];
            newVehicles[index] = { ...newVehicles[index], [field]: value };
            return newVehicles;
        });
        setFeedback(null);
    };

    const isVehicleTypeValid = (vehicleTypeId: string): boolean => {
        const targetTariffName = formData.exclusivaOverride ? 'Exclusiva' : formData.tipoCochera;
        const activeTariff = allAbonoTariffs.find(t =>
            t.name.toLowerCase().includes(targetTariffName.toLowerCase())
        );
        if (!activeTariff) return false;

        const hasStandard = prices.some(p =>
            p.tariff_id === activeTariff.id &&
            p.vehicle_type_id === vehicleTypeId &&
            p.price_list === 'standard'
        );
        const hasElectronic = prices.some(p =>
            p.tariff_id === activeTariff.id &&
            p.vehicle_type_id === vehicleTypeId &&
            p.price_list === 'electronic'
        );
        return hasStandard && hasElectronic;
    };

    const addVehicle = () => {
        if (vehicles.length < 3) {
            setVehicles(prev => [...prev, { ...emptyVehicle }]);
        }
    };

    const removeVehicle = (index: number) => {
        if (vehicles.length > 1) {
            setVehicles(prev => prev.filter((_, i) => i !== index));
        }
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
            if (!formData.dni || !formData.nombre) {
                throw new Error("Complete los datos mínimos del cliente (DNI, Nombre).");
            }

            // Validate all vehicles
            const invalidVehicles = vehicles.some(v => !v.patente.trim() || !v.vehicleTypeId);
            if (invalidVehicles) {
                throw new Error("Todos los vehículos añadidos deben tener Patente y Tipo.");
            }

            // Cleanup
            const cleanedDni = formData.dni.trim();
            const finalType = formData.exclusivaOverride ? 'Exclusiva' : formData.tipoCochera;

            // 1. Upsert Customer
            let customerId: string;

            if (isAddingToExisting) {
                customerId = preloadedCustomer.id;
            } else {
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

                const { data, error } = await supabase.from('customers').insert(customerPayload).select().single();
                if (error) throw error;
                customerId = data.id;
            }

            // 2. Upsert All Vehicles sequentially
            const allVehiclePlates: string[] = [];
            const processedVehicles = [];

            const activeTariff = allAbonoTariffs.find(t => t.name.toLowerCase().includes(finalType.toLowerCase()));

            for (const vData of vehicles) {
                const cleanedPlate = vData.patente.trim().toUpperCase();
                allVehiclePlates.push(cleanedPlate);

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
                    type: vehicleTypes.find(v => v.id === vData.vehicleTypeId)?.name || 'Auto',
                    brand: vData.marca,
                    model: vData.modelo,
                    color: vData.color,
                    year: vData.year,
                    insurance: vData.insurance,
                    is_subscriber: true
                };
                if (ownerId) vehiclePayload.owner_id = ownerId;

                let savedVehicleId = '';
                if (existingVehicle) {
                    const { data, error } = await supabase.from('vehicles').update(vehiclePayload).eq('id', existingVehicle.id).select().single();
                    if (error) throw error;
                    savedVehicleId = data.id;
                } else {
                    const { data, error } = await supabase.from('vehicles').insert(vehiclePayload).select().single();
                    if (error) throw error;
                    savedVehicleId = data.id;
                }

                // Calculate its specific price for logic comparison
                let vPrice = 0;
                if (activeTariff && vData.vehicleTypeId) {
                    const priceRecord = prices.find(p => p.tariff_id === activeTariff.id && p.vehicle_type_id === vData.vehicleTypeId && p.price_list === 'standard');
                    vPrice = priceRecord ? Number(priceRecord.amount) : 0;
                }

                processedVehicles.push({ id: savedVehicleId, price: vPrice });
            }

            // Find principal vehicle (the one that sets the price)
            let mainVehicleId = processedVehicles[0].id;
            let currentMax = -1;
            for (const pv of processedVehicles) {
                if (pv.price > currentMax) {
                    currentMax = pv.price;
                    mainVehicleId = pv.id;
                }
            }

            // 3. Update/Insert Cochera
            let cocheraId: string;
            const cocheraPayload: any = {
                garage_id: garageId,
                cliente_id: customerId,
                tipo: finalType,
                numero: finalType === 'Movil' ? `M-${allVehiclePlates[0]}` : formData.numeroCochera,
                vehiculos: allVehiclePlates,
                status: 'Ocupada',
                precio_base: basePriceDisplay // Saving standard value as instructed
            };
            if (formData.piso) cocheraPayload.piso = formData.piso; // Guardamos el piso

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
                vehicle_id: mainVehicleId, // Vincular al vehiculo principal
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
                    type: 'MANUAL_MIGRATION',
                    due_date: now.toISOString(), // due_date to now()
                    surcharge_applied: 0
                };
                const { error: debtError } = await supabase.from('debts').insert(debtPayload);
                if (debtError) console.warn("Error creating debt:", debtError); // Non-blocking
            }

            setFeedback({ type: 'success', text: 'Datos cargados exitosamente.' });

            // Clear specific form states
            if (!isAddingToExisting) {
                setFormData(prev => ({
                    ...prev,
                    numeroCochera: '',
                    piso: '',
                    nombre: '',
                    dni: '',
                    email: '',
                    domicilio: '',
                    localidad: '',
                    telParticular: '',
                    initialDebtAmount: 0
                }));
            } else {
                setFormData(prev => ({ ...prev, numeroCochera: '', piso: '', initialDebtAmount: 0 }));
            }
            setVehicles([{ ...emptyVehicle }]);
            setDniAlreadyExists(false);

            setTimeout(() => setFeedback(null), 4000);

            if (onSuccess) {
                onSuccess();
            }

        } catch (err: any) {
            console.error("Migration Error:", err);
            setFeedback({ type: 'error', text: err.message || 'Error al procesar la carga de datos.' });
        } finally {
            setLoading(false);
        }
    };

    const inputClass = "w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all text-sm text-slate-900 font-medium placeholder:text-slate-400 shadow-sm";
    const labelClass = "text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-1.5 block ml-1";

    // Check if we can save
    const isSaveDisabled = loading || !formData.dni
        || vehicles.some(v => !v.patente || !v.vehicleTypeId)
        || vehicles.some(v => v.vehicleTypeId && !isVehicleTypeValid(v.vehicleTypeId))
        || dniAlreadyExists;

    return (
        <div className="max-w-6xl mx-auto w-full animate-in fade-in zoom-in-95 h-full flex flex-col rounded-2xl overflow-hidden relative shadow-sm border border-slate-200 bg-white">
            {onBack && (
                <div className="px-10 pt-8 pb-2">
                    <button
                        type="button"
                        onClick={onBack}
                        className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 font-bold text-xs uppercase tracking-wider transition-colors hover:bg-slate-50 px-3 py-1.5 rounded-lg -ml-3"
                    >
                        ← Volver al Directorio
                    </button>
                </div>
            )}

            <div className="flex-1 flex overflow-hidden">
                {/* Panel Central: Formulario (70%) */}
                <form onSubmit={handleSubmit} className="flex-[7] p-8 overflow-y-auto space-y-8 bg-white min-w-0">

                    {/* Header Info */}
                    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-6">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <Database className="h-5 w-5 text-indigo-600" />
                                {isAddingToExisting ? 'Añadir a Cliente Existente' : 'Carga de Cliente Nuevo'}
                            </h2>
                            <p className="text-sm text-slate-500 mt-1 italic">
                                Sistema de migración silenciosa para abonados (sin movimientos de caja).
                            </p>
                        </div>
                        {feedback && (
                            <div className={cn(
                                "p-3 px-4 rounded-xl border flex items-center gap-3 animate-in fade-in zoom-in-95 shadow-sm",
                                feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'
                            )}>
                                {feedback.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                                <p className="font-bold text-xs uppercase tracking-wider">{feedback.text}</p>
                            </div>
                        )}
                    </div>

                    {/* Sector: Ubicación y Abono */}
                    <div className="grid grid-cols-3 gap-6 bg-slate-50/50 p-6 rounded-2xl border border-slate-100 shadow-inner">
                        <div className="space-y-2">
                            <label className={labelClass}>Tipo de Abono</label>
                            <div className="flex bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm gap-1">
                                {['Movil', 'Fija'].map(type => (
                                    <button type="button" key={type}
                                        onClick={() => {
                                            if (type === 'Movil') {
                                                setFormData({ ...formData, tipoCochera: 'Movil', exclusivaOverride: false, numeroCochera: '', piso: '' });
                                                setVehicles(prev => prev.length > 1 ? [prev[0]] : prev);
                                            } else {
                                                setFormData({ ...formData, tipoCochera: 'Fija' });
                                            }
                                        }}
                                        className={`w-1/2 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${formData.tipoCochera === type ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className={cn("space-y-2 transition-all", formData.tipoCochera !== 'Fija' && "opacity-30 grayscale blur-[1px] pointer-events-none")}>
                            <label className={labelClass}>N° de Cochera</label>
                            <div className="flex gap-2">
                                <input
                                    placeholder="000"
                                    className="flex-1 px-4 py-1.5 text-center bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-black h-[38px] text-base shadow-sm w-full"
                                    value={formData.numeroCochera}
                                    onChange={e => handleInputChange('numeroCochera', e.target.value)}
                                    disabled={formData.tipoCochera !== 'Fija'}
                                />
                                <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-slate-200 hover:border-indigo-300 transition-all h-[38px] shadow-sm shrink-0">
                                    <input
                                        type="checkbox"
                                        className="accent-indigo-600 w-4 h-4 rounded-md"
                                        checked={formData.exclusivaOverride}
                                        onChange={e => handleInputChange('exclusivaOverride', e.target.checked)}
                                        disabled={formData.tipoCochera !== 'Fija'}
                                    />
                                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-tighter">EXCL.</span>
                                </label>
                            </div>
                        </div>

                        <div className={cn("space-y-2 transition-all", formData.tipoCochera === 'Movil' && "opacity-30 grayscale blur-[1px] pointer-events-none")}>
                            <label className={labelClass}>Piso / Nivel</label>
                            <select
                                className="w-full pl-4 pr-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold h-[38px] text-sm shadow-sm text-slate-700"
                                value={formData.piso}
                                onChange={e => handleInputChange('piso', e.target.value)}
                                disabled={formData.tipoCochera === 'Movil'}
                            >
                                <option value="" disabled>Seleccione...</option>
                                {buildingLevels.map((level: any) => (
                                    <option key={level.id} value={level.display_name}>{level.display_name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Sector: Datos Personales (Rediseño 3 columnas) */}
                    <div className="space-y-6">
                        <h3 className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                            <User className="h-4 w-4 text-indigo-500" />
                            Datos del Propietario
                        </h3>

                        <div className="space-y-4">
                            {/* Fila 1: Nombre (w-full) */}
                            <div className="w-full relative">
                                <label className={labelClass}>Nombre y Apellido *</label>
                                <User className="h-4 w-4 absolute left-3.5 top-[34px] text-slate-400" />
                                <input className={cn(inputClass, isAddingToExisting && "bg-slate-50 text-slate-400 border-dashed border-slate-200 shadow-none")} disabled={isAddingToExisting} value={formData.nombre} onChange={e => handleInputChange('nombre', e.target.value)} required />
                            </div>

                            {/* Fila 2: DNI, Teléfono y Email (grid 3 columnas) */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="relative">
                                    <label className={labelClass}>DNI / CUIT *</label>
                                    <Fingerprint className="h-4 w-4 absolute left-3.5 top-[34px] text-slate-400" />
                                    <input
                                        className={cn(
                                            inputClass,
                                            dniAlreadyExists && "border-red-500 bg-red-50 focus:ring-red-500 text-red-700",
                                            isAddingToExisting && "bg-slate-50 text-slate-400 border-dashed border-slate-200 shadow-none"
                                        )}
                                        disabled={isAddingToExisting}
                                        value={formData.dni}
                                        onChange={e => handleInputChange('dni', e.target.value)}
                                        required
                                    />
                                    {dniAlreadyExists && (
                                        <p className="mt-2 text-[10px] text-red-600 font-bold flex items-center gap-1">
                                            <AlertCircle className="h-3 w-3" /> DNI YA REGISTRADO
                                        </p>
                                    )}
                                </div>
                                <div className="relative">
                                    <label className={labelClass}>Teléfono Móvil</label>
                                    <Phone className="h-4 w-4 absolute left-3.5 top-[34px] text-slate-400" />
                                    <input className={cn(inputClass, isAddingToExisting && "bg-slate-50 text-slate-400 border-dashed border-slate-200 shadow-none")} disabled={isAddingToExisting} value={formData.telParticular} onChange={e => handleInputChange('telParticular', e.target.value)} />
                                </div>
                                <div className="relative">
                                    <label className={labelClass}>Correo Electrónico</label>
                                    <Mail className="h-4 w-4 absolute left-3.5 top-[34px] text-slate-400" />
                                    <input className={cn(inputClass, isAddingToExisting && "bg-slate-50 text-slate-400 border-dashed border-slate-200 shadow-none")} disabled={isAddingToExisting} value={formData.email} onChange={e => handleInputChange('email', e.target.value)} />
                                </div>
                            </div>

                            {/* Fila 3: Domicilio y Localidad (grid 2 columnas) */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="relative">
                                    <label className={labelClass}>Domicilio Particular</label>
                                    <MapPin className="h-4 w-4 absolute left-3.5 top-[34px] text-slate-400" />
                                    <input className={cn(inputClass, isAddingToExisting && "bg-slate-50 text-slate-400 border-dashed border-slate-200 shadow-none")} disabled={isAddingToExisting} value={formData.domicilio} onChange={e => handleInputChange('domicilio', e.target.value)} />
                                </div>
                                <div className="relative">
                                    <label className={labelClass}>Localidad</label>
                                    <MapPin className="h-4 w-4 absolute left-3.5 top-[34px] text-slate-400" />
                                    <input className={cn(inputClass, isAddingToExisting && "bg-slate-50 text-slate-400 border-dashed border-slate-200 shadow-none")} disabled={isAddingToExisting} value={formData.localidad} onChange={e => handleInputChange('localidad', e.target.value)} />
                                </div>
                            </div>
                        </div>

                        {dniAlreadyExists && (
                            <div className="bg-red-50 p-4 rounded-xl border border-red-100 animate-in shake-1 overflow-hidden relative">
                                <div className="absolute top-0 right-0 p-2 opacity-10">
                                    <AlertCircle className="h-16 w-16" />
                                </div>
                                <div className="flex gap-3 items-start relative z-10">
                                    <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                                    <div>
                                        <p className="text-sm font-black text-red-700 leading-tight">Acceso Restringido: DNI Duplicado</p>
                                        <p className="text-xs text-red-600 mt-1">Este cliente ya existe en el sistema. Utilice el buscador de la izquierda para seleccionarlo y añadir una nueva cochera a su perfil existente.</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sector: Vehículos (Tarjetas Pro) */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <h3 className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                                <Car className="h-4 w-4 text-indigo-500" />
                                Registro Vehicular
                            </h3>
                            {vehicles.length < 3 && formData.tipoCochera !== 'Movil' && (
                                <button
                                    type="button"
                                    onClick={addVehicle}
                                    className="flex items-center gap-2 px-4 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white font-black text-[10px] rounded-full transition-all uppercase tracking-widest"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Añadir Vehículo
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 gap-6">
                            {vehicles.map((vh, index) => (
                                <div key={index} className="group relative bg-white border border-slate-200 hover:border-indigo-200 p-4 pt-8 rounded-2xl shadow-sm transition-all hover:shadow-md">
                                    <div className="absolute top-0 left-0 bg-slate-100 text-slate-500 font-black text-[10px] px-4 py-1.5 rounded-br-2xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                        VEHÍCULO {index + 1}
                                    </div>

                                    <div className="grid grid-cols-3 gap-4 pt-2">
                                        {/* Fila 1 */}
                                        <div className="col-span-1 space-y-2">
                                            <label className={labelClass}>Dominio / Patente *</label>
                                            <input
                                                className={cn(inputClass, "pl-4 font-mono font-black text-lg tracking-widest uppercase border-l-[6px] border-l-indigo-500 shadow-inner bg-slate-50")}
                                                placeholder="AAA 000"
                                                value={vh.patente}
                                                onChange={e => handleVehicleChange(index, 'patente', e.target.value.toUpperCase())}
                                                required
                                            />
                                        </div>
                                        <div className="col-span-2 space-y-2">
                                            <label className={labelClass}>Tipo de Vehículo *</label>
                                            <select
                                                className={cn(inputClass, "pl-4 py-2 h-[38px] font-bold")}
                                                value={vh.vehicleTypeId}
                                                onChange={e => handleVehicleChange(index, 'vehicleTypeId', e.target.value)}
                                                required
                                            >
                                                <option value="" disabled hidden>Seleccionar...</option>
                                                {vehicleTypes.map(v => {
                                                    const valid = isVehicleTypeValid(v.id);
                                                    return (
                                                        <option
                                                            key={v.id}
                                                            value={v.id}
                                                            disabled={!valid}
                                                            title={!valid ? 'Tipo de vehículo sin configuración de precios completa (Standard/Electronic)' : ''}
                                                        >
                                                            {v.name}{!valid ? ' ⚠' : ''}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                        </div>

                                        {/* Fila 2 */}
                                        <div className="col-span-1 space-y-2 mt-2">
                                            <label className={labelClass}>Marca</label>
                                            <input className={cn(inputClass, "pl-4")} value={vh.marca} onChange={e => handleVehicleChange(index, 'marca', e.target.value)} placeholder="Ej. Ford" />
                                        </div>
                                        <div className="col-span-1 space-y-2 mt-2">
                                            <label className={labelClass}>Modelo</label>
                                            <input className={cn(inputClass, "pl-4")} value={vh.modelo} onChange={e => handleVehicleChange(index, 'modelo', e.target.value)} placeholder="Ej. Focus" />
                                        </div>
                                        <div className="col-span-1 space-y-2 mt-2">
                                            <label className={labelClass}>Año</label>
                                            <input className={cn(inputClass, "pl-4 text-center")} value={vh.year} onChange={e => handleVehicleChange(index, 'year', e.target.value)} placeholder="0000" />
                                        </div>

                                        {/* Fila 3 */}
                                        <div className="col-span-1 space-y-2 mt-2">
                                            <label className={labelClass}>Color</label>
                                            <input className={cn(inputClass, "pl-4")} value={vh.color} onChange={e => handleVehicleChange(index, 'color', e.target.value)} placeholder="Gris" />
                                        </div>
                                        <div className="col-span-2 space-y-2 mt-2">
                                            <label className={labelClass}>Compañía de Seguro</label>
                                            <input className={cn(inputClass, "pl-4")} value={vh.insurance} onChange={e => handleVehicleChange(index, 'insurance', e.target.value)} placeholder="Ej. Federación..." />
                                        </div>
                                    </div>

                                    {vehicles.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeVehicle(index)}
                                            className="absolute top-4 right-4 text-slate-300 hover:text-red-500 p-2 rounded-xl transition-all hover:bg-red-50"
                                            title="Eliminar vehículo"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </form>

                {/* Panel Derecho: Liquidación / Sidebar de Pago */}
                <div className="w-[300px] border-l border-t md:border-t-0 border-slate-200 bg-slate-50/30 h-full shrink-0 flex flex-col shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-10">
                    <div className="p-6 space-y-6 flex-1 overflow-y-auto flex flex-col justify-between">
                        <div className="space-y-6">
                            <h3 className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
                                <Banknote className="h-4 w-4 text-indigo-500" />
                                Liquidación
                            </h3>

                            <div className="space-y-4">
                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Base Mensual</span>
                                        <span className="font-mono font-black text-slate-900 text-lg">${basePriceDisplay.toLocaleString()}</span>
                                    </div>
                                </div>

                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                    <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2 block">Deuda a Importar</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-lg">$</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all text-xl font-black text-slate-900 shadow-inner"
                                            value={formData.initialDebtAmount || ''}
                                            onChange={e => handleInputChange('initialDebtAmount', parseFloat(e.target.value) || 0)}
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-3 font-bold uppercase leading-tight italic">
                                        Saldos previos a la fecha.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-200">
                            <button
                                onClick={handleSubmit}
                                className={cn(
                                    "w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-[0.2em] rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2",
                                    loading && "opacity-80"
                                )}
                                disabled={isSaveDisabled}
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                {isAddingToExisting ? 'Añadir al Perfil' : 'Guardar Migración'}
                            </button>

                            {isSaveDisabled && !loading && (
                                <div className="mt-4 flex gap-2 p-4 bg-red-50 rounded-xl border border-red-100">
                                    <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                                    <p className="text-[10px] text-red-600 font-bold uppercase tracking-wide leading-relaxed">
                                        {dniAlreadyExists
                                            ? "DNI Bloqueado (Ya existe)"
                                            : vehicles.some(v => v.vehicleTypeId && !isVehicleTypeValid(v.vehicleTypeId))
                                                ? "Vehículo sin precios completos (Standard/Electronic)"
                                                : "Completar DNI y Vehículo"}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

