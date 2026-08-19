import re

with open('components/hub/CashFlowHub.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

state_insertion = \"\"\"
    // Peak Hours State
    const [peakStays, setPeakStays] = useState<Stay[]>([]);
    const [loadingPeakStays, setLoadingPeakStays] = useState(false);
    const peakRequestRef = useRef(0);
    const peakCacheRef = useRef<Record<string, Stay[]>>({});

    useEffect(() => {
        if (garages.length === 0) return;
        
        const daysMap: Record<string, number> = {
            'today': 0, '7_days': 7, '15_days': 15, '30_days': 30, '60_days': 60, '90_days': 90
        };
        const days = daysMap[peakPeriod] || 0;
        
        if (days === 0) {
            setPeakStays([]);
            return;
        }

        const cacheKey = \\_\\;
        if (peakCacheRef.current[cacheKey]) {
            setPeakStays(peakCacheRef.current[cacheKey]);
            return;
        }

        const reqId = ++peakRequestRef.current;
        const fetchHistorical = async () => {
            setLoadingPeakStays(true);
            try {
                const now = new Date();
                const fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1, 0, 0, 0, 0);
                
                const { data, error } = await supabase
                    .from('stays')
                    .select('id,garage_id,plate,entry_time,exit_time,active')
                    .in('garage_id', garages.map(g => g.id))
                    .gte('entry_time', fromDate.toISOString())
                    .order('entry_time', { ascending: false });
                
                if (reqId === peakRequestRef.current && !error) {
                    const fetchedStays = (data || []) as Stay[];
                    peakCacheRef.current[cacheKey] = fetchedStays;
                    setPeakStays(fetchedStays);
                }
            } catch (err) {
                console.error("Error fetching peak stays", err);
            } finally {
                if (reqId === peakRequestRef.current) {
                    setLoadingPeakStays(false);
                }
            }
        };
        fetchHistorical();
    }, [peakPeriod, garages]);
\"\"\"

# Insert state after setFilters
content = re.sub(
    r'const \[filters, setFilters\] = useState\(\{[^\}]+\}\);',
    lambda m: m.group(0) + '\\n' + state_insertion,
    content
)

old_peak_memo = r'const peakHoursData = useMemo\(\(\) => \{.*?return histogram;\s*\}, \[gAllStays, peakMode\]\);'

