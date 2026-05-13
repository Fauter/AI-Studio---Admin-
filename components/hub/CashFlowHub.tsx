import React, { useState, useEffect, useMemo } from 'react';
import {
    Activity, GitBranch, List, Filter, BadgeDollarSign, AlertCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Garage, BuildingLevel } from '../../types';
import { useAuth } from '../../hooks/useAuth';

import {
    cn,
    formatCurrency,
    getArgentinaDateAnchors,
    OperationClock,
    ProgressRing,
    ActiveSection,
    Movement,
    Stay,
    Subscription,
    Debt,
    Cochera
} from './cash-flow/CashFlowShared';
import KpiGrid from './cash-flow/KpiGrid';
import ChartsSection from './cash-flow/ChartsSection';
import BranchTable from './cash-flow/BranchTable';
import MovementsTable from './cash-flow/MovementsTable';
import HistoryModal from './cash-flow/modals/HistoryModal';
import DebtModal from './cash-flow/modals/DebtModal';
import EficaciaModal from './cash-flow/modals/EficaciaModal';
import DailyIncomeModal from './cash-flow/modals/DailyIncomeModal';

export type PeakMode = 'occupancy' | 'entries' | 'exits';

interface CashFlowHubProps {
    garages: Garage[];
}

// ─────────────────────────────────────────────────────────────
// §4. Main Component
// ─────────────────────────────────────────────────────────────

