
import React, { useState, useEffect, useMemo } from 'react';
import {
    Building2, Wallet, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
    CreditCard, Calendar, Loader2, Filter, Car, Clock, AlertCircle, Inbox, X,
    BarChart3, LineChart, List, GitBranch, BadgeDollarSign, ChevronRight,
    Activity, Zap, ChevronDown, ChevronUp, Target, Percent, Eye, EyeOff
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Garage, BuildingLevel } from '../../types';
import { twMerge } from 'tailwind-merge';
import clsx from 'clsx';
import { useAuth } from '../../hooks/useAuth';

function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

// ─────────────────────────────────────────────────────────────
// §1. Type Definitions
// ─────────────────────────────────────────────────────────────

interface Movement {
    id: string;
    garage_id: string;
    type: 'CobroEstadia' | 'CobroAbono' | 'INGRESO' | 'EGRESO' | 'COBRO' | 'PAGO' | 'CAJA_INICIAL' | 'RETIRO';
    plate?: string;
    amount: number;
    payment_method?: string;
    timestamp: string;
    ticket_number?: string;
    operator?: string;
    related_entity_id?: string | null;
    invoice_type?: string | null;
}

interface Stay {
    id: string;
    garage_id: string;
    plate: string;
    entry_time: string;
    exit_time?: string;
    vehicle_type: string;
    active: boolean;
}

interface Subscription {
    id: string;
    garage_id: string;
    customer_id?: string;
    start_date?: string;
    end_date?: string;
    active?: boolean;
    price?: number;
    type?: string;
}

interface Debt {
    id: string;
    remaining_amount: number;
    status: 'PENDING' | 'PAID';
    customer_id?: string;
    garage_id: string;
    created_at?: string;
    amount?: number;
    due_date?: string;
    subscription_id?: string;
    customers?: { name: string };
    subscriptions?: { type: string } | null;
}

interface Cochera {
    id: string;
    garage_id: string;
    tipo: string;
    status: 'Ocupada' | 'Libre';
    numero?: string;
    cliente_id?: string;
    vehiculos?: string[];
    precio_base?: number;
}

interface CashFlowHubProps {
    garages: Garage[];
}

type ActiveSection = 'resumen' | 'sucursal' | 'registro';

// ─────────────────────────────────────────────────────────────
// §2. Format Utilities
// ─────────────────────────────────────────────────────────────

const arsFormatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const formatCurrency = (amount: number) => arsFormatter.format(amount);

/** Compact axis label with smart decimals: 683000 → "$683K", 37900000 → "$37.9M" */
function formatAxisLabel(val: number): string {
    if (val >= 1_000_000) {
        const m = val / 1_000_000;
        return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
    }
    if (val >= 1_000) {
        const k = val / 1_000;
        return `$${k % 1 === 0 ? k.toFixed(0) : k >= 100 ? k.toFixed(0) : k.toFixed(1)}K`;
    }
    return `$${val}`;
}

/**
 * Helper: Returns midnight (00:00:00) of "today" and "yesterday" in Argentina local time (UTC-3).
 * This avoids all timezone drift issues from comparing ISO strings.
 */
function getArgentinaDateAnchors() {
    const now = new Date();
    // Build "today 00:00:00" in the runtime's local timezone
    const inicioHoy = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const inicioAyer = new Date(inicioHoy);
    inicioAyer.setDate(inicioAyer.getDate() - 1);
    const inicioManana = new Date(inicioHoy);
    inicioManana.setDate(inicioManana.getDate() + 1);
    return { now, inicioHoy, inicioAyer, inicioManana };
}

const formatDate = (isoString: string) => {
    if (!isoString) return '-';
    const d = new Date(typeof isoString === 'string' ? isoString.replace(' ', 'T') : isoString);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const getTimeElapsed = (entryTime: string) => {
    const diffMs = Date.now() - new Date(entryTime).getTime();
    const diffHrs = Math.floor(diffMs / 3_600_000);
    const diffMins = Math.floor((diffMs % 3_600_000) / 60_000);
    if (diffHrs > 24) return `+${Math.floor(diffHrs / 24)}d`;
    if (diffHrs > 0) return `${diffHrs}h ${diffMins}m`;
    return `${diffMins}m`;
};

// ─────────────────────────────────────────────────────────────
// §3. SVG Chart Components
// ─────────────────────────────────────────────────────────────

function ProgressRing({ percentage, size = 56, strokeWidth = 5 }: { percentage: number; size?: number; strokeWidth?: number }) {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (Math.min(percentage, 100) / 100) * circumference;
    const color = percentage > 85 ? '#ef4444' : percentage > 60 ? '#f59e0b' : '#6366f1';
    return (
        <svg width={size} height={size} className="transform -rotate-90">
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth} />
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
                strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
                className="transition-all duration-1000 ease-out" />
        </svg>
    );
}

