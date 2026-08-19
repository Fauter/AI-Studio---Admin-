import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
    Users, Search, Loader2, AlertCircle, CheckCircle2,
    CreditCard, Car, History, User, Building2, Save, X, Phone, Mail, MapPin, Camera,
    ShieldCheck, Contact2, FileText, Truck, Bike, Bus, Van, Motorbike, type LucideIcon
} from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import clsx from 'clsx';
import SectionHeader from '../components/hub/SectionHeader';

function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

// --- Interfaces for Local Types ---
interface Customer {
    id: string;
    garage_id: string;
    name: string;
    dni: string | null;
    phone: string | null;
    email: string | null;
    work_phone: string | null;
    emergency_phone: string | null;
    address: string | null;
    localidad: string | null;
}

interface Debt {
    id: string;
    customer_id: string;
    amount: number;
    status: string;
    due_date: string | null;
    type?: string;
    remaining_amount?: number;
    amount_paid?: number;
    subscription_id?: string;
}

const getRemaining = (d: Debt) => (d.remaining_amount != null) ? Number(d.remaining_amount) : Number(d.amount);

interface Cochera {
    id: string;
    cliente_id: string | null;
    vehiculo_id: string | null;
    vehiculos?: string[]; // Array of plates
    name: string | null;
    numero: string | null;
    tipo: string | null;
    precio_base: number | null;
    isVencida?: boolean;
    allVehicles?: Vehicle[];
}

interface Vehicle {
    id: string;
    plate: string;
    brand: string | null;
    model: string | null;
    type?: string | null;
    photos?: any;
}

interface VehicleTypeRecord {
    id: string;
    garage_id: string;
    name: string;
    icon_key: string;
    color_key?: string;
    sort_order: number;
}

// --- Vehicle Icon Mapping ---
const VEHICLE_ICON_MAP: Record<string, LucideIcon> = {
    bicycle: Bike,
    motorcycle: Motorbike,
    car: Car,
    van: Van,
    truck: Truck,
    bus: Bus,
};

const getVehicleIcon = (iconKey?: string | null): LucideIcon => {
    if (!iconKey) return Car;
    return VEHICLE_ICON_MAP[iconKey.toLowerCase()] || Car;
};

