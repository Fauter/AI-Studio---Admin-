import React, { useState, useEffect, useRef } from 'react';
import { BarChart3, LineChart, Clock } from 'lucide-react';
import { formatAxisLabel, cn, PeakPeriod, ChartView, PeakMode } from './CashFlowShared';

interface ChartsSectionProps {
    revenueChartData: {
        data: { day: number; current: number; previous: number; isFuture: boolean }[];
        maxVal: number;
    };
    peakHoursData: number[];
    peakHoursLabels?: string[];
    peakMode: PeakMode;
    setPeakMode: (mode: PeakMode) => void;
    peakPeriod: PeakPeriod;
    setPeakPeriod: (period: PeakPeriod) => void;
    historicalChartView: ChartView;
    setHistoricalChartView: (view: ChartView) => void;
    loadingPeakStays?: boolean;
}

function useContainerDimensions() {
    const ref = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const elem = ref.current;
        if (!elem) return;
        const observer = new ResizeObserver((entries) => {
            if (entries[0]) {
                const { width, height } = entries[0].contentRect;
                if (width > 0 && height > 0) {
                    setDimensions({ width, height });
                }
            }
        });
        observer.observe(elem);
        return () => observer.disconnect();
    }, []);

    return { ref, dimensions };
}

function EmptyChartPlaceholder({ label, peakMode, loading }: { label?: string; peakMode?: PeakMode; loading?: boolean }) {
    if (loading) {
        return (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-indigo-500/80">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-2"></div>
                <p className="text-xs font-medium">Cargando historial...</p>
            </div>
        );
    }
    let msg = label;
    if (!msg && peakMode) {
        if (peakMode === 'occupancy') msg = "Sin datos de ocupación";
        else if (peakMode === 'entries') msg = "Sin entradas registradas";
        else if (peakMode === 'exits') msg = "Sin salidas registradas";
    }
    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
            <BarChart3 className="h-8 w-8 mb-2 opacity-20" />
            <p className="text-xs font-medium">{msg}</p>
        </div>
    );
}