function RevenueAreaChart({ data, maxVal }: { data: { day: number; current: number; previous: number; isFuture: boolean }[]; maxVal: number }) {
    if (data.length === 0) return <EmptyChartPlaceholder label="Sin datos de facturación" />;
    const W = 400, H = 200;
    const pad = { top: 24, right: 64, bottom: 30, left: 52 };
    const totalDays = data.length; // always full month (e.g. 31)
    const chartW = W - pad.left - pad.right, chartH = H - pad.top - pad.bottom;
    // Add 10% headroom so floating badges don't clip at the top
    const safeMax = (maxVal || 1) * 1.1;
    const toX = (day: number) => pad.left + ((day - 1) / Math.max(totalDays - 1, 1)) * chartW;
    const toY = (val: number) => pad.top + chartH - (val / safeMax) * chartH;

    // Previous month: full line across ALL days
    const previousPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(d.day).toFixed(2)},${toY(d.previous).toFixed(2)}`).join(' ');

    // Current month: only up to today (filter out future days)
    const currentData = data.filter(d => !d.isFuture);
    const currentPath = currentData.length > 0
        ? currentData.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(d.day).toFixed(2)},${toY(d.current).toFixed(2)}`).join(' ')
        : '';
    const lastCurrent = currentData[currentData.length - 1];
    const firstCurrent = currentData[0];
    const areaPath = currentPath && lastCurrent && firstCurrent
        ? `${currentPath} L${toX(lastCurrent.day).toFixed(2)},${(pad.top + chartH).toFixed(2)} L${toX(firstCurrent.day).toFixed(2)},${(pad.top + chartH).toFixed(2)} Z`
        : '';

    // End-of-line data points for floating badges
    const lastPrevious = data[data.length - 1];
    const todayDay = lastCurrent?.day;

    // Y-axis tick fractions
    const yTicks = [0.25, 0.5, 0.75, 1];

    // X-axis: canonical marks avoiding label collision
    const lastDay = data[data.length - 1]?.day;
    const visibleXDays = data.filter(d =>
        d.day === 1 || d.day === lastDay || (d.day % 5 === 0 && d.day < 30)
    );

    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
            <defs>
                <linearGradient id="areaGradCF" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#a5b4fc" stopOpacity="0.03" />
                </linearGradient>
            </defs>
            {/* Horizontal grid lines + Y-axis labels */}
            {yTicks.map((f, i) => (
                <g key={i}>
                    <line x1={pad.left} x2={W - pad.right} y1={toY(f * safeMax)} y2={toY(f * safeMax)} stroke="#e2e8f0" strokeWidth="0.5" />
                    <text x={pad.left - 6} y={toY(f * safeMax) + 3.5} textAnchor="end" fontSize="9" fill="#94a3b8" fontFamily="monospace">
                        {formatAxisLabel(Math.round(f * safeMax))}
                    </text>
                </g>
            ))}
            {/* Baseline label $0 */}
            <text x={pad.left - 6} y={pad.top + chartH + 3.5} textAnchor="end" fontSize="9" fill="#cbd5e1" fontFamily="monospace">$0</text>

            {/* "HOY" vertical marker line */}
            {todayDay && (
                <g>
                    <line x1={toX(todayDay)} x2={toX(todayDay)} y1={pad.top} y2={pad.top + chartH}
                        stroke="#6366f1" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
                    <text x={toX(todayDay)} y={pad.top - 6} textAnchor="middle" fontSize="8" fill="#6366f1" fontWeight="bold" fontFamily="monospace" opacity="0.7">
                        HOY
                    </text>
                </g>
            )}

            {/* Area fill (current month only, up to today) */}
            {areaPath && <path d={areaPath} fill="url(#areaGradCF)" />}
            {/* Previous month: full dashed line */}
            <path d={previousPath} fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6 3" />
            {/* Current month: solid line up to today */}
            {currentPath && <path d={currentPath} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
            {/* Dots on current line at even intervals */}
            {currentData.filter((_, i) => i % Math.max(1, Math.floor(currentData.length / 8)) === 0 || i === currentData.length - 1).map((d) => (
                <circle key={d.day} cx={toX(d.day)} cy={toY(d.current)} r="3" fill="#6366f1" />
            ))}

            {/* ── Floating badge: Previous month (end of dashed line) ── */}
            {lastPrevious && lastPrevious.previous > 0 && (
                <g>
                    <rect x={toX(lastPrevious.day) + 4} y={toY(lastPrevious.previous) - 8} width={formatAxisLabel(Math.round(lastPrevious.previous)).length * 6.5 + 8} height="16" rx="4"
                        fill="#94a3b8" opacity="0.9" />
                    <text x={toX(lastPrevious.day) + 8} y={toY(lastPrevious.previous) + 3.5} fontSize="8" fill="#fff" fontWeight="bold" fontFamily="monospace">
                        {formatAxisLabel(Math.round(lastPrevious.previous))}
                    </text>
                </g>
            )}

            {/* ── Floating badge: Current month (end of solid line) ── */}
            {lastCurrent && lastCurrent.current > 0 && (
                <g>
                    <rect x={toX(lastCurrent.day) + 4} y={toY(lastCurrent.current) - 8} width={formatAxisLabel(Math.round(lastCurrent.current)).length * 6.5 + 8} height="16" rx="4"
                        fill="#6366f1" />
                    <text x={toX(lastCurrent.day) + 8} y={toY(lastCurrent.current) + 3.5} fontSize="8" fill="#fff" fontWeight="bold" fontFamily="monospace">
                        {formatAxisLabel(Math.round(lastCurrent.current))}
                    </text>
                </g>
            )}

            {/* X-axis day labels: canonical marks only */}
            {visibleXDays.map((d) => (
                <text key={`x-${d.day}`} x={toX(d.day)} y={H - 6} textAnchor="middle" fontSize="10" fill="#64748b" fontFamily="monospace">{d.day}</text>
            ))}
        </svg>
    );
}

