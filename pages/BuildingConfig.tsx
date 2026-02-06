import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Building2, 
  Save, 
  ArrowUp, 
  ArrowDown, 
  Layers, 
  CheckCircle2, 
  AlertCircle,
  CarFront
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { LevelType, BuildingLevel, BuildingConfig } from '../types';

export default function BuildingConfigPage() {
  const { garageId } = useParams<{ garageId: string }>();
  
  // State for the configuration form
  const [config, setConfig] = useState<BuildingConfig>({
    garage_id: garageId || '',
    count_subsuelos: 0,
    has_planta_baja: true,
    count_pisos: 0
  });

  // Raw data from DB
  const [dbLevels, setDbLevels] = useState<BuildingLevel[]>([]);
  
  // Derived state for UI (The stack of levels being edited)
  const [levelsPreview, setLevelsPreview] = useState<Partial<BuildingLevel>[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // 1. Load initial data
  useEffect(() => {
    if (!garageId) return;

    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch Config
        const { data: configData, error: configError } = await supabase
          .from('building_configs')
          .select('*')
          .eq('garage_id', garageId)
          .single();

        // Fetch Levels
        const { data: levelsData, error: levelsError } = await supabase
          .from('building_levels')
          .select('*')
          .eq('garage_id', garageId)
          .order('sort_order', { ascending: false }); // Order top to bottom for logic

        if (configData) {
          setConfig(configData);
        } else if (configError && configError.code !== 'PGRST116') {
          // If error is not "Not Found", throw it
          throw configError;
        }

        if (levelsData) {
          setDbLevels(levelsData);
        }

      } catch (err: any) {
        console.error('Error fetching building data:', err);
        setMessage({ type: 'error', text: 'Error al cargar la configuración.' });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [garageId]);

  // 2. Generate Preview Logic (The Reconciliation)
  useEffect(() => {
    if (loading) return;
    generateLevelsStructure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.count_pisos, config.has_planta_baja, config.count_subsuelos, loading]);

  const generateLevelsStructure = () => {
    const newStructure: Partial<BuildingLevel>[] = [];

    // Helper to find existing data for a specific sort_order to preserve ID and Spots
    const findExisting = (order: number) => dbLevels.find(l => l.sort_order === order);

    // A. Generate Floors (Pisos) - Top Down (N to 1)
    const pisos = config.count_pisos || 0;
    for (let i = pisos; i >= 1; i--) {
      const existing = findExisting(i);
      newStructure.push({
        id: existing?.id, // Keep ID if exists to update, undefined = insert
        garage_id: garageId,
        type: LevelType.PISO,
        level_number: i,
        display_name: existing?.display_name || `Piso ${i}`,
        sort_order: i,
        total_spots: existing?.total_spots || 0
      });
    }

    // B. Generate Ground Floor (PB) - Sort Order 0
    if (config.has_planta_baja) {
      const existing = findExisting(0);
      newStructure.push({
        id: existing?.id,
        garage_id: garageId,
        type: LevelType.PLANTA_BAJA,
        level_number: 0,
        display_name: existing?.display_name || 'Planta Baja',
        sort_order: 0,
        total_spots: existing?.total_spots || 0
      });
    }

    // C. Generate Basements (Subsuelos) - Top Down (1 to N) -> Sort Order -1 to -N
    const subsuelos = config.count_subsuelos || 0;
    for (let i = 1; i <= subsuelos; i++) {
      const sortOrder = -i;
      const existing = findExisting(sortOrder);
      newStructure.push({
        id: existing?.id,
        garage_id: garageId,
        type: LevelType.SUBSUELO,
        level_number: i,
        display_name: existing?.display_name || `Subsuelo ${i}`,
        sort_order: sortOrder,
        total_spots: existing?.total_spots || 0
      });
    }

    setLevelsPreview(newStructure);
  };

  const handleSpotChange = (index: number, value: string) => {
    const updated = [...levelsPreview];
    updated[index].total_spots = parseInt(value) || 0;
    setLevelsPreview(updated);
  };

  const handleSave = async () => {
    if (!garageId) return;
    setSaving(true);
    setMessage(null);

    try {
      // 1. Upsert Config
      const { error: configErr } = await supabase
        .from('building_configs')
        .upsert({
          garage_id: garageId,
          count_subsuelos: config.count_subsuelos,
          has_planta_baja: config.has_planta_baja,
          count_pisos: config.count_pisos
        });

      if (configErr) throw configErr;

      // 2. Upsert Levels
      // Clean payload for DB (remove undefined IDs if strictly needed, but Supabase handles upsert without ID as insert if we don't pass it in match key)
      const levelsPayload = levelsPreview.map(l => ({
        id: l.id, // If undefined, Supabase generates UUID
        garage_id: garageId,
        type: l.type,
        level_number: l.level_number,
        display_name: l.display_name,
        total_spots: l.total_spots,
        sort_order: l.sort_order
      }));

      // NOTE: Supabase UPSERT needs the Primary Key to update. 
      // If `id` is undefined, it creates a new row.
      const { data: savedLevels, error: levelsErr } = await supabase
        .from('building_levels')
        .upsert(levelsPayload as any, { onConflict: 'id' })
        .select();

      if (levelsErr) throw levelsErr;

      // Update local state with the newly saved real IDs
      if (savedLevels) {
        setDbLevels(savedLevels as BuildingLevel[]);
      }

      setMessage({ type: 'success', text: 'Configuración guardada correctamente.' });
      
    } catch (err: any) {
      console.error('Error saving:', err);
      setMessage({ type: 'error', text: `Error al guardar: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Cargando estructura del edificio...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6 text-blue-600" />
            Configuración de Edificio
          </h1>
          <p className="text-slate-500 mt-1">Define la estructura física y la capacidad de tu garaje.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`
            flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-white transition-all
            ${saving ? 'bg-blue-400 cursor-wait' : 'bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg'}
          `}
        >
          {saving ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"/> : <Save className="h-4 w-4" />}
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-lg border flex items-center gap-3 ${
          message.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Configuration Form */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Layers className="h-5 w-5 text-slate-400" />
              Estructura General
            </h2>
            
            <div className="space-y-6">
              {/* Floors Input */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Cantidad de Pisos Superiores</label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <ArrowUp className="absolute left-3 top-2.5 h-5 w-5 text-blue-500" />
                    <input
                      type="number"
                      min="0"
                      max="20"
                      value={config.count_pisos || 0}
                      onChange={(e) => setConfig({ ...config, count_pisos: parseInt(e.target.value) || 0 })}
                      className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
                    />
                  </div>
                  <span className="text-xs text-slate-400 font-medium px-2 bg-slate-100 rounded py-1">Niveles Aéreos</span>
                </div>
              </div>

              {/* Ground Floor Toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-md">
                    <CarFront className="h-5 w-5 text-green-700" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Planta Baja</p>
                    <p className="text-xs text-slate-500">Nivel a calle (Nivel 0)</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={config.has_planta_baja || false} 
                    onChange={(e) => setConfig({ ...config, has_planta_baja: e.target.checked })}
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Basements Input */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Cantidad de Subsuelos</label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <ArrowDown className="absolute left-3 top-2.5 h-5 w-5 text-indigo-500" />
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={config.count_subsuelos || 0}
                      onChange={(e) => setConfig({ ...config, count_subsuelos: parseInt(e.target.value) || 0 })}
                      className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
                    />
                  </div>
                  <span className="text-xs text-slate-400 font-medium px-2 bg-slate-100 rounded py-1">Niveles Subterráneos</span>
                </div>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-blue-50 text-blue-800 text-sm rounded-lg border border-blue-100">
              <p><strong>Nota:</strong> Al reducir niveles, los datos de capacidad de los niveles eliminados no se borran de la base de datos inmediatamente, pero dejarán de ser visibles.</p>
            </div>
          </div>
        </div>

        {/* Right Column: Visual Stack (The Building) */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center justify-between">
            <span>Vista Previa del Edificio</span>
            <span className="text-sm font-normal text-slate-500">Total Capacidad: <span className="font-bold text-slate-900">{levelsPreview.reduce((acc, curr) => acc + (curr.total_spots || 0), 0)}</span> cocheras</span>
          </h2>

          <div className="flex flex-col gap-3 bg-slate-100/50 p-6 rounded-2xl border border-slate-200 min-h-[400px]">
            {levelsPreview.length === 0 && (
              <div className="flex-1 flex items-center justify-center text-slate-400 italic">
                Define la estructura para ver los niveles
              </div>
            )}

            {levelsPreview.map((level, idx) => {
              // Determine styles based on level type
              let bgColor = 'bg-white';
              let borderColor = 'border-slate-200';
              let iconColor = 'text-slate-400';
              let labelColor = 'text-slate-700';

              if (level.type === LevelType.PISO) {
                bgColor = 'bg-sky-50';
                borderColor = 'border-sky-200';
                iconColor = 'text-sky-500';
                labelColor = 'text-sky-900';
              } else if (level.type === LevelType.PLANTA_BAJA) {
                bgColor = 'bg-emerald-50';
                borderColor = 'border-emerald-300 ring-1 ring-emerald-100'; // Highlight PB
                iconColor = 'text-emerald-600';
                labelColor = 'text-emerald-900';
              } else if (level.type === LevelType.SUBSUELO) {
                bgColor = 'bg-slate-100';
                borderColor = 'border-slate-300';
                iconColor = 'text-slate-500';
                labelColor = 'text-slate-800';
              }

              return (
                <div 
                  key={`${level.type}-${level.level_number}`} 
                  className={`relative flex items-center gap-4 p-4 rounded-xl border shadow-sm transition-all hover:shadow-md ${bgColor} ${borderColor}`}
                >
                  {/* Icon Indicator */}
                  <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-lg bg-white/60 border border-white/50 shadow-sm ${iconColor}`}>
                    {level.type === LevelType.PISO && <ArrowUp className="h-6 w-6" />}
                    {level.type === LevelType.PLANTA_BAJA && <CarFront className="h-6 w-6" />}
                    {level.type === LevelType.SUBSUELO && <ArrowDown className="h-6 w-6" />}
                  </div>

                  {/* Level Info */}
                  <div className="flex-1">
                    <h3 className={`font-bold text-lg ${labelColor}`}>{level.display_name}</h3>
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold opacity-70">{level.type?.replace('_', ' ')}</p>
                  </div>

                  {/* Capacity Input */}
                  <div className="flex flex-col items-end">
                    <label className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Cocheras</label>
                    <input
                      type="number"
                      min="0"
                      value={level.total_spots || ''}
                      onChange={(e) => handleSpotChange(idx, e.target.value)}
                      className="w-24 text-right font-mono text-lg font-bold border-b-2 border-slate-300 bg-transparent focus:border-blue-600 focus:outline-none transition-colors p-1"
                      placeholder="0"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}