export default function CashFlowHub({ garages }: CashFlowHubProps) {
    const { profile } = useAuth();
    const [activeSection, setActiveSection] = useState<ActiveSection>('resumen');
    const [peakMode, setPeakMode] = useState<PeakMode>('occupancy');
    const [selectedGarageId, setSelectedGarageId] = useState<string>('all');
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [filters, setFilters] = useState({
        operatorId: '', paymentMethod: '', vehicleType: '', tariffType: '',
        exactDate: '', startDate: '', endDate: ''
    });

    const [movements, setMovements] = useState<Movement[]>([]);
    const [stays, setStays] = useState<Stay[]>([]);
    const [allStays, setAllStays] = useState<Stay[]>([]);
    const [vehicles, setVehicles] = useState<{ plate: string; type: string; is_subscriber?: boolean; garage_id?: string; customer_id?: string }[]>([]);
    const [employees, setEmployees] = useState<{ id: string; full_name: string }[]>([]);
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [debts, setDebts] = useState<Debt[]>([]);
    const [cocheras, setCocheras] = useState<Cochera[]>([]);
    const [buildingLevels, setBuildingLevels] = useState<BuildingLevel[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [loadingStep, setLoadingStep] = useState('Iniciando...');
    const [tariffs, setTariffs] = useState<any[]>([]);
    const [vehicleTypes, setVehicleTypes] = useState<any[]>([]);
    const [prices, setPrices] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
    const [isEficaciaModalOpen, setIsEficaciaModalOpen] = useState(false);
    const [isDailyIncomeModalOpen, setIsDailyIncomeModalOpen] = useState(false);
    const [eficaciaMonthOffset, setEficaciaMonthOffset] = useState(0);
    const [dailyIncomeMonthOffset, setDailyIncomeMonthOffset] = useState(0);

    // §4a. Data Fetching
    useEffect(() => {
        if (garages.length === 0) { setLoading(false); return; }
        const fetchData = async () => {
            setLoading(true); setError(null);
            setLoadingProgress(0);
            setLoadingStep('Preparando carga...');

            const retry = async <T = any,>(fn: () => any, retries = 3): Promise<T> => {
                for (let i = 0; i < retries; i++) {
                    const { data, error } = await fn();
                    if (!error) return data as T;
                    if (i === retries - 1) throw error;
                    await new Promise(r => setTimeout(r, 1000 * (i + 1))); // exponential backoff
                }
                throw new Error("Unreachable");
            };

            try {
                const garageIds = garages.map(g => g.id);
                // Fetch from January 1st of the current year for full historical visibility
                const now = new Date();
                const firstDayOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
                const movementsSince = firstDayOfYear.toISOString();

                // Etapa 1 (10%): Configuración base.
                setLoadingProgress(10);
                setLoadingStep('Cargando configuración base...');

                const tariffsData = await retry(() => supabase.from('tariffs').select('id, name, type, garage_id').in('garage_id', garageIds));
                const vehicleTypesData = await retry(() => supabase.from('vehicle_types').select('id, name, garage_id').in('garage_id', garageIds));

                setTariffs(tariffsData || []);
                setVehicleTypes(vehicleTypesData || []);

                // Etapa 2 (20%): Cocheras y Niveles.
                setLoadingProgress(20);
                setLoadingStep('Cargando estructura operativa...');

                const cocherasData = await retry(() => supabase.from('cocheras').select('id, garage_id, tipo, status, numero, cliente_id, vehiculos, precio_base').in('garage_id', garageIds));
                const levelsData = await retry(() => supabase.from('building_levels').select('id, garage_id, display_name, total_spots').in('garage_id', garageIds));

                setCocheras((cocherasData || []) as Cochera[]);
                setBuildingLevels((levelsData || []) as BuildingLevel[]);

                // Etapa 3 (40%): Precios, Debts y Subscripciones.
                setLoadingProgress(40);
                setLoadingStep('Cargando tarifario y abonos...');

                const pricesData = await retry(() => supabase.from('prices').select('amount, tariff_id, vehicle_type_id'));
                const subsData = await retry(() => supabase.from('subscriptions').select('id, garage_id, customer_id, start_date, end_date, active, price, type').in('garage_id', garageIds));
                const debtsData = await retry(() => supabase.from('debts').select('id, remaining_amount, status, due_date, customer_id, garage_id, created_at, amount, subscription_id, customers:customer_id(name), subscriptions:subscription_id(type)').in('garage_id', garageIds).eq('status', 'PENDING'));

                setPrices(pricesData || []);
                setSubscriptions((subsData || []) as Subscription[]);
                setDebts((debtsData || []) as Debt[]);

                // Etapa 4 (80%): Vehicles y Stays Activos.
                setLoadingProgress(80);
                setLoadingStep('Cargando datos operativos...');

                const nowStays = new Date();
                const oneMonthAgo = new Date(nowStays.getFullYear(), nowStays.getMonth() - 1, nowStays.getDate()).toISOString();

                const vehiclesData = await retry(() => supabase.from('vehicles').select('plate, type, is_subscriber, garage_id, customer_id').in('garage_id', garageIds));
                const activeStaysData = await retry(() => supabase.from('stays').select('*').in('garage_id', garageIds).eq('active', true).order('entry_time', { ascending: false }));
                const allStaysData = await retry(() => supabase.from('stays').select('id,garage_id,plate,entry_time,exit_time,vehicle_type,active').in('garage_id', garageIds).gte('entry_time', oneMonthAgo).order('entry_time', { ascending: false }).limit(3000));

                setVehicles(vehiclesData || []);
                setStays((activeStaysData || []) as Stay[]);
                setAllStays((allStaysData || []) as Stay[]);

                // Etapa 5 (100%): Movements Paginados
                setLoadingProgress(100);
                setLoadingStep('Cargando histórico de movimientos...');

                const PAGE_SIZE = 1000;
                let allMovements: Movement[] = [];
                let from = 0;
                let keepFetching = true;
                while (keepFetching) {
                    const batch = await retry(() => supabase
                        .from('movements')
                        .select('id, amount, type, timestamp, payment_method, plate, garage_id, operator, related_entity_id, ticket_number, invoice_type, notes')
                        .in('garage_id', garageIds)
                        .gte('timestamp', movementsSince)
                        .order('timestamp', { ascending: false })
                        .range(from, from + PAGE_SIZE - 1)
                    );
                    const rows = (batch || []) as Movement[];
                    allMovements = allMovements.concat(rows);
                    if (rows.length < PAGE_SIZE) {
                        keepFetching = false;
                    } else {
                        from += PAGE_SIZE;
                        setLoadingStep(`Analizando ${allMovements.length} movimientos históricos...`);
                    }
                }

                setLoadingStep('Sincronizando operadores...');

                let empData: { id: string; full_name: string }[] = [];
                if (profile?.id) {
                    try {
                        const res = await retry<any[]>(() => supabase.from('employee_accounts').select('id, first_name, last_name, garage_id, role').eq('owner_id', profile.id)) || [];
                        empData = res.map((e: any) => ({ id: e.id, full_name: `${e.first_name || ''} ${e.last_name || ''}`.trim() || 'Operario' }));
                    } catch (e) {
                        console.warn('Error silenciado al cargar empleados:', e);
                    }
                }

                setMovements(allMovements);
                setEmployees(empData);
                setLoadingStep('Conexión estable con Supabase');
            } catch (err: any) {
                console.error('Error fetching dashboard data:', err);
                setError('No se pudieron cargar los datos financieros.');
            } finally { setLoading(false); }
        };
        fetchData();
    }, [garages, profile?.id]);

    // §4b. Lookup Maps
    const staysLookup = useMemo(() => {
        const map: Record<string, Stay> = {};
        allStays.forEach(s => { map[s.id] = s; });
        return map;
    }, [allStays]);

    const vehicleTypesMap = useMemo(() => {
        const map: Record<string, string> = {};
        vehicles.forEach(v => { if (v.plate && v.type) map[v.plate] = v.type; });
        return map;
    }, [vehicles]);

    const subscriberMap = useMemo(() => {
        const map: Record<string, boolean> = {};
        vehicles.forEach(v => { if (v.plate) map[v.plate] = !!v.is_subscriber; });
        return map;
    }, [vehicles]);

    const uniqueVehicleTypes = useMemo(() => {
        const types = new Set<string>();
        vehicles.forEach(v => { if (v.type) types.add(v.type.toUpperCase()); });
        return Array.from(types).sort();
    }, [vehicles]);

    const getGarageName = (id: string) => garages.find(g => g.id === id)?.name || 'Desconocido';
    const cleanDescription = (notes?: string) => {
        if (!notes) return '---';
        return notes.includes('-') ? notes.split('-')[0].trim() : notes;
    };

    // §4c. Garage-Filtered Base Sets
    const gMovements = useMemo(() => selectedGarageId === 'all' ? movements : movements.filter(m => m.garage_id === selectedGarageId), [movements, selectedGarageId]);
    const gStays = useMemo(() => selectedGarageId === 'all' ? stays : stays.filter(s => s.garage_id === selectedGarageId), [stays, selectedGarageId]);
    const gAllStays = useMemo(() => selectedGarageId === 'all' ? allStays : allStays.filter(s => s.garage_id === selectedGarageId), [allStays, selectedGarageId]);
    const gDebts = useMemo(() => selectedGarageId === 'all' ? debts : debts.filter(d => d.garage_id === selectedGarageId), [debts, selectedGarageId]);
    const gSubscriptions = useMemo(() => selectedGarageId === 'all' ? subscriptions : subscriptions.filter(s => s.garage_id === selectedGarageId), [subscriptions, selectedGarageId]);
    const gVehicles = useMemo(() => selectedGarageId === 'all' ? vehicles : vehicles.filter(v => v.garage_id === selectedGarageId), [vehicles, selectedGarageId]);
    const gCocheras = useMemo(() => selectedGarageId === 'all' ? cocheras : cocheras.filter(c => c.garage_id === selectedGarageId), [cocheras, selectedGarageId]);
    const gLevels = useMemo(() => selectedGarageId === 'all' ? buildingLevels : buildingLevels.filter(l => l.garage_id === selectedGarageId), [buildingLevels, selectedGarageId]);

    // §4d. KPIs
    const kpiIngresos = useMemo(() => {
        const { inicioHoy, inicioAyer, inicioManana } = getArgentinaDateAnchors();
        const hoyMs = inicioHoy.getTime();
        const ayerMs = inicioAyer.getTime();
        const mananaMs = inicioManana.getTime();
        let todayTotal = 0, yesterdayTotal = 0;
        gMovements.forEach(m => {
            if (!m.timestamp) return;
            // Only count income types (CobroEstadia + CobroAbono + INGRESO + COBRO + CAJA_INICIAL)
            const isIngreso = m.type === 'CobroEstadia' || (m.type as string) === 'CobroAbono'
                || m.type === 'INGRESO' || m.type === 'COBRO' || m.type === 'CAJA_INICIAL';
            if (!isIngreso) return;
            const ts = new Date(m.timestamp).getTime();
            const amt = Number(m.amount ?? 0);
            if (ts >= hoyMs && ts < mananaMs) todayTotal += amt;
            if (ts >= ayerMs && ts < hoyMs) yesterdayTotal += amt;
        });
        const variation = yesterdayTotal === 0 ? (todayTotal > 0 ? 100 : 0) : ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100;
        return { today: todayTotal, yesterday: yesterdayTotal, variation: Math.round(variation) };
    }, [gMovements]);

    const kpiFacturacion = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getMonth(), currentYear = now.getFullYear();
        const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        let currentTotal = 0, prevTotal = 0;
        gMovements.forEach(m => {
            const d = new Date(m.timestamp);
            const amt = Number(m.amount || 0);
            if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) currentTotal += amt;
            else if (d.getFullYear() === prevYear && d.getMonth() === prevMonth) prevTotal += amt;
        });
        const variation = prevTotal === 0 ? (currentTotal > 0 ? 100 : 0) : ((currentTotal - prevTotal) / prevTotal) * 100;
        return { current: currentTotal, previous: prevTotal, variation: Math.round(variation) };
    }, [gMovements]);

    const monthlyHistory = useMemo(() => {
        const buckets: Record<string, number> = {};
        const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        gMovements.forEach(m => {
            if (!m.timestamp) return;
            const safeTs = typeof m.timestamp === 'string' ? m.timestamp.replace(' ', 'T') : m.timestamp;
            const d = new Date(safeTs);
            const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
            buckets[key] = (buckets[key] || 0) + Number(m.amount || 0);
        });
        // Sort keys ascending (chronological) for correct variation calculation
        const chronoKeys = Object.keys(buckets).sort((a, b) => a.localeCompare(b));
        const withVariation = chronoKeys.map((key, idx) => {
            const [yearStr, monthStr] = key.split('-');
            const year = parseInt(yearStr, 10);
            const month = parseInt(monthStr, 10);
            const total = buckets[key];
            const prevKey = idx > 0 ? chronoKeys[idx - 1] : null;
            const prevTotal = prevKey ? buckets[prevKey] : 0;
            const isOldest = idx === 0;
            const variation = isOldest ? 0 : (prevTotal === 0 ? (total > 0 ? 100 : 0) : Math.round(((total - prevTotal) / prevTotal) * 100));
            return { label: `${MONTH_NAMES[month]} ${year}`, total, variation, isOldest };
        });
        // Reverse for display: most recent first
        return withVariation.reverse();
    }, [gMovements]);

    const dailyIncomeData = useMemo(() => {
        const { inicioHoy } = getArgentinaDateAnchors();

        // Target month calculation
        const targetDate = new Date(inicioHoy.getFullYear(), inicioHoy.getMonth() - dailyIncomeMonthOffset, 1);
        const targetYear = targetDate.getFullYear();
        const targetMonth = targetDate.getMonth();

        // Previous month calculation
        const prevDate = new Date(targetYear, targetMonth, 0); // last day of prev month
        const prevYear = prevDate.getFullYear();
        const prevMonth = prevDate.getMonth();
        const prevLastDay = prevDate.getDate();

        const targetMonthStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;
        const prevMonthStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}`;

        const dailyMap: Record<string, number> = {};

        gMovements.forEach(m => {
            if (!m.timestamp) return;
            const isIngreso = m.type === 'CobroEstadia' || m.type === 'CobroAbono' || m.type === 'INGRESO' || m.type === 'COBRO' || m.type === 'CAJA_INICIAL';
            if (!isIngreso) return;

            const safeTs = typeof m.timestamp === 'string' ? m.timestamp.replace(' ', 'T') : m.timestamp;
            const d = new Date(safeTs);
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

            if (dateStr.startsWith(targetMonthStr) || dateStr.startsWith(prevMonthStr)) {
                dailyMap[dateStr] = (dailyMap[dateStr] || 0) + Number(m.amount || 0);
            }
        });

        const fullDays = [];
        const nowMs = inicioHoy.getTime();

        // Padding calculation (start on Monday)
        const firstDayIndex = targetDate.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
        const padDaysCount = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

        for (let i = padDaysCount; i > 0; i--) {
            const padDayNum = prevLastDay - i + 1;
            const dateStr = `${prevMonthStr}-${String(padDayNum).padStart(2, '0')}`;
            const amount = dailyMap[dateStr] || 0;

            fullDays.push({
                fullDate: dateStr,
                dayNum: padDayNum,
                amount,
                variation: 0,
                isFuture: false,
                isPadding: true
            });
        }

        const prevLastDayStr = `${prevMonthStr}-${String(prevLastDay).padStart(2, '0')}`;
        let previousAmount = dailyMap[prevLastDayStr] || 0;

        const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();

        for (let dayNum = 1; dayNum <= lastDay; dayNum++) {
            const dayKey = String(dayNum).padStart(2, '0');
            const dateStr = `${targetMonthStr}-${dayKey}`;
            const amount = dailyMap[dateStr] || 0;

            const variation = previousAmount === 0 ? (amount > 0 ? 100 : 0) : Math.round(((amount - previousAmount) / previousAmount) * 100);

            const cellDate = new Date(targetYear, targetMonth, dayNum);
            const isFuture = cellDate.getTime() > nowMs;

            fullDays.push({
                fullDate: dateStr,
                dayNum,
                amount,
                variation,
                isFuture,
                isPadding: false
            });

            previousAmount = amount;
        }

        let monthLabel = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(targetDate);
        monthLabel = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

        return {
            monthLabel,
            days: fullDays
        };
    }, [gMovements, dailyIncomeMonthOffset]);

    const kpiOcupacion = useMemo(() => {
        const totalSpots = gLevels.reduce((acc, l) => acc + (l.total_spots || 0), 0);
        // Universo A: Cocheras con status 'Ocupada' (abonados fijos)
        const cocherasOcupadas = gCocheras.filter(c => c.status === 'Ocupada').length;
        // Universo B: Estadías activas (vehículos por hora que entraron y no salieron)
        const estadiasActivas = gStays.length; // gStays is already filtered to active===true
        const totalOcupado = cocherasOcupadas + estadiasActivas;
        const porcentaje = totalSpots === 0 ? 0 : Math.round((totalOcupado / totalSpots) * 100);
        return { ocupadas: totalOcupado, cocherasOcupadas, estadiasActivas, totalSpots, porcentaje };
    }, [gCocheras, gStays, gLevels]);

    const clientesConCochera = useMemo(() => new Set(cocheras.map(c => c.cliente_id).filter(Boolean)), [cocheras]);

    const kpiDeuda = useMemo(() => {
        const deudasValidas = gDebts.filter(d => d.customer_id && clientesConCochera.has(d.customer_id));
        const total = deudasValidas.reduce((acc, d) => acc + (Number(d.remaining_amount) || 0), 0);
        const now = new Date();
        const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();
        const monthRevenue = gMovements.reduce((a, m) => {
            if (!m.timestamp) return a;
            return new Date(m.timestamp).getTime() >= inicioMes ? a + Number(m.amount ?? 0) : a;
        }, 0);
        const isAlert = monthRevenue > 0 && total > monthRevenue * 0.1;
        return { total, isAlert, count: deudasValidas.length };
    }, [gDebts, gMovements, clientesConCochera]);

    const debtDetailList = useMemo(() => {
        // Only process debts from customers that have cocheras assigned
        const deudasValidas = gDebts.filter(d => d.customer_id && clientesConCochera.has(d.customer_id));

        const grouped: Record<string, {
            customerId: string;
            customerName: string;
            totalDebt: number;
            items: Array<{
                id: string;
                amount: number;
                monthLabel: string;
                cocheraNumero: string;
            }>;
        }> = {};

        deudasValidas.forEach(d => {
            const key = d.customer_id!;
            const customerName = d.customers?.name || 'Sin identificar';

            if (!grouped[key]) {
                grouped[key] = {
                    customerId: key,
                    customerName,
                    totalDebt: 0,
                    items: []
                };
            }

            const amount = Number(d.remaining_amount) || 0;
            grouped[key].totalDebt += amount;

            // Resolve Cochera Number
            let cocheraNum = 'N/A';
            const customerCocheras = cocheras.filter(c => c.cliente_id === key && c.numero);
            if (customerCocheras.length > 0) {
                // Si el cliente tiene cocheras asociadas, usa la primera encontrada
                cocheraNum = customerCocheras[0].numero!;
            }

            // Parse Date to format 'Mayo 2026'
            const rawDate = d.due_date || d.created_at || new Date().toISOString();
            const dateObj = new Date(rawDate);
            // Sumar 4 horas para compensar el UTC-3 y evitar que el día 1 retroceda al mes anterior
            const safeDate = isNaN(dateObj.getTime()) ? new Date() : new Date(dateObj.getTime() + 4 * 60 * 60 * 1000);
            let monthLabel = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(safeDate);
            monthLabel = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

            grouped[key].items.push({
                id: d.id,
                amount,
                monthLabel,
                cocheraNumero: cocheraNum
            });
        });

        // Sort by total descending
        return Object.values(grouped).sort((a, b) => b.totalDebt - a.totalDebt);
    }, [gDebts, cocheras, clientesConCochera]);

    const kpiSubs = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

        // Source of truth: vehicles with is_subscriber === true
        const subscriberVehicles = gVehicles.filter(v => v.is_subscriber === true);
        const total = subscriberVehicles.length;

        // Altas y bajas del mes según start_date / end_date de subscriptions
        let altas = 0, prevAltas = 0;
        let bajas = 0, prevBajas = 0;
        const monthStr = now.toISOString().slice(0, 7);
        const prevMonthStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}`;
        gSubscriptions.forEach(sub => {
            if (sub.start_date?.startsWith(monthStr)) altas++;
            if (sub.start_date?.startsWith(prevMonthStr)) prevAltas++;
            if (sub.end_date?.startsWith(monthStr)) bajas++;
            if (sub.end_date?.startsWith(prevMonthStr)) prevBajas++;
        });

        const prevBalance = prevAltas - prevBajas;
        const currentBalance = altas - bajas;
        const subsVariation = prevBalance === 0 ? (currentBalance > 0 ? 100 : 0) : Math.round(((currentBalance - prevBalance) / Math.abs(prevBalance)) * 100);
        return { altas, bajas, balance: currentBalance, total, prevAltas, prevBajas, subsVariation };
    }, [gVehicles, gSubscriptions]);

    const kpiEficacia = useMemo(() => {
        const { inicioHoy } = getArgentinaDateAnchors();
        const inicioMes = new Date(inicioHoy.getFullYear(), inicioHoy.getMonth(), 1, 0, 0, 0, 0).getTime();

        // Build lookup maps
        const tariffsMap = new Map(tariffs.map(t => [t.name?.trim().toUpperCase(), t.id]));
        const vehicleTypesMap = new Map(vehicleTypes.map(vt => [vt.name?.trim().toUpperCase(), vt.id]));

        // Build nested map for prices: tariff_id_vehicle_type_id -> amount
        const pricesMap = new Map<string, number>();
        prices.forEach(p => {
            pricesMap.set(`${p.tariff_id}_${p.vehicle_type_id}`, p.amount);
        });

        // Filter and map vehicles for quick lookup
        const activeVehicles = new Map(gVehicles.filter(v => v.is_subscriber).map(v => [v.plate?.trim().toUpperCase(), v]));

        let potencialTotal = 0;
        const validTipos = ['FIJA', 'EXCLUSIVA', 'MOVIL'];
        const occupiedCocheras = gCocheras.filter(c => c.status === 'Ocupada' && validTipos.includes(c.tipo?.trim().toUpperCase() || ''));

        occupiedCocheras.forEach(cochera => {
            const cocheraTipo = cochera.tipo?.trim().toUpperCase();
            const tariffId = tariffsMap.get(cocheraTipo);

            const precioBase = Number(cochera.precio_base || 0);

            if (!tariffId) {
                potencialTotal += precioBase;
                return;
            }

            const vehiculosAsociados = cochera.vehiculos || [];
            if (vehiculosAsociados.length === 0) {
                potencialTotal += precioBase;
                return;
            }

            let maxAmount = 0;
            vehiculosAsociados.forEach(plate => {
                const v = activeVehicles.get(plate.trim().toUpperCase()) as any;
                if (!v) return;

                const vTypeId = vehicleTypesMap.get(v.type?.trim().toUpperCase());
                if (!vTypeId) return;

                const priceAmount = pricesMap.get(`${tariffId}_${vTypeId}`);
                if (priceAmount && priceAmount > maxAmount) {
                    maxAmount = priceAmount;
                }
            });
            potencialTotal += maxAmount > 0 ? maxAmount : precioBase;
        });

        let monthRev = 0;
        gMovements.forEach(m => {
            if (!m.timestamp) return;
            const isAbono = m.type === 'CobroAbono';
            if (!isAbono) return;
            const ts = new Date(m.timestamp).getTime();
            if (ts >= inicioMes) monthRev += Number(m.amount ?? 0);
        });

        const percentage = potencialTotal === 0 ? 0 : Math.round((monthRev / potencialTotal) * 100);
        return { potencialTotal, monthRev, percentage };
    }, [gCocheras, gVehicles, gMovements, tariffs, prices, vehicleTypes, gSubscriptions]);

    const eficaciaTimeline = useMemo(() => {
        const { inicioHoy } = getArgentinaDateAnchors();

        // Target month calculation
        const targetDate = new Date(inicioHoy.getFullYear(), inicioHoy.getMonth() - eficaciaMonthOffset, 1);
        const targetYear = targetDate.getFullYear();
        const targetMonth = targetDate.getMonth();
        const firstDayOfMonth = targetDate.getTime();
        const lastDayOfMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59).getTime();

        const abonoMovements = gMovements.filter(m => {
            if (!m.timestamp || m.type !== 'CobroAbono') return false;
            const ts = new Date(m.timestamp).getTime();
            return ts >= firstDayOfMonth && ts <= lastDayOfMonth;
        });

        const dailyMap: Record<string, number> = {};
        abonoMovements.forEach(m => {
            const d = new Date(m.timestamp);
            const dayKey = d.getDate().toString().padStart(2, '0');
            dailyMap[dayKey] = (dailyMap[dayKey] || 0) + Number(m.amount || 0);
        });

        let accumulated = 0;
        const timeline = Object.keys(dailyMap)
            .sort((a, b) => parseInt(a) - parseInt(b))
            .map(dayStr => {
                const dayTotal = dailyMap[dayStr];
                accumulated += dayTotal;
                const pct = kpiEficacia.potencialTotal === 0 ? 0 : Math.round((accumulated / kpiEficacia.potencialTotal) * 100);
                return { day: dayStr, total: dayTotal, accumulated, percentage: pct };
            });

        return {
            monthLabel: targetDate.toLocaleString('es-AR', { month: 'long', year: 'numeric' }),
            timeline
        };
    }, [gMovements, eficaciaMonthOffset, kpiEficacia.potencialTotal]);

    // §4e. Chart Data
    const revenueChartData = useMemo(() => {
        const now = new Date();
        const currentYear = now.getFullYear(), currentMonth = now.getMonth(), currentDay = now.getDate();
        const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const daysInPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();
        // Daily buckets
        const currentBucket: number[] = new Array(daysInCurrentMonth).fill(0);
        const prevBucket: number[] = new Array(daysInPrevMonth).fill(0);
        gMovements.forEach(m => {
            if (!m.timestamp) return;
            // Sanitize timestamp: replace space with 'T' for cross-engine ISO compatibility
            const safeTs = typeof m.timestamp === 'string' ? m.timestamp.replace(' ', 'T') : m.timestamp;
            // Parse using local timezone to avoid UTC drift
            // (e.g. 22:00 ART stays in the correct local day)
            const d = new Date(safeTs);
            const year = d.getFullYear();
            const month = d.getMonth();
            const day = d.getDate();
            const amt = Number(m.amount || 0);
            if (year === currentYear && month === currentMonth) currentBucket[day - 1] += amt;
            else if (year === prevYear && month === prevMonth && day <= daysInPrevMonth) prevBucket[day - 1] += amt;
        });
        // Build full-month array (1..daysInCurrentMonth)
        // current accumulates up to today, then freezes; previous accumulates fully
        let accCurrent = 0, accPrev = 0;
        const data: { day: number; current: number; previous: number; isFuture: boolean }[] = [];
        for (let i = 0; i < daysInCurrentMonth; i++) {
            // Current month: only accumulate up to today
            if (i < currentDay) accCurrent += currentBucket[i];
            // Previous month: accumulate up to the number of days that month had
            if (i < daysInPrevMonth) accPrev += prevBucket[i];
            data.push({ day: i + 1, current: accCurrent, previous: accPrev, isFuture: i >= currentDay });
        }
        // maxVal compares peaks from BOTH months for a stable Y-axis scale
        const maxVal = Math.max(...data.map(d => Math.max(d.current, d.previous)), 1);
        return { data, maxVal };
    }, [gMovements]);

    const peakHoursData = useMemo(() => {
        const histogram = new Array(24).fill(0);
        const { inicioHoy, inicioManana, now } = getArgentinaDateAnchors();
        const hoyMs = inicioHoy.getTime();
        const mananaMs = inicioManana.getTime();

        gAllStays.forEach(stay => {
            if (!stay.entry_time) return;
            const entryDate = new Date(stay.entry_time);
            const entryMs = entryDate.getTime();

            // Determine exit: if active (still inside), use "now"
            const exitDate = (stay.active || !stay.exit_time) ? now : new Date(stay.exit_time);
            const exitMs = exitDate.getTime();

            if (peakMode === 'occupancy') {
                // Skip stays that ended before today or started after today
                if (exitMs < hoyMs || entryMs >= mananaMs) return;

                // Clamp entry/exit to today's window for hour iteration
                const effectiveEntry = entryMs < hoyMs ? inicioHoy : entryDate;
                const effectiveExit = exitMs >= mananaMs ? new Date(inicioHoy.getFullYear(), inicioHoy.getMonth(), inicioHoy.getDate(), 23, 59, 59) : exitDate;

                const startHour = effectiveEntry.getHours();
                const endHour = effectiveExit.getHours();

                for (let h = startHour; h <= Math.min(endHour, 23); h++) {
                    histogram[h]++;
                }
            } else if (peakMode === 'entries') {
                if (entryMs >= hoyMs && entryMs < mananaMs) {
                    histogram[entryDate.getHours()]++;
                }
            } else if (peakMode === 'exits') {
                if (!stay.active && stay.exit_time) {
                    if (exitMs >= hoyMs && exitMs < mananaMs) {
                        histogram[exitDate.getHours()]++;
                    }
                }
            }
        });
        return histogram;
    }, [gAllStays, peakMode]);

    const branchBreakdown = useMemo(() => {
        const { inicioHoy, inicioManana } = getArgentinaDateAnchors();
        const hoyMs = inicioHoy.getTime();
        const mananaMs = inicioManana.getTime();
        return garages.map(g => {
            const gMoves = movements.filter(m => m.garage_id === g.id);
            const todayMoves = gMoves.filter(m => {
                if (!m.timestamp) return false;
                const ts = new Date(m.timestamp).getTime();
                return ts >= hoyMs && ts < mananaMs;
            });
            const todayTotal = todayMoves.reduce((a, m) => a + Number(m.amount ?? 0), 0);
            const effectivo = todayMoves.filter(m => m.payment_method?.toUpperCase() === 'EFECTIVO').reduce((a, m) => a + Number(m.amount ?? 0), 0);
            const digital = todayMoves.filter(m => m.payment_method && m.payment_method.toUpperCase() !== 'EFECTIVO').reduce((a, m) => a + Number(m.amount ?? 0), 0);
            const spots = buildingLevels.filter(l => l.garage_id === g.id).reduce((a, l) => a + (l.total_spots || 0), 0);
            // Hybrid occupancy: cocheras Ocupada + active stays
            const cocherasOcup = cocheras.filter(c => c.garage_id === g.id && c.status === 'Ocupada').length;
            const estadiasAct = stays.filter(s => s.garage_id === g.id).length; // stays already filtered to active===true
            const occupied = cocherasOcup + estadiasAct;
            const occupancy = spots === 0 ? 0 : Math.round((occupied / spots) * 100);
            const deuda = debts
                .filter(d => d.garage_id === g.id && d.customer_id && clientesConCochera.has(d.customer_id))
                .reduce((a, d) => a + Number(d.remaining_amount ?? 0), 0);
            const activeSubs = vehicles.filter(v => v.garage_id === g.id && v.is_subscriber === true).length;
            return { id: g.id, name: g.name || 'Sin Nombre', effectivo, digital, total: todayTotal, occupancy, deuda, spots, occupied, activeSubs };
        });
    }, [garages, movements, stays, buildingLevels, cocheras, debts, vehicles, clientesConCochera]);

    // §4f. Filtered Movements
    const filteredMovements = useMemo(() => {
        let result = gMovements;
        if (filters.operatorId) {
            const empName = employees.find(e => e.id === filters.operatorId)?.full_name;
            if (empName) result = result.filter(m => m.operator === empName);
        }
        if (filters.paymentMethod) result = result.filter(m => m.payment_method?.toUpperCase().includes(filters.paymentMethod.toUpperCase()));
        if (filters.tariffType) {
            if (filters.tariffType === 'Hora') result = result.filter(m => m.type === 'CobroEstadia');
            else if (filters.tariffType === 'Abono') result = result.filter(m => (m.type as string) === 'CobroAbono');
            else if (filters.tariffType === 'Anticipado') result = result.filter(m => (m.type as string) === 'CobroAnticipado');
        }
        if (filters.vehicleType) {
            result = result.filter(m => {
                const t = (m.plate && vehicleTypesMap[m.plate]) ? vehicleTypesMap[m.plate] : m.vehicle_type;
                return t?.toUpperCase() === filters.vehicleType.toUpperCase();
            });
        }
        if (filters.exactDate) result = result.filter(m => m.timestamp.startsWith(filters.exactDate));
        else {
            if (filters.startDate) { const s = new Date(filters.startDate + 'T00:00:00').getTime(); result = result.filter(m => new Date(m.timestamp).getTime() >= s); }
            if (filters.endDate) { const e = new Date(filters.endDate + 'T23:59:59').getTime(); result = result.filter(m => new Date(m.timestamp).getTime() <= e); }
        }
        return result;
    }, [gMovements, filters, employees, vehicleTypesMap]);

    const totalCaja = useMemo(() => filteredMovements.reduce((acc, m) => acc + Number(m.amount || 0), 0), [filteredMovements]);

    // Functions removed, logic is preserved



    // §5. RENDER
    const sections: { key: ActiveSection; label: string; icon: any }[] = [
        { key: 'resumen', label: 'Resumen General', icon: Activity },
        { key: 'sucursal', label: 'Análisis por Sucursal', icon: GitBranch },
        { key: 'registro', label: 'Registro de Actividad', icon: List },
    ];

    /** Garage filter — rendered inline where needed */
    const GarageFilter = () => (
        <div className="relative">
            <Filter className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
            <select value={selectedGarageId} onChange={(e) => setSelectedGarageId(e.target.value)}
                className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm cursor-pointer">
                <option value="all">Todos los Garajes</option>
                {garages.map(g => (<option key={g.id} value={g.id}>{g.name}</option>))}
            </select>
        </div>
    );

    if (loading && movements.length === 0) {
        return (
            <div className="flex h-[80vh] items-center justify-center bg-white rounded-2xl border border-slate-200/60 shadow-sm flex-col gap-6">
                <div className="relative flex items-center justify-center">
                    <ProgressRing percentage={loadingProgress} size={160} strokeWidth={10} />
                    <span className="absolute text-4xl font-bold font-mono text-indigo-600">
                        {loadingProgress}%
                    </span>
                </div>
                <div className="flex flex-col items-center gap-2">
                    <span className="text-lg font-medium text-slate-700">{loadingStep}</span>
                    <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 rounded-full border border-emerald-100">
                        <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Sincronización de Datos en Bloques: Integridad Asegurada</span>
                    </div>
                </div>
            </div>
        );
    }
    if (error) {
        return (
            <div className="flex h-32 items-center justify-center bg-red-50 rounded-2xl border border-red-200 text-red-600 gap-2">
                <AlertCircle className="h-5 w-5" /> {error}
            </div>
        );
    }

    return (
        <>
            <div className="space-y-5">
                {/* HEADER */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-lg shadow-indigo-500/20">
                            <Activity className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800 tracking-tight">Centro Financiero</h2>
                            <p className="text-xs text-slate-500">Terminal de inteligencia operativa</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <OperationClock />
                    </div>
                </div>

                {/* SUB-NAVBAR — Minimalist underline style */}
                <div className="flex items-center justify-between border-b border-slate-200">
                    <div className="flex items-center gap-1">
                        {sections.map(s => {
                            const Icon = s.icon;
                            const isActive = activeSection === s.key;
                            return (
                                <button key={s.key} onClick={() => setActiveSection(s.key)}
                                    className={cn("flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all -mb-px",
                                        isActive ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300")}>
                                    <Icon className="h-3.5 w-3.5" />
                                    <span className="hidden md:inline">{s.label}</span>
                                </button>
                            );
                        })}
                    </div>
                    {activeSection === 'resumen' && (
                        <div className="pb-2">
                            <GarageFilter />
                        </div>
                    )}
                </div>

                {/* ══ RESUMEN GENERAL ══ */}
                {activeSection === 'resumen' && (
                    <div className="space-y-5 animate-in fade-in duration-300">
                        <KpiGrid
                            kpiIngresos={kpiIngresos}
                            kpiFacturacion={kpiFacturacion}
                            kpiOcupacion={kpiOcupacion}
                            kpiSubs={kpiSubs}
                            kpiDeuda={kpiDeuda}
                            kpiEficacia={kpiEficacia}
                            setIsHistoryModalOpen={setIsHistoryModalOpen}
                            setIsDebtModalOpen={setIsDebtModalOpen}
                            setIsEficaciaModalOpen={setIsEficaciaModalOpen}
                            setIsDailyIncomeModalOpen={setIsDailyIncomeModalOpen}
                        />
                        <ChartsSection
                            revenueChartData={revenueChartData}
                            peakHoursData={peakHoursData}
                            peakMode={peakMode}
                            setPeakMode={setPeakMode}
                        />
                    </div>
                )}


                {/* ══ ANÁLISIS POR SUCURSAL ══ */}
                {activeSection === 'sucursal' && (
                    <BranchTable branchBreakdown={branchBreakdown} />
                )}

                {/* ══ REGISTRO DE ACTIVIDAD ══ */}
                {activeSection === 'registro' && (
                    <MovementsTable
                        filteredMovements={filteredMovements}
                        totalCaja={totalCaja}
                        filters={filters}
                        setFilters={setFilters}
                        filtersOpen={filtersOpen}
                        setFiltersOpen={setFiltersOpen}
                        employees={employees}
                        uniqueVehicleTypes={uniqueVehicleTypes}
                        vehicleTypesMap={vehicleTypesMap}
                        staysLookup={staysLookup}
                        getGarageName={getGarageName}
                        GarageFilter={<GarageFilter />}
                    />
                )}
            </div>

            {/* ══ HISTORY MODAL ══ */}
            <HistoryModal
                isOpen={isHistoryModalOpen}
                onClose={() => setIsHistoryModalOpen(false)}
                monthlyHistory={monthlyHistory}
            />

            {/* ══ DEBT DETAIL MODAL ══ */}
            <DebtModal
                isOpen={isDebtModalOpen}
                onClose={() => setIsDebtModalOpen(false)}
                debtDetailList={debtDetailList}
                kpiDeudaTotal={kpiDeuda.total}
            />

            {/* ══ EFICACIA TIMELINE MODAL ══ */}
            <EficaciaModal
                isOpen={isEficaciaModalOpen}
                onClose={() => setIsEficaciaModalOpen(false)}
                eficaciaTimeline={eficaciaTimeline}
                kpiEficaciaPotencialTotal={kpiEficacia.potencialTotal}
                eficaciaMonthOffset={eficaciaMonthOffset}
                setEficaciaMonthOffset={setEficaciaMonthOffset}
            />

            {/* ══ DAILY INCOME MODAL ══ */}
            <DailyIncomeModal
                isOpen={isDailyIncomeModalOpen}
                onClose={() => setIsDailyIncomeModalOpen(false)}
                dailyIncomeData={dailyIncomeData}
                dailyIncomeMonthOffset={dailyIncomeMonthOffset}
                setDailyIncomeMonthOffset={setDailyIncomeMonthOffset}
            />
        </>
    );
}