function RevenueAreaChart({ data, maxVal }: { data: { day: number; current: number; previous: number; isFuture: boolean }[]; maxVal: number }) {
    const { ref, dimensions } = useContainerDimensions();
    const { width: W, height: H } = dimensions;

    if (data.length === 0) {
        return (
            <div ref={ref} className="w-full h-full relative">
                <EmptyChartPlaceholder label="Sin datos de facturación" />
            </div>
        );
    }
    
    if (W === 0 || H === 0) {
        return <div ref={ref} className="w-full h-full relative" />;
    }

    const pad = { top: 24, right: 64, bottom: 30, left: 52 };
    const totalDays = data.length;
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;
    const safeMax = (maxVal || 1) * 1.1;
    const toX = (day: number) => pad.left + ((day - 1) / Math.max(totalDays - 1, 1)) * chartW;
    const toY = (val: number) => pad.top + chartH - (val / safeMax) * chartH;

    const previousPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(d.day).toFixed(2)},${toY(d.previous).toFixed(2)}`).join(' ');

    const currentData = data.filter(d => !d.isFuture);
    const currentPath = currentData.length > 0
        ? currentData.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(d.day).toFixed(2)},${toY(d.current).toFixed(2)}`).join(' ')
        : '';
    const lastCurrent = currentData[currentData.length - 1];
    const firstCurrent = currentData[0];
    const areaPath = currentPath && lastCurrent && firstCurrent
        ? `${currentPath} L${toX(lastCurrent.day).toFixed(2)},${(pad.top + chartH).toFixed(2)} L${toX(firstCurrent.day).toFixed(2)},${(pad.top + chartH).toFixed(2)} Z`
        : '';

    const lastPrevious = data[data.length - 1];
    const todayDay = lastCurrent?.day;

    const yTicks = [0.25, 0.5, 0.75, 1];

    const lastDay = data[data.length - 1]?.day;
    const visibleXDays = data.filter(d =>
        d.day === 1 || d.day === lastDay || (d.day % 5 === 0 && d.day < 30)
    );

    return (
        <div ref={ref} className="w-full h-full relative">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full block">
                <defs>
                    <linearGradient id="areaGradCF" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#a5b4fc" stopOpacity="0.03" />
                    </linearGradient>
                </defs>
                {yTicks.map((f, i) => (
                    <g key={i}>
                        <line x1={pad.left} x2={W - pad.right} y1={toY(f * safeMax)} y2={toY(f * safeMax)} stroke="#e2e8f0" strokeWidth="0.5" />
                        <text x={pad.left - 6} y={toY(f * safeMax) + 3.5} textAnchor="end" fontSize="10" fill="#94a3b8" fontFamily="monospace">
                            {formatAxisLabel(Math.round(f * safeMax))}
                        </text>
                    </g>
                ))}
                <text x={pad.left - 6} y={pad.top + chartH + 3.5} textAnchor="end" fontSize="10" fill="#cbd5e1" fontFamily="monospace">$0</text>

                {todayDay && (
                    <g>
                        <line x1={toX(todayDay)} x2={toX(todayDay)} y1={pad.top} y2={pad.top + chartH}
                            stroke="#6366f1" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
                        <text x={toX(todayDay)} y={pad.top - 6} textAnchor="middle" fontSize="9" fill="#6366f1" fontWeight="bold" fontFamily="monospace" opacity="0.7">
                            HOY
                        </text>
                    </g>
                )}

                {areaPath && <path d={areaPath} fill="url(#areaGradCF)" />}
                <path d={previousPath} fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6 3" />
                {currentPath && <path d={currentPath} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
                {currentData.filter((_, i) => i % Math.max(1, Math.floor(currentData.length / 8)) === 0 || i === currentData.length - 1).map((d) => (
                    <circle key={d.day} cx={toX(d.day)} cy={toY(d.current)} r="3.5" fill="#6366f1" />
                ))}

                {lastPrevious && lastPrevious.previous > 0 && (
                    <g>
                        <rect x={toX(lastPrevious.day) + 4} y={toY(lastPrevious.previous) - 9} width={formatAxisLabel(Math.round(lastPrevious.previous)).length * 7 + 8} height="18" rx="4"
                            fill="#94a3b8" opacity="0.9" />
                        <text x={toX(lastPrevious.day) + 8} y={toY(lastPrevious.previous) + 4} fontSize="9" fill="#fff" fontWeight="bold" fontFamily="monospace">
                            {formatAxisLabel(Math.round(lastPrevious.previous))}
                        </text>
                    </g>
                )}

                {lastCurrent && lastCurrent.current > 0 && (
                    <g>
                        <rect x={toX(lastCurrent.day) + 4} y={toY(lastCurrent.current) - 9} width={formatAxisLabel(Math.round(lastCurrent.current)).length * 7 + 8} height="18" rx="4"
                            fill="#6366f1" />
                        <text x={toX(lastCurrent.day) + 8} y={toY(lastCurrent.current) + 4} fontSize="9" fill="#fff" fontWeight="bold" fontFamily="monospace">
                            {formatAxisLabel(Math.round(lastCurrent.current))}
                        </text>
                    </g>
                )}

                {visibleXDays.map((d) => (
                    <text key={`x-${d.day}`} x={toX(d.day)} y={H - 6} textAnchor="middle" fontSize="11" fill="#64748b" fontFamily="monospace">{d.day}</text>
                ))}
            </svg>
        </div>
    );
}

const VISIBLE_HOURS = new Set([0, 4, 8, 12, 16, 20, 23]);