const VISIBLE_HOURS = new Set([0, 4, 8, 12, 16, 20, 23]);

function PeakHoursBarChart({ data }: { data: number[] }) {
    const maxVal = Math.max(...data, 1);
    const currentHour = new Date().getHours();
    const W = 400, H = 200;
    const pad = { top: 16, right: 8, bottom: 30, left: 36 };
    const chartH = H - pad.top - pad.bottom;
    const barW = (W - pad.left - pad.right) / 24;
    const gap = barW * 0.1;
    if (data.every(v => v === 0)) return <EmptyChartPlaceholder label="Sin datos de ocupación por hora" />;
    // Compute even Y-axis ticks for car counts (0, 2, 4, 6... or 0, 5, 10, 15...)
    const evenStep = maxVal <= 8 ? 2 : maxVal <= 20 ? 5 : Math.ceil(maxVal / 5 / 5) * 5;
    const yTicks: number[] = [];
    for (let t = evenStep; t <= maxVal + evenStep; t += evenStep) { yTicks.push(t); if (yTicks.length >= 5) break; }
    // Threshold: show value label on bars that reach >= 40% of max
    const labelThreshold = maxVal * 0.4;
    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
            <defs>
                <linearGradient id="barGradCF" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#a5b4fc" />
                </linearGradient>
                <linearGradient id="barHighlightCF" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
            </defs>
            {/* Horizontal grid lines + Y-axis car count labels */}
            {yTicks.map((tick, i) => {
                const yPos = pad.top + chartH - (tick / maxVal) * chartH;
                return (
                    <g key={`yt-${i}`}>
                        <line x1={pad.left} x2={W - pad.right} y1={yPos} y2={yPos} stroke="#e2e8f0" strokeWidth="0.5" />
                        <text x={pad.left - 6} y={yPos + 3.5} textAnchor="end" fontSize="9" fill="#94a3b8" fontFamily="monospace">
                            {tick}
                        </text>
                    </g>
                );
            })}
            {/* Baseline label 0 */}
            <text x={pad.left - 6} y={pad.top + chartH + 3.5} textAnchor="end" fontSize="9" fill="#cbd5e1" fontFamily="monospace">0</text>
            {data.map((val, hour) => {
                const barH = (val / maxVal) * chartH;
                const x = pad.left + hour * barW + gap;
                const y = pad.top + chartH - barH;
                const w = barW - gap * 2;
                const isCurrentHour = hour === currentHour;
                const isPeakHour = val === maxVal && val > 0;
                const showLabel = val >= labelThreshold && val > 0;
                return (
                    <g key={hour}>
                        <rect x={x} y={y} width={Math.max(w, 2)} height={Math.max(barH, 0)} rx="2"
                            fill={isPeakHour ? 'url(#barHighlightCF)' : isCurrentHour ? '#6366f1' : 'url(#barGradCF)'}
                            opacity={val === 0 ? 0.1 : isCurrentHour ? 1 : 0.65}
                            className="transition-all duration-500" />
                        {VISIBLE_HOURS.has(hour) && (
                            <text x={x + w / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="#64748b" fontFamily="monospace">
                                {hour.toString().padStart(2, '0')}
                            </text>
                        )}
                        {isPeakHour ? (
                            <text x={x + w / 2} y={y - 6} textAnchor="middle" fontSize="9" fill="#10b981" fontWeight="bold" fontFamily="monospace">
                                ★ {val}
                            </text>
                        ) : showLabel ? (
                            <text x={x + w / 2} y={y - 4} textAnchor="middle" fontSize="8" fill="#6366f1" fontWeight="600" fontFamily="monospace">
                                {val}
                            </text>
                        ) : null}
                    </g>
                );
            })}
        </svg>
    );
}

function EmptyChartPlaceholder({ label }: { label: string }) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2 py-10">
            <BarChart3 className="h-8 w-8 opacity-20" />
            <p className="text-xs">{label}</p>
        </div>
    );
}

function OperationClock() {
    const [now, setNow] = React.useState(new Date());
    React.useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 30_000);
        return () => clearInterval(t);
    }, []);
    return (
        <div className="flex items-center gap-2 text-xs text-slate-500 font-mono bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden sm:inline text-slate-400">LIVE</span>
            <span className="font-semibold text-slate-700">
                {now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
            </span>
        </div>
    );
}