// --- Dynamic Vehicle Color Styles ---
const getVehicleColorStyles = (colorKey: string): string => {
    switch (colorKey) {
        case 'orange': return 'bg-orange-100 text-orange-600 border-orange-200';
        case 'blue': return 'bg-blue-100 text-blue-600 border-blue-200';
        case 'slate': return 'bg-slate-100 text-slate-600 border-slate-200';
        case 'indigo': return 'bg-indigo-100 text-indigo-600 border-indigo-200';
        case 'purple': return 'bg-purple-100 text-purple-600 border-purple-200';
        case 'emerald': return 'bg-emerald-100 text-emerald-600 border-emerald-200';
        case 'rose': return 'bg-rose-100 text-rose-600 border-rose-200';
        default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
};

// --- Search Normalization Helpers ---

/**
 * Normalizes text for general search (names, descriptions).
 * Handles null/undefined, trims, lowercases, removes diacritics,
 * and collapses repeated whitespace.
 */
const normalizeSearchText = (value: string | null | undefined): string => {
    if (value == null) return '';
    return value
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ');
};

/**
 * Normalizes identifiers (DNI, plates) for search.
 * Uses normalizeSearchText as base, then strips spaces, hyphens,
 * dots, and any non-alphanumeric character.
 */
const normalizeIdentifier = (value: string | null | undefined): string => {
    return normalizeSearchText(value).replace(/[^a-z0-9]/g, '');
};

// --- Smart Capitalization ---
const smartCapitalize = (text: string): string => {
    if (!text) return '';
    // If text is all lowercase, convert to Capital Case
    if (text === text.toLowerCase()) {
        return text.charAt(0).toUpperCase() + text.slice(1);
    }
    // If it already has uppercase chars (BMW, F100), leave intact
    return text;
};

interface Subscription {
    id: string;
    customer_id: string;
    vehicle_id: string | null;
    start_date: string;
    end_date: string | null;
    price: number;
    active: boolean;
    documents_metadata: any;
}

type TabType = 'profile' | 'assets' | 'finance' | 'history' | 'documentation';

export default function CustomersPage() {
    const { garageId } = useParams<{ garageId: string }>();

    // --- State ---
    const [loading, setLoading] = useState(true);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [debts, setDebts] = useState<Debt[]>([]);
    const [cocheras, setCocheras] = useState<Cochera[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [vehicleTypes, setVehicleTypes] = useState<VehicleTypeRecord[]>([]);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [activeTab, setActiveTab] = useState<TabType>('profile');

    // Form state for profile editing
    const [editForm, setEditForm] = useState<Partial<Customer>>({});
    const [savingProfile, setSavingProfile] = useState(false);
    const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    const detailScrollRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (selectedCustomer?.id && detailScrollRef.current) {
            detailScrollRef.current.scrollTo({ top: 0 });
        }
    }, [selectedCustomer?.id]);

    // --- Fetch Data ---
    useEffect(() => {
        if (!garageId) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const [
                    customersRes,
                    debtsRes,
                    cocherasRes,
                    vehiclesRes,
                    subsRes,
                    vehicleTypesRes
                ] = await Promise.all([
                    supabase.from('customers').select('*').eq('garage_id', garageId),
                    supabase.from('debts').select('*').eq('garage_id', garageId).eq('status', 'PENDING'),
                    supabase.from('cocheras').select('*').eq('garage_id', garageId),
                    supabase.from('vehicles').select('*').eq('garage_id', garageId),
                    supabase.from('suscriptions').select('id, customer_id, vehicle_id, start_date, end_date, price, active, documents_metadata').eq('garage_id', garageId),
                    supabase.from('vehicle_types').select('*').eq('garage_id', garageId),
                ]);

                if (customersRes.error) throw customersRes.error;

                setCustomers(customersRes.data as Customer[] || []);
                setDebts(debtsRes.data as Debt[] || []);
                setCocheras(cocherasRes.data as Cochera[] || []);
                setVehicles(vehiclesRes.data as Vehicle[] || []);
                setSubscriptions(subsRes.data as Subscription[] || []);
                setVehicleTypes(vehicleTypesRes.data as VehicleTypeRecord[] || []);

            } catch (err: any) {
                console.error("Error fetching customers data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [garageId]);

    // --- Plate Search Index ---
    // Maps customer.id → Set of normalized plates from cocheras.vehiculos
    // with vehiculo_id → vehicles.plate as fallback.
    const customerPlateSearchIndex = useMemo(() => {
        const index = new Map<string, Set<string>>();

        // Build a vehicle lookup by ID for O(1) resolution of vehiculo_id
        const vehicleById = new Map<string, Vehicle>();
        for (const v of vehicles) {
            vehicleById.set(v.id, v);
        }

        for (const cochera of cocheras) {
            if (!cochera.cliente_id) continue;

            let plates = index.get(cochera.cliente_id);
            if (!plates) {
                plates = new Set<string>();
                index.set(cochera.cliente_id, plates);
            }

            // Primary source: cochera.vehiculos[]
            if (Array.isArray(cochera.vehiculos)) {
                for (const raw of cochera.vehiculos) {
                    if (raw == null || typeof raw !== 'string') continue;
                    const normalized = normalizeIdentifier(raw);
                    if (normalized) plates.add(normalized);
                }
            }

            // Fallback: cochera.vehiculo_id → vehicles.plate
            if (cochera.vehiculo_id) {
                const vehicle = vehicleById.get(cochera.vehiculo_id);
                if (vehicle?.plate) {
                    const normalized = normalizeIdentifier(vehicle.plate);
                    if (normalized) plates.add(normalized);
                }
            }
        }

        return index;
    }, [cocheras, vehicles]);

    // --- Memos & Derived State ---
    const filteredCustomers = useMemo(() => {
        const trimmed = searchTerm.trim();
        if (!trimmed) return customers;

        const normalizedTextTerm = normalizeSearchText(trimmed);
        const normalizedIdentifierTerm = normalizeIdentifier(trimmed);

        // Guard: if the term normalizes to empty (e.g. only symbols),
        // return no results to prevent ''.includes('') matching everything.
        if (!normalizedTextTerm && !normalizedIdentifierTerm) return [];

        return customers.filter(customer => {
            // Match by name
            const matchesName = normalizedTextTerm
                ? normalizeSearchText(customer.name).includes(normalizedTextTerm)
                : false;

            // Match by DNI
            const matchesDni = normalizedIdentifierTerm
                ? normalizeIdentifier(customer.dni).includes(normalizedIdentifierTerm)
                : false;

            // Match by plate (from customerPlateSearchIndex)
            let matchesPlate = false;
            if (normalizedIdentifierTerm) {
                const plates = customerPlateSearchIndex.get(customer.id);
                if (plates) {
                    for (const plate of plates) {
                        if (plate.includes(normalizedIdentifierTerm)) {
                            matchesPlate = true;
                            break;
                        }
                    }
                }
            }

            return matchesName || matchesDni || matchesPlate;
        });
    }, [customers, searchTerm, customerPlateSearchIndex]);

    // Enriched Customer Data (for the table)
    const customersWithStats = useMemo(() => {
        const enriched = filteredCustomers.map(customer => {
            const customerCocheras = cocheras.filter(c => c.cliente_id === customer.id);
            const cocherasCount = customerCocheras.length;

            // Cálculo de Deuda Real: Solo suma deuda si tiene cocheras asignadas.
            let totalDebt = 0;
            if (cocherasCount > 0) {
                const customerDebts = debts.filter(d => d.customer_id === customer.id && d.status === 'PENDING');
                totalDebt = customerDebts.reduce((sum, d) => sum + getRemaining(d), 0);
            }

            return {
                ...customer,
                totalDebt,
                cocherasCount,
                cocherasInfo: customerCocheras.map(c => c.numero || c.name).join(', ')
            };
        });

        // Ordenamiento Inteligente
        return enriched.sort((a, b) => {
            const aHasCocheras = a.cocherasCount > 0;
            const bHasCocheras = b.cocherasCount > 0;

            // 3. Al final de todo: Clientes sin cocheras
            if (aHasCocheras && !bHasCocheras) return -1;
            if (!aHasCocheras && bHasCocheras) return 1;
            if (!aHasCocheras && !bHasCocheras) return 0;

            const aHasDebt = a.totalDebt > 0;
            const bHasDebt = b.totalDebt > 0;

            // 1. Primero: Clientes con cocheras asignadas Y deuda (mayor deuda arriba)
            if (aHasDebt && !bHasDebt) return -1;
            if (!aHasDebt && bHasDebt) return 1;
            if (aHasDebt && bHasDebt) {
                return b.totalDebt - a.totalDebt;
            }

            // 2. Segundo: Clientes con cocheras asignadas SIN deuda (ordenados por nombre)
            return (a.name || '').localeCompare(b.name || '');
        });
    }, [filteredCustomers, debts, cocheras]);

    // Data for the Selected Customer Detail View
    const selectedDebts = selectedCustomer ? debts.filter(d => d.customer_id === selectedCustomer.id) : [];
    const selectedTotalDebt = selectedDebts.reduce((sum, d) => sum + getRemaining(d), 0);

    // Realizar el cruce de datos: cochera -> vehículo -> suscripción -> deudas CANON
    const selectedCocheras = useMemo(() => {
        if (!selectedCustomer) return [];
        const customerCocheras = cocheras.filter(c => c.cliente_id === selectedCustomer.id);
        const customerSubs = subscriptions.filter(s => s.customer_id === selectedCustomer.id);

        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

        return customerCocheras.map(cochera => {
            const allVehicles = vehicles.filter(v => cochera.vehiculos?.includes(v.plate));

            let hasCanonDebt = false;
            let currentEndDate: string | null = null;
            let totalCocheraDebt = 0;
            const owedMonths: string[] = [];
            const cocheraDebtIds: string[] = [];

            // Iterate ALL vehicles and ALL subs (not just active — inactive subs can still have pending debts)
            for (const vehicle of allVehicles) {
                const subsForVehicle = customerSubs.filter(s => s.vehicle_id === vehicle.id);
                for (const sub of subsForVehicle) {
                    // Track end_date from the most recent sub (any state) for calendar check
                    if (sub.end_date) {
                        if (!currentEndDate || new Date(sub.end_date).getTime() > new Date(currentEndDate).getTime()) {
                            currentEndDate = sub.end_date;
                        }
                    }

                    // Find CANON debts tied to this subscription
                    const subDebts = selectedDebts.filter(d =>
                        d.subscription_id === sub.id &&
                        d.status === 'PENDING' &&
                        d.type === 'CANON' &&
                        getRemaining(d) > 0
                    );

                    if (subDebts.length > 0) {
                        hasCanonDebt = true;
                        for (const debt of subDebts) {
                            totalCocheraDebt += getRemaining(debt);
                            cocheraDebtIds.push(debt.id);
                            if (debt.due_date) {
                                const [y, m] = debt.due_date.split('T')[0].split('-');
                                owedMonths.push(`${monthNames[parseInt(m, 10) - 1]} ${y}`);
                            }
                        }
                    }
                }
            }

            // Doble Candado: Calendar expired OR has pending CANON debts
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const calendarExpired = currentEndDate ? new Date(currentEndDate).getTime() < today.getTime() : false;
            const isVencida = calendarExpired || hasCanonDebt;

            return { ...cochera, allVehicles, isVencida, currentEndDate, totalCocheraDebt, owedMonths, cocheraDebtIds, calendarExpired };
        });
    }, [selectedCustomer, cocheras, vehicles, subscriptions, selectedDebts]);

    const selectedSubs = selectedCustomer ? subscriptions.filter(s => s.customer_id === selectedCustomer.id).sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()) : [];

    // --- Handlers ---
    const handleSelectCustomer = (customer: Customer) => {
        setSelectedCustomer(customer);
        setEditForm({
            name: customer.name || '',
            dni: customer.dni || '',
            phone: customer.phone || '',
            work_phone: customer.work_phone || '',
            emergency_phone: customer.emergency_phone || '',
            email: customer.email || '',
            address: customer.address || '',
            localidad: customer.localidad || ''
        });
        setActiveTab('profile');
        setSelectedImage(null);
        setStatusMsg(null);
    };

    const closeDetailView = () => {
        setSelectedCustomer(null);
        setSelectedImage(null);
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCustomer || !garageId) return;

        setSavingProfile(true);
        setStatusMsg(null);

        try {
            const { error } = await supabase
                .from('customers')
                .update(editForm)
                .eq('id', selectedCustomer.id)
                .eq('garage_id', garageId); // Security constraint

            if (error) throw error;

            // Update local state
            const updatedCustomer = { ...selectedCustomer, ...editForm };
            setCustomers(prev => prev.map(c => c.id === updatedCustomer.id ? updatedCustomer : c));
            setSelectedCustomer(updatedCustomer);
            setStatusMsg({ type: 'success', text: 'Perfil actualizado correctamente.' });
            setTimeout(() => setStatusMsg(null), 3000);

        } catch (err: any) {
            setStatusMsg({ type: 'error', text: 'Error al actualizar: ' + err.message });
        } finally {
            setSavingProfile(false);
        }
    };

    const handleCobrar = () => {
        // Placeholder functionality
        setStatusMsg({ type: 'success', text: 'Función de cobro en desarrollo.' });
        setTimeout(() => setStatusMsg(null), 3000);
    };

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 h-full min-h-0 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
            <SectionHeader title="Gestión de Abonados" icon={Users} iconColor="indigo" />

            <div className="flex gap-6 flex-1 min-h-0 min-w-0 overflow-hidden">

                {/* MAIN LIST VIEW */}
                <div className={cn(
                    "bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col transition-all duration-300 min-h-0 min-w-0 overflow-hidden",
                    selectedCustomer ? "w-full lg:w-[360px] xl:w-[380px] shrink-0 hidden lg:flex" : "w-full flex-1"
                )}>
                    {/* Header & Search */}
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                        <div className="relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar por nombre, DNI o patente..."
                                aria-label="Buscar abonado por nombre, DNI o patente"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                            />
                        </div>
                    </div>

                    {/* Table / List */}
                    <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain">
                        <table className="w-full text-sm text-left table-fixed">
                            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-3 md:px-4 py-3">Cliente</th>
                                    {!selectedCustomer && <th className="px-4 py-3 hidden sm:table-cell">Contacto</th>}
                                    {!selectedCustomer && <th className="px-4 py-3 text-center hidden md:table-cell">Cocheras</th>}
                                    <th className={cn("py-3 text-right", selectedCustomer ? "px-3 md:px-4 w-[90px]" : "px-3 md:px-4")}>Deuda</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {customersWithStats.map(customer => (
                                    <tr
                                        key={customer.id}
                                        onClick={() => handleSelectCustomer(customer)}
                                        className={cn(
                                            "group cursor-pointer transition-colors",
                                            selectedCustomer?.id === customer.id ? "bg-indigo-50" : "hover:bg-slate-50/80"
                                        )}
                                    >
                                        <td className="px-3 md:px-4 py-2.5 min-w-0">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className={cn(
                                                    "h-8 w-8 rounded-full flex items-center justify-center shrink-0 font-bold text-xs transition-colors",
                                                    selectedCustomer?.id === customer.id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-700"
                                                )}>
                                                    {customer.name?.charAt(0).toUpperCase() || 'C'}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className={cn("font-bold truncate", selectedCustomer?.id === customer.id ? "text-indigo-900" : "text-slate-800")} title={customer.name || ''}>
                                                        {customer.name}
                                                    </p>
                                                    <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate" title={customer.dni || ''}>DNI {customer.dni || 'S/N'}</p>
                                                </div>
                                            </div>
                                        </td>

                                        {!selectedCustomer && (
                                            <td className="px-4 py-2.5 text-slate-500 text-xs min-w-0 hidden sm:table-cell">
                                                <p className="truncate" title={customer.phone || ''}>{customer.phone || '-'}</p>
                                                <p className="truncate text-[11px]" title={customer.email || ''}>{customer.email || '-'}</p>
                                            </td>
                                        )}

                                        {!selectedCustomer && (
                                            <td className="px-4 py-2.5 text-center hidden md:table-cell">
                                                <span className="inline-flex items-center justify-center bg-slate-100 text-slate-600 rounded-md px-2 py-1 text-xs font-bold border border-slate-200">
                                                    {customer.cocherasCount} <Car className="h-3 w-3 ml-1" />
                                                </span>
                                            </td>
                                        )}

                                        <td className="px-3 md:px-4 py-2.5 text-right whitespace-nowrap">
                                            {customer.totalDebt > 0 ? (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
                                                    ${customer.totalDebt.toLocaleString()}
                                                </span>
                                            ) : customer.cocherasCount === 0 ? (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200">
                                                    Inactivo
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                    Al Día
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {customersWithStats.length === 0 && (
                                    <tr>
                                        <td colSpan={selectedCustomer ? 2 : 4} className="px-4 py-8 text-center text-slate-400">
                                            No se encontraron clientes.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* DETAIL VIEW PANEL */}
                {selectedCustomer && (
                    <div className="flex-1 min-w-0 h-full bg-white rounded-2xl border border-slate-200 shadow-xl flex flex-col animate-in slide-in-from-right-4 overflow-hidden">

                        {/* Header */}
                        <div className="px-5 py-3 shrink-0 bg-slate-900 flex items-center justify-between shadow-md z-20">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="h-10 w-10 shrink-0 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-lg font-bold border-2 border-slate-700 shadow-inner">
                                    {selectedCustomer.name?.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-lg font-bold text-white leading-tight truncate" title={selectedCustomer.name}>{selectedCustomer.name}</h2>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-slate-400 text-xs font-mono bg-slate-800 px-2 py-0.5 rounded border border-slate-700">ID: {selectedCustomer.id.substring(0, 8)}</span>
                                        {selectedTotalDebt > 0 ? (
                                            <span className="text-red-400 text-xs font-bold flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Deuda Activa</span>
                                        ) : (
                                            <span className="text-emerald-400 text-xs font-bold flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Cuenta al Día</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button onClick={closeDetailView} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Status Messages */}
                        {statusMsg && (
                            <div className={cn(
                                "px-6 py-3 flex items-center gap-2 text-sm font-bold border-b",
                                statusMsg.type === 'success' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-red-50 text-red-700 border-red-100"
                            )}>
                                {statusMsg.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                {statusMsg.text}
                            </div>
                        )}

                        {/* Tabs Component - Clean Style */}
                        <div className="flex px-4 shrink-0 border-b border-slate-200 bg-slate-50 items-end overflow-x-auto hide-scrollbar">
                            {[
                                { id: 'profile', label: 'Perfil', icon: User },
                                { id: 'assets', label: 'Cocheras & Vehículos', icon: Building2 },
                                { id: 'finance', label: 'Estado Financiero', icon: CreditCard },
                                // { id: 'history', label: 'Historial', icon: History },
                            ].map(tab => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id as TabType)}
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-2.5 text-[13px] font-bold border-b-2 transition-all whitespace-nowrap",
                                            isActive
                                                ? "border-indigo-600 text-indigo-700 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05),_0_2px_4px_-1px_rgba(0,0,0,0.06)] rounded-t-lg"
                                                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
                                        )}
                                    >
                                        <Icon className={cn("h-3.5 w-3.5", isActive ? "text-indigo-600" : "text-slate-400")} />
                                        {tab.label}
                                    </button>
                                )
                            })}
                        </div>

                        {/* Tab Content Area */}
                        <div ref={detailScrollRef} className={cn(
                            "flex-1 min-h-0 overscroll-contain bg-slate-50/30 flex flex-col",
                            activeTab === 'profile' ? "overflow-y-auto overflow-x-hidden p-4 lg:p-5 [@media(max-height:800px)]:p-3.5" : "overflow-y-auto overflow-x-hidden p-4 lg:p-5"
                        )}>

                            {/* TAB: PROFILE */}
                            {activeTab === 'profile' && (
                                <form onSubmit={handleUpdateProfile} className="w-full h-auto min-h-full max-w-4xl mx-auto flex flex-col gap-4 [@media(max-height:800px)]:gap-3 animate-in fade-in">
                                    <div className="flex-none flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm p-5 [@media(max-height:800px)]:p-4 mb-4 md:mb-0">
                                        
                                        {/* BLOQUE 1 - Información Personal */}
                                        <div className="shrink-0">
                                            <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2 mb-3 [@media(max-height:800px)]:mb-2.5">
                                                <User className="h-4 w-4 text-slate-400" /> Información Personal
                                            </h3>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-3.5 [@media(max-height:800px)]:gap-y-3 shrink-0">
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-500 uppercase leading-tight mb-1.5">Nombre Completo</label>
                                                <input
                                                    type="text" required value={editForm.name || ''}
                                                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                                    className="w-full px-3 py-2 h-10 [@media(max-height:800px)]:h-9 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-500 uppercase leading-tight mb-1.5">DNI</label>
                                                <input
                                                    type="text" value={editForm.dni || ''}
                                                    onChange={e => setEditForm({ ...editForm, dni: e.target.value })}
                                                    className="w-full px-3 py-2 h-10 [@media(max-height:800px)]:h-9 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-500 uppercase leading-tight mb-1.5 flex items-center gap-1"><Phone className="h-3 w-3" /> Teléfono</label>
                                                <input
                                                    type="text" value={editForm.phone || ''}
                                                    onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                                                    className="w-full px-3 py-2 h-10 [@media(max-height:800px)]:h-9 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-500 uppercase leading-tight mb-1.5 flex items-center gap-1"><Mail className="h-3 w-3" /> Correo Electrónico</label>
                                                <input
                                                    type="email" value={editForm.email || ''}
                                                    onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                                                    className="w-full px-3 py-2 h-10 [@media(max-height:800px)]:h-9 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-500 uppercase leading-tight mb-1.5 flex items-center gap-1"><Phone className="h-3 w-3" /> Teléfono Laboral</label>
                                                <input
                                                    type="text" value={editForm.work_phone || ''}
                                                    onChange={e => setEditForm({ ...editForm, work_phone: e.target.value })}
                                                    className="w-full px-3 py-2 h-10 [@media(max-height:800px)]:h-9 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-500 uppercase leading-tight mb-1.5 flex items-center gap-1"><Phone className="h-3 w-3 text-red-500" /> Teléfono de Emergencia</label>
                                                <input
                                                    type="text" value={editForm.emergency_phone || ''}
                                                    onChange={e => setEditForm({ ...editForm, emergency_phone: e.target.value })}
                                                    className="w-full px-3 py-2 h-10 [@media(max-height:800px)]:h-9 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                                />
                                            </div>
                                        </div>

                                        {/* BLOQUE 2 - Dirección */}
                                        <div className="shrink-0 mt-5 pt-4 border-t border-slate-100 [@media(max-height:800px)]:mt-4 [@media(max-height:800px)]:pt-3">
                                            <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2 mb-3 [@media(max-height:800px)]:mb-2.5">
                                                <MapPin className="h-4 w-4 text-slate-400" /> Dirección
                                            </h3>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-3.5 [@media(max-height:800px)]:gap-y-3 shrink-0">
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-500 uppercase leading-tight mb-1.5">Domicilio</label>
                                                <input
                                                    type="text" value={editForm.address || ''}
                                                    onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                                                    className="w-full px-3 py-2 h-10 [@media(max-height:800px)]:h-9 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-500 uppercase leading-tight mb-1.5">Localidad</label>
                                                <input
                                                    type="text" value={editForm.localidad || ''}
                                                    onChange={e => setEditForm({ ...editForm, localidad: e.target.value })}
                                                    className="w-full px-3 py-2 h-10 [@media(max-height:800px)]:h-9 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                                />
                                            </div>
                                        </div>

                                        {/* Flex spacer to distribute available height if the window is tall enough */}
                                        <div className="flex-1 min-h-0"></div>
                                    </div>

                                    {/* Fila de Acción */}
                                    <div className="flex justify-end shrink-0">
                                        <button type="submit" disabled={savingProfile} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-10 [@media(max-height:800px)]:h-9 px-5 rounded-xl flex items-center gap-2 text-sm transition-all shadow-md shadow-indigo-200">
                                            {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar Cambios
                                        </button>
                                    </div>
                                </form>
                            )}

                            {/* TAB: FINANCE */}
                            {activeTab === 'finance' && (
                                <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in">

                                    {/* Summary Card */}
                                    <div className={cn(
                                        "p-6 rounded-2xl border shadow-sm flex items-center justify-between",
                                        selectedTotalDebt > 0 ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"
                                    )}>
                                        <div>
                                            <p className={cn("text-sm font-bold uppercase tracking-wide", selectedTotalDebt > 0 ? "text-red-600" : "text-emerald-700")}>
                                                Estado de Cuenta
                                            </p>
                                            <h3 className={cn("text-3xl font-black mt-1", selectedTotalDebt > 0 ? "text-red-700" : "text-emerald-800")}>
                                                {selectedTotalDebt > 0 ? `$${selectedTotalDebt.toLocaleString()}` : 'Al Día'}
                                            </h3>
                                        </div>
                                        <div className={cn("h-16 w-16 rounded-full flex items-center justify-center opacity-70", selectedTotalDebt > 0 ? "bg-red-200" : "bg-emerald-200")}>
                                            {selectedTotalDebt > 0 ? <AlertCircle className="h-8 w-8 text-red-700" /> : <CheckCircle2 className="h-8 w-8 text-emerald-700" />}
                                        </div>
                                    </div>

                                    {/* Pending Debts List */}
                                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                                            <h3 className="font-bold text-slate-800">Deudas Pendientes</h3>
                                            {/* {selectedTotalDebt > 0 && (
                                                <button onClick={handleCobrar} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-1.5 rounded-lg transition-colors shadow-sm">
                                                    Registrar Cobro
                                                </button>
                                            )} */}
                                        </div>
                                        {selectedDebts.length > 0 ? (
                                            <ul className="divide-y divide-slate-100">
                                                {selectedDebts.map(debt => {
                                                    const isCanon = debt.type === 'CANON';
                                                    const isMigration = debt.type === 'MANUAL_MIGRATION';

                                                    let label = isMigration ? 'Deuda Manual' : 'Abono Impago';
                                                    if (isCanon) {
                                                        const relatedSub = selectedSubs.find(s => s.id === debt.subscription_id);
                                                        if (relatedSub) {
                                                            const relatedCochera = selectedCocheras.find(c =>
                                                                c.allVehicles?.some((v: any) => v.id === relatedSub.vehicle_id)
                                                            );
                                                            if (relatedCochera) {
                                                                const dateStr = debt.due_date ? (() => {
                                                                    const [y, m] = debt.due_date.split('T')[0].split('-');
                                                                    return `${m}/${y}`;
                                                                })() : '';
                                                                label = `Cochera #${relatedCochera.numero || relatedCochera.name || 'S/N'}${dateStr ? ` - ${dateStr}` : ''}`;
                                                            }
                                                        }
                                                    }

                                                    const remaining = getRemaining(debt);
                                                    const isPartial = debt.amount_paid != null && Number(debt.amount_paid) > 0;

                                                    // Determine color scheme: amber for partial, red for full debt
                                                    const colorScheme = isPartial
                                                        ? { icon: 'bg-amber-50 border-amber-200 text-amber-600', label: 'text-amber-900', amount: 'text-amber-600', badge: 'text-amber-600 bg-amber-50 border-amber-200' }
                                                        : isMigration
                                                            ? { icon: 'bg-orange-50 border-orange-100 text-orange-600', label: 'text-orange-900', amount: 'text-orange-600', badge: 'text-orange-500 bg-orange-50 border-orange-200' }
                                                            : { icon: 'bg-red-50 border-red-100 text-red-600', label: 'text-red-900', amount: 'text-red-600', badge: 'text-red-500 bg-red-50 border-red-200' };

                                                    return (
                                                        <li key={debt.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50">
                                                            <div className="flex items-center gap-4">
                                                                <div className={cn("h-10 w-10 border text-lg rounded-lg flex items-center justify-center font-bold", colorScheme.icon)}>
                                                                    $
                                                                </div>
                                                                <div>
                                                                    <p className={cn("font-bold flex items-center gap-2 flex-wrap", colorScheme.label)}>
                                                                        {label}
                                                                        {isPartial && <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">Saldo Parcial</span>}
                                                                    </p>
                                                                    <p className="text-xs text-slate-500 mt-0.5">Vencimiento: {debt.due_date ? new Date(debt.due_date).toLocaleDateString() : 'Desconocido'}</p>
                                                                    {isPartial && (
                                                                        <p className="text-[11px] text-slate-400 mt-1">
                                                                            Original: <span className="font-semibold">${Number(debt.amount).toLocaleString()}</span> | Pagado: <span className="font-semibold text-emerald-600">${Number(debt.amount_paid).toLocaleString()}</span> | Restante: <span className="font-semibold text-amber-600">${remaining.toLocaleString()}</span>
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="text-right flex flex-col items-end">
                                                                <p className={cn("font-bold text-lg", colorScheme.amount)}>${remaining.toLocaleString()}</p>
                                                                <span className={cn(
                                                                    "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border mt-0.5",
                                                                    colorScheme.badge
                                                                )}>{isPartial ? 'Saldo Parcial' : 'Pendiente'}</span>
                                                            </div>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        ) : (
                                            <div className="p-12 text-center flex flex-col items-center">
                                                <CheckCircle2 className="h-12 w-12 text-emerald-400 mb-3 opacity-50" />
                                                <p className="text-slate-500 font-medium">El cliente no registra deudas pendientes.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* TAB: ASSETS */}
                            {activeTab === 'assets' && (
                                <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in">
                                    <h3 className="font-bold text-sm text-slate-500 uppercase tracking-wide mb-4">Cocheras Asignadas ({selectedCocheras.length})</h3>

                                    {selectedCocheras.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {selectedCocheras.map(cochera => {
                                                const hasCocheraDebt = cochera.totalCocheraDebt > 0;

                                                return (
                                                <div key={cochera.id} className={cn(
                                                    "rounded-2xl border p-5 transition-all",
                                                    (cochera.isVencida || hasCocheraDebt)
                                                        ? "bg-red-50/40 border-red-100 shadow-[0_2px_10px_-3px_rgba(239,68,68,0.15)]"
                                                        : "bg-white border-slate-200 shadow-sm hover:border-indigo-300"
                                                )}>
                                                    {/* Cochera Header */}
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className={cn(
                                                                "p-2.5 rounded-xl",
                                                                (cochera.isVencida || hasCocheraDebt) ? "bg-red-100 text-red-600" : "bg-indigo-50 text-indigo-600"
                                                            )}>
                                                                <Building2 className="h-5 w-5" />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <p className={cn("font-black text-lg flex items-center gap-2 flex-wrap", (cochera.isVencida || hasCocheraDebt) ? "text-red-700" : "text-slate-800")}>
                                                                    #{cochera.numero || cochera.name || 'S/N'}
                                                                    {hasCocheraDebt && (
                                                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-100 border border-red-200 px-1.5 py-0.5 rounded">
                                                                            <AlertCircle className="h-3 w-3" /> DEBE {cochera.owedMonths?.length || '?'} MESES
                                                                        </span>
                                                                    )}
                                                                </p>
                                                                <span className="text-[10px] font-bold uppercase text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 w-fit mt-1">
                                                                    Tipo: {cochera.tipo || 'Standard'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        {/* Precio base / Deuda */}
                                                        <div className="text-right flex flex-col items-end gap-1">
                                                            {hasCocheraDebt ? (
                                                                <>
                                                                    <p className="text-slate-400 text-xs line-through">
                                                                        ${cochera.precio_base?.toLocaleString() || 0}/mes
                                                                    </p>
                                                                    <p className="font-black text-sm text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">
                                                                        ${cochera.totalCocheraDebt.toLocaleString()}
                                                                    </p>
                                                                </>
                                                            ) : (
                                                                <p className="text-slate-400 font-bold text-sm bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                                                                    ${cochera.precio_base?.toLocaleString() || 0}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Meses adeudados detalle */}
                                                    {cochera.owedMonths && cochera.owedMonths.length > 0 && (
                                                        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-100 rounded-xl">
                                                            <p className="text-[10px] font-bold uppercase text-red-500 mb-1">Meses Adeudados</p>
                                                            <p className="text-xs font-semibold text-red-700">
                                                                {cochera.owedMonths.join(', ')}
                                                            </p>
                                                        </div>
                                                    )}

                                                    {/* CRUCE: VEHÍCULOS AUTORIZADOS */}
                                                    <div className="mt-4 pt-4 border-t border-slate-100">
                                                        <p className="text-[10px] font-bold uppercase text-slate-400 mb-2">Vehículos Autorizados</p>
                                                        {cochera.allVehicles && cochera.allVehicles.length > 0 ? (
                                                            <div className="space-y-2">
                                                                {cochera.allVehicles.map((vehicle: Vehicle) => {
                                                                    let parsedPhotos: any = {};
                                                                    try {
                                                                        parsedPhotos = typeof vehicle.photos === 'string' ? JSON.parse(vehicle.photos) : vehicle.photos || {};
                                                                    } catch (e) { }

                                                                    const seguroUrl = parsedPhotos?.seguro;
                                                                    const dniUrl = parsedPhotos?.dni;
                                                                    const cedulaUrl = parsedPhotos?.cedula;

                                                                    // Resolve vehicle type icon & color from vehicle_types table
                                                                    const matchedType = vehicleTypes.find(vt => vt.name?.toLowerCase() === vehicle.type?.toLowerCase());
                                                                    const VehicleIcon = getVehicleIcon(matchedType?.icon_key);
                                                                    const vehicleColorKey = matchedType?.color_key || 'slate';
                                                                    const vehicleTypeName = vehicle.type ? smartCapitalize(vehicle.type) : null;

                                                                    // Build secondary line: Brand Model (filter nulls)
                                                                    const brandModel = [vehicle.brand, vehicle.model].filter(Boolean).join(' ');

                                                                    return (
                                                                        <div key={vehicle.id} className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200 hover:border-indigo-200 transition-colors">
                                                                            <div className="flex items-center gap-3 min-w-0">
                                                                                {/* Icon with system color */}
                                                                                <div className={cn("p-1.5 rounded-lg border shrink-0", getVehicleColorStyles(vehicleColorKey))}>
                                                                                    <VehicleIcon className="h-4 w-4" />
                                                                                </div>
                                                                                <div className="min-w-0">
                                                                                    {/* Primary line: Patente + Type */}
                                                                                    <div className="flex items-center gap-2">
                                                                                        <p className="font-bold font-mono text-slate-800 text-sm shrink-0">{vehicle.plate}</p>
                                                                                        {vehicleTypeName && (
                                                                                            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0", getVehicleColorStyles(vehicleColorKey))}>
                                                                                                {vehicleTypeName}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                    {/* Secondary line: Brand Model */}
                                                                                    {brandModel && (
                                                                                        <p className="text-[11px] text-slate-400 mt-0.5 truncate">{brandModel}</p>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex items-center gap-1 shrink-0">
                                                                                <button
                                                                                    type="button"
                                                                                    disabled={!seguroUrl}
                                                                                    onClick={(e) => { e.stopPropagation(); setSelectedImage(seguroUrl); }}
                                                                                    title="Seguro"
                                                                                    className="p-1 rounded bg-slate-100 hover:bg-indigo-100 text-slate-400 hover:text-indigo-600 transition-colors disabled:opacity-20 disabled:hover:bg-slate-100 disabled:hover:text-slate-400"
                                                                                >
                                                                                    <ShieldCheck className="h-3.5 w-3.5" />
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    disabled={!dniUrl}
                                                                                    onClick={(e) => { e.stopPropagation(); setSelectedImage(dniUrl); }}
                                                                                    title="DNI"
                                                                                    className="p-1 rounded bg-slate-100 hover:bg-indigo-100 text-slate-400 hover:text-indigo-600 transition-colors disabled:opacity-20 disabled:hover:bg-slate-100 disabled:hover:text-slate-400"
                                                                                >
                                                                                    <Contact2 className="h-3.5 w-3.5" />
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    disabled={!cedulaUrl}
                                                                                    onClick={(e) => { e.stopPropagation(); setSelectedImage(cedulaUrl); }}
                                                                                    title="Cédula"
                                                                                    className="p-1 rounded bg-slate-100 hover:bg-indigo-100 text-slate-400 hover:text-indigo-600 transition-colors disabled:opacity-20 disabled:hover:bg-slate-100 disabled:hover:text-slate-400"
                                                                                >
                                                                                    <FileText className="h-3.5 w-3.5" />
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2 bg-amber-50 text-amber-600 border border-amber-200 p-3 rounded-xl text-xs font-bold">
                                                                <AlertCircle className="h-4 w-4" /> Sin vehículos asignados
                                                            </div>
                                                        )}

                                                        {cochera.currentEndDate && (
                                                            <div className={cn(
                                                                "mt-4 pt-3 border-t border-slate-100 text-xs",
                                                                cochera.isVencida ? "text-red-600 font-bold" : "text-indigo-600 font-medium"
                                                            )}>
                                                                Vencimiento Suscripción: {(() => {
                                                                    const [year, month, day] = cochera.currentEndDate!.split('T')[0].split('-');
                                                                    return `${day}/${month}/${year}`;
                                                                })()}
                                                                {cochera.calendarExpired && " (VENCIDA)"}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="bg-white rounded-2xl border border-slate-200 border-dashed p-12 text-center flex flex-col items-center">
                                            <Building2 className="h-10 w-10 text-slate-300 mb-3" />
                                            <p className="text-slate-500 font-medium text-lg">Sin cocheras</p>
                                            <p className="text-sm text-slate-400 mt-1">Este cliente no tiene cocheras asignadas actualmente.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB: HISTORY */}
                            {activeTab === 'history' && (
                                <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in">
                                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                                <History className="h-4 w-4 text-slate-400" /> Historial de Abonos
                                            </h3>
                                        </div>
                                        {selectedSubs.length > 0 ? (
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-white border-b border-slate-100 text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                                                    <tr>
                                                        <th className="px-4 py-2 sm:px-6 sm:py-3">Periodo</th>
                                                        <th className="px-4 py-2 sm:px-6 sm:py-3">Monto</th>
                                                        <th className="px-4 py-2 sm:px-6 sm:py-3">Estado</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {selectedSubs.map(sub => (
                                                        <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                                                            <td className="px-4 py-2 sm:px-6 sm:py-3">
                                                                <div className="font-medium text-slate-800 text-xs sm:text-sm">{new Date(sub.start_date).toLocaleDateString()} al {sub.end_date ? new Date(sub.end_date).toLocaleDateString() : 'N/A'}</div>
                                                            </td>
                                                            <td className="px-4 py-2 sm:px-6 sm:py-3 font-bold text-slate-600 text-xs sm:text-sm">
                                                                ${Number(sub.price).toLocaleString()}
                                                            </td>
                                                            <td className="px-4 py-2 sm:px-6 sm:py-3">
                                                                <span className={cn(
                                                                    "inline-flex items-center px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded text-[9px] sm:text-[10px] font-bold uppercase",
                                                                    sub.active ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                                                        "bg-slate-100 text-slate-500 border border-slate-200"
                                                                )}>
                                                                    {sub.active ? 'Activo' : 'Inactivo'}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        ) : (
                                            <div className="p-12 text-center flex flex-col items-center">
                                                <History className="h-10 w-10 text-slate-300 mb-3" />
                                                <p className="text-slate-500 font-medium">No hay historial registrado.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* TAB: DOCUMENTATION */}
                            {activeTab === 'documentation' && (
                                <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in">
                                    <h3 className="font-bold text-sm text-slate-500 uppercase tracking-wide mb-4">Documentación Digitalizada</h3>
                                    {(() => {
                                        const customerSubs = selectedSubs.filter(s => s.documents_metadata);
                                        const usedSubIds = new Set<string>();

                                        const cocherasWithDocs = selectedCocheras.map(cochera => {
                                            // Find the most recent subscription with documents (selectedSubs is pre-sorted descending)
                                            const matchedSub = customerSubs.find(s => !usedSubIds.has(s.id));
                                            if (matchedSub) usedSubIds.add(matchedSub.id);

                                            let documents: any[] = [];
                                            if (matchedSub?.documents_metadata) {
                                                try {
                                                    const raw = typeof matchedSub.documents_metadata === 'string'
                                                        ? JSON.parse(matchedSub.documents_metadata)
                                                        : matchedSub.documents_metadata;
                                                    if (Array.isArray(raw?.documents)) documents = raw.documents;
                                                    else if (Array.isArray(raw)) documents = raw;
                                                } catch { /* malformed JSON — skip gracefully */ }
                                            }

                                            return { cochera, documents };
                                        });

                                        if (cocherasWithDocs.length === 0) {
                                            return (
                                                <div className="bg-white rounded-2xl border border-slate-200 border-dashed p-12 text-center flex flex-col items-center">
                                                    <Camera className="h-10 w-10 text-slate-300 mb-3" />
                                                    <p className="text-slate-500 font-medium text-lg">Sin cocheras</p>
                                                    <p className="text-sm text-slate-400 mt-1">Este cliente no tiene cocheras para mostrar documentación.</p>
                                                </div>
                                            );
                                        }

                                        return cocherasWithDocs.map(({ cochera, documents }) => (
                                            <div key={cochera.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
                                                    <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                                                        <Building2 className="h-4 w-4" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-800">Cochera {cochera.numero || cochera.name || 'S/N'}</h4>
                                                        <p className="text-xs text-slate-400">Tipo: {cochera.tipo || 'Standard'}</p>
                                                    </div>
                                                </div>

                                                {documents.length > 0 ? (
                                                    <div className="p-5">
                                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                                            {documents.map((doc: any, idx: number) => {
                                                                const imgSrc = doc.url || doc.image || doc.data || (typeof doc === 'string' ? doc : null);
                                                                const label = doc.type || doc.label || doc.name || `Documento ${idx + 1}`;

                                                                if (!imgSrc) return null;

                                                                return (
                                                                    <button
                                                                        key={idx}
                                                                        onClick={() => setSelectedImage(imgSrc)}
                                                                        className="group relative aspect-[4/3] rounded-xl overflow-hidden border-2 border-slate-200 hover:border-indigo-400 hover:shadow-lg transition-all bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                                    >
                                                                        <img
                                                                            src={imgSrc}
                                                                            alt={label}
                                                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                                        />
                                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                        <span className="absolute bottom-2 left-2 text-[10px] font-bold text-white uppercase tracking-wider bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                                                            {label}
                                                                        </span>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="p-8 text-center flex flex-col items-center">
                                                        <AlertCircle className="h-8 w-8 text-slate-300 mb-2" />
                                                        <p className="text-slate-500 font-medium text-sm">Sin documentación cargada para esta cochera</p>
                                                    </div>
                                                )}
                                            </div>
                                        ));
                                    })()}
                                </div>
                            )}

                        </div>
                    </div>
                )}
            </div>

            {/* MODAL: Vista Previa de Documento */}
            {selectedImage && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
                    onClick={() => setSelectedImage(null)}
                >
                    <button
                        onClick={(e) => { e.stopPropagation(); setSelectedImage(null); }}
                        className="absolute top-6 right-6 p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors z-10"
                    >
                        <X className="h-6 w-6" />
                    </button>
                    <img
                        src={selectedImage}
                        alt="Vista previa del documento"
                        className="max-w-[90vw] max-h-[90vh] object-contain rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
}
