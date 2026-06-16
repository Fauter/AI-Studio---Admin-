import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import {
    Wallet,
    Car,
    Clock,
    Inbox,
    Activity,
    Search,
    FilterX,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Printer,
    FileSpreadsheet,
    FileText,
} from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

// ─── Interfaces ────────────────────────────────────────────────────
interface Movement {
    id: string;
    type: string;
    plate?: string;
    amount: number;
    payment_method?: string;
    timestamp: string;
    operator?: string;
    operator_name?: string;
    ticket_code?: string;
    invoice_type?: string;
    notes?: string;
}

interface Stay {
    id: string;
    plate: string;
    entry_time: string;
    exit_time?: string;
    vehicle_type: string;
    active: boolean;
}

interface MovementFilters {
    dateFrom: string;
    dateTo: string;
    plate: string;
    vehicleType: string;
    tariffType: string;
    operator: string;
    method: string;
    amountMin: string;
    amountMax: string;
}

interface StayFilters {
    plate: string;
    vehicleType: string;
    timeRange: string; // '' | '<1h' | '1h-4h' | '4h-12h' | '>12h'
}

const EMPTY_MOV_FILTERS: MovementFilters = { dateFrom: '', dateTo: '', plate: '', vehicleType: '', tariffType: '', operator: '', method: '', amountMin: '', amountMax: '' };
const PAGE_SIZE = 100;
const EMPTY_STAY_FILTERS: StayFilters = { plate: '', vehicleType: '', timeRange: '' };

// ─── Helpers ───────────────────────────────────────────────────────
const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(amount);

const formatNotesCurrency = (text?: string) => {
    if (!text) return '---';
    return text.replace(/\$(\d+)/g, (match, p1) => {
        const num = parseInt(p1, 10);
        return isNaN(num) ? match : `$${new Intl.NumberFormat('es-AR').format(num)}`;
    });
};

const getTimeElapsed = (entryTime: string) => {
    const diffMs = Date.now() - new Date(entryTime).getTime();
    const diffHrs = Math.floor(diffMs / 3_600_000);
    const diffMins = Math.floor((diffMs % 3_600_000) / 60_000);
    if (diffHrs > 24) return `+${Math.floor(diffHrs / 24)}d`;
    if (diffHrs > 0) return `${diffHrs}h ${diffMins}m`;
    return `${diffMins}m`;
};

const getTimeElapsedHours = (entryTime: string) => (Date.now() - new Date(entryTime).getTime()) / 3_600_000;

const isToday = (dateString: string) => {
    if (!dateString) return false;
    const d = new Date(dateString), t = new Date();
    return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
};

const formatTime24 = (dateString: string) =>
    new Date(dateString).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

const formatDateDM = (dateString: string) => {
    const d = new Date(dateString);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
};

/**
 * Parses a "DD/MM" string into a full Date, inferring the year intelligently.
 * - If we're in Jan/Feb and user enters Nov/Dec → assumes previous year.
 * - Otherwise assumes current year.
 * Returns null for invalid input.
 */
const parseSmartDate = (input: string): Date | null => {
    const trimmed = input.trim();
    const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (!match) return null;

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10); // 1-based from user

    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    const now = new Date();
    const currentMonth = now.getMonth(); // 0-based
    const currentYear = now.getFullYear();
    const inputMonth0 = month - 1; // convert to 0-based for comparison

    // If current month is Jan(0) or Feb(1) and user typed Nov(10) or Dec(11) → previous year
    const year = (currentMonth <= 1 && inputMonth0 >= 10) ? currentYear - 1 : currentYear;

    const date = new Date(year, inputMonth0, day);
    // Validate the date didn't roll over (e.g., 31/02 → March)
    if (date.getMonth() !== inputMonth0 || date.getDate() !== day) return null;

    return date;
};

/** Enforces DD/MM mask: allows only digits and slash, auto-inserts slash after 2 digits */
const applyDateMask = (raw: string): string => {
    // Strip non-digit, non-slash
    let cleaned = raw.replace(/[^\d/]/g, '');
    // Remove extra slashes
    const parts = cleaned.split('/');
    if (parts.length > 2) cleaned = parts[0] + '/' + parts.slice(1).join('');
    // Auto-insert slash after DD
    const digits = cleaned.replace(/\//g, '');
    if (digits.length >= 2 && !cleaned.includes('/')) {
        cleaned = digits.slice(0, 2) + '/' + digits.slice(2);
    }
    // Cap at 5 chars (DD/MM)
    return cleaned.slice(0, 5);
};

// ─── useDebounce Hook ──────────────────────────────────────────────
function useDebounce(value: string, delay: number) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const id = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(id);
    }, [value, delay]);
    return debounced;
}

