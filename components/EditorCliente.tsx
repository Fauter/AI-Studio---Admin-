import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
    User, Car, MapPin, Phone, Mail, Save, Loader2, AlertCircle, CheckCircle2,
    Trash2, Building2, Fingerprint, ArrowLeft, Unlink, ChevronDown, ChevronUp
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface EditorClienteProps {
    garageId: string;
    customer: any;
    onSuccess: () => void;
    onBack: () => void;
}

export default function EditorCliente({ garageId, customer, onSuccess, onBack }: EditorClienteProps) {
    const [activeTab, setActiveTab] = useState<'personales' | 'cocheras'>('personales');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Data states
    const [formData, setFormData] = useState({
        nombre: '',
        dni: '',
        email: '',
        domicilio: '',
        localidad: '',
        telParticular: '',
        work_address: '',
        emergency_phone: '',
        work_phone: ''
    });

    const [vehicles, setVehicles] = useState<any[]>([]);
    const [cocheras, setCocheras] = useState<any[]>([]);
    const [vehicleTypes, setVehicleTypes] = useState<any[]>([]);
    const [tariffs, setTariffs] = useState<any[]>([]);
    const [prices, setPrices] = useState<any[]>([]);
    const [subscriptions, setSubscriptions] = useState<any[]>([]);
    const [buildingLevels, setBuildingLevels] = useState<any[]>([]);
    const [expandedVehicles, setExpandedVehicles] = useState<Record<string, boolean>>({});

    const toggleVehicleInfo = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setExpandedVehicles(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // Delete modal state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState('');

    useEffect(() => {
        if (customer) {
            setFormData({
                nombre: customer.name || '',
                dni: customer.dni || '',
                email: customer.email || '',
                domicilio: customer.address || '',
                localidad: customer.localidad || '',
                telParticular: customer.phone || '',
                work_address: customer.work_address || '',
                emergency_phone: customer.emergency_phone || '',
                work_phone: customer.work_phone || ''
            });
            fetchExtraData();
        }
    }, [customer]);

    const fetchExtraData = async () => {
        setLoading(true);
        try {
            const [vehRes, cochRes, typesRes, tariffsRes, pricesRes, subsRes, levelsRes] = await Promise.all([
                supabase.from('vehicles').select('*').eq('customer_id', customer.id),
                supabase.from('cocheras').select('*').eq('cliente_id', customer.id),
                supabase.from('vehicle_types').select('*').eq('garage_id', garageId).order('sort_order'),
                supabase.from('tariffs').select('*').eq('garage_id', garageId).eq('type', 'abono'),
                supabase.from('prices').select('*').eq('garage_id', garageId).eq('price_list', 'standard'),
                supabase.from('subscriptions').select('*').eq('customer_id', customer.id).eq('active', true),
                supabase.from('building_levels').select('*').eq('garage_id', garageId).order('sort_order')
            ]);

            if (vehRes.data) setVehicles(vehRes.data);
            if (cochRes.data) setCocheras(cochRes.data);
            if (typesRes.data) setVehicleTypes(typesRes.data);
            if (tariffsRes.data) setTariffs(tariffsRes.data);
            if (pricesRes.data) setPrices(pricesRes.data);
            if (subsRes.data) setSubscriptions(subsRes.data);
            if (levelsRes.data) setBuildingLevels(levelsRes.data);
        } catch (err) {
            console.error('Error fetching customer details:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSavePersonales = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setFeedback(null);
        try {
            const { error } = await supabase
                .from('customers')
                .update({
                    name: formData.nombre,
                    dni: formData.dni,
                    email: formData.email,
                    phone: formData.telParticular,
                    address: formData.domicilio,
                    localidad: formData.localidad,
                    work_address: formData.work_address,
                    emergency_phone: formData.emergency_phone,
                    work_phone: formData.work_phone
                })
                .eq('id', customer.id);

            if (error) throw error;
            setFeedback({ type: 'success', text: 'Datos personales actualizados correctamente.' });
            setTimeout(() => setFeedback(null), 3000);
            onSuccess();
        } catch (err: any) {
            console.error(err);
            setFeedback({ type: 'error', text: err.message || 'Error al guardar datos.' });
        } finally {
            setSaving(false);
        }
    };

    // Cochera Handlers
    const handleCocheraChange = (index: number, field: string, value: string) => {
        const newCocheras = [...cocheras];
        newCocheras[index] = { ...newCocheras[index], [field]: value };
        setCocheras(newCocheras);
    };

    const handleVehicleChange = (vIdx: number, oldPlate: string, field: string, value: string) => {
        const newVehicles = [...vehicles];
        newVehicles[vIdx] = { ...newVehicles[vIdx], [field]: value };
        setVehicles(newVehicles);

        if (field === 'plate' && oldPlate) {
            const newCocheras = cocheras.map(c => {
                if ((c.vehiculos || []).includes(oldPlate)) {
                    return {
                        ...c,
                        vehiculos: c.vehiculos.map((p: string) => p === oldPlate ? value : p)
                    };
                }
                return c;
            });
            setCocheras(newCocheras);
        }
    };

    const handleLiberarCochera = async (cochera: any) => {
        if (!window.confirm(`¿Estás seguro de que deseas liberar la cochera ${cochera.numero || 'asignada'}? Esta acción desligará vehículos y pondrá Inactiva la suscripción.`)) return;

        setSaving(true);
        setFeedback(null);
        try {
            // Action 1 + 2: Update Cochera and Vehicles
            const plates = cochera.vehiculos || [];
            if (plates.length > 0) {
                await supabase.from('vehicles').update({ is_subscriber: false, customer_id: null }).in('plate', plates);
            }
            await supabase.from('cocheras').update({ cliente_id: null, vehiculos: [], status: 'Disponible' }).eq('id', cochera.id);

            // Action 3 + 4: Update Subscription and Debts
            const linkedVehicles = vehicles.filter((v: any) => plates.includes(v.plate));
            const linkedVehicleIds = linkedVehicles.map((v: any) => v.id);
            const activeSub = subscriptions.find((s: any) => linkedVehicleIds.includes(s.vehicle_id) || s.type === cochera.tipo);

            if (activeSub) {
                await supabase.from('subscriptions').update({ active: false }).eq('id', activeSub.id);
                // Also cancel pending debts
                await supabase.from('debts').update({ status: 'CANCELLED' }).eq('subscription_id', activeSub.id).eq('status', 'PENDING');
            }

            setFeedback({ type: 'success', text: 'Cochera liberada con éxito.' });
            setTimeout(() => setFeedback(null), 3000);
            await fetchExtraData();
        } catch (err: any) {
            console.error(err);
            setFeedback({ type: 'error', text: err.message || 'Error al liberar cochera.' });
        } finally {
            setSaving(false);
        }
    };

    const handleDesvincularVehiculo = async (cochera: any, plateToDesvincular: string) => {
        if (!window.confirm(`¿Quitar el vehículo con patente ${plateToDesvincular} de esta cochera?`)) return;

        setSaving(true);
        setFeedback(null);
        try {
            const newVehiculos = (cochera.vehiculos || []).filter((p: string) => p !== plateToDesvincular);
            await supabase.from('vehicles').update({ is_subscriber: false }).eq('plate', plateToDesvincular);

            if (newVehiculos.length === 0) {
                // Auto-Liberar
                await supabase.from('cocheras').update({ cliente_id: null, vehiculos: [], status: 'Disponible' }).eq('id', cochera.id);

                // Subscription deactivation
                const justRemovedVehicle = vehicles.find(v => v.plate === plateToDesvincular);
                if (justRemovedVehicle) {
                    const specificSub = subscriptions.find(s => s.vehicle_id === justRemovedVehicle.id || s.type === cochera.tipo);
                    if (specificSub) {
                        await supabase.from('subscriptions').update({ active: false }).eq('id', specificSub.id);
                        await supabase.from('debts').update({ status: 'CANCELLED' }).eq('subscription_id', specificSub.id).eq('status', 'PENDING');
                    }
                }

                setFeedback({ type: 'success', text: 'Vehículo desvinculado. La cochera quedó vacía y fue liberada.' });
            } else {
                let maxPrice = 0;
                const targetTariffName = cochera.tipo === 'Exclusiva' ? 'Exclusiva' : cochera.tipo;
                const activeTariff = tariffs.find(t => t.name.toLowerCase().includes(targetTariffName.toLowerCase()));

                const remainingVehicles = vehicles.filter(v => newVehiculos.includes(v.plate));

                for (const v of remainingVehicles) {
                    if (!v.type) continue;

                    let vTypeName = vehicleTypes.find(vt => vt.id === v.type)?.name || v.type;
                    const typeObj = vehicleTypes.find(vt => vt.name === vTypeName || vt.id === v.type);

                    if (activeTariff && typeObj) {
                        const priceRecord = prices.find(p => p.tariff_id === activeTariff.id && p.vehicle_type_id === typeObj.id && p.price_list === 'standard');
                        if (priceRecord && Number(priceRecord.amount) > maxPrice) {
                            maxPrice = Number(priceRecord.amount);
                        }
                    }
                }

                const finalBasePrice = maxPrice > 0 ? maxPrice : cochera.precio_base;

                await supabase.from('cocheras').update({
                    vehiculos: newVehiculos,
                    precio_base: finalBasePrice
                }).eq('id', cochera.id);
                setFeedback({ type: 'success', text: 'Vehículo desvinculado correctamente.' });
            }

            setTimeout(() => setFeedback(null), 3000);
            await fetchExtraData();
        } catch (err: any) {
            console.error(err);
            setFeedback({ type: 'error', text: err.message || 'Error al desvincular vehículo.' });
        } finally {
            setSaving(false);
        }
    };

    const handleSaveCocheraCompleta = async (cochera: any, cVehicles: any[]) => {
        setSaving(true);
        setFeedback(null);
        try {
            let maxPrice = 0;
            const targetTariffName = cochera.tipo === 'Exclusiva' ? 'Exclusiva' : cochera.tipo;
            const activeTariff = tariffs.find(t => t.name.toLowerCase().includes(targetTariffName.toLowerCase()));

            for (const v of cVehicles) {
                if (!v.plate || !v.type) throw new Error("Los vehículos deben tener Patente y Tipo.");

                let vTypeName = vehicleTypes.find(vt => vt.id === v.type)?.name || v.type;
                const typeObj = vehicleTypes.find(vt => vt.name === vTypeName || vt.id === v.type);

                if (activeTariff && typeObj) {
                    const priceRecord = prices.find(p => p.tariff_id === activeTariff.id && p.vehicle_type_id === typeObj.id);
                    if (priceRecord && Number(priceRecord.amount) > maxPrice) {
                        maxPrice = Number(priceRecord.amount);
                    }
                }

                const payload = {
                    plate: v.plate.toUpperCase().trim(),
                    brand: v.brand || '',
                    model: v.model || '',
                    color: v.color || '',
                    year: v.year || '',
                    insurance: v.insurance || '',
                    type: vTypeName
                };

                await supabase.from('vehicles').update(payload).eq('id', v.id);
            }

            const cPayload = {
                tipo: cochera.tipo,
                numero: cochera.numero,
                piso: cochera.piso || '',
                vehiculos: (cochera.vehiculos || []).map((p: string) => p.toUpperCase().trim()),
                precio_base: maxPrice > 0 ? maxPrice : cochera.precio_base
            };

            await supabase.from('cocheras').update(cPayload).eq('id', cochera.id);

            setFeedback({ type: 'success', text: 'Cochera y vehículos actualizados correctamente.' });
            setTimeout(() => setFeedback(null), 3000);
            await fetchExtraData();
        } catch (err: any) {
            console.error(err);
            setFeedback({ type: 'error', text: err.message || 'Error al guardar.' });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteCustomer = async () => {
        if (deleteConfirmation.toLowerCase() !== 'eliminar') return;
        setSaving(true);
        setFeedback(null);
        try {
            await supabase.from('cocheras').update({ cliente_id: null, vehiculos: [], status: 'Libre' }).eq('cliente_id', customer.id);
            await supabase.from('subscriptions').update({ active: false }).eq('customer_id', customer.id);
            await supabase.from('vehicles').delete().eq('customer_id', customer.id);
            const { error } = await supabase.from('customers').delete().eq('id', customer.id);
            if (error) throw error;
            onSuccess();
        } catch (err: any) {
            console.error(err);
            setFeedback({ type: 'error', text: 'Error al eliminar el cliente: ' + (err.message || '') });
            setSaving(false);
            setShowDeleteModal(false);
        }
    };

    const inputClass = "w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-900 font-medium placeholder:text-slate-400";
    const labelClass = "text-[10px] font-black uppercase tracking-[0.1em] text-slate-500 mb-2 block ml-1";

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64 w-full">
                <Loader2 className="animate-spin text-indigo-600 w-8 h-8" />
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto w-full animate-in fade-in zoom-in-95 h-full flex flex-col rounded-2xl overflow-hidden relative shadow-sm border border-slate-200 bg-white">
            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 text-slate-400 hover:text-indigo-600 bg-white border border-slate-200 rounded-xl bg-white shadow-sm transition-all hover:bg-slate-50 shrink-0">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">Editor de Perfil</h2>
                        <p className="text-sm text-slate-500">Gestionando a <span className="font-bold">{customer.name}</span></p>
                    </div>
                </div>

                {feedback && (
                    <div className={cn("px-4 py-2 rounded-xl border flex items-center gap-2 animate-in fade-in zoom-in-95 shadow-sm", feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700')}>
                        {feedback.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                        <p className="font-bold text-xs uppercase tracking-wider">{feedback.text}</p>
                    </div>
                )}
            </div>

            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                <div className="w-full md:w-64 border-r border-slate-200 bg-slate-50/30 p-6 flex flex-col gap-2">
                    <button onClick={() => setActiveTab('personales')} className={cn("text-left px-4 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-3", activeTab === 'personales' ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-100/80")}>
                        <User className="w-4 h-4" /> Datos Personales
                    </button>
                    <button onClick={() => setActiveTab('cocheras')} className={cn("text-left px-4 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-3", activeTab === 'cocheras' ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-100/80")}>
                        <Building2 className="w-4 h-4" /> Gestión de Cocheras
                    </button>
                    <div className="mt-auto pt-6 border-t border-slate-200">
                        <button onClick={() => setShowDeleteModal(true)} className="w-full text-left px-4 py-3 rounded-xl font-bold text-sm text-red-600 hover:bg-red-50 hover:text-red-700 transition-all flex items-center gap-3">
                            <Trash2 className="w-4 h-4" /> Eliminar Cliente
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 bg-white">
                    {activeTab === 'personales' && (
                        <form onSubmit={handleSavePersonales} className="max-w-3xl space-y-8 animate-in fade-in slide-in-from-bottom-2">
                            <div className="space-y-6">
                                <div>
                                    <label className={labelClass}>Nombre y Apellido *</label>
                                    <div className="relative">
                                        <User className="h-5 w-5 absolute left-3 top-3.5 text-slate-400" />
                                        <input className={inputClass} value={formData.nombre} onChange={e => handleInputChange('nombre', e.target.value)} required />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className={labelClass}>DNI / CUIT *</label>
                                        <div className="relative">
                                            <Fingerprint className="h-5 w-5 absolute left-3 top-3.5 text-slate-400" />
                                            <input className={inputClass} value={formData.dni} onChange={e => handleInputChange('dni', e.target.value)} required />
                                        </div>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Teléfono Móvil</label>
                                        <div className="relative">
                                            <Phone className="h-5 w-5 absolute left-3 top-3.5 text-slate-400" />
                                            <input className={inputClass} value={formData.telParticular} onChange={e => handleInputChange('telParticular', e.target.value)} />
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className={labelClass}>Correo Electrónico</label>
                                    <div className="relative">
                                        <Mail className="h-5 w-5 absolute left-3 top-3.5 text-slate-400" />
                                        <input className={inputClass} type="email" value={formData.email} onChange={e => handleInputChange('email', e.target.value)} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className={labelClass}>Domicilio Particular</label>
                                        <div className="relative">
                                            <MapPin className="h-5 w-5 absolute left-3 top-3.5 text-slate-400" />
                                            <input className={inputClass} value={formData.domicilio} onChange={e => handleInputChange('domicilio', e.target.value)} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Localidad</label>
                                        <div className="relative">
                                            <MapPin className="h-5 w-5 absolute left-3 top-3.5 text-slate-400" />
                                            <input className={inputClass} value={formData.localidad} onChange={e => handleInputChange('localidad', e.target.value)} />
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div>
                                        <label className={labelClass}>Teléfono de Emergencia</label>
                                        <div className="relative">
                                            <Phone className="h-5 w-5 absolute left-3 top-3.5 text-red-400" />
                                            <input className={cn(inputClass, "focus:ring-red-500 border-red-200")} value={formData.emergency_phone} onChange={e => handleInputChange('emergency_phone', e.target.value)} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Teléfono Laboral</label>
                                        <div className="relative">
                                            <Phone className="h-5 w-5 absolute left-3 top-3.5 text-slate-400" />
                                            <input className={inputClass} value={formData.work_phone} onChange={e => handleInputChange('work_phone', e.target.value)} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Domicilio Laboral</label>
                                        <div className="relative">
                                            <MapPin className="h-5 w-5 absolute left-3 top-3.5 text-slate-400" />
                                            <input className={inputClass} value={formData.work_address} onChange={e => handleInputChange('work_address', e.target.value)} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="pt-6 border-t border-slate-100 flex justify-end">
                                <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md flex items-center gap-2">
                                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                    Guardar Perfil
                                </button>
                            </div>
                        </form>
                    )}

                    {activeTab === 'cocheras' && (
                        <div className={cn("animate-in fade-in slide-in-from-bottom-2 pb-8", cocheras.length === 0 ? "max-w-4xl" : "w-full grid grid-cols-1 lg:grid-cols-2 gap-6")}>
                            {cocheras.length === 0 ? (
                                <div className="p-8 text-center text-slate-500 bg-slate-50 border border-slate-200 rounded-2xl">
                                    No hay cocheras asociadas a este cliente. Utilice el botón "Añadir Cochera" desde la tabla principal.
                                </div>
                            ) : (
                                cocheras.map((cochera, idx) => {
                                    const cVehicles = vehicles.filter((v: any) => (cochera.vehiculos || []).includes(v.plate));
                                    const formattedPrice = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(cochera.precio_base || 0);

                                    return (
                                        <div key={cochera.id || idx} className="bg-white text-slate-800 flex flex-col border border-indigo-500/20 hover:border-indigo-500/40 transition-all rounded-2xl overflow-hidden shadow-sm relative group">
                                            <div className="p-3 border-b border-slate-100 flex flex-col bg-slate-50/50 gap-2">
                                                <div className="flex justify-between items-start w-full">
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <div className="p-1.5 bg-indigo-50 text-indigo-500 rounded-lg shrink-0">
                                                            <Building2 className="w-5 h-5" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-lg font-black text-slate-800">{cochera.numero || 'S/N'}</span>
                                                                <span className="px-1.5 py-0.5 rounded-md bg-white text-indigo-600 border border-indigo-200 shadow-sm text-[10px] font-bold uppercase tracking-wider">
                                                                    {cochera.tipo}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <button
                                                        onClick={() => handleLiberarCochera(cochera)}
                                                        className="px-2 py-1 bg-white text-red-500 hover:bg-red-50 border border-red-200 hover:border-red-300 rounded-lg text-[9px] font-bold transition-all uppercase flex items-center gap-1.5 shrink-0 mt-0.5"
                                                    >
                                                        <Unlink className="w-3 h-3" /> Liberar
                                                    </button>
                                                </div>

                                                <div className="flex items-center gap-4">
                                                    {cochera.piso && (
                                                        <div className="flex flex-col shrink-0">
                                                            <span className="text-[9px] uppercase font-bold text-slate-400 leading-none mb-0.5">Sector</span>
                                                            <span className="text-xs font-black text-slate-700">{cochera.piso}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex flex-col shrink-0">
                                                        <span className="text-[9px] uppercase font-bold text-slate-400 leading-none mb-0.5">Base</span>
                                                        <span className="text-xs font-black text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-md inline-block w-fit">{formattedPrice}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex-1 p-5 space-y-5 flex flex-col">
                                                <div className="grid grid-cols-3 gap-3">
                                                    <div>
                                                        <label className="text-[10px] font-black uppercase text-slate-500 mb-1.5 block">Tipo</label>
                                                        <select className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500 text-slate-700 rounded-lg outline-none text-sm font-medium transition-all" value={cochera.tipo || ''} onChange={e => handleCocheraChange(idx, 'tipo', e.target.value)}>
                                                            <option value="Movil" disabled={cVehicles.length > 1} title={cVehicles.length > 1 ? "Móvil solo admite 1 vehículo" : ""}>Móvil</option>
                                                            <option value="Fija">Fija</option>
                                                            <option value="Exclusiva">Exclusiva</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-black uppercase text-slate-500 mb-1.5 block">Número</label>
                                                        <input className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500 text-slate-700 rounded-lg outline-none text-sm font-bold text-center transition-all" value={cochera.numero || ''} onChange={e => handleCocheraChange(idx, 'numero', e.target.value)} disabled={cochera.tipo === 'Movil'} placeholder={cochera.tipo === 'Movil' ? 'Auto M' : ''} />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-black uppercase text-slate-500 mb-1.5 block">Sector</label>
                                                        <select
                                                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500 text-slate-700 rounded-lg outline-none text-sm font-medium transition-all"
                                                            value={cochera.piso || ''}
                                                            onChange={e => handleCocheraChange(idx, 'piso', e.target.value)}
                                                        >
                                                            <option value="" disabled hidden>Seleccione...</option>
                                                            {buildingLevels.map((level: any) => (
                                                                <option key={level.id} value={level.display_name}>{level.display_name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>

                                                <div className="space-y-3">
                                                    <h4 className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                                                        <Car className="w-3 h-3 text-indigo-400" /> Vehículos Vinculados
                                                    </h4>

                                                    {cVehicles.length === 0 ? (
                                                        <p className="text-xs text-slate-400 italic">No hay vehículos asignados a esta cochera.</p>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            {cVehicles.map((v: any) => {
                                                                const vIdx = vehicles.findIndex((gv: any) => gv.id === v.id);
                                                                const isExpanded = !!expandedVehicles[v.id];

                                                                return (
                                                                    <div key={v.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden transition-all shadow-sm">
                                                                        <div
                                                                            className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                                                                            onClick={(e) => toggleVehicleInfo(v.id, e)}
                                                                        >
                                                                            <div className="flex items-center gap-3">
                                                                                <div className="bg-slate-100 border border-slate-200 text-slate-800 font-mono font-black tracking-widest text-center rounded px-3 py-1 text-sm uppercase shadow-sm">
                                                                                    {v.plate || 'S/N'}
                                                                                </div>
                                                                                {!isExpanded && (
                                                                                    <div className="text-xs font-bold text-slate-500 flex gap-2">
                                                                                        <span className="text-indigo-600">{v.type || 'Tipo'}</span>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex items-center gap-2">
                                                                                <button type="button" onClick={(e) => { e.stopPropagation(); handleDesvincularVehiculo(cochera, v.plate); }} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors" title="Desvincular Vehículo">
                                                                                    <Trash2 className="w-4 h-4" />
                                                                                </button>
                                                                                <div className="p-1 text-slate-400">
                                                                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        {isExpanded && (
                                                                            <div className="p-4 bg-slate-50 border-t border-slate-100 animate-in fade-in slide-in-from-top-2">
                                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                                                    <div className="col-span-1 sm:col-span-2">
                                                                                        <label className="text-[9px] font-bold text-slate-500 uppercase">Patente (Editable)</label>
                                                                                        <input className="w-full px-2 py-1.5 mt-0.5 bg-white border border-slate-200 text-slate-700 font-mono font-bold tracking-widest text-center rounded focus:ring-1 focus:ring-indigo-500 outline-none text-sm uppercase transition-all shadow-sm" value={v.plate || ''} onChange={e => handleVehicleChange(vIdx, v.plate, 'plate', e.target.value.toUpperCase())} placeholder="PATENTE" />
                                                                                    </div>
                                                                                    <div>
                                                                                        <label className="text-[9px] font-bold text-slate-500 uppercase">Tipo</label>
                                                                                        <select className="w-full px-2 py-1.5 mt-0.5 bg-white border border-slate-200 focus:ring-1 focus:ring-indigo-500 text-slate-700 rounded outline-none text-xs font-medium transition-all shadow-sm" value={v.type || ''} onChange={e => handleVehicleChange(vIdx, v.plate, 'type', e.target.value)}>
                                                                                            <option value="" disabled hidden>Tipo...</option>
                                                                                            {vehicleTypes.map((vt: any) => (
                                                                                                <option key={vt.id} value={vt.name}>{vt.name}</option>
                                                                                            ))}
                                                                                        </select>
                                                                                    </div>
                                                                                    <div>
                                                                                        <label className="text-[9px] font-bold text-slate-500 uppercase">Marca</label>
                                                                                        <input className="w-full px-2 py-1.5 mt-0.5 bg-white border border-slate-200 focus:ring-1 focus:ring-indigo-500 text-slate-700 rounded outline-none text-xs font-medium transition-all shadow-sm" value={v.brand || ''} onChange={e => handleVehicleChange(vIdx, v.plate, 'brand', e.target.value)} placeholder="Ej: Ford" />
                                                                                    </div>
                                                                                    <div>
                                                                                        <label className="text-[9px] font-bold text-slate-500 uppercase">Modelo</label>
                                                                                        <input className="w-full px-2 py-1.5 mt-0.5 bg-white border border-slate-200 focus:ring-1 focus:ring-indigo-500 text-slate-700 rounded outline-none text-xs font-medium transition-all shadow-sm" value={v.model || ''} onChange={e => handleVehicleChange(vIdx, v.plate, 'model', e.target.value)} placeholder="Ej: Fiesta" />
                                                                                    </div>
                                                                                    <div>
                                                                                        <label className="text-[9px] font-bold text-slate-500 uppercase">Color</label>
                                                                                        <input className="w-full px-2 py-1.5 mt-0.5 bg-white border border-slate-200 focus:ring-1 focus:ring-indigo-500 text-slate-700 rounded outline-none text-xs font-medium transition-all shadow-sm" value={v.color || ''} onChange={e => handleVehicleChange(vIdx, v.plate, 'color', e.target.value)} placeholder="Gris" />
                                                                                    </div>
                                                                                    <div>
                                                                                        <label className="text-[9px] font-bold text-slate-500 uppercase">Año</label>
                                                                                        <input className="w-full px-2 py-1.5 mt-0.5 bg-white border border-slate-200 focus:ring-1 focus:ring-indigo-500 text-slate-700 rounded outline-none text-xs font-medium transition-all shadow-sm" value={v.year || ''} onChange={e => handleVehicleChange(vIdx, v.plate, 'year', e.target.value)} placeholder="2018" />
                                                                                    </div>
                                                                                    <div>
                                                                                        <label className="text-[9px] font-bold text-slate-500 uppercase">Compañía de Seguro</label>
                                                                                        <input className="w-full px-2 py-1.5 mt-0.5 bg-white border border-slate-200 focus:ring-1 focus:ring-indigo-500 text-slate-700 rounded outline-none text-xs font-medium transition-all shadow-sm" value={v.insurance || ''} onChange={e => handleVehicleChange(vIdx, v.plate, 'insurance', e.target.value)} placeholder="Sancor" />
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="mt-auto pt-4 flex justify-end items-center border-t border-slate-100">
                                                    <button
                                                        onClick={() => handleSaveCocheraCompleta(cochera, cVehicles)}
                                                        disabled={saving}
                                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-all text-xs flex items-center gap-2 shadow-sm"
                                                    >
                                                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Actualizar Cochera
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>
            </div>

            {showDeleteModal && (
                <div className="absolute inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95">
                        <div className="p-6 bg-red-50 border-b border-red-100 flex items-center gap-4">
                            <div className="bg-red-100 p-3 rounded-full text-red-600">
                                <AlertCircle className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-red-900 text-lg">Eliminación Crítica</h3>
                                <p className="text-red-700 text-sm">Esta acción es destructiva e irreversible.</p>
                            </div>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="text-slate-600 text-sm">
                                Al eliminar este cliente:
                                <ul className="list-disc pl-5 mt-2 space-y-1 font-medium text-slate-700">
                                    <li>Sus cocheras actuales quedarán <span className="text-amber-600">Libres</span>.</li>
                                    <li>Las subscripciones activas se cancelarán.</li>
                                    <li>El historial de vehículos será eliminado.</li>
                                </ul>
                            </div>

                            <div className="pt-4">
                                <label className="text-xs font-bold text-slate-500 uppercase">Escriba "eliminar" para confirmar</label>
                                <input
                                    type="text"
                                    placeholder="eliminar"
                                    className="w-full mt-2 px-4 py-3 bg-red-50/50 border border-red-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 font-bold text-red-700 text-center uppercase tracking-widest"
                                    value={deleteConfirmation}
                                    onChange={e => setDeleteConfirmation(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg transition-colors"
                                disabled={saving}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDeleteCustomer}
                                disabled={deleteConfirmation.toLowerCase() !== 'eliminar' || saving}
                                className="px-6 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                Sí, Eliminar Todo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
