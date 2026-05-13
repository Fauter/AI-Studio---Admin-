import React from 'react';
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';
import { TrendingUp, TrendingDown } from 'lucide-react';

export function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

// ─────────────────────────────────────────────────────────────
// §1. Type Definitions
// ─────────────────────────────────────────────────────────────

export interface Movement {
    id: string;
    garage_id: string;
    type: 'CobroEstadia' | 'CobroAbono' | 'INGRESO' | 'EGRESO' | 'COBRO' | 'PAGO' | 'CAJA_INICIAL' | 'RETIRO' | string;
    plate?: string;
    amount: number;
    payment_method?: string;
    timestamp: string;
    ticket_number?: string;
    operator?: string;
    related_entity_id?: string | null;
    invoice_type?: string | null;
    vehicle_type?: string;
    notes?: string;
}

export interface Stay {
    id: string;
    garage_id: string;
    plate: string;
    entry_time: string;
    exit_time?: string;
    vehicle_type: string;
    active: boolean;
}

export interface Subscription {
    id: string;
    garage_id: string;
    customer_id?: string;
    start_date?: string;
    end_date?: string;
    active?: boolean;
    price?: number;
    type?: string;
}

export interface Debt {
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

export interface Cochera {
    id: string;
    garage_id: string;
    tipo: string;
    status: 'Ocupada' | 'Libre';
    numero?: string;
    cliente_id?: string;
    vehiculos?: string[];
    precio_base?: number;
}

export type ActiveSection = 'resumen' | 'sucursal' | 'registro';

// ─────────────────────────────────────────────────────────────
// §2. Format Utilities
// ─────────────────────────────────────────────────────────────

export const arsFormatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 });
export const formatCurrency = (amount: number) => arsFormatter.format(amount);

/** Compact axis label with smart decimals: 683000 → "$683K", 37900000 → "$37.9M" */
export function formatAxisLabel(val: number): string {
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
export function getArgentinaDateAnchors() {
    const now = new Date();
    // Build "today 00:00:00" in the runtime's local timezone
    const inicioHoy = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const inicioAyer = new Date(inicioHoy);
    inicioAyer.setDate(inicioAyer.getDate() - 1);
    const inicioManana = new Date(inicioHoy);
    inicioManana.setDate(inicioManana.getDate() + 1);
    return { now, inicioHoy, inicioAyer, inicioManana };
}

export const formatDate = (isoString: string) => {
    if (!isoString) return '-';
    const d = new Date(typeof isoString === 'string' ? isoString.replace(' ', 'T') : isoString);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const getTimeElapsed = (entryTime: string) => {
    const diffMs = Date.now() - new Date(entryTime).getTime();
    const diffHrs = Math.floor(diffMs / 3_600_000);
    const diffMins = Math.floor((diffMs % 3_600_000) / 60_000);
    if (diffHrs > 24) return `+${Math.floor(diffHrs / 24)}d`;
    if (diffHrs > 0) return `${diffHrs}h ${diffMins}m`;
    return `${diffMins}m`;
};

export const getAmountColor = (type: Movement['type'] | string) => {
    if (type === 'RETIRO' || type === 'EGRESO') return 'text-red-600';
    if (type === 'INGRESO' || type === 'CobroEstadia' || type === 'CobroAbono' || type === 'COBRO' || type === 'CAJA_INICIAL') return 'text-emerald-600';
    return 'text-slate-800';
};

// ─────────────────────────────────────────────────────────────
// §3. Shared UI Components
// ─────────────────────────────────────────────────────────────

export function ProgressRing({ percentage, size = 56, strokeWidth = 5 }: { percentage: number; size?: number; strokeWidth?: number }) {
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

export function VariationBadge({ value, suffix = '%' }: { value: number; suffix?: string }) {
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

export function OperationClock() {
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
