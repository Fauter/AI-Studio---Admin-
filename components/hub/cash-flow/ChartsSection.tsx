import React from 'react';
import { BarChart3, LineChart, Clock } from 'lucide-react';
import { formatAxisLabel, cn } from './CashFlowShared';
import type { PeakMode } from '../CashFlowHub';

interface ChartsSectionProps {
    revenueChartData: {
        data: { day: number; current: number; previous: number; isFuture: boolean }[];
        maxVal: number;
    };
    peakHoursData: number[];
    peakMode: PeakMode;
    setPeakMode: (mode: PeakMode) => void;
}

function EmptyChartPlaceholder({ label, peakMode }: { label?: string; peakMode?: PeakMode }) {
    let msg = label;
    if (!msg && peakMode) {
        if (peakMode === 'occupancy') msg = "Sin datos de ocupación por hora";
        else if (peakMode === 'entries') msg = "Sin datos de entradas";
        else if (peakMode === 'exits') msg = "Sin datos de salidas";
    }
    return (
        <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2 py-10">
            <BarChart3 className="h-8 w-8 opacity-20" />
            <p className="text-xs">{msg}</p>
        </div>
    );
}

function RevenueAreaChart({ data, maxVal }: { data: { day: number; current: number; previous: number; isFuture: boolean }[]; maxVal: number }) {
    if (data.length === 0) return <EmptyChartPlaceholder label="Sin datos de facturación" />;
    const W = 400, H = 200;
    const pad = { top: 24, right: 64, bottom: 30, left: 52 };
    const totalDays = data.length;
    const chartW = W - pad.left - pad.right, chartH = H - pad.top - pad.bottom;
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
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
            <defs>
                <linearGradient id="areaGradCF" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#a5b4fc" stopOpacity="0.03" />
                </linearGradient>
            </defs>
            {yTicks.map((f, i) => (
                <g key={i}>
                    <line x1={pad.left} x2={W - pad.right} y1={toY(f * safeMax)} y2={toY(f * safeMax)} stroke="#e2e8f0" strokeWidth="0.5" />
                    <text x={pad.left - 6} y={toY(f * safeMax) + 3.5} textAnchor="end" fontSize="9" fill="#94a3b8" fontFamily="monospace">
                        {formatAxisLabel(Math.round(f * safeMax))}
                    </text>
                </g>
            ))}
            <text x={pad.left - 6} y={pad.top + chartH + 3.5} textAnchor="end" fontSize="9" fill="#cbd5e1" fontFamily="monospace">$0</text>

            {todayDay && (
                <g>
                    <line x1={toX(todayDay)} x2={toX(todayDay)} y1={pad.top} y2={pad.top + chartH}
                        stroke="#6366f1" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
                    <text x={toX(todayDay)} y={pad.top - 6} textAnchor="middle" fontSize="8" fill="#6366f1" fontWeight="bold" fontFamily="monospace" opacity="0.7">
                        HOY
                    </text>
                </g>
            )}

            {areaPath && <path d={areaPath} fill="url(#areaGradCF)" />}
            <path d={previousPath} fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6 3" />
            {currentPath && <path d={currentPath} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
            {currentData.filter((_, i) => i % Math.max(1, Math.floor(currentData.length / 8)) === 0 || i === currentData.length - 1).map((d) => (
                <circle key={d.day} cx={toX(d.day)} cy={toY(d.current)} r="3" fill="#6366f1" />
            ))}

            {lastPrevious && lastPrevious.previous > 0 && (
                <g>
                    <rect x={toX(lastPrevious.day) + 4} y={toY(lastPrevious.previous) - 8} width={formatAxisLabel(Math.round(lastPrevious.previous)).length * 6.5 + 8} height="16" rx="4"
                        fill="#94a3b8" opacity="0.9" />
                    <text x={toX(lastPrevious.day) + 8} y={toY(lastPrevious.previous) + 3.5} fontSize="8" fill="#fff" fontWeight="bold" fontFamily="monospace">
                        {formatAxisLabel(Math.round(lastPrevious.previous))}
                    </text>
                </g>
            )}

            {lastCurrent && lastCurrent.current > 0 && (
                <g>
                    <rect x={toX(lastCurrent.day) + 4} y={toY(lastCurrent.current) - 8} width={formatAxisLabel(Math.round(lastCurrent.current)).length * 6.5 + 8} height="16" rx="4"
                        fill="#6366f1" />
                    <text x={toX(lastCurrent.day) + 8} y={toY(lastCurrent.current) + 3.5} fontSize="8" fill="#fff" fontWeight="bold" fontFamily="monospace">
                        {formatAxisLabel(Math.round(lastCurrent.current))}
                    </text>
                </g>
            )}

            {visibleXDays.map((d) => (
                <text key={`x-${d.day}`} x={toX(d.day)} y={H - 6} textAnchor="middle" fontSize="10" fill="#64748b" fontFamily="monospace">{d.day}</text>
            ))}
        </svg>
    );
}

