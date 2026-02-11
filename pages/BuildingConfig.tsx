import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Building2, 
  Save, 
  ArrowUp, 
  ArrowDown, 
  Home,
  Layers, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  ParkingSquare
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { LevelType, BuildingLevel, BuildingLevelDTO } from '../types';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export default function BuildingConfigPage() {
  const { garageId } = useParams<{ garageId: string }>();
  
  // --- Global State ---
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // --- Data Source of Truth (DB) ---
  const [dbLevels, setDbLevels] = useState<BuildingLevel[]>([]);
  
  // --- UI/Working State ---
  const isSwitchingGarage = useRef(false);
  
  const [floorCount, setFloorCount] = useState<number>(0);
  const [basementCount, setBasementCount] = useState<number>(0);
  const [hasGroundFloor, setHasGroundFloor] = useState<boolean>(true);
  
  const [levelsPreview, setLevelsPreview] = useState<BuildingLevelDTO[]>([]);

  // --- 1. Master Reset & Fetch (Anti-Leakage) ---
  
  useEffect(() => {
    if (!garageId) return;

    const initGarageContext = async () => {
      // CRITICAL: Clean Slate Protocol
      // Instantly wipe all data from previous garage to prevent cross-contamination
      isSwitchingGarage.current = true;
      setLoading(true);
      setDbLevels([]);
      setLevelsPreview([]);
      setFloorCount(0);
      setBasementCount(0);
      setHasGroundFloor(true);
      setFeedback(null);

      try {
        // Fetch Config
        const { data: configData, error: configError } = await supabase
          .from('building_configs')
          .select('*')
          .eq('garage_id', garageId)
          .maybeSingle(); 

        if (configError) throw configError;

        // Fetch Levels
        const { data: levelsData, error: levelsError } = await supabase
          .from('building_levels')
          .select('*')
          .eq('garage_id', garageId);
          
        if (levelsError) throw levelsError;

        // Update Source of Truth
        setDbLevels(levelsData || []);

        // Initialize UI Controls based on DB Config
        if (configData) {
          setFloorCount(configData.count_pisos || 0);
          setBasementCount(configData.count_subsuelos || 0);
          setHasGroundFloor(configData.has_planta_baja ?? true);
        }

      } catch (err: any) {
        console.error("Fetch Error:", err);
        setFeedback({ type: 'error', text: "Error al cargar datos. Verifica tu conexión." });
      } finally {
        isSwitchingGarage.current = false;
        setLoading(false);
      }
    };

    initGarageContext();
  }, [garageId]);

  // --- 2. Tower Reconciliation (The Builder) ---
  
  useEffect(() => {
    // Prevent reconciliation running during initialization or switching
    if (loading || isSwitchingGarage.current) return;

    reconcileTower();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floorCount, basementCount, hasGroundFloor, loading]);

  const reconcileTower = () => {
    const newLevels: BuildingLevelDTO[] = [];

    const resolveLevelData = (order: number, defaultName: string, type: LevelType) => {
      // 1. Check active unsaved edits
      const current = levelsPreview.find(l => l.sort_order === order);
      if (current) return current;

      // 2. Check DB history (Prevents data loss on resize)
      const persisted = dbLevels.find(l => l.sort_order === order);
      if (persisted) {
        return {
          // We keep the ID internally for reference, but handleSave will strip it for the payload logic
          id: persisted.id,
          sort_order: persisted.sort_order!,
          type: persisted.type!,
          display_name: persisted.display_name!,
          capacity: persisted.total_spots || 0 
        };
      }

      // 3. New Instance
      return {
        sort_order: order,
        type: type,
        display_name: defaultName,
        capacity: 0
      };
    };

    // A. Floors (Top to Bottom: N -> 1)
    for (let i = floorCount; i >= 1; i--) {
      newLevels.push(resolveLevelData(i, `Piso ${i}`, LevelType.PISO));
    }

    // B. Ground Floor (0)
    if (hasGroundFloor) {
      newLevels.push(resolveLevelData(0, 'Planta Baja', LevelType.PLANTA_BAJA));
    }

    // C. Basements (-1 -> -N)
    for (let i = 1; i <= basementCount; i++) {
      const sortOrder = -i;
      newLevels.push(resolveLevelData(sortOrder, `Subsuelo ${i}`, LevelType.SUBSUELO));
    }

    setLevelsPreview(newLevels);
  };

  // --- 3. Handlers ---

  const handleLevelUpdate = (index: number, field: keyof BuildingLevelDTO, value: any) => {
    const updated = [...levelsPreview];
    updated[index] = { ...updated[index], [field]: value };
    setLevelsPreview(updated);
  };

  const handleSave = async () => {
    if (!garageId) return;
    setSaving(true);
    setFeedback(null);

    try {
      // 1. Config Upsert (Always reliable)
      const { error: configErr } = await supabase
        .from('building_configs')
        .upsert({
          garage_id: garageId,
          count_pisos: floorCount,
          count_subsuelos: basementCount,
          has_planta_baja: hasGroundFloor
        }, { onConflict: 'garage_id' });

      if (configErr) throw configErr;

      // 2. Levels Upsert - ID STRIPPING STRATEGY
      // We explicitly REMOVE the 'id' field from the payload.
      // We rely 100% on the UNIQUE constraint (garage_id, sort_order).
      // If the row exists, Postgres updates it. If not, it creates it with a new UUID.
      
      const levelsPayload = levelsPreview.map(dto => ({
        garage_id: garageId,
        type: dto.type,
        level_number: Math.abs(dto.sort_order),
        display_name: dto.display_name,
        total_spots: dto.capacity || 0, // Map Frontend 'capacity' -> DB 'total_spots'
        sort_order: dto.sort_order
        // NO 'id' FIELD HERE. This prevents error 23502.
      }));

      // 3. Atomic Upsert
      const { data: savedData, error: levelsErr } = await supabase
        .from('building_levels')
        .upsert(levelsPayload, { onConflict: 'garage_id,sort_order' }) 
        .select();

      if (levelsErr) throw levelsErr;

      // 4. Post-Save Sync
      // We fetch the fresh data (including the IDs generated/updated) and update our local state.
      if (savedData) {
        const castedData = savedData as BuildingLevel[];
        setDbLevels(castedData);
        
        // Re-map the preview to include the new IDs for future reference (though we won't send them next time either)
        setLevelsPreview(prev => prev.map(p => {
          const fresh = castedData.find(d => d.sort_order === p.sort_order);
          return fresh ? { ...p, id: fresh.id } : p;
        }));
      }

      setFeedback({ type: 'success', text: 'Estructura guardada correctamente.' });

    } catch (err: any) {
      console.error("Save Error:", err);
      let msg = err.message || 'Error desconocido';
      if (msg.includes('null value in column "id"')) msg = 'Error de Integridad: El sistema intentó crear un nivel inválido.';
      setFeedback({ type: 'error', text: `Error: ${msg}` });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex h-[50vh] items-center justify-center flex-col gap-4 text-slate-400">
      <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
      <p className="animate-pulse">Sincronizando Estructura...</p>
    </div>
  );

  const totalCapacity = levelsPreview.reduce((acc, curr) => acc + (curr.capacity || 0), 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6 md:p-12 rounded-3xl border border-slate-900 shadow-2xl">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Building2 className="h-8 w-8 text-indigo-500" />
            Configuración de Edificio
          </h1>
          <p className="text-slate-400 mt-2 text-lg">Define la estructura vertical y la capacidad de tu garaje.</p>
        </div>

        <div className="flex items-center gap-4">
           <div className="text-right hidden md:block">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Capacidad Total</p>
              <p className="text-2xl font-mono font-bold text-indigo-400">{totalCapacity} <span className="text-sm text-slate-500">vehículos</span></p>
           </div>
           <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white transition-all shadow-lg shadow-indigo-900/20",
              saving 
                ? "bg-slate-800 cursor-wait text-slate-500" 
                : "bg-indigo-600 hover:bg-indigo-500 hover:scale-105 active:scale-95"
            )}
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin"/> : <Save className="h-5 w-5" />}
            {saving ? 'Aplicando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>

      {feedback && (
        <div className={cn(
          "mb-8 p-4 rounded-xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-4",
          feedback.type === 'success' ? 'bg-emerald-950/30 border-emerald-800 text-emerald-400' : 'bg-red-950/30 border-red-800 text-red-400'
        )}>
          {feedback.type === 'success' ? <CheckCircle2 className="h-5 w-5"/> : <AlertCircle className="h-5 w-5"/>}
          <p className="font-medium">{feedback.text}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Controls Panel */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Layers className="h-5 w-5 text-indigo-400" />
              Parámetros Estructurales
            </h2>

            <div className="space-y-8">
              {/* Floors */}
              <div className="relative group">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block group-focus-within:text-indigo-400 transition-colors">Pisos Superiores</label>
                <div className="flex items-center gap-3">
                   <div className="relative flex-1">
                      <ArrowUp className="absolute left-3 top-3 h-5 w-5 text-slate-600 group-focus-within:text-indigo-500 transition-colors pointer-events-none" />
                      <input 
                        type="number" 
                        min="0" max="50"
                        value={floorCount}
                        onChange={(e) => setFloorCount(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-white font-mono focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition-all [color-scheme:dark]"
                      />
                   </div>
                </div>
              </div>

              {/* Ground Floor Toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-950 border border-slate-800">
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-slate-900 rounded-lg text-slate-400">
                      <Home className="h-5 w-5" />
                   </div>
                   <div>
                      <p className="font-bold text-slate-200 text-sm">Planta Baja</p>
                      <p className="text-xs text-slate-500">Nivel de calle (0)</p>
                   </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={hasGroundFloor} 
                    onChange={(e) => setHasGroundFloor(e.target.checked)}
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* Basements */}
              <div className="relative group">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block group-focus-within:text-indigo-400 transition-colors">Subsuelos</label>
                <div className="flex items-center gap-3">
                   <div className="relative flex-1">
                      <ArrowDown className="absolute left-3 top-3 h-5 w-5 text-slate-600 group-focus-within:text-indigo-500 transition-colors pointer-events-none" />
                      <input 
                        type="number" 
                        min="0" max="20"
                        value={basementCount}
                        onChange={(e) => setBasementCount(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-white font-mono focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition-all [color-scheme:dark]"
                      />
                   </div>
                </div>
              </div>
            </div>
            
            <div className="mt-8 pt-6 border-t border-slate-800/50">
               <p className="text-xs text-slate-500 leading-relaxed">
                 <strong className="text-slate-400">Nota técnica:</strong> Los niveles se ordenan automáticamente según su posición física.
               </p>
            </div>
          </div>
        </div>

        {/* Visual Tower */}
        <div className="lg:col-span-8">
           <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 min-h-[600px] flex flex-col items-center relative overflow-hidden">
              
              {/* Background Grid Decoration */}
              <div className="absolute inset-0 opacity-10 pointer-events-none" 
                   style={{ backgroundImage: 'linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
              </div>

              <h2 className="text-lg font-bold text-white mb-8 z-10 relative bg-slate-900 px-4 rounded-full border border-slate-800 shadow-sm flex items-center gap-2">
                 Visualización de Torre
                 {levelsPreview.length > 0 && <span className="text-xs text-slate-500">({levelsPreview.length} Niveles)</span>}
              </h2>

              <div className="w-full max-w-2xl space-y-3 z-10 relative">
                 {levelsPreview.map((level, idx) => {
                    const isPb = level.type === LevelType.PLANTA_BAJA;
                    const isFloor = level.type === LevelType.PISO;
                    
                    return (
                      <div 
                        key={idx} 
                        className={cn(
                          "group relative flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 hover:scale-[1.01] hover:shadow-xl",
                          isPb 
                            ? "bg-indigo-900/20 border-indigo-500/50 shadow-lg shadow-indigo-900/10 z-10" 
                            : "bg-slate-950 border-slate-800 hover:border-slate-700"
                        )}
                      >
                         {/* Icon Marker */}
                         <div className={cn(
                           "flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center border font-mono font-bold text-lg",
                           isPb ? "bg-indigo-600 border-indigo-500 text-white" : 
                           isFloor ? "bg-slate-900 border-slate-700 text-slate-400 group-hover:text-indigo-400" :
                           "bg-slate-900 border-slate-800 text-slate-600"
                         )}>
                            {isPb ? "PB" : level.sort_order}
                         </div>

                         {/* Editable Name */}
                         <div className="flex-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1 block group-hover:text-indigo-400 transition-colors">
                               {isFloor ? 'Piso Superior' : isPb ? 'Nivel Calle' : 'Subsuelo'}
                            </label>
                            <input 
                              type="text"
                              value={level.display_name}
                              onChange={(e) => handleLevelUpdate(idx, 'display_name', e.target.value)}
                              className="w-full bg-transparent border-none p-0 text-white font-bold text-lg focus:ring-0 focus:outline-none placeholder-slate-600"
                              placeholder="Nombre del Nivel"
                            />
                         </div>

                         {/* Capacity */}
                         <div className="flex flex-col items-end">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1 block group-hover:text-indigo-400 transition-colors">
                              Cocheras
                            </label>
                            <div className="flex items-center gap-2 bg-slate-900/50 border border-slate-800 rounded-lg px-3 py-1.5 focus-within:border-indigo-500 transition-colors">
                               <ParkingSquare className="h-4 w-4 text-slate-500" />
                               <input 
                                  type="number"
                                  min="0"
                                  value={level.capacity || ''}
                                  onChange={(e) => handleLevelUpdate(idx, 'capacity', parseInt(e.target.value) || 0)}
                                  className="no-spinner w-16 bg-transparent border-none p-0 text-right font-mono text-white font-bold focus:ring-0 focus:outline-none"
                                  placeholder="0"
                               />
                            </div>
                         </div>
                      </div>
                    );
                 })}

                 {levelsPreview.length === 0 && (
                    <div className="py-20 flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-800 rounded-2xl">
                       <Building2 className="h-12 w-12 mb-4 opacity-20" />
                       <p>Sin niveles configurados</p>
                    </div>
                 )}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}