import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { 
    Movement, Stay, Subscription, Debt, Cochera, Expense
} from '../components/hub/cash-flow/CashFlowShared';
import { Garage, BuildingLevel } from '../types';

interface CashFlowState {
    movements: Movement[];
    stays: Stay[];
    allStays: Stay[];
    vehicles: { plate: string; type: string; is_subscriber?: boolean; garage_id?: string; customer_id?: string }[];
    employees: { id: string; full_name: string }[];
    subscriptions: Subscription[];
    debts: Debt[];
    cocheras: Cochera[];
    buildingLevels: BuildingLevel[];
    expenses: Expense[];
    tariffs: any[];
    vehicleTypes: any[];
    prices: any[];

    loadingTier1: boolean;
    loadingTier2: boolean;
    error: string | null;
    loadingStep: string;
    loadingProgress: number;

    isInitialized: boolean;
    lastGarageIdsHash: string;

    fetchTier1: (garages: Garage[], profileId?: string) => Promise<void>;
    fetchTier2: (garages: Garage[]) => Promise<void>;

    addExpense: (expense: Expense) => void;
}

export const useCashFlowStore = create<CashFlowState>((set, get) => ({
    movements: [],
    stays: [],
    allStays: [],
    vehicles: [],
    employees: [],
    subscriptions: [],
    debts: [],
    cocheras: [],
    buildingLevels: [],
    expenses: [],
    tariffs: [],
    vehicleTypes: [],
    prices: [],

    loadingTier1: true,
    loadingTier2: false,
    error: null,
    loadingStep: 'Iniciando...',
    loadingProgress: 0,
    
    isInitialized: false,
    lastGarageIdsHash: '',

    addExpense: (expense) => set(state => ({ expenses: [expense, ...state.expenses] })),

    fetchTier1: async (garages, profileId) => {
        if (garages.length === 0) {
            set({ loadingTier1: false });
            return;
        }

        const currentGarageIdsHash = garages.map(g => g.id).sort().join(',');
        const { isInitialized, lastGarageIdsHash } = get();

        // Prevent refetching if already initialized for the exact same garages
        if (isInitialized && currentGarageIdsHash === lastGarageIdsHash) {
            return;
        }

        set({ 
            loadingTier1: true, 
            error: null, 
            loadingProgress: 0, 
            loadingStep: 'Preparando carga rápida (Tier 1)...',
            lastGarageIdsHash: currentGarageIdsHash,
            isInitialized: false
        });

        const retry = async <T = any,>(fn: () => any, retries = 3): Promise<T> => {
            for (let i = 0; i < retries; i++) {
                const { data, error } = await fn();
                if (!error) return data as T;
                if (i === retries - 1) throw error;
                await new Promise(r => setTimeout(r, 1000 * (i + 1)));
            }
            throw new Error("Unreachable");
        };

        try {
            const garageIds = garages.map(g => g.id);
            const now = new Date();
            
            // Tier 1: Mes actual y mes anterior
            const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
            const movementsSince = prevMonthDate.toISOString();

            set({ loadingProgress: 5, loadingStep: 'Sincronizando base de datos en paralelo...' });

            let completed = 0;
            const totalTasks = 13;
            const trackProgress = async <T>(promise: Promise<T>, taskName: string): Promise<T> => {
                const result = await promise;
                completed++;
                const progress = Math.round((completed / totalTasks) * 100);
                set({ 
                    loadingProgress: progress,
                    loadingStep: `Sincronizando ${taskName}... (${completed}/${totalTasks})`
                });
                return result;
            };

            const fetchMovements = async () => {
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
                    if (rows.length < PAGE_SIZE) keepFetching = false;
                    else from += PAGE_SIZE;
                }
                return allMovements;
            };

            const fetchEmployees = async () => {
                if (!profileId) return [];
                try {
                    const res = await retry<any[]>(() => supabase.from('employee_accounts').select('id, first_name, last_name, garage_id, role').eq('owner_id', profileId)) || [];
                    return res.map((e: any) => ({ id: e.id, full_name: `${e.first_name || ''} ${e.last_name || ''}`.trim() || 'Operario' }));
                } catch (e) {
                    console.warn('Error silenciado al cargar empleados:', e);
                    return [];
                }
            };

            // Ejecución 100% concurrente
            const [
                tariffsData, vehicleTypesData, cocherasData, levelsData, pricesData,
                subsData, debtsData, vehiclesData, activeStaysData, allStaysData,
                expensesData, movementsData, employeesData
            ] = await Promise.all([
                trackProgress(retry(() => supabase.from('tariffs').select('id, name, type, garage_id').in('garage_id', garageIds)), 'Tarifas'),
                trackProgress(retry(() => supabase.from('vehicle_types').select('id, name, garage_id').in('garage_id', garageIds)), 'Tipos de Vehículo'),
                trackProgress(retry(() => supabase.from('cocheras').select('id, garage_id, tipo, status, numero, cliente_id, vehiculos, precio_base').in('garage_id', garageIds)), 'Cocheras'),
                trackProgress(retry(() => supabase.from('building_levels').select('id, garage_id, display_name, total_spots').in('garage_id', garageIds)), 'Niveles'),
                trackProgress(retry(() => supabase.from('prices').select('amount, tariff_id, vehicle_type_id')), 'Precios'),
                trackProgress(retry(() => supabase.from('subscriptions').select('id, garage_id, customer_id, start_date, end_date, active, price, type').in('garage_id', garageIds)), 'Abonos'),
                trackProgress(retry(() => supabase.from('debts').select('id, remaining_amount, status, due_date, customer_id, garage_id, created_at, amount, subscription_id, customers:customer_id(name), subscriptions:subscription_id(type)').in('garage_id', garageIds).eq('status', 'PENDING')), 'Deudas'),
                trackProgress(retry(() => supabase.from('vehicles').select('plate, type, is_subscriber, garage_id, customer_id').in('garage_id', garageIds)), 'Vehículos'),
                trackProgress(retry(() => supabase.from('stays').select('*').in('garage_id', garageIds).eq('active', true).order('entry_time', { ascending: false })), 'Estadías Activas'),
                trackProgress(retry(() => supabase.from('stays').select('id,garage_id,plate,entry_time,exit_time,vehicle_type,active').in('garage_id', garageIds).gte('entry_time', movementsSince).order('entry_time', { ascending: false }).limit(3000)), 'Histórico de Estadías'),
                trackProgress(retry(() => supabase.from('expenses').select('id, garage_id, owner_id, template_id, description, imputation, custom_garage_name, amount, expense_type, expense_date, created_at, created_by').in('garage_id', garageIds).gte('expense_date', movementsSince).order('expense_date', { ascending: false })), 'Egresos'),
                trackProgress(fetchMovements(), 'Movimientos'),
                trackProgress(fetchEmployees(), 'Operadores')
            ]);

            set({
                tariffs: tariffsData || [],
                vehicleTypes: vehicleTypesData || [],
                cocheras: (cocherasData || []) as Cochera[],
                buildingLevels: (levelsData || []) as BuildingLevel[],
                prices: pricesData || [],
                subscriptions: (subsData || []) as Subscription[],
                debts: (debtsData || []) as Debt[],
                vehicles: vehiclesData || [],
                stays: (activeStaysData || []) as Stay[],
                allStays: (allStaysData || []) as Stay[],
                expenses: (expensesData || []) as Expense[],
                movements: movementsData || [],
                employees: employeesData || [],
                loadingTier1: false,
                isInitialized: true,
                loadingStep: 'Carga completa'
            });
        } catch (err: any) {
            console.error('Error fetching dashboard data:', err);
            set({ error: 'No se pudieron cargar los datos financieros.', loadingTier1: false });
        }
    },

    fetchTier2: async (garages) => {
        if (garages.length === 0) return;
        
        set({ loadingTier2: true });

        const retry = async <T = any,>(fn: () => any, retries = 3): Promise<T> => {
            for (let i = 0; i < retries; i++) {
                const { data, error } = await fn();
                if (!error) return data as T;
                if (i === retries - 1) throw error;
                await new Promise(r => setTimeout(r, 1000 * (i + 1)));
            }
            throw new Error("Unreachable");
        };

        try {
            const garageIds = garages.map(g => g.id);
            const now = new Date();
            
            // Tier 2: Desde principio de año hasta principio del mes anterior (Tier 1 coverage)
            const firstDayOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0).toISOString();
            const firstDayOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0).toISOString();

            // Fetch historical expenses
            const historicalExpensesData = await retry(() => supabase
                .from('expenses')
                .select('id, garage_id, owner_id, template_id, description, amount, expense_type, expense_date, created_at, created_by')
                .in('garage_id', garageIds)
                .gte('expense_date', firstDayOfYear)
                .lt('expense_date', firstDayOfPrevMonth)
                .order('expense_date', { ascending: false })
            );

            // Fetch historical stays (not usually needed for variation but good for completeness)
            const historicalStaysData = await retry(() => supabase
                .from('stays')
                .select('id,garage_id,plate,entry_time,exit_time,vehicle_type,active')
                .in('garage_id', garageIds)
                .gte('entry_time', firstDayOfYear)
                .lt('entry_time', firstDayOfPrevMonth)
                .order('entry_time', { ascending: false })
                .limit(3000)
            );

            // Fetch historical movements paginated
            const PAGE_SIZE = 1000;
            let historicalMovements: Movement[] = [];
            let from = 0;
            let keepFetching = true;
            while (keepFetching) {
                const batch = await retry(() => supabase
                    .from('movements')
                    .select('id, amount, type, timestamp, payment_method, plate, garage_id, operator, related_entity_id, ticket_number, invoice_type, notes')
                    .in('garage_id', garageIds)
                    .gte('timestamp', firstDayOfYear)
                    .lt('timestamp', firstDayOfPrevMonth)
                    .order('timestamp', { ascending: false })
                    .range(from, from + PAGE_SIZE - 1)
                );
                const rows = (batch || []) as Movement[];
                historicalMovements = historicalMovements.concat(rows);
                if (rows.length < PAGE_SIZE) keepFetching = false;
                else from += PAGE_SIZE;
            }

            // Merge into current state
            const current = get();
            
            // Helper to avoid duplicates just in case
            const uniqueById = (arr: any[]) => {
                const map = new Map();
                arr.forEach(item => map.set(item.id, item));
                return Array.from(map.values());
            };

            set({
                expenses: uniqueById([...current.expenses, ...((historicalExpensesData || []) as Expense[])]),
                allStays: uniqueById([...current.allStays, ...((historicalStaysData || []) as Stay[])]),
                movements: uniqueById([...current.movements, ...historicalMovements]),
                loadingTier2: false
            });

        } catch (err: any) {
            console.error('Error fetching tier 2 data:', err);
            set({ loadingTier2: false });
        }
    }
}));