const VISIBLE_HOURS = new Set([0, 4, 8, 12, 16, 20, 23]);

function PeakHoursBarChart({ data, peakMode }: { data: number[]; peakMode: PeakMode }) {
    const maxVal = Math.max(...data, 1);
    const currentHour = new Date().getHours();
    const W = 400, H = 200;
    const pad = { top: 16, right: 8, bottom: 30, left: 36 };
    const chartH = H - pad.top - pad.bottom;
    const barW = (W - pad.left - pad.right) / 24;
    const gap = barW * 0.1;
    if (data.every(v => v === 0)) return <EmptyChartPlaceholder peakMode={peakMode} />;
    
    const evenStep = maxVal <= 8 ? 2 : maxVal <= 20 ? 5 : Math.ceil(maxVal / 5 / 5) * 5;
    const yTicks: number[] = [];
    for (let t = evenStep; t <= maxVal + evenStep; t += evenStep) { yTicks.push(t); if (yTicks.length >= 5) break; }
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
            <text x={pad.left - 6} y={pad.top + chartH + 3.5} textAnchor="end" fontSize="9" fill="#cbd5e1" fontFamily="monospace">0</text>
            {data.map((val, hour) => {
                const barH = (val / maxVal) * chartH;
                const x = pad.left + hour * barW + gap;
                const y = pad.top + chartH - barH;
                const w = barW - gap * 2;
                const isCurrentHour = hour === currentHour;
                const isPeakHour = val === maxVal && val > 0;
                const isPlateauStart = isPeakHour && (hour === 0 || data[hour - 1] < maxVal);
                const showLabel = val >= labelThreshold && val > 0;
                
                const gradId = peakMode === 'occupancy' ? 'url(#barGradCF)' : peakMode === 'entries' ? 'url(#barGradEntries)' : 'url(#barGradExits)';
                const highlightId = peakMode === 'occupancy' ? 'url(#barHighlightCF)' : peakMode === 'entries' ? 'url(#barHighlightEntries)' : 'url(#barHighlightExits)';
                const currentHourColor = peakMode === 'occupancy' ? '#6366f1' : peakMode === 'entries' ? '#3b82f6' : '#f43f5e';
                const labelColor = peakMode === 'occupancy' ? '#6366f1' : peakMode === 'entries' ? '#3b82f6' : '#f43f5e';
                const peakLabelColor = peakMode === 'occupancy' ? '#10b981' : peakMode === 'entries' ? '#f59e0b' : '#f97316';

                return (
                    <g key={hour}>
                        <rect x={x} y={y} width={Math.max(w, 2)} height={Math.max(barH, 0)} rx="2"
                            fill={isPeakHour ? highlightId : isCurrentHour ? currentHourColor : gradId}
                            opacity={val === 0 ? 0.1 : isCurrentHour ? 1 : 0.65}
                            className="transition-all duration-500" />
                        {VISIBLE_HOURS.has(hour) && (
                            <text x={x + w / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="#64748b" fontFamily="monospace">
                                {hour.toString().padStart(2, '0')}
                            </text>
                        )}
                        {isPeakHour ? (
                            <text x={x + w / 2} y={y - 6} textAnchor="middle" fontSize="9" fill={peakLabelColor} fontWeight="bold" fontFamily="monospace">
                                {isPlateauStart ? '★ ' : ''}{val}
                            </text>
                        ) : showLabel ? (
                            <text x={x + w / 2} y={y - 4} textAnchor="middle" fontSize="8" fill={labelColor} fontWeight="600" fontFamily="monospace">
                                {val}
                            </text>
                        ) : null}
                    </g>
                );
            })}
        </svg>
    );
}

export default function ChartsSection({ revenueChartData, peakHoursData, peakMode, setPeakMode }: ChartsSectionProps) {
    return (
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
                <div className="h-56 px-3 pb-3">
                    <RevenueAreaChart data={revenueChartData.data} maxVal={revenueChartData.maxVal} />
                </div>
            </div>
            <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 pt-5 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-indigo-500" />
                        <h3 className="text-sm font-bold text-slate-700">Horas Pico (Hoy)</h3>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/60">
                            {(['occupancy', 'entries', 'exits'] as PeakMode[]).map((mode) => {
                                const isSelected = peakMode === mode;
                                const label = mode === 'occupancy' ? 'Ocupación' : mode === 'entries' ? 'Entradas' : 'Salidas';
                                return (
                                    <button
                                        key={mode}
                                        onClick={() => setPeakMode(mode)}
                                        className={cn(
                                            "px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all duration-200",
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
                        <div className="hidden sm:flex items-center gap-1.5 text-[10px]">
                            <Clock className="h-3 w-3 text-slate-400" />
                            <span className="font-mono font-bold text-indigo-600">{new Date().getHours().toString().padStart(2, '0')}:00</span>
                        </div>
                    </div>
                </div>
                <div className="h-56 px-3 pb-3">
                    <PeakHoursBarChart data={peakHoursData} peakMode={peakMode} />
                </div>
            </div>
        </div>
    );
}