function PeakHoursBarChart({ data, peakMode, labels, peakPeriod, historicalChartView, loading }: { data: number[]; peakMode: PeakMode; labels?: string[]; peakPeriod?: PeakPeriod; historicalChartView?: ChartView; loading?: boolean }) {
    const { ref, dimensions } = useContainerDimensions();
    const { width: W, height: H } = dimensions;

    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [pinnedIndex, setPinnedIndex] = useState<number | null>(null);
    
    if (loading || data.every(v => v === 0)) {
        return (
            <div ref={ref} className="w-full h-full relative">
                <EmptyChartPlaceholder peakMode={peakMode} loading={loading} />
            </div>
        );
    }
    
    if (W === 0 || H === 0) {
        return <div ref={ref} className="w-full h-full relative" />;
    }

    const actualDataMax = Math.max(...data);
    const dataMax = Math.max(actualDataMax, 1);
    const currentHour = new Date().getHours();
    
    const pad = { top: 24, right: 16, bottom: 30, left: 24 };
    const chartH = H - pad.top - pad.bottom;
    const barW = (W - pad.left - pad.right) / Math.max(data.length, 1);
    const gap = data.length > 30 ? Math.max(0.5, barW * 0.05) : barW * 0.1;
    
    const visibleXIndices = new Set<number>();
    if (labels) {
        const count = data.length;
        if (count <= 7) {
            for (let i = 0; i < count; i++) visibleXIndices.add(i);
        } else {
            const targetVisible = 6;
            const step = Math.max(1, Math.round((count - 1) / (targetVisible - 1)));
            visibleXIndices.add(0);
            visibleXIndices.add(count - 1);
            for (let i = step; i < count - 1; i += step) {
                if (count - 1 - i >= step * 0.5) visibleXIndices.add(i);
            }
        }
    } else {
        VISIBLE_HOURS.forEach(h => visibleXIndices.add(h));
    }
    
    const evenStep = dataMax <= 8 ? 2 : dataMax <= 20 ? 5 : Math.ceil(dataMax / 5 / 5) * 5;
    const yTicks: number[] = [];
    for (let t = evenStep; t <= dataMax + evenStep; t += evenStep) { yTicks.push(t); if (yTicks.length >= 5) break; }
    
    const plotMax = Math.max(dataMax, yTicks.length > 0 ? yTicks[yTicks.length - 1] : dataMax);
    
    const peakIndex = data.indexOf(actualDataMax);
    const minLabelSpace = 20;
    const labelStep = Math.max(1, Math.ceil(minLabelSpace / barW));

    const activeIndex = pinnedIndex !== null ? pinnedIndex : hoveredIndex;
    let tooltipNode = null;

    if (activeIndex !== null && data[activeIndex] !== undefined) {
        const val = data[activeIndex];
        const isPeak = val === actualDataMax && val > 0;
        const activeX = pad.left + activeIndex * barW + barW / 2;
        const activeBarH = (val / plotMax) * chartH;
        const activeY = pad.top + chartH - activeBarH;
        
        const leftPercent = (activeX / W) * 100;
        const topPercent = (activeY / H) * 100;
        
        let dateText = "";
        if (peakPeriod === "today" || historicalChartView === "hourly-profile") {
            dateText = `${activeIndex.toString().padStart(2, "0")}:00 – ${(activeIndex + 1).toString().padStart(2, "0")}:00`;
        } else if (labels && labels[activeIndex]) {
            const [d, m] = labels[activeIndex].split("/");
            const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
            dateText = `${d} de ${months[parseInt(m, 10) - 1] || m}`;
        }
        
        const metricName = peakMode === "occupancy" ? "Ocupación" : peakMode === "entries" ? "Entradas" : "Salidas";
        const vehiclesText = val === 1 ? "1 vehículo" : `${val} vehículos`;
        
        tooltipNode = (
            <div className="absolute z-10 pointer-events-none transition-all duration-200"
                 style={{ left: `${leftPercent}%`, top: `${topPercent}%`, transform: topPercent < 30 ? "translateX(-50%) translateY(8px)" : "translateX(-50%) translateY(calc(-100% - 8px))" }}>
                <div className="bg-white border border-slate-200 shadow-md rounded-md px-3 py-2 flex flex-col min-w-[130px] whitespace-nowrap">
                    <span className="text-[11px] font-semibold text-slate-600 mb-1">{dateText}</span>
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] text-slate-500">{metricName}</span>
                        <span className="text-xs font-bold font-mono text-slate-800">{vehiclesText}</span>
                    </div>
                    {isPeak && (
                        <div className="mt-1 pt-1 border-t border-slate-100">
                            <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1">★ Pico del período</span>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div ref={ref} className="relative w-full h-full">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full outline-none block" onClick={(e) => { if (e.target === e.currentTarget) setPinnedIndex(null); }}>
                <defs>
                    <linearGradient id="barGradCF" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#a5b4fc" />
                    </linearGradient>
                    <linearGradient id="barHighlightCF" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34d399" />
                        <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>

                    <linearGradient id="barGradEntries" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#93c5fd" />
                    </linearGradient>
                    <linearGradient id="barHighlightEntries" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fbbf24" />
                        <stop offset="100%" stopColor="#f59e0b" />
                    </linearGradient>

                    <linearGradient id="barGradExits" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f43f5e" />
                        <stop offset="100%" stopColor="#fda4af" />
                    </linearGradient>
                    <linearGradient id="barHighlightExits" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fb923c" />
                        <stop offset="100%" stopColor="#f97316" />
                    </linearGradient>
                </defs>
                <rect x="0" y="0" width={W} height={H} fill="transparent" onClick={() => setPinnedIndex(null)} />
                
                {yTicks.map((tick, i) => {
                    const yPos = pad.top + chartH - (tick / plotMax) * chartH;
                    return (
                        <g key={`yt-${i}`} className="pointer-events-none">
                            <line x1={pad.left} x2={W - pad.right} y1={yPos} y2={yPos} stroke="#e2e8f0" strokeWidth="0.5" />
                            <text x={pad.left - 6} y={yPos + 3.5} textAnchor="end" fontSize="10" fill="#94a3b8" fontFamily="monospace">
                                {tick}
                            </text>
                        </g>
                    );
                })}
                <text x={pad.left - 6} y={pad.top + chartH + 3.5} textAnchor="end" fontSize="10" fill="#cbd5e1" fontFamily="monospace">0</text>
                
                {data.map((val, hour) => {
                    const barH = (val / plotMax) * chartH;
                    const x = pad.left + hour * barW + gap;
                    const y = pad.top + chartH - barH;
                    const w = barW - gap * 2;
                    const isCurrentHour = (peakPeriod === "today" || historicalChartView === "hourly-profile") && hour === currentHour;
                    const isPeakHour = val === actualDataMax && val > 0;
                    const isVisibleLabel = visibleXIndices.has(hour);
                    const isHovered = activeIndex === hour;
                    
                    const showNumLabel = isPeakHour || (val > 0 && Math.abs(hour - peakIndex) % labelStep === 0);
                    
                    const gradId = peakMode === "occupancy" ? "url(#barGradCF)" : peakMode === "entries" ? "url(#barGradEntries)" : "url(#barGradExits)";
                    const highlightId = peakMode === "occupancy" ? "url(#barHighlightCF)" : peakMode === "entries" ? "url(#barHighlightEntries)" : "url(#barHighlightExits)";
                    const currentHourColor = peakMode === "occupancy" ? "#6366f1" : peakMode === "entries" ? "#3b82f6" : "#f43f5e";
                    const labelColor = peakMode === "occupancy" ? "#6366f1" : peakMode === "entries" ? "#3b82f6" : "#f43f5e";
                    const peakLabelColor = peakMode === "occupancy" ? "#10b981" : peakMode === "entries" ? "#f59e0b" : "#f97316";

                    return (
                        <g key={hour} 
                           onMouseEnter={() => setHoveredIndex(hour)}
                           onMouseLeave={() => setHoveredIndex(null)}
                           onClick={(e) => { e.stopPropagation(); setPinnedIndex(pinnedIndex === hour ? null : hour); }}
                           className="cursor-pointer outline-none"
                           tabIndex={0}
                           onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setPinnedIndex(pinnedIndex === hour ? null : hour); if (e.key === "Escape") setPinnedIndex(null); }}
                        >
                            <rect x={pad.left + hour * barW} y={pad.top} width={barW} height={chartH} fill="transparent" />
                            
                            <rect x={x} y={y} width={Math.max(w, 2)} height={Math.max(barH, 0)} rx="2"
                                fill={isPeakHour ? highlightId : isCurrentHour ? currentHourColor : gradId}
                                opacity={val === 0 ? 0.1 : isHovered ? 0.85 : isCurrentHour ? 1 : 0.65}
                                className="transition-all duration-200" />
                                
                            {isVisibleLabel && (
                                <text x={x + w / 2} y={H - 8} textAnchor="middle" fontSize="11" fill={isHovered ? "#334155" : "#64748b"} fontWeight={isHovered ? "bold" : "normal"} fontFamily="monospace" className="pointer-events-none transition-colors">
                                    {labels ? labels[hour] : hour.toString().padStart(2, "0")}
                                </text>
                            )}
                            
                            {showNumLabel && (
                                <text x={x + w / 2} y={y - 6} textAnchor="middle" fontSize={isPeakHour ? (barW < 12 ? "9" : "10") : "9"} fill={isPeakHour ? peakLabelColor : labelColor} fontWeight={isPeakHour ? "bold" : "600"} fontFamily="monospace" className="pointer-events-none">
                                    {isPeakHour && barW > 14 ? "★ " : ""}{val}
                                </text>
                            )}
                        </g>
                    );
                })}
            </svg>
            {tooltipNode}
        </div>
    );
}

