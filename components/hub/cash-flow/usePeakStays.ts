import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { Stay, PeakPeriod, ChartView, PeakMode, getArgentinaDateAnchors } from './CashFlowShared';

interface PeakChartSeries {
    data: number[];
    labels?: string[];
}

const PEAK_PERIOD_DAYS: Record<string, number> = {
    '7_days': 7,
    '15_days': 15,
    '30_days': 30,
    '60_days': 60,
    '90_days': 90,
};

interface CacheEntry {
    stays: Stay[];
    startDate: Date;
    promise?: Promise<Stay[]>;
}

const staysCache = new Map<string, CacheEntry>();
const prefetchAbortControllers = new Map<string, AbortController>();

function get90DaysStartDate(inicioHoy: Date) {
    return new Date(inicioHoy.getFullYear(), inicioHoy.getMonth(), inicioHoy.getDate() - 90 + 1, 0, 0, 0, 0);
}

async function fetchStaysFromSupabase(garageIds: string[], startDate: Date, signal?: AbortSignal): Promise<Stay[]> {
    const isoStart = startDate.toISOString();
    let allStays: Stay[] = [];
    let from = 0;
    const PAGE_SIZE = 1000;
    
    while (true) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        
        let query = supabase
            .from('stays')
            .select('id,garage_id,plate,entry_time,exit_time,active')
            .in('garage_id', garageIds)
            .or(`entry_time.gte.${isoStart},active.eq.true,exit_time.gte.${isoStart}`)
            .order('entry_time', { ascending: false })
            .range(from, from + PAGE_SIZE - 1);
            
        if (signal) {
            query = query.abortSignal(signal);
        }

        const { data, error } = await query;
            
        if (error) throw error;
        
        if (data) allStays = allStays.concat(data as Stay[]);
        if (!data || data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
    }
    return allStays;
}

async function prefetch90Days(garageIds: string[], inicioHoy: Date) {
    const cacheKey = [...garageIds].sort().join(',');
    const startDate = get90DaysStartDate(inicioHoy);
    
    const cached = staysCache.get(cacheKey);
    if (cached && cached.startDate.getTime() <= startDate.getTime()) {
        return;
    }

    if (prefetchAbortControllers.has(cacheKey)) {
        prefetchAbortControllers.get(cacheKey)?.abort();
    }
    
    const abortController = new AbortController();
    prefetchAbortControllers.set(cacheKey, abortController);
    
    const promise = fetchStaysFromSupabase(garageIds, startDate, abortController.signal);
    
    staysCache.set(cacheKey, {
        stays: [],
        startDate: startDate,
        promise: promise
    });

    try {
        const stays = await promise;
        if (!abortController.signal.aborted) {
            staysCache.set(cacheKey, { stays, startDate, promise: undefined });
        }
    } catch (err: any) {
        if (err.name !== 'AbortError') {
            console.error("Error prefetching 90 days peak stays:", err);
            const currentCache = staysCache.get(cacheKey);
            if (currentCache?.promise === promise) {
                staysCache.delete(cacheKey);
            }
        }
    } finally {
        prefetchAbortControllers.delete(cacheKey);
    }
}

