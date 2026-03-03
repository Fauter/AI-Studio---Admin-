import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
    ShieldAlert, Search, Loader2, AlertCircle
} from 'lucide-react';
import SectionHeader from '../components/hub/SectionHeader';

// --- Interface ---
interface Incident {
    id: string;
    garage_id: string;
    created_at: string;
    operator: string | null;
    description: string | null;
}

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

export default function IncidentsPage() {
    const { garageId } = useParams<{ garageId: string }>();

    const [loading, setLoading] = useState(true);
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [error, setError] = useState<string | null>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // --- Fetch ---
    useEffect(() => {
        if (!garageId) return;
        const fetchIncidents = async () => {
            setLoading(true);
            setError(null);
            try {
                const { data, error: dbError } = await supabase
                    .from('incidents')
                    .select('*')
                    .eq('garage_id', garageId)
                    .order('created_at', { ascending: false });
                if (dbError) throw dbError;
                setIncidents(data as Incident[] || []);
            } catch (err: any) {
                setError('Error al cargar los incidentes: ' + err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchIncidents();
    }, [garageId]);

    // --- Filtering ---
    const filteredIncidents = useMemo(() => {
        return incidents.filter(item => {
            const term = searchTerm.toLowerCase();
            const matchesSearch = !searchTerm ||
                (item.operator || '').toLowerCase().includes(term) ||
                (item.description || '').toLowerCase().includes(term);
            const itemDate = new Date(item.created_at);
            const matchesFrom = !dateFrom || itemDate >= new Date(dateFrom);
            const matchesTo = !dateTo || itemDate <= new Date(dateTo + 'T23:59:59');
            return matchesSearch && matchesFrom && matchesTo;
        });
    }, [incidents, searchTerm, dateFrom, dateTo]);

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-red-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <SectionHeader title="Incidentes" icon={ShieldAlert} iconColor="red" />

            {/* Error Banner */}
            {error && (
                <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {error}
                </div>
            )}

            {/* Filters Bar */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <div className="relative flex-1 min-w-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por operador o descripción..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
                    />
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">Desde</label>
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={e => setDateFrom(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
                    />
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">Hasta</label>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={e => setDateTo(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                        {filteredIncidents.length} registro{filteredIncidents.length !== 1 ? 's' : ''} encontrado{filteredIncidents.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                            <tr>
                                <th className="px-5 py-3">Fecha</th>
                                <th className="px-5 py-3">Operador</th>
                                <th className="px-5 py-3">Descripción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredIncidents.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-5 py-14 text-center">
                                        <ShieldAlert className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                                        <p className="text-slate-400 font-medium text-base">No se encontraron incidentes.</p>
                                        <p className="text-slate-300 text-sm mt-1">Ajustá los filtros o verificá que existan registros.</p>
                                    </td>
                                </tr>
                            )}
                            {filteredIncidents.map(incident => (
                                <tr key={incident.id} className="hover:bg-slate-50/70 transition-colors group">
                                    <td className="px-5 py-3.5 text-slate-600 text-xs whitespace-nowrap">
                                        {formatDate(incident.created_at)}
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <div className="flex items-center gap-2">
                                            <div className="h-7 w-7 rounded-full bg-red-100 flex items-center justify-center text-red-700 text-[11px] font-black flex-shrink-0">
                                                {incident.operator?.charAt(0).toUpperCase() || '?'}
                                            </div>
                                            <span className="font-semibold text-slate-800">
                                                {incident.operator || <span className="text-slate-400 italic">Sin nombre</span>}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3.5 text-slate-600 max-w-md">
                                        <p className="leading-relaxed">{incident.description || <span className="text-slate-400 italic">Sin descripción</span>}</p>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