/** Variation badge component */
function VariationBadge({ value, suffix = '%' }: { value: number; suffix?: string }) {
    if (value === 0) return null;
    const isPositive = value > 0;
    return (
        <span className={cn(
            "inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold tabular-nums",
            isPositive ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
        )}>
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {isPositive ? '+' : ''}{value}{suffix}
        </span>
    );
}


// ─────────────────────────────────────────────────────────────
// §4. Main Component
// ─────────────────────────────────────────────────────────────

export default function CashFlowHub({ garages }: CashFlowHubProps) {
    const { profile } = useAuth();
    const [activeSection, setActiveSection] = useState<ActiveSection>('resumen');
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
    const [eficaciaMonthOffset, setEficaciaMonthOffset] = useState(0);

    // §4a. Data Fetching
    useEffect(() => {
        if (garages.length === 0) { setLoading(false); return; }
        const fetchData = async () => {
            setLoading(true); setError(null);
            setLoadingProgress(0);
            setLoadingStep('Preparando carga...');
            
            const retry = async <T,>(fn: () => Promise<{ data: T | null; error: any }>, retries = 3): Promise<T> => {
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
                        .select('id, amount, type, timestamp, payment_method, plate, garage_id, operator, related_entity_id, ticket_number, invoice_type')
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
                        const res = await retry(() => supabase.from('employee_accounts').select('id, first_name, last_name, garage_id, role').eq('owner_id', profile.id)) || [];
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
                const v = activeVehicles.get(plate.trim().toUpperCase());
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
        });
        return histogram;
    }, [gAllStays]);

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

    const getAmountColor = (type: Movement['type'] | string) => {
        if (type === 'RETIRO' || type === 'EGRESO') return 'text-red-600';
        if (type === 'INGRESO' || type === 'CobroEstadia' || type === 'CobroAbono' || type === 'COBRO' || type === 'CAJA_INICIAL') return 'text-emerald-600';
        return 'text-slate-800';
    };



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
                        <div className="hidden sm:flex items-center bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold font-mono shadow-sm gap-2">
                            <BadgeDollarSign className="h-4 w-4 opacity-70" />
                            {formatCurrency(kpiIngresos.today)}
                        </div>
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
                        {/* KPI Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                            {/* Ingresos Hoy */}
                            <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600"><Wallet className="h-4 w-4" /></div>
                                    <VariationBadge value={kpiIngresos.variation} />
                                </div>
                                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Ingresos Hoy</p>
                                <p className="text-2xl font-bold font-mono text-slate-800 tracking-tight">{formatCurrency(kpiIngresos.today)}</p>
                                <p className="text-[10px] text-slate-400 mt-1">Ayer: {formatCurrency(kpiIngresos.yesterday)}</p>
                            </div>
                            {/* Facturación Mes */}
                            <div onClick={() => setIsHistoryModalOpen(true)}
                                className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-indigo-300 active:scale-[0.98] transition-all cursor-pointer">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600"><TrendingUp className="h-4 w-4" /></div>
                                    <Eye className="h-3.5 w-3.5 text-slate-300" />
                                </div>
                                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Facturación Mes</p>
                                <p className="text-2xl font-bold font-mono text-slate-800 tracking-tight">{formatCurrency(kpiFacturacion.current)}</p>
                                <p className="text-[10px] text-slate-400 mt-1">Anterior: {formatCurrency(kpiFacturacion.previous)}</p>
                            </div>
                            {/* Ocupación */}
                            <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600"><Building2 className="h-4 w-4" /></div>
                                    <ProgressRing percentage={kpiOcupacion.porcentaje} size={36} strokeWidth={3.5} />
                                </div>
                                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Ocupación Real</p>
                                <p className="text-2xl font-bold font-mono text-slate-800 tracking-tight">{kpiOcupacion.porcentaje}%</p>
                                <p className="text-[10px] text-slate-400 mt-1">{kpiOcupacion.ocupadas} / {kpiOcupacion.totalSpots} plazas</p>
                                <p className="text-[9px] text-slate-400">{kpiOcupacion.cocherasOcupadas} fijas + {kpiOcupacion.estadiasActivas} estadías</p>
                            </div>
                            {/* Abonos */}
                            <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="p-2 rounded-lg bg-violet-50 text-violet-600"><CreditCard className="h-4 w-4" /></div>
                                    {/* <VariationBadge value={kpiSubs.subsVariation} /> */}
                                </div>
                                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Abonos Activos</p>
                                <p className="text-2xl font-bold font-mono text-slate-800 tracking-tight">{kpiSubs.total}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] text-emerald-600 flex items-center gap-0.5"><ArrowUpRight className="h-2.5 w-2.5" />{kpiSubs.altas}</span>
                                    <span className="text-[10px] text-red-500 flex items-center gap-0.5"><ArrowDownRight className="h-2.5 w-2.5" />{kpiSubs.bajas}</span>
                                </div>
                            </div>
                            {/* Deuda */}
                            <div onClick={() => kpiDeuda.count > 0 && setIsDebtModalOpen(true)}
                                className={cn("bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all",
                                    kpiDeuda.isAlert ? "border-amber-300" : "border-slate-200/60",
                                    kpiDeuda.count > 0 ? "cursor-pointer hover:border-amber-400 active:scale-[0.98]" : "cursor-default")}>
                                <div className="flex items-center justify-between mb-3">
                                    <div className={cn("p-2 rounded-lg", kpiDeuda.isAlert ? "bg-amber-50 text-amber-600" : "bg-slate-50 text-slate-500")}><AlertCircle className="h-4 w-4" /></div>
                                    {kpiDeuda.count > 0 ? (
                                        <Eye className="h-3.5 w-3.5 text-slate-300" />
                                    ) : kpiDeuda.isAlert ? (
                                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[9px] font-bold uppercase animate-pulse">Alerta</span>
                                    ) : null}
                                </div>
                                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Deuda Pendiente</p>
                                <p className={cn("text-2xl font-bold font-mono tracking-tight", kpiDeuda.isAlert ? "text-amber-700" : "text-slate-800")}>{formatCurrency(kpiDeuda.total)}</p>
                                <p className="text-[10px] text-slate-400 mt-1">{kpiDeuda.count} pendiente{kpiDeuda.count !== 1 ? 's' : ''}</p>
                            </div>
                            {/* Eficacia */}
                            <div onClick={() => setIsEficaciaModalOpen(true)}
                                className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-indigo-300 active:scale-[0.98] transition-all cursor-pointer">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600"><Target className="h-4 w-4" /></div>
                                    <Eye className="h-3.5 w-3.5 text-slate-300" />
                                </div>
                                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Eficacia Cobranza</p>
                                <p className="text-2xl font-bold font-mono text-slate-800 tracking-tight">{kpiEficacia.percentage}%</p>
                                <p className="text-[10px] text-slate-400 mt-1">{formatCurrency(kpiEficacia.monthRev)} / {formatCurrency(kpiEficacia.potencialTotal)}</p>
                            </div>
                        </div>
                        {/* Charts */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
                                <div className="px-5 pt-5 pb-2 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <LineChart className="h-4 w-4 text-indigo-500" />
                                        <h3 className="text-sm font-bold text-slate-700">Facturación Acumulada (MoM)</h3>
                                    </div>
                                    <div className="flex items-center gap-3 text-[10px]">
                                        <span className="flex items-center gap-1 text-slate-500"><span className="w-3 h-0.5 bg-indigo-500 rounded-full inline-block" /> Actual</span>
                                        <span className="flex items-center gap-1 text-slate-400"><span className="w-3 h-0.5 bg-slate-400 rounded-full inline-block" /> Anterior</span>
                                    </div>
                                </div>
                                <div className="h-56 px-3 pb-3"><RevenueAreaChart data={revenueChartData.data} maxVal={revenueChartData.maxVal} /></div>
                            </div>
                            <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
                                <div className="px-5 pt-5 pb-2 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <BarChart3 className="h-4 w-4 text-indigo-500" />
                                        <h3 className="text-sm font-bold text-slate-700">Horas Pico (Hoy)</h3>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px]">
                                        <Clock className="h-3 w-3 text-slate-400" />
                                        <span className="font-mono font-bold text-indigo-600">{new Date().getHours().toString().padStart(2, '0')}:00</span>
                                    </div>
                                </div>
                                <div className="h-56 px-3 pb-3"><PeakHoursBarChart data={peakHoursData} /></div>
                            </div>
                        </div>
                    </div>
                )}


                {/* ══ ANÁLISIS POR SUCURSAL ══ */}
                {activeSection === 'sucursal' && (
                    <div className="animate-in fade-in duration-300 bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-5 pt-5 pb-3 flex items-center gap-2.5 border-b border-slate-100">
                            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600"><GitBranch className="h-4 w-4" /></div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-800">Rendimiento por Sucursal</h3>
                                <p className="text-[10px] text-slate-400">Ingresos del día actual desglosados</p>
                            </div>
                        </div>
                        <div className="overflow-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-[10px] text-slate-500 uppercase bg-slate-50/80 sticky top-0 backdrop-blur-sm">
                                    <tr>
                                        <th className="px-5 py-3 font-semibold">Sucursal</th>
                                        <th className="px-5 py-3 font-semibold text-right">Efectivo</th>
                                        <th className="px-5 py-3 font-semibold text-right">Digital</th>
                                        <th className="px-5 py-3 font-semibold text-right">Total Hoy</th>
                                        <th className="px-5 py-3 font-semibold text-center">Ocupación</th>
                                        <th className="px-5 py-3 font-semibold text-center">Abonos</th>
                                        <th className="px-5 py-3 font-semibold text-right">Deuda</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {branchBreakdown.length === 0 ? (
                                        <tr><td colSpan={7} className="p-12 text-center text-slate-400 text-sm">
                                            <div className="flex flex-col items-center gap-2"><Building2 className="h-8 w-8 opacity-20" /><p>No hay sucursales configuradas.</p></div>
                                        </td></tr>
                                    ) : (
                                        branchBreakdown.map(branch => (
                                            <tr key={branch.id} className="hover:bg-indigo-50/40 transition-colors cursor-default">
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center"><Building2 className="h-4 w-4" /></div>
                                                        <div>
                                                            <p className="font-semibold text-slate-800 text-sm">{branch.name}</p>
                                                            <p className="text-[10px] text-slate-400">{branch.occupied}/{branch.spots} cocheras</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 text-right font-mono font-bold text-slate-700">{formatCurrency(branch.effectivo)}</td>
                                                <td className="px-5 py-4 text-right font-mono font-bold text-slate-700">{formatCurrency(branch.digital)}</td>
                                                <td className="px-5 py-4 text-right font-mono font-bold text-slate-800">{formatCurrency(branch.total)}</td>
                                                <td className="px-5 py-4 text-center">
                                                    <div className="inline-flex items-center gap-2">
                                                        <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                            <div className={cn("h-full rounded-full transition-all", branch.occupancy > 85 ? "bg-red-500" : branch.occupancy > 60 ? "bg-amber-500" : "bg-indigo-500")}
                                                                style={{ width: `${Math.min(branch.occupancy, 100)}%` }} />
                                                        </div>
                                                        <span className="text-xs font-bold font-mono text-slate-600">{branch.occupancy}%</span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 text-center font-mono font-bold text-violet-600">{branch.activeSubs}</td>
                                                <td className="px-5 py-4 text-right">
                                                    <span className={cn("font-mono font-bold text-sm", branch.deuda > 0 ? "text-amber-600" : "text-slate-400")}>{formatCurrency(branch.deuda)}</span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                    {branchBreakdown.length > 1 && (
                                        <tr className="bg-slate-50/80 font-bold border-t border-slate-200">
                                            <td className="px-5 py-3 text-sm text-slate-700">Total General</td>
                                            <td className="px-5 py-3 text-right font-mono text-slate-800">{formatCurrency(branchBreakdown.reduce((a, b) => a + b.effectivo, 0))}</td>
                                            <td className="px-5 py-3 text-right font-mono text-slate-800">{formatCurrency(branchBreakdown.reduce((a, b) => a + b.digital, 0))}</td>
                                            <td className="px-5 py-3 text-right font-mono text-slate-800">{formatCurrency(branchBreakdown.reduce((a, b) => a + b.total, 0))}</td>
                                            <td className="px-5 py-3 text-center"><span className="text-xs font-mono text-slate-600">{(() => { const t = branchBreakdown.reduce((a, b) => a + b.spots, 0); const o = branchBreakdown.reduce((a, b) => a + b.occupied, 0); return t === 0 ? '0%' : `${Math.round((o / t) * 100)}%`; })()}</span></td>
                                            <td className="px-5 py-3 text-center font-mono text-violet-600">{branchBreakdown.reduce((a, b) => a + b.activeSubs, 0)}</td>
                                            <td className="px-5 py-3 text-right font-mono text-amber-700">{formatCurrency(branchBreakdown.reduce((a, b) => a + b.deuda, 0))}</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ══ REGISTRO DE ACTIVIDAD ══ */}
                {activeSection === 'registro' && (
                    <div className="animate-in fade-in duration-300 bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-slate-100">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-lg bg-slate-100 text-slate-600"><List className="h-4 w-4" /></div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800">Registro de Movimientos</h3>
                                    <p className="text-[10px] text-slate-400">{filteredMovements.length} registros</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <GarageFilter />
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
                            <div className="px-5 py-4 bg-slate-50/80 border-b border-slate-100 animate-in slide-in-from-top-2 duration-200">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-xs font-semibold text-slate-600 flex items-center gap-1.5"><Filter className="h-3.5 w-3.5 text-indigo-500" /> Filtros Avanzados</h4>
                                    {Object.values(filters).some(v => v !== '') && (
                                        <button onClick={() => setFilters({ operatorId: '', paymentMethod: '', vehicleType: '', tariffType: '', exactDate: '', startDate: '', endDate: '' })}
                                            className="text-[10px] text-slate-500 hover:text-indigo-600 font-medium transition-colors flex items-center gap-0.5"><X className="h-3 w-3" /> Limpiar</button>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-wider">Operador</label>
                                        <select value={filters.operatorId} onChange={(e) => setFilters(p => ({ ...p, operatorId: e.target.value }))}
                                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/50">
                                            <option value="">Todos</option>
                                            {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-wider">Método Pago</label>
                                        <select value={filters.paymentMethod} onChange={(e) => setFilters(p => ({ ...p, paymentMethod: e.target.value }))}
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
                                        <select value={filters.vehicleType} onChange={(e) => setFilters(p => ({ ...p, vehicleType: e.target.value }))}
                                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/50">
                                            <option value="">Todos</option>
                                            {uniqueVehicleTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-wider">Tipo Tarifa</label>
                                        <select value={filters.tariffType} onChange={(e) => setFilters(p => ({ ...p, tariffType: e.target.value }))}
                                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/50">
                                            <option value="">Todas</option>
                                            <option value="Hora">Hora / Estadía</option>
                                            <option value="Abono">Abono</option>
                                            <option value="Anticipado">Anticipado</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-wider">Fecha Exacta</label>
                                        <input type="date" value={filters.exactDate} onChange={(e) => setFilters(p => ({ ...p, exactDate: e.target.value, startDate: '', endDate: '' }))}
                                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/50" />
                                    </div>
                                    {!filters.exactDate && (
                                        <>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Desde</label>
                                                <input type="date" value={filters.startDate} onChange={(e) => setFilters(p => ({ ...p, startDate: e.target.value }))}
                                                    className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/50" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Hasta</label>
                                                <input type="date" value={filters.endDate} onChange={(e) => setFilters(p => ({ ...p, endDate: e.target.value }))}
                                                    className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/50" />
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Movements Table */}
                        <div className="h-[500px] overflow-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-[10px] text-slate-500 uppercase bg-slate-50/80 sticky top-0 z-10 backdrop-blur-sm border-b border-slate-100">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold">Garaje</th>
                                        <th className="px-4 py-3 font-semibold">Patente</th>
                                        <th className="px-4 py-3 font-semibold">Hora</th>
                                        <th className="px-4 py-3 font-semibold">Descripción</th>
                                        <th className="px-4 py-3 font-semibold">Operador</th>
                                        <th className="px-4 py-3 font-semibold">Método</th>
                                        <th className="px-4 py-3 font-semibold text-right">Monto</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredMovements.length === 0 ? (
                                        <tr><td colSpan={8} className="p-12 text-center text-slate-400 text-sm">
                                            <div className="flex flex-col items-center gap-2"><Inbox className="h-8 w-8 opacity-20" /><p>No hay movimientos en este período.</p></div>
                                        </td></tr>
                                    ) : (
                                        filteredMovements.slice(0, 500).map(move => (
                                            <tr key={move.id} className="hover:bg-indigo-50/40 transition-colors cursor-default">
                                                <td className="px-4 py-3.5"><span className="font-medium text-slate-600 text-xs">{getGarageName(move.garage_id)}</span></td>
                                                <td className="px-4 py-3.5">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold font-mono text-slate-800 tracking-wide">{move.plate || '---'}</span>
                                                        <span className="text-[10px] text-slate-400 uppercase">
                                                            {(move.plate && vehicleTypesMap[move.plate]) ? vehicleTypesMap[move.plate] : (move.vehicle_type || 'Vehículo')}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5 text-left text-xs font-medium">
                                                    {move.type === 'CobroEstadia' && move.related_entity_id && staysLookup[move.related_entity_id] ? (
                                                        <div className="flex flex-col items-start gap-0.5">
                                                            <div className="flex items-center gap-1 text-slate-500 text-[10px]">
                                                                <ArrowUpRight className="h-3 w-3 opacity-60" />
                                                                <span>{formatDate(staysLookup[move.related_entity_id].entry_time)}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1 text-slate-700">
                                                                <ArrowDownRight className="h-3 w-3 opacity-60" />
                                                                <span>{formatDate(staysLookup[move.related_entity_id].exit_time || move.timestamp)}</span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-500">{formatDate(move.timestamp)}</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3.5"><span className="text-xs text-slate-600">---</span></td>
                                                <td className="px-4 py-3.5">
                                                    <span className={cn("text-xs font-medium", (!move.operator || move.operator === 'Sistema') ? "text-slate-400" : "text-slate-600")}>
                                                        {move.operator || 'Sistema'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3.5"><span className="text-xs text-slate-500 font-medium font-mono">{move.payment_method ? move.payment_method.toUpperCase() : '---'}</span></td>
                                                <td className={cn("px-4 py-3.5 text-right font-bold font-mono", getAmountColor(move.type))}>{formatCurrency(move.amount)}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* ══ HISTORY MODAL ══ */}
            {isHistoryModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setIsHistoryModalOpen(false)}>
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />
                    {/* Modal */}
                    <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600"><TrendingUp className="h-4 w-4" /></div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800">Historial de Facturación</h3>
                                    <p className="text-[10px] text-slate-400">Desglose mensual de ingresos</p>
                                </div>
                            </div>
                            <button onClick={() => setIsHistoryModalOpen(false)}
                                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        {/* Content */}
                        <div className="overflow-auto flex-1 px-6 py-3">
                            {monthlyHistory.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                                    <Calendar className="h-8 w-8 opacity-20" />
                                    <p className="text-xs">Sin datos históricos</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {monthlyHistory.map((entry, i) => (
                                        <div key={i} className={cn(
                                            "flex items-center justify-between py-3.5 gap-4",
                                            i === 0 && "bg-indigo-50/40 -mx-6 px-6 rounded-xl"
                                        )}>
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold",
                                                    i === 0 ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"
                                                )}>
                                                    {entry.label.slice(0, 3)}
                                                </div>
                                                <span className={cn("text-sm font-medium truncate",
                                                    i === 0 ? "text-indigo-800 font-semibold" : "text-slate-700"
                                                )}>
                                                    {entry.label}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0">
                                                <span className={cn("text-sm font-bold font-mono tabular-nums",
                                                    i === 0 ? "text-indigo-800" : "text-slate-800"
                                                )}>
                                                    {formatCurrency(entry.total)}
                                                </span>
                                                {!entry.isOldest && <VariationBadge value={entry.variation} />}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ══ DEBT DETAIL MODAL ══ */}
            {isDebtModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setIsDebtModalOpen(false)}>
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />
                    <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-lg bg-amber-50 text-amber-600"><AlertCircle className="h-4 w-4" /></div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800">Detalle de Deudores</h3>
                                    <p className="text-[10px] text-slate-400">{debtDetailList.length} deudor{debtDetailList.length !== 1 ? 'es' : ''}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-lg font-bold font-mono text-amber-700">{formatCurrency(kpiDeuda.total)}</span>
                                <button onClick={() => setIsDebtModalOpen(false)}
                                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                        {/* Content */}
                        <div className="overflow-auto flex-1 px-6 py-3">
                            {debtDetailList.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                                    <AlertCircle className="h-8 w-8 opacity-20" />
                                    <p className="text-xs">No hay deudas pendientes</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {debtDetailList.map((customer, i) => (
                                        <div key={customer.customerId || i} className="bg-slate-50/50 rounded-xl border border-slate-100 p-4">
                                            <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-bold text-slate-800">{customer.customerName}</p>
                                                    {customer.items.length > 1 && (
                                                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[9px] font-bold uppercase">
                                                            {customer.items.length} meses
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-sm font-bold font-mono text-amber-600 tabular-nums">
                                                    {formatCurrency(customer.totalDebt)}
                                                </span>
                                            </div>
                                            <div className="space-y-1.5">
                                                {customer.items.map(item => (
                                                    <div key={item.id} className="flex justify-between items-center text-[10px] text-slate-500">
                                                        <span>{item.monthLabel} - Cochera {item.cocheraNumero}</span>
                                                        <span className="font-mono text-slate-400">{formatCurrency(item.amount)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        {/* Footer */}
                        <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/80 rounded-b-2xl">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Deuda</span>
                            <span className="text-base font-bold font-mono text-amber-700">{formatCurrency(kpiDeuda.total)}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* ══ EFICACIA TIMELINE MODAL ══ */}
            {isEficaciaModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setIsEficaciaModalOpen(false)}>
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />
                    <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600"><Target className="h-4 w-4" /></div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800">Línea de Tiempo - Eficacia</h3>
                                    <p className="text-[10px] text-slate-400 capitalize">{eficaciaTimeline.monthLabel}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                                    <button onClick={() => setEficaciaMonthOffset(prev => prev + 1)} className="p-1.5 rounded hover:bg-white hover:shadow-sm text-slate-500 transition-all">
                                        <ChevronDown className="h-3.5 w-3.5" />
                                    </button>
                                    <span className="text-xs font-semibold px-2 text-slate-600">Meses</span>
                                    <button onClick={() => setEficaciaMonthOffset(prev => Math.max(0, prev - 1))} className="p-1.5 rounded hover:bg-white hover:shadow-sm text-slate-500 transition-all" disabled={eficaciaMonthOffset === 0}>
                                        <ChevronUp className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                                <button onClick={() => setIsEficaciaModalOpen(false)}
                                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                        {/* Content */}
                        <div className="overflow-auto flex-1 px-6 py-3">
                            {eficaciaTimeline.timeline.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                                    <Calendar className="h-8 w-8 opacity-20" />
                                    <p className="text-xs">Sin cobros de abonos en este mes</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    <div className="flex items-center justify-between py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        <span className="w-16">Día</span>
                                        <span className="flex-1 text-right">Recaudado</span>
                                        <span className="w-24 text-right">Acumulado</span>
                                    </div>
                                    {eficaciaTimeline.timeline.map((entry, i) => (
                                        <div key={i} className="flex items-center justify-between py-3.5 gap-4">
                                            <div className="w-16 flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold bg-slate-100 text-slate-600">
                                                    {entry.day}
                                                </div>
                                            </div>
                                            <div className="flex-1 text-right">
                                                <span className="text-sm font-bold font-mono text-emerald-600 tabular-nums">
                                                    +{formatCurrency(entry.total)}
                                                </span>
                                            </div>
                                            <div className="w-24 flex flex-col items-end">
                                                <span className="text-sm font-bold font-mono text-slate-800 tabular-nums">
                                                    {entry.percentage}%
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-mono">
                                                    {formatCurrency(entry.accumulated)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        {/* Footer */}
                        <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/80 rounded-b-2xl">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Potencial Teórico</span>
                            <span className="text-base font-bold font-mono text-slate-700">{formatCurrency(kpiEficacia.potencialTotal)}</span>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