export function usePeakStays(
    garageIds: string[],
    peakPeriod: PeakPeriod,
    historicalChartView: ChartView,
    peakMode: PeakMode
) {
    const [series, setSeries] = useState<PeakChartSeries>({ data: [], labels: undefined });
    const [loading, setLoading] = useState(false);
    
    const fetchIdRef = useRef(0);
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (garageIds.length === 0) {
            setSeries({ data: [], labels: undefined });
            return;
        }

        const fetchId = ++fetchIdRef.current;
        const { inicioHoy, now } = getArgentinaDateAnchors();
        
        let days = 0;
        let startDate: Date;
        
        if (peakPeriod === 'today') {
            startDate = inicioHoy;
        } else {
            days = PEAK_PERIOD_DAYS[peakPeriod] || 30;
            startDate = new Date(inicioHoy.getFullYear(), inicioHoy.getMonth(), inicioHoy.getDate() - days + 1, 0, 0, 0, 0);
        }

        const cacheKey = [...garageIds].sort().join(',');

        const processStays = (stays: Stay[]) => {
            if (fetchId !== fetchIdRef.current) return;
            const newSeries = aggregatePeakStays(stays, peakPeriod, historicalChartView, peakMode, startDate, now);
            setSeries(newSeries);
            setLoading(false);
        };

        const getStaysForPeriod = async () => {
            const cached = staysCache.get(cacheKey);

            if (cached) {
                if (!cached.promise && cached.startDate.getTime() <= startDate.getTime()) {
                    processStays(cached.stays);
                    if (cached.startDate.getTime() > get90DaysStartDate(inicioHoy).getTime()) {
                        prefetch90Days(garageIds, inicioHoy);
                    }
                    return;
                }
                
                if (cached.promise && cached.startDate.getTime() <= startDate.getTime()) {
                    setLoading(true);
                    try {
                        const stays = await cached.promise;
                        processStays(stays);
                    } catch (err) {
                        if (fetchId === fetchIdRef.current) setLoading(false);
                    }
                    return;
                }
            }

            setLoading(true);
            
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            const abortController = new AbortController();
            abortControllerRef.current = abortController;

            const promise = fetchStaysFromSupabase(garageIds, startDate, abortController.signal);
            
            staysCache.set(cacheKey, {
                stays: [],
                startDate: startDate,
                promise: promise
            });

            try {
                const stays = await promise;
                if (!abortController.signal.aborted) {
                    staysCache.set(cacheKey, { stays, startDate, promise: undefined });
                    processStays(stays);
                    
                    if (startDate.getTime() > get90DaysStartDate(inicioHoy).getTime()) {
                         prefetch90Days(garageIds, inicioHoy);
                    }
                }
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    console.error("Error fetching peak stays:", err);
                    if (fetchId === fetchIdRef.current) setLoading(false);
                }
            }
        };

        getStaysForPeriod();

    }, [garageIds, peakPeriod, historicalChartView, peakMode]);

    return { ...series, loadingPeakStays: loading };
}