new_peak_memo = \"\"\"const gPeakStays = useMemo(() => {
        const staysToUse = peakPeriod === 'today' ? allStays : peakStays;
        return selectedGarageId === 'all' ? staysToUse : staysToUse.filter(s => s.garage_id === selectedGarageId);
    }, [peakPeriod, allStays, peakStays, selectedGarageId]);

    const { peakHoursData, peakHoursLabels } = useMemo(() => {
        const { now, inicioHoy, inicioManana } = getArgentinaDateAnchors();
        const daysMap: Record<string, number> = { 'today': 1, '7_days': 7, '15_days': 15, '30_days': 30, '60_days': 60, '90_days': 90 };
        const days = daysMap[peakPeriod] || 1;
        
        const periodStart = new Date(inicioHoy);
        if (peakPeriod !== 'today') {
            periodStart.setDate(periodStart.getDate() - days + 1);
        }
        const periodStartMs = periodStart.getTime();
        const periodEndMs = inicioManana.getTime();
        
        const isHourlyProfile = historicalChartView === 'hourly-profile' || peakPeriod === 'today';
        
        if (isHourlyProfile) {
            const histogram = new Array(24).fill(0);
            
            gPeakStays.forEach(stay => {
                if (!stay.entry_time) return;
                const entryDate = new Date(stay.entry_time);
                const exitDate = (stay.active || !stay.exit_time) ? now : new Date(stay.exit_time);
                
                const effEntryMs = Math.max(entryDate.getTime(), periodStartMs);
                const effExitMs = Math.min(exitDate.getTime(), periodEndMs);
                if (effEntryMs >= effExitMs) return;

                if (peakMode === 'occupancy') {
                    let cur = new Date(effEntryMs);
                    cur.setMinutes(0, 0, 0, 0);
                    while (cur.getTime() < effExitMs) {
                        histogram[cur.getHours()]++;
                        cur.setHours(cur.getHours() + 1);
                    }
                } else if (peakMode === 'entries') {
                    if (entryDate.getTime() >= periodStartMs && entryDate.getTime() < periodEndMs) {
                        histogram[entryDate.getHours()]++;
                    }
                } else if (peakMode === 'exits') {
                    if (!stay.active && stay.exit_time) {
                        if (exitDate.getTime() >= periodStartMs && exitDate.getTime() < periodEndMs) {
                            histogram[exitDate.getHours()]++;
                        }
                    }
                }
            });
            
            if (peakPeriod !== 'today' && days > 1) {
                for (let i = 0; i < 24; i++) {
                    histogram[i] = Math.round(histogram[i] / days);
                }
            }
            return { peakHoursData: histogram, peakHoursLabels: undefined };
        } else {
            const labels: string[] = [];
            const histogram = new Array(days).fill(0);
            
            for (let i = 0; i < days; i++) {
                const d = new Date(periodStart);
                d.setDate(d.getDate() + i);
                const pad = (n: number) => n.toString().padStart(2, '0');
                labels.push(\\/\\);
            }

            gPeakStays.forEach(stay => {
                if (!stay.entry_time) return;
                const entryDate = new Date(stay.entry_time);
                const exitDate = (stay.active || !stay.exit_time) ? now : new Date(stay.exit_time);
                
                const effEntryMs = Math.max(entryDate.getTime(), periodStartMs);
                const effExitMs = Math.min(exitDate.getTime(), periodEndMs);
                if (effEntryMs >= effExitMs) return;

                const getIndex = (dateMs: number) => {
                    const d = new Date(dateMs);
                    const d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
                    return Math.round((d0.getTime() - periodStartMs) / 86400000);
                };

                if (peakMode === 'occupancy') {
                    let cur = new Date(effEntryMs);
                    cur.setHours(0, 0, 0, 0);
                    while (cur.getTime() < effExitMs) {
                        const index = getIndex(cur.getTime());
                        if (index >= 0 && index < days) {
                            histogram[index]++;
                        }
                        cur.setDate(cur.getDate() + 1);
                    }
                } else if (peakMode === 'entries') {
                    if (entryDate.getTime() >= periodStartMs && entryDate.getTime() < periodEndMs) {
                        const index = getIndex(entryDate.getTime());
                        if (index >= 0 && index < days) histogram[index]++;
                    }
                } else if (peakMode === 'exits') {
                    if (!stay.active && stay.exit_time) {
                        if (exitDate.getTime() >= periodStartMs && exitDate.getTime() < periodEndMs) {
                            const index = getIndex(exitDate.getTime());
                            if (index >= 0 && index < days) histogram[index]++;
                        }
                    }
                }
            });
            return { peakHoursData: histogram, peakHoursLabels: labels };
        }
    }, [gPeakStays, peakMode, peakPeriod, historicalChartView]);\"\"\"

content = re.sub(old_peak_memo, new_peak_memo, content, flags=re.DOTALL)

old_charts_section = r\"\"\"<ChartsSection
\s*revenueChartData=\{revenueChartData\}
\s*peakHoursData=\{peakHoursData\}
\s*peakMode=\{peakMode\}
\s*setPeakMode=\{setPeakMode\}
\s*peakPeriod=\{peakPeriod\}
\s*setPeakPeriod=\{setPeakPeriod\}
\s*historicalChartView=\{historicalChartView\}
\s*setHistoricalChartView=\{setHistoricalChartView\}
\s*/>\"\"\"

new_charts_section = \"\"\"<ChartsSection
                            revenueChartData={revenueChartData}
                            peakHoursData={peakHoursData}
                            peakHoursLabels={peakHoursLabels}
                            loadingPeakStays={loadingPeakStays}
                            peakMode={peakMode}
                            setPeakMode={setPeakMode}
                            peakPeriod={peakPeriod}
                            setPeakPeriod={setPeakPeriod}
                            historicalChartView={historicalChartView}
                            setHistoricalChartView={setHistoricalChartView}
                        />\"\"\"

content = re.sub(old_charts_section, new_charts_section, content)

with open('components/hub/CashFlowHub.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
