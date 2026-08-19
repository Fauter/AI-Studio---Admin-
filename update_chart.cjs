
const fs = require("fs");

let code = fs.readFileSync("components/hub/cash-flow/ChartsSection.tsx", "utf8");

// We need to replace the entire PeakHoursBarChart function
const startTag = "function PeakHoursBarChart({";
const endTag = "export default function ChartsSection";

const startIndex = code.indexOf(startTag);
const endIndex = code.indexOf(endTag);

const newChart = `function PeakHoursBarChart({ data, peakMode, labels, peakPeriod, historicalChartView, loading }: { data: number[]; peakMode: PeakMode; labels?: string[]; peakPeriod?: PeakPeriod; historicalChartView?: ChartView; loading?: boolean }) {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [pinnedIndex, setPinnedIndex] = useState<number | null>(null);
    
    const dataMax = Math.max(...data, 1);
    const currentHour = new Date().getHours();
    const W = 400, H = 200;
    const pad = { top: 24, right: 4, bottom: 30, left: 24 };
    const chartH = H - pad.top - pad.bottom;
    const barW = (W - pad.left - pad.right) / Math.max(data.length, 1);
    const gap = data.length > 30 ? Math.max(0.5, barW * 0.05) : barW * 0.1;
    
    if (loading || data.every(v => v === 0)) return <EmptyChartPlaceholder peakMode={peakMode} loading={loading} />;
    
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
    
    const peakIndex = data.indexOf(Math.max(...data));
    const minLabelSpace = 18;
    const labelStep = Math.max(1, Math.ceil(minLabelSpace / barW));

    const activeIndex = pinnedIndex !== null ? pinnedIndex : hoveredIndex;
    let tooltipNode = null;

    if (activeIndex !== null && data[activeIndex] !== undefined) {
        const val = data[activeIndex];
        const isPeak = val === Math.max(...data) && val > 0;
        const activeX = pad.left + activeIndex * barW + barW / 2;
        const activeBarH = (val / plotMax) * chartH;
        const activeY = pad.top + chartH - activeBarH;
        
        const leftPercent = (activeX / W) * 100;
        const topPercent = (activeY / H) * 100;
        
        let dateText = "";
        if (peakPeriod === "today" || historicalChartView === "hourly-profile") {
            dateText = \`\${activeIndex.toString().padStart(2, "0")}:00 – \${(activeIndex + 1).toString().padStart(2, "0")}:00\`;
        } else if (labels && labels[activeIndex]) {
            const [d, m] = labels[activeIndex].split("/");
            const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
            dateText = \`\${d} de \${months[parseInt(m, 10) - 1] || m}\`;
        }
        
        const metricName = peakMode === "occupancy" ? "Ocupación" : peakMode === "entries" ? "Entradas" : "Salidas";
        const vehiclesText = val === 1 ? "1 vehículo" : \`\${val} vehículos\`;
        
        tooltipNode = (
            <div className="absolute z-10 pointer-events-none transition-all duration-200"
                 style={{ left: \`\${leftPercent}%\`, top: \`\${topPercent}%\`, transform: topPercent < 30 ? "translateX(-50%) translateY(8px)" : "translateX(-50%) translateY(calc(-100% - 8px))" }}>
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
        <div className="relative w-full h-full">
            <svg viewBox={\`0 0 \${W} \${H}\`} className="w-full h-full outline-none" preserveAspectRatio="none" onClick={(e) => { if (e.target === e.currentTarget) setPinnedIndex(null); }}>
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
                        <g key={\`yt-\${i}\`} className="pointer-events-none">
                            <line x1={pad.left} x2={W - pad.right} y1={yPos} y2={yPos} stroke="#e2e8f0" strokeWidth="0.5" />
                            <text x={pad.left - 6} y={yPos + 3.5} textAnchor="end" fontSize="9" fill="#94a3b8" fontFamily="monospace">
                                {tick}
                            </text>
                        </g>
                    );
                })}
                <text x={pad.left - 6} y={pad.top + chartH + 3.5} textAnchor="end" fontSize="9" fill="#cbd5e1" fontFamily="monospace">0</text>
                
                {data.map((val, hour) => {
                    const barH = (val / plotMax) * chartH;
                    const x = pad.left + hour * barW + gap;
                    const y = pad.top + chartH - barH;
                    const w = barW - gap * 2;
                    const isCurrentHour = (peakPeriod === "today" || historicalChartView === "hourly-profile") && hour === currentHour;
                    const isPeakHour = val === Math.max(...data, 1) && val > 0;
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
                                <text x={x + w / 2} y={H - 8} textAnchor="middle" fontSize="10" fill={isHovered ? "#334155" : "#64748b"} fontWeight={isHovered ? "bold" : "normal"} fontFamily="monospace" className="pointer-events-none transition-colors">
                                    {labels ? labels[hour] : hour.toString().padStart(2, "0")}
                                </text>
                            )}
                            
                            {showNumLabel && (
                                <text x={x + w / 2} y={y - 6} textAnchor="middle" fontSize={isPeakHour ? (barW < 12 ? "8" : "9") : "8"} fill={isPeakHour ? peakLabelColor : labelColor} fontWeight={isPeakHour ? "bold" : "600"} fontFamily="monospace" className="pointer-events-none">
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
\n\n`;

code = code.substring(0, startIndex) + newChart + code.substring(endIndex);
fs.writeFileSync("components/hub/cash-flow/ChartsSection.tsx", code);