function aggregatePeakStays(
    stays: Stay[],
    peakPeriod: PeakPeriod,
    historicalChartView: ChartView,
    peakMode: PeakMode,
    startDate: Date,
    now: Date
): PeakChartSeries {
    if (peakPeriod === 'today') {
        const histogram = new Array(24).fill(0);
        const hoyMs = startDate.getTime();
        const mananaMs = hoyMs + 24 * 60 * 60 * 1000;
        
        stays.forEach(stay => {
            if (!stay.entry_time) return;
            const entryDate = new Date(stay.entry_time);
            const entryMs = entryDate.getTime();
            const exitDate = (stay.active || !stay.exit_time) ? now : new Date(stay.exit_time);
            const exitMs = exitDate.getTime();
            
            if (peakMode === 'occupancy') {
                if (exitMs < hoyMs || entryMs >= mananaMs) return;
                const effectiveEntry = entryMs < hoyMs ? startDate : entryDate;
                const effectiveExit = exitMs >= mananaMs ? new Date(mananaMs - 1) : exitDate;
                
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
                if (!stay.active && stay.exit_time && exitMs >= hoyMs && exitMs < mananaMs) {
                    histogram[exitDate.getHours()]++;
                }
            }
        });
        return { data: histogram, labels: undefined };
    }

    const days = PEAK_PERIOD_DAYS[peakPeriod] || 30;
    
    if (historicalChartView === 'historical') {
        const data = new Array(days).fill(0);
        const labels = new Array(days).fill('');
        
        const buckets: { startMs: number, endMs: number, label: string }[] = [];
        for (let i = 0; i < days; i++) {
            const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i, 0, 0, 0, 0);
            const nextD = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
            const dayLabel = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
            buckets.push({ startMs: d.getTime(), endMs: nextD.getTime(), label: dayLabel });
            labels[i] = dayLabel;
        }

        if (peakMode === 'occupancy') {
            for (let i = 0; i < days; i++) {
                const b = buckets[i];
                const dayHistogram = new Array(24).fill(0);
                stays.forEach(stay => {
                    if (!stay.entry_time) return;
                    const entryMs = new Date(stay.entry_time).getTime();
                    const exitMs = (stay.active || !stay.exit_time) ? now.getTime() : new Date(stay.exit_time).getTime();
                    
                    if (exitMs < b.startMs || entryMs >= b.endMs) return;
                    
                    const effEntry = entryMs < b.startMs ? new Date(b.startMs) : new Date(entryMs);
                    const effExit = exitMs >= b.endMs ? new Date(b.endMs - 1) : new Date(exitMs);
                    
                    const startH = effEntry.getHours();
                    const endH = effExit.getHours();
                    for (let h = startH; h <= endH; h++) {
                        dayHistogram[h]++;
                    }
                });
                data[i] = Math.max(...dayHistogram, 0);
            }
        } else if (peakMode === 'entries') {
            stays.forEach(stay => {
                if (!stay.entry_time) return;
                const entryMs = new Date(stay.entry_time).getTime();
                for (let i = 0; i < days; i++) {
                    if (entryMs >= buckets[i].startMs && entryMs < buckets[i].endMs) {
                        data[i]++;
                        break;
                    }
                }
            });
        } else if (peakMode === 'exits') {
            stays.forEach(stay => {
                if (stay.active || !stay.exit_time) return;
                const exitMs = new Date(stay.exit_time).getTime();
                for (let i = 0; i < days; i++) {
                    if (exitMs >= buckets[i].startMs && exitMs < buckets[i].endMs) {
                        data[i]++;
                        break;
                    }
                }
            });
        }
        
        return { data, labels };

    } else {
        const histogram = new Array(24).fill(0);
        
        if (peakMode === 'occupancy') {
            const hourSums = new Array(24).fill(0);
            
            for (let i = 0; i < days; i++) {
                const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i, 0, 0, 0, 0);
                const nextD = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
                
                const dayHistogram = new Array(24).fill(0);
                stays.forEach(stay => {
                    if (!stay.entry_time) return;
                    const entryMs = new Date(stay.entry_time).getTime();
                    const exitMs = (stay.active || !stay.exit_time) ? now.getTime() : new Date(stay.exit_time).getTime();
                    
                    if (exitMs < d.getTime() || entryMs >= nextD.getTime()) return;
                    
                    const effEntry = entryMs < d.getTime() ? d : new Date(entryMs);
                    const effExit = exitMs >= nextD.getTime() ? new Date(nextD.getTime() - 1) : new Date(exitMs);
                    
                    const startH = effEntry.getHours();
                    const endH = effExit.getHours();
                    for (let h = startH; h <= endH; h++) {
                        dayHistogram[h]++;
                    }
                });
                
                for (let h = 0; h < 24; h++) {
                    hourSums[h] += dayHistogram[h];
                }
            }
            
            for (let h = 0; h < 24; h++) {
                histogram[h] = Math.round(hourSums[h] / days);
            }
            
        } else if (peakMode === 'entries') {
            stays.forEach(stay => {
                if (!stay.entry_time) return;
                const entryMs = new Date(stay.entry_time).getTime();
                if (entryMs >= startDate.getTime() && entryMs < now.getTime()) {
                    histogram[new Date(entryMs).getHours()]++;
                }
            });
            for (let h = 0; h < 24; h++) {
                histogram[h] = Math.round(histogram[h] / days);
            }
        } else if (peakMode === 'exits') {
            stays.forEach(stay => {
                if (stay.active || !stay.exit_time) return;
                const exitMs = new Date(stay.exit_time).getTime();
                if (exitMs >= startDate.getTime() && exitMs < now.getTime()) {
                    histogram[new Date(exitMs).getHours()]++;
                }
            });
            for (let h = 0; h < 24; h++) {
                histogram[h] = Math.round(histogram[h] / days);
            }
        }
        
        return { data: histogram, labels: undefined };
    }
}