// ─── Small Select Component ────────────────────────────────────────
function FilterSelect({ value, onChange, options, placeholder }: {
    value: string; onChange: (v: string) => void; options: string[]; placeholder: string;
}) {
    return (
        <div className="relative">
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                className="w-full h-9 appearance-none text-xs bg-white border border-slate-200 rounded-md pl-2 pr-6 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer truncate"
            >
                <option value="">{placeholder}</option>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════
export default function DashboardHome() {
    const { garageId } = useParams();

    // ── Data state ──
    const [movements, setMovements] = useState<Movement[]>([]);
    const [stays, setStays] = useState<Stay[]>([]);
    const [vehicleMap, setVehicleMap] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [garageInfo, setGarageInfo] = useState<{ name: string; address: string } | null>(null);
    const [activeTab, setActiveTab] = useState<'movements' | 'stays'>('movements');

    // ── Filter state ──
    const [movFilters, setMovFilters] = useState<MovementFilters>(EMPTY_MOV_FILTERS);
    const [stayFilters, setStayFilters] = useState<StayFilters>(EMPTY_STAY_FILTERS);
    const [movPage, setMovPage] = useState(1);

    // Debounced plate searches (300ms)
    const debouncedMovPlate = useDebounce(movFilters.plate, 300);
    const debouncedStayPlate = useDebounce(stayFilters.plate, 300);

    // ── Helpers to check if filters are active ──
    const movFiltersActive = movFilters.dateFrom || movFilters.dateTo || debouncedMovPlate || movFilters.vehicleType || movFilters.tariffType || movFilters.operator || movFilters.method || movFilters.amountMin || movFilters.amountMax;
    const stayFiltersActive = debouncedStayPlate || stayFilters.vehicleType || stayFilters.timeRange;

    // ── Data fetching ──
    useEffect(() => {
        if (!garageId) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const { data: gData } = await supabase
                    .from('garages')
                    .select('name, address')
                    .eq('id', garageId)
                    .single();
                if (gData) setGarageInfo(gData);

                const { data: movesData } = await supabase
                    .from('movements')
                    .select('*')
                    .eq('garage_id', garageId)
                    .order('timestamp', { ascending: false })
                    .limit(1500);

                const { data: activeStaysData } = await supabase
                    .from('stays')
                    .select('*')
                    .eq('garage_id', garageId)
                    .eq('active', true)
                    .order('entry_time', { ascending: false });

                const { data: recentStaysData } = await supabase
                    .from('stays')
                    .select('*')
                    .eq('garage_id', garageId)
                    .order('entry_time', { ascending: false })
                    .limit(200);

                if (movesData) setMovements(movesData as Movement[]);

                const staysMap = new Map<string, Stay>();
                if (recentStaysData) recentStaysData.forEach(s => staysMap.set(s.id, s as Stay));
                if (activeStaysData) activeStaysData.forEach(s => staysMap.set(s.id, s as Stay));
                setStays(Array.from(staysMap.values()));

                const { data: vData } = await supabase
                    .from('vehicles')
                    .select('plate, type')
                    .eq('garage_id', garageId);

                if (vData) {
                    const vMap: Record<string, string> = {};
                    vData.forEach(v => { if (v.plate) vMap[v.plate] = v.type; });
                    setVehicleMap(vMap);
                }
            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 60000);
        return () => clearInterval(interval);
    }, [garageId]);

    // ── Derived (global, unfiltered for KPIs) ──
    const todayMovements = useMemo(() => movements.filter(m => isToday(m.timestamp)), [movements]);
    const todayTotalRevenue = useMemo(() => todayMovements.reduce((a, m) => a + (Number(m.amount) || 0), 0), [todayMovements]);
    const activeStays = useMemo(() => stays.filter(s => s.active).sort((a, b) => new Date(b.entry_time).getTime() - new Date(a.entry_time).getTime()), [stays]);
    const entriesToday = useMemo(() => stays.filter(s => isToday(s.entry_time)).length, [stays]);
    const exitsToday = useMemo(() => stays.filter(s => !s.active && s.exit_time && isToday(s.exit_time)).length, [stays]);

    // ── Dropdown options (derived from data) ──
    const operatorOptions = useMemo(() => {
        const set = new Set<string>();
        movements.forEach(m => { const op = m.operator || m.operator_name; if (op) set.add(op); });
        return Array.from(set).sort();
    }, [movements]);

    const methodOptions = useMemo(() => {
        const set = new Set<string>();
        movements.forEach(m => { if (m.payment_method) set.add(m.payment_method); });
        return Array.from(set).sort();
    }, [movements]);

    const vehicleTypeOptions = useMemo(() => {
        const set = new Set<string>();
        activeStays.forEach(s => { if (s.vehicle_type) set.add(s.vehicle_type); });
        return Array.from(set).sort();
    }, [activeStays]);

    const movVehicleTypeOptions = useMemo(() => {
        const set = new Set<string>();
        movements.forEach(m => {
            if (m.plate && vehicleMap[m.plate]) set.add(vehicleMap[m.plate]);
        });
        return Array.from(set).sort();
    }, [movements, vehicleMap]);

    // ── Filtered lists ──
    const filteredMovements = useMemo(() => {
        let list = movements;
        if (movFilters.dateFrom) {
            const from = parseSmartDate(movFilters.dateFrom);
            if (from) {
                from.setHours(0, 0, 0, 0);
                list = list.filter(m => new Date(m.timestamp) >= from);
            }
        }
        if (movFilters.dateTo) {
            const to = parseSmartDate(movFilters.dateTo);
            if (to) {
                to.setHours(23, 59, 59, 999);
                list = list.filter(m => new Date(m.timestamp) <= to);
            }
        }
        if (debouncedMovPlate) {
            const q = debouncedMovPlate.toUpperCase();
            list = list.filter(m => (m.plate || '').toUpperCase().includes(q));
        }
        if (movFilters.vehicleType) {
            list = list.filter(m => m.plate && vehicleMap[m.plate] === movFilters.vehicleType);
        }
        if (movFilters.tariffType) {
            list = list.filter(m => m.type === movFilters.tariffType);
        }
        if (movFilters.operator) {
            list = list.filter(m => (m.operator || m.operator_name) === movFilters.operator);
        }
        if (movFilters.method) {
            list = list.filter(m => m.payment_method === movFilters.method);
        }
        if (movFilters.amountMin) {
            const min = Number(movFilters.amountMin);
            if (!isNaN(min)) list = list.filter(m => (Number(m.amount) || 0) >= min);
        }
        if (movFilters.amountMax) {
            const max = Number(movFilters.amountMax);
            if (!isNaN(max)) list = list.filter(m => (Number(m.amount) || 0) <= max);
        }
        return list;
    }, [movements, movFilters.dateFrom, movFilters.dateTo, debouncedMovPlate, movFilters.vehicleType, movFilters.tariffType, movFilters.operator, movFilters.method, movFilters.amountMin, movFilters.amountMax, vehicleMap]);

    const totalPages = Math.max(1, Math.ceil(filteredMovements.length / PAGE_SIZE));
    const safePage = Math.min(movPage, totalPages);
    const paginatedMovements = useMemo(() => {
        const start = (safePage - 1) * PAGE_SIZE;
        return filteredMovements.slice(start, start + PAGE_SIZE);
    }, [filteredMovements, safePage]);

    const filteredStays = useMemo(() => {
        let list = activeStays;
        if (debouncedStayPlate) {
            const q = debouncedStayPlate.toUpperCase();
            list = list.filter(s => s.plate.toUpperCase().includes(q));
        }
        if (stayFilters.vehicleType) {
            list = list.filter(s => s.vehicle_type === stayFilters.vehicleType);
        }
        if (stayFilters.timeRange) {
            list = list.filter(s => {
                const hrs = getTimeElapsedHours(s.entry_time);
                switch (stayFilters.timeRange) {
                    case '<1h': return hrs < 1;
                    case '1h-4h': return hrs >= 1 && hrs < 4;
                    case '4h-12h': return hrs >= 4 && hrs < 12;
                    case '>12h': return hrs >= 12;
                    default: return true;
                }
            });
        }
        return list;
    }, [activeStays, debouncedStayPlate, stayFilters.vehicleType, stayFilters.timeRange]);

    // ── Filter helpers ──
    const updateMovFilter = useCallback((key: keyof MovementFilters, value: string) => {
        setMovFilters(prev => ({ ...prev, [key]: value }));
        setMovPage(1);
    }, []);

    const updateStayFilter = useCallback((key: keyof StayFilters, value: string) => {
        setStayFilters(prev => ({ ...prev, [key]: value }));
    }, []);

    const resetMovFilters = useCallback(() => { setMovFilters(EMPTY_MOV_FILTERS); setMovPage(1); }, []);
    const resetStayFilters = useCallback(() => setStayFilters(EMPTY_STAY_FILTERS), []);

    // ── Print handler ──
    const handlePrint = useCallback(() => {
        window.print();
    }, []);

    // ── Export menu state ──
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const exportMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
                setIsExportMenuOpen(false);
            }
        };
        if (isExportMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isExportMenuOpen]);

    const printFiltersText = useMemo(() => {
        const active: string[] = [];
        if (movFilters.dateFrom || movFilters.dateTo) {
            let dr = 'Rango:';
            if (movFilters.dateFrom) dr += ` Desde ${movFilters.dateFrom}`;
            if (movFilters.dateTo) dr += ` Hasta ${movFilters.dateTo}`;
            active.push(dr.trim());
        }
        if (debouncedMovPlate) active.push(`Patente: ${debouncedMovPlate}`);
        if (movFilters.operator) active.push(`Operador: ${movFilters.operator}`);
        if (movFilters.method) active.push(`Método: ${movFilters.method}`);
        if (movFilters.vehicleType) active.push(`Vehículo: ${movFilters.vehicleType}`);
        if (movFilters.tariffType) active.push(`Tarifa: ${movFilters.tariffType === 'CobroEstadia' ? 'Estadía' : 'Abono'}`);
        if (movFilters.amountMin || movFilters.amountMax) {
            let mr = 'Monto:';
            if (movFilters.amountMin) mr += ` Min $${movFilters.amountMin}`;
            if (movFilters.amountMax) mr += ` Max $${movFilters.amountMax}`;
            active.push(mr.trim());
        }
        return active.length > 0 ? `Filtros aplicados: ${active.join(' | ')}` : null;
    }, [movFilters, debouncedMovPlate]);

    // ── Export to XLSX (ExcelJS) ──
    const handleExportExcel = useCallback(async () => {
        if (filteredMovements.length === 0) return;

        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Movimientos');

        const now = new Date().toLocaleString('es-AR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
        });

        // ── Set Column Widths explicitly (no ws.columns to avoid header collision) ──
        ws.getColumn(1).width = 18; // Fecha/Hora
        ws.getColumn(2).width = 12; // Patente
        ws.getColumn(3).width = 16; // Tipo
        ws.getColumn(4).width = 22; // Operador
        ws.getColumn(5).width = 18; // Método
        ws.getColumn(6).width = 10; // Factura
        ws.getColumn(7).width = 40; // Descripción
        ws.getColumn(8).width = 15; // Monto
        ws.getColumn(9).width = 12; // Ticket

        const totalCols = 9;
        let currentRowIndex = 1;

        // ── Metadata Rows ──

        // Fila 1: Nombre del Garage
        const nameRow = ws.getRow(currentRowIndex++);
        nameRow.getCell(1).value = (garageInfo?.name || 'Reporte Operativo').toUpperCase();
        nameRow.getCell(1).font = { size: 11, bold: true }; // I've added bold: true so it looks good as the new main header
        nameRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        ws.mergeCells(nameRow.number, 1, nameRow.number, totalCols);
        nameRow.height = 24; // Increased height slightly so it looks better as the first row

        // Fila 2: Dirección (Condicional)
        if (garageInfo?.address) {
            const addrRow = ws.getRow(currentRowIndex++);
            addrRow.getCell(1).value = garageInfo.address;
            addrRow.getCell(1).font = { size: 10, color: { argb: 'FF6B7280' } };
            addrRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
            ws.mergeCells(addrRow.number, 1, addrRow.number, totalCols);
            addrRow.height = 20;
        }

        // Fila 3: Info de Generación
        const infoRow = ws.getRow(currentRowIndex++);
        infoRow.getCell(1).value = `Generado el ${now} · ${filteredMovements.length} resultados`;
        infoRow.getCell(1).font = { size: 10, color: { argb: 'FF6B7280' } };
        infoRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        ws.mergeCells(infoRow.number, 1, infoRow.number, totalCols);
        infoRow.height = 20;

        // Fila 4: Filtros (Condicional - Si no hay, no se crea la fila)
        if (printFiltersText) {
            const filterRow = ws.getRow(currentRowIndex++);
            filterRow.getCell(1).value = printFiltersText;
            filterRow.getCell(1).font = { size: 10, color: { argb: 'FF6B7280' } };
            filterRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
            ws.mergeCells(filterRow.number, 1, filterRow.number, totalCols);
            filterRow.height = 20;
        }

        // Fila Espaciadora
        ws.addRow([]);
        currentRowIndex++;

        // ── Header Row ──
        const headerRow = ws.getRow(currentRowIndex++);
        headerRow.values = ['Fecha/Hora', 'Patente', 'Tipo Vehículo', 'Operador', 'Método de Pago', 'Factura', 'Descripción', 'Monto', 'Ticket'];

        headerRow.eachCell((cell) => {
            cell.font = { bold: true, size: 11, color: { argb: 'FF1F2937' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
            };
        });
        headerRow.height = 22;

        // ── Data Rows ──
        filteredMovements.forEach((m) => {
            const rowValues = [
                new Date(m.timestamp),
                m.plate || '',
                m.plate ? (vehicleMap[m.plate] || '') : m.type,
                m.operator || m.operator_name || 'Sistema',
                m.payment_method || '',
                m.invoice_type || '',
                (m.notes || '').replace(/[\r\n]+/g, ' '),
                Number(m.amount) || 0,
                m.ticket_code ? String(Number(m.ticket_code)).padStart(4, '0') : ''
            ];
            const row = ws.addRow(rowValues);

            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                    left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                    bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                    right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
                };
                cell.font = { size: 10 };

                // Formatting specific columns
                if (colNumber === 1) { // Fecha/Hora
                    cell.numFmt = 'dd/mm/yyyy hh:mm';
                } else if (colNumber === 2 || colNumber === 9) { // Patente, Ticket
                    cell.font = { name: 'Consolas', size: 10 };
                    if (colNumber === 9) cell.alignment = { horizontal: 'right' };
                } else if (colNumber === 8) { // Monto
                    cell.font = { name: 'Consolas', size: 10 };
                    cell.numFmt = '$ #,##0';
                    cell.alignment = { horizontal: 'right' };
                }
            });
        });

        // ── Save File ──
        const buffer = await wb.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `movimientos_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }, [filteredMovements, vehicleMap, garageInfo, printFiltersText]);

    const isHighDensity = filteredMovements.length > 50;

    const printPages = useMemo(() => {
        const pages: Movement[][] = [];
        // Maximized row limits to fill A4 pages
        const firstPageLimit = isHighDensity ? 35 : 30;
        const standardLimit = isHighDensity ? 45 : 40;
        if (filteredMovements.length === 0) return [];

        pages.push(filteredMovements.slice(0, firstPageLimit));
        let remaining = filteredMovements.slice(firstPageLimit);

        while (remaining.length > 0) {
            pages.push(remaining.slice(0, standardLimit));
            remaining = remaining.slice(standardLimit);
        }
        return pages;
    }, [filteredMovements, isHighDensity]);

    // ── Loading ──
    if (loading && movements.length === 0) {
        return (
            <div className="flex items-center justify-center h-full min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    // ═════════════════════════════════════════════════════════════════
    // RENDER
    // ═════════════════════════════════════════════════════════════════
    return (
        <>
            <div className="px-1 py-2 space-y-2 max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500 print:hidden">

                {/* ── Header compacto ── */}
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 min-w-0">
                        <Activity className="h-5 w-5 text-indigo-600 shrink-0" />
                        <h1 className="text-lg font-bold text-slate-900 truncate">Dashboard Operativo</h1>
                        <span className="hidden sm:inline text-slate-400 text-xs">·</span>
                        <span className="hidden sm:inline text-xs text-slate-400 truncate">Resumen en tiempo real</span>
                    </div>
                    <span className="text-[11px] text-slate-400 whitespace-nowrap shrink-0">
                        {new Date().toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                </div>

                {/* ── Tabla Principal ── */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[calc(100vh-140px)]">

                    {/* Tabs Header */}
                    <div className="flex border-b border-slate-200 bg-slate-50/80 shrink-0">
                        <button
                            onClick={() => setActiveTab('movements')}
                            className={cn(
                                "flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all relative",
                                activeTab === 'movements'
                                    ? "text-indigo-700 bg-white"
                                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-100/50"
                            )}
                        >
                            {activeTab === 'movements' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
                            <Wallet className="h-3.5 w-3.5" />
                            Movimientos
                            <span className={cn(
                                "py-0.5 px-1.5 rounded-full text-[9px] font-bold",
                                activeTab === 'movements' ? "bg-indigo-100 text-indigo-700" : "bg-slate-200 text-slate-500"
                            )}>
                                {filteredMovements.length}
                            </span>
                        </button>
                        <button
                            onClick={() => setActiveTab('stays')}
                            className={cn(
                                "flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all relative border-l border-slate-200",
                                activeTab === 'stays'
                                    ? "text-blue-700 bg-white"
                                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-100/50"
                            )}
                        >
                            {activeTab === 'stays' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
                            <Car className="h-3.5 w-3.5" />
                            En Playa
                            <span className={cn(
                                "py-0.5 px-1.5 rounded-full text-[9px] font-bold",
                                activeTab === 'stays' ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-500"
                            )}>
                                {activeStays.length}
                            </span>
                        </button>
                    </div>

                    {/* Movements Filter Toolbar */}
                    {activeTab === 'movements' && (
                        <div className="bg-slate-50/50 p-3 border-b border-slate-200 shrink-0 print:hidden">
                            <div className="flex items-end gap-2">
                                {/* ── Scrollable filter inputs ── */}
                                <div className="flex flex-nowrap items-end gap-2 overflow-x-auto pb-1 scrollbar-hide min-w-0 flex-1">
                                    <div className="flex-1 min-w-[75px]">
                                        <label className="block text-[10px] text-slate-500 font-medium mb-1 truncate">Desde <span className="text-slate-400">(DD/MM)</span></label>
                                        <input type="text" inputMode="numeric" value={movFilters.dateFrom} onChange={e => updateMovFilter('dateFrom', applyDateMask(e.target.value))} placeholder="DD/MM" maxLength={5} className={cn("w-full h-9 text-xs bg-white border rounded-md px-2 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500", movFilters.dateFrom && !parseSmartDate(movFilters.dateFrom) && movFilters.dateFrom.length === 5 ? "border-amber-400 bg-amber-50/50" : "border-slate-200")} />
                                    </div>
                                    <div className="flex-1 min-w-[75px]">
                                        <label className="block text-[10px] text-slate-500 font-medium mb-1 truncate">Hasta <span className="text-slate-400">(DD/MM)</span></label>
                                        <input type="text" inputMode="numeric" value={movFilters.dateTo} onChange={e => updateMovFilter('dateTo', applyDateMask(e.target.value))} placeholder="DD/MM" maxLength={5} className={cn("w-full h-9 text-xs bg-white border rounded-md px-2 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500", movFilters.dateTo && !parseSmartDate(movFilters.dateTo) && movFilters.dateTo.length === 5 ? "border-amber-400 bg-amber-50/50" : "border-slate-200")} />
                                    </div>
                                    <div className="flex-1 min-w-[75px]">
                                        <label className="block text-[10px] text-slate-500 font-medium mb-1 truncate">Patente</label>
                                        <div className="relative">
                                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                            <input type="text" value={movFilters.plate} onChange={e => updateMovFilter('plate', e.target.value)} placeholder="Buscar…" className="w-full h-9 text-xs bg-white border border-slate-200 rounded-md pl-7 pr-2 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                                        </div>
                                    </div>

                                    <div className="flex-1 min-w-[75px]">
                                        <label className="block text-[10px] text-slate-500 font-medium mb-1 truncate">Operador</label>
                                        <FilterSelect value={movFilters.operator} onChange={v => updateMovFilter('operator', v)} options={operatorOptions} placeholder="Todos" />
                                    </div>
                                    <div className="flex-1 min-w-[75px]">
                                        <label className="block text-[10px] text-slate-500 font-medium mb-1 truncate">Método</label>
                                        <FilterSelect value={movFilters.method} onChange={v => updateMovFilter('method', v)} options={methodOptions} placeholder="Todos" />
                                    </div>
                                    <div className="flex-1 min-w-[75px]">
                                        <label className="block text-[10px] text-slate-500 font-medium mb-1 truncate">Vehículo</label>
                                        <FilterSelect value={movFilters.vehicleType} onChange={v => updateMovFilter('vehicleType', v)} options={movVehicleTypeOptions} placeholder="Todos" />
                                    </div>
                                    <div className="flex-1 min-w-[75px]">
                                        <label className="block text-[10px] text-slate-500 font-medium mb-1 truncate">Tarifa</label>
                                        <div className="relative">
                                            <select value={movFilters.tariffType} onChange={e => updateMovFilter('tariffType', e.target.value)} className="w-full h-9 appearance-none text-xs bg-white border border-slate-200 rounded-md pl-2 pr-6 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer truncate">
                                                <option value="">Todas</option>
                                                <option value="CobroEstadia">Estadía</option>
                                                <option value="CobroAbono">Abono</option>
                                            </select>
                                            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                                        </div>
                                    </div>
                                </div>

                                {/* ── Action buttons (outside overflow container) ── */}
                                <div className="flex items-center gap-2 shrink-0 self-end pb-1">
                                    {movFiltersActive && (
                                        <button onClick={resetMovFilters} className="h-9 px-3 flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-md transition-colors">
                                            <FilterX className="h-4 w-4" />
                                            Limpiar
                                            <span className="text-[10px] font-normal text-indigo-400">({filteredMovements.length})</span>
                                        </button>
                                    )}
                                    {/* ── Split Button: Export Group ── */}
                                    <div ref={exportMenuRef} className="relative flex items-center">
                                        <button
                                            onClick={handleExportExcel}
                                            title="Descargar movimientos como Excel"
                                            className="h-9 pl-3 pr-3 flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-l-md hover:bg-slate-50 transition-colors border-r-0 whitespace-nowrap"
                                        >
                                            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                                            Descargar Excel
                                        </button>
                                        <button
                                            onClick={() => setIsExportMenuOpen(prev => !prev)}
                                            title="Más opciones de exportación"
                                            className={cn(
                                                "h-9 px-1.5 flex items-center bg-white border border-slate-200 rounded-r-md hover:bg-slate-50 transition-colors",
                                                isExportMenuOpen && "bg-slate-100"
                                            )}
                                        >
                                            <ChevronDown className={cn("h-3.5 w-3.5 text-slate-500 transition-transform", isExportMenuOpen && "rotate-180")} />
                                        </button>
                                        {isExportMenuOpen && (
                                            <div className="absolute top-full right-0 mt-1 w-52 bg-white rounded-lg border border-slate-200 shadow-lg z-[9999] py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                                                <button
                                                    onClick={() => { handlePrint(); setIsExportMenuOpen(false); }}
                                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                                                >
                                                    <FileText className="h-4 w-4 text-rose-500" />
                                                    <span className="font-medium">Exportar a PDF</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            {/* Date range validation warning */}
                            {(() => {
                                const fromDate = parseSmartDate(movFilters.dateFrom);
                                const toDate = parseSmartDate(movFilters.dateTo);
                                if (fromDate && toDate && fromDate > toDate) {
                                    return <p className="mt-2 text-[11px] text-amber-600 font-medium">⚠ La fecha "Desde" es posterior a "Hasta". Ajustá el rango.</p>;
                                }
                                return null;
                            })()}
                        </div>
                    )}

                    {/* Tab Content */}
                    <div className="flex-1 overflow-auto scrollbar-thin">
                        {activeTab === 'movements' ? (
                            <>
                                <table className="w-full text-sm text-left">
                                    <thead className="sticky top-0 z-20">
                                        {/* Column names */}
                                        <tr className="text-[10px] text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                                            <th className="px-2 py-2 font-semibold w-[90px]">Hora</th>
                                            <th className="px-2 py-2 font-semibold">Patente / Detalle</th>
                                            <th className="px-2 py-2 font-semibold">Operador</th>
                                            <th className="px-2 py-2 font-semibold w-[90px]">Método</th>
                                            <th className="px-2 py-2 font-semibold w-[90px]">Factura</th>
                                            <th className="px-2 py-2 font-semibold min-w-[250px]">Descripción</th>
                                            <th className="px-2 py-2 font-semibold text-right">Monto</th>
                                            <th className="px-2 py-2 font-semibold text-right w-[80px]">Ticket</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {filteredMovements.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="py-8 text-center text-slate-400">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <Inbox className="h-8 w-8 text-slate-200" />
                                                        <p className="text-sm font-medium text-slate-500">
                                                            {movFiltersActive
                                                                ? 'No se encontraron resultados para los filtros aplicados'
                                                                : 'No hay movimientos recientes'}
                                                        </p>
                                                        <p className="text-[11px] text-slate-400">
                                                            {movFiltersActive
                                                                ? 'Probá ajustar o limpiar los filtros.'
                                                                : 'Los cobros aparecerán aquí automáticamente.'}
                                                        </p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            paginatedMovements.map(move => (
                                                <tr key={move.id} className="hover:bg-indigo-50/30 transition-colors">
                                                    <td className="px-2 py-2 text-xs text-slate-500 whitespace-nowrap">
                                                        <span className="font-semibold text-slate-700">{formatTime24(move.timestamp)}</span>
                                                        <span className="block text-[9px] text-slate-400">{formatDateDM(move.timestamp)}</span>
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <div className="font-bold text-slate-800 font-mono text-[13px]">{move.plate || '---'}</div>
                                                        <div className="text-[9px] uppercase text-indigo-600 font-medium">
                                                            {move.plate ? (vehicleMap[move.plate] || 'Vehículo') : move.type}
                                                        </div>
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <div className="flex items-center gap-1.5 text-slate-600 text-xs font-medium">
                                                            <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[9px] uppercase shrink-0">
                                                                {(move.operator || move.operator_name || 'S')[0]}
                                                            </div>
                                                            <span className="truncate max-w-[120px]">{move.operator || move.operator_name || 'Sistema'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <span className={cn(
                                                            "px-1 py-0 rounded text-[10px] font-bold uppercase border",
                                                            (move.payment_method || '').toUpperCase() === 'EFECTIVO'
                                                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                                : "bg-indigo-50 text-indigo-700 border-indigo-200"
                                                        )}>
                                                            {move.payment_method || '---'}
                                                        </span>
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        {move.invoice_type ? (
                                                            <span className={cn(
                                                                "px-1 py-0 rounded text-[10px] font-bold uppercase",
                                                                move.invoice_type === 'CC' ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"
                                                            )}>
                                                                {move.invoice_type}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400 text-xs">---</span>
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-2" title={move.notes}>
                                                        <div className="text-xs text-slate-600 whitespace-normal break-words">
                                                            {formatNotesCurrency(move.notes)}
                                                        </div>
                                                    </td>
                                                    <td className="px-2 py-2 text-right font-bold text-slate-900 font-mono text-sm">
                                                        {formatCurrency(move.amount)}
                                                    </td>
                                                    <td className="px-2 py-2 text-right font-mono text-xs text-slate-500">
                                                        {move.ticket_code
                                                            ? String(Number(move.ticket_code)).padStart(4, '0')
                                                            : '---'}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                                {/* Pagination Controls */}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-t border-slate-200 shrink-0 print:hidden">
                                        <span className="text-[11px] text-slate-500">
                                            {filteredMovements.length} resultado{filteredMovements.length !== 1 ? 's' : ''}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => setMovPage(p => Math.max(1, p - 1))} disabled={safePage <= 1} className={cn("h-8 px-2.5 flex items-center gap-1 text-xs font-medium rounded-md border transition-colors", safePage <= 1 ? "border-slate-100 text-slate-300 cursor-not-allowed" : "border-slate-200 text-slate-600 hover:bg-slate-100")}>
                                                <ChevronLeft className="h-3.5 w-3.5" /> Anterior
                                            </button>
                                            <span className="text-xs font-semibold text-slate-700 tabular-nums">
                                                {safePage} <span className="font-normal text-slate-400">de</span> {totalPages}
                                            </span>
                                            <button onClick={() => setMovPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} className={cn("h-8 px-2.5 flex items-center gap-1 text-xs font-medium rounded-md border transition-colors", safePage >= totalPages ? "border-slate-100 text-slate-300 cursor-not-allowed" : "border-slate-200 text-slate-600 hover:bg-slate-100")}>
                                                Siguiente <ChevronRight className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <table className="w-full text-sm text-left">
                                <thead className="sticky top-0 z-20">
                                    {/* Column names */}
                                    <tr className="text-[10px] text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                                        <th className="px-4 py-2 font-semibold">Patente</th>
                                        <th className="px-4 py-2 font-semibold">Tipo</th>
                                        <th className="px-4 py-2 font-semibold">Hora de Ingreso</th>
                                        <th className="px-4 py-2 font-semibold text-right">Tiempo</th>
                                    </tr>
                                    {/* Filter row */}
                                    <tr className="bg-white border-b border-slate-100">
                                        <td className="px-4 py-1.5">
                                            <div className="relative">
                                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                                                <input
                                                    type="text"
                                                    value={stayFilters.plate}
                                                    onChange={e => updateStayFilter('plate', e.target.value)}
                                                    placeholder="Buscar patente…"
                                                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-md pl-7 pr-2 py-1 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                                />
                                            </div>
                                        </td>
                                        <td className="px-4 py-1.5">
                                            <FilterSelect
                                                value={stayFilters.vehicleType}
                                                onChange={v => updateStayFilter('vehicleType', v)}
                                                options={vehicleTypeOptions}
                                                placeholder="Todos"
                                            />
                                        </td>
                                        <td className="px-4 py-1.5">
                                            {/* No filter for entry time */}
                                        </td>
                                        <td className="px-4 py-1.5">
                                            <FilterSelect
                                                value={stayFilters.timeRange}
                                                onChange={v => updateStayFilter('timeRange', v)}
                                                options={['<1h', '1h-4h', '4h-12h', '>12h']}
                                                placeholder="Todos"
                                            />
                                        </td>
                                    </tr>
                                    {/* Reset button row */}
                                    {stayFiltersActive && (
                                        <tr className="bg-blue-50/50 border-b border-blue-100">
                                            <td colSpan={4} className="px-4 py-1">
                                                <button
                                                    onClick={resetStayFilters}
                                                    className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                                                >
                                                    <FilterX className="h-3 w-3" />
                                                    Limpiar filtros
                                                </button>
                                            </td>
                                        </tr>
                                    )}
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredStays.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="py-8 text-center text-slate-400">
                                                <div className="flex flex-col items-center gap-1">
                                                    <Car className="h-8 w-8 text-slate-200" />
                                                    <p className="text-sm font-medium text-slate-500">
                                                        {stayFiltersActive
                                                            ? 'No se encontraron resultados para los filtros aplicados'
                                                            : 'La playa está completamente vacía'}
                                                    </p>
                                                    <p className="text-[11px] text-slate-400">
                                                        {stayFiltersActive
                                                            ? 'Probá ajustar o limpiar los filtros.'
                                                            : 'Acá verás los vehículos que ingresen al garaje.'}
                                                    </p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredStays.map(stay => (
                                            <tr key={stay.id} className="hover:bg-blue-50/30 transition-colors">
                                                <td className="px-4 py-2">
                                                    <span className="font-bold text-slate-800 font-mono text-[13px] px-2 py-0.5 bg-white rounded border border-slate-300 uppercase">
                                                        {stay.plate}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2">
                                                    <span className="text-[10px] font-bold text-slate-600 uppercase bg-slate-100 px-1.5 py-0.5 rounded">
                                                        {stay.vehicle_type || 'Vehículo'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2 text-xs text-slate-600 font-medium">
                                                    {formatTime24(stay.entry_time)}
                                                    <span className="ml-1.5 text-[10px] text-slate-400">{formatDateDM(stay.entry_time)}</span>
                                                </td>
                                                <td className="px-4 py-2 text-right">
                                                    <div className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 font-bold text-[11px] rounded border border-blue-100">
                                                        <Clock className="h-3 w-3" />
                                                        {getTimeElapsed(stay.entry_time)}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            {/* ═══ Print-Only Section ═══ */}
            <div className="hidden print:block w-full bg-white text-black text-sm absolute top-0 left-0 z-[9999]">
                <style type="text/css">
                    {`
                        @media print {
                            @page { size: A4; margin: 0; }
                            body { 
                                -webkit-print-color-adjust: exact;
                                print-color-adjust: exact;
                            }
                        }
                    `}
                </style>
                {printPages.map((pageData, index) => {
                    // Density-aware padding classes
                    const thPadding = isHighDensity ? 'py-[3px] px-1' : 'py-1.5 px-1';
                    const tdPadding = isHighDensity ? 'py-1 px-1' : 'py-1.5 px-1';
                    const fontSize = isHighDensity ? 'text-[11px]' : 'text-xs';
                    const isFirstPage = index === 0;
                    const isLastPage = index === printPages.length - 1;

                    return (
                        <div
                            key={index}
                            className={`grid grid-rows-[auto_1fr_auto] h-[297mm] w-full p-[15mm] box-border ${isLastPage ? 'print:break-after-auto' : 'print:break-after-page'
                                }`}
                        >
                            {/* Row 1: Header (auto) — only on the first page */}
                            {isFirstPage ? (
                                <div className="text-center mb-1">
                                    <h1 className="text-xl font-bold uppercase leading-tight">{garageInfo?.name || 'Dashboard Operativo'}</h1>
                                    {garageInfo?.address && <p className="text-xs text-slate-600 leading-tight">{garageInfo.address}</p>}
                                    <h2 className="text-base font-semibold mt-0.5 leading-tight">Reporte de Movimientos</h2>
                                    <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                                        Generado el {new Date().toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} · {filteredMovements.length} resultados
                                    </p>
                                    {printFiltersText && (
                                        <p className="text-[10px] text-slate-600 font-medium mt-0.5 leading-tight">
                                            {printFiltersText}
                                        </p>
                                    )}
                                </div>
                            ) : <div />}

                            {/* Row 2: Data table (1fr — fills all remaining space) */}
                            <div className="overflow-hidden">
                                <table className={`w-full text-left ${fontSize} border-collapse`}>
                                    <thead>
                                        <tr className="border-b-2 border-slate-800">
                                            <th className={`${thPadding} font-semibold`}>Fecha/Hora</th>
                                            <th className={`${thPadding} font-semibold`}>Patente</th>
                                            <th className={`${thPadding} font-semibold`}>Tipo</th>
                                            <th className={`${thPadding} font-semibold`}>Operador</th>
                                            <th className={`${thPadding} font-semibold`}>Método</th>
                                            <th className={`${thPadding} font-semibold`}>Factura</th>
                                            <th className={`${thPadding} font-semibold`}>Descripción</th>
                                            <th className={`${thPadding} font-semibold text-right`}>Monto</th>
                                            <th className={`${thPadding} font-semibold text-right`}>Ticket</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pageData.map(m => (
                                            <tr key={m.id} className="border-b border-slate-200">
                                                <td className={`${tdPadding} whitespace-nowrap`}>{formatDateDM(m.timestamp)} {formatTime24(m.timestamp)}</td>
                                                <td className={`${tdPadding} font-mono`}>{m.plate || '---'}</td>
                                                <td className={`${tdPadding} text-[9px] uppercase`}>{m.plate ? (vehicleMap[m.plate] || 'Vehículo') : m.type}</td>
                                                <td className={`${tdPadding}`}>{m.operator || m.operator_name || 'Sistema'}</td>
                                                <td className={`${tdPadding}`}>{m.payment_method || '---'}</td>
                                                <td className={`${tdPadding} text-[9px] uppercase`}>{m.invoice_type || '---'}</td>
                                                <td className={`${tdPadding} max-w-[200px] truncate`}>{m.notes || '---'}</td>
                                                <td className={`${tdPadding} text-right font-mono`}>{formatCurrency(m.amount)}</td>
                                                <td className={`${tdPadding} text-right font-mono`}>{m.ticket_code ? String(Number(m.ticket_code)).padStart(4, '0') : '---'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Row 3: Footer (auto — grid anchors it to the bottom) */}
                            <div className="pt-3 border-t border-slate-300 flex items-center justify-between text-[10px] text-slate-500">
                                <span>{garageInfo?.name || 'Reporte'}</span>
                                <span>Página {index + 1} de {printPages.length}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </>
    );
}