export default function ChartsSection({ revenueChartData, peakHoursData, peakHoursLabels, peakMode, setPeakMode, peakPeriod, setPeakPeriod, historicalChartView, setHistoricalChartView, loadingPeakStays }: ChartsSectionProps) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                <div className="px-5 pt-5 pb-2 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <LineChart className="h-4 w-4 text-indigo-500" />
                        <h3 className="text-sm font-bold text-slate-700">Facturación Acumulada (MoM)</h3>
                    </div>
                    <div className="flex items-center gap-3 text-[10px]">
                        <span className="flex items-center gap-1 text-slate-500"><span className="w-3 h-0.5 bg-indigo-500 rounded-full inline-block" /> Actual</span>
                        <span className="flex items-center gap-1 text-slate-400"><span className="w-3 h-0.5 bg-slate-400 rounded-full inline-block" /> Anterior</span>
                    </div>
                </div>
                <div className="h-[280px] px-3 pb-3 relative grow">
                    <RevenueAreaChart data={revenueChartData.data} maxVal={revenueChartData.maxVal} />
                </div>
            </div>
            
            <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                <div className="px-5 pt-5 pb-2 flex items-center justify-between overflow-x-auto no-scrollbar shrink-0">
                    <div className="flex items-center gap-2 mr-2 shrink-0">
                        <BarChart3 className="h-4 w-4 text-indigo-500" />
                        <h3 className="text-sm font-bold text-slate-700 whitespace-nowrap">Horas Pico</h3>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <select value={peakPeriod} onChange={(e) => {
                            const p = e.target.value as PeakPeriod;
                            setPeakPeriod(p);
                            if (p === 'today') setHistoricalChartView('historical');
                        }} className="text-[10px] py-1 pl-2 pr-6 border-slate-200 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 h-[26px]">
                            <option value="today">Hoy</option>
                            <option value="7_days">Últimos 7 días</option>
                            <option value="15_days">Últimos 15 días</option>
                            <option value="30_days">Últimos 30 días</option>
                            <option value="60_days">Últimos 60 días</option>
                            <option value="90_days">Últimos 90 días</option>
                        </select>
                        <div className="flex items-center bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/60 shrink-0">
                            {(['occupancy', 'entries', 'exits'] as PeakMode[]).map((mode) => {
                                const isSelected = peakMode === mode;
                                const label = mode === 'occupancy' ? 'Ocupación' : mode === 'entries' ? 'Entradas' : 'Salidas';
                                return (
                                    <button
                                        key={mode}
                                        onClick={() => setPeakMode(mode)}
                                        className={cn(
                                            "px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all duration-200 whitespace-nowrap",
                                            isSelected 
                                                ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/50" 
                                                : "text-slate-500 hover:text-slate-700"
                                        )}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                        <label className={cn("flex items-center gap-1.5 text-[10px] select-none h-[26px] px-2 rounded-md transition-colors whitespace-nowrap shrink-0", peakPeriod === 'today' ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-slate-50 border border-slate-200")}>
                            <input type="checkbox" disabled={peakPeriod === 'today'} checked={historicalChartView === 'hourly-profile'} onChange={(e) => setHistoricalChartView(e.target.checked ? 'hourly-profile' : 'historical')} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3 h-3 cursor-pointer" />
                            <span className="font-semibold text-slate-600">Patrón Horario</span>
                        </label>
                    </div>
                </div>
                <div className="h-[280px] px-3 pb-3 relative grow">
                    <PeakHoursBarChart data={peakHoursData} peakMode={peakMode} labels={peakHoursLabels} peakPeriod={peakPeriod} historicalChartView={historicalChartView} loading={loadingPeakStays} />
                </div>
            </div>
        </div>
    );
}
