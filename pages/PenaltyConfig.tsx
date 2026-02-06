import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { 
  CreditCard, 
  Save, 
  Calendar, 
  Plus, 
  Trash2, 
  Percent, 
  AlertCircle, 
  CheckCircle2, 
  Clock 
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { MonthlyPunitorio, MonthlyPunitorioStep } from '../types';

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export default function PenaltyConfigPage() {
  const { garageId } = useParams<{ garageId: string }>();
  
  // State 12 months array
  const [rules, setRules] = useState<MonthlyPunitorio[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Initialize empty structure for 12 months
  const getDefaultRules = (): MonthlyPunitorio[] => {
    return Array.from({ length: 12 }, (_, i) => ({
      month_index: i,
      active: true,
      start_day: 10, // Default start day
      steps: []
    }));
  };

  useEffect(() => {
    if (!garageId) return;

    const fetchConfig = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('financial_configs')
          .select('punitorio_rules')
          .eq('garage_id', garageId)
          .single();

        if (error && error.code !== 'PGRST116') { // Ignore Not Found
          throw error;
        }

        if (data && data.punitorio_rules && Array.isArray(data.punitorio_rules) && data.punitorio_rules.length > 0) {
          // Merge DB data with default structure to ensure 12 months exist
          const dbRules = data.punitorio_rules as MonthlyPunitorio[];
          const fullRules = getDefaultRules().map(defaultRule => {
            const found = dbRules.find(r => r.month_index === defaultRule.month_index);
            return found ? found : defaultRule;
          });
          setRules(fullRules);
        } else {
          setRules(getDefaultRules());
        }

      } catch (err: any) {
        console.error('Error loading financial config:', err);
        setMessage({ type: 'error', text: 'Error al cargar configuración financiera.' });
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [garageId]);

  // --- Handlers ---

  const handleUpdateMonth = (monthIndex: number, field: keyof MonthlyPunitorio, value: any) => {
    setRules(prev => prev.map(r => 
      r.month_index === monthIndex ? { ...r, [field]: value } : r
    ));
  };

  const handleAddStep = (monthIndex: number) => {
    setRules(prev => prev.map(r => {
      if (r.month_index !== monthIndex) return r;
      
      // Smart default: next step is +5 days from last step or start_day
      const lastDay = r.steps.length > 0 
        ? r.steps[r.steps.length - 1].day_trigger 
        : r.start_day;
      
      const newStep: MonthlyPunitorioStep = {
        day_trigger: lastDay + 5,
        surcharge_percentage: 5
      };

      return { ...r, steps: [...r.steps, newStep] };
    }));
  };

  const handleRemoveStep = (monthIndex: number, stepIndex: number) => {
    setRules(prev => prev.map(r => {
      if (r.month_index !== monthIndex) return r;
      const newSteps = [...r.steps];
      newSteps.splice(stepIndex, 1);
      return { ...r, steps: newSteps };
    }));
  };

  const handleStepChange = (monthIndex: number, stepIndex: number, field: keyof MonthlyPunitorioStep, value: number) => {
    setRules(prev => prev.map(r => {
      if (r.month_index !== monthIndex) return r;
      const newSteps = [...r.steps];
      newSteps[stepIndex] = { ...newSteps[stepIndex], [field]: value };
      return { ...r, steps: newSteps };
    }));
  };

  const handleSave = async () => {
    if (!garageId) return;
    setSaving(true);
    setMessage(null);

    try {
      // Logic: Ensure steps are sorted by day_trigger before saving to maintain consistency
      const sanitizedRules = rules.map(r => ({
        ...r,
        steps: [...r.steps].sort((a, b) => a.day_trigger - b.day_trigger)
      }));

      // Update state to reflect sorted view
      setRules(sanitizedRules);

      const { error } = await supabase
        .from('financial_configs')
        .upsert({
          garage_id: garageId,
          punitorio_rules: sanitizedRules as any // Cast to any for JSONB compatibility
        }, { onConflict: 'garage_id' });

      if (error) throw error;

      setMessage({ type: 'success', text: 'Configuración financiera actualizada.' });
    } catch (err: any) {
      console.error('Error saving:', err);
      setMessage({ type: 'error', text: 'Error al guardar cambios.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Cargando datos financieros...</div>;

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-blue-600" />
            Finanzas & Punitorios
          </h1>
          <p className="text-slate-500 mt-1">Configura los intereses por mora y vencimientos mes a mes.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`
            flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-medium text-white transition-all w-full md:w-auto
            ${saving ? 'bg-blue-400 cursor-wait' : 'bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg'}
          `}
        >
          {saving ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"/> : <Save className="h-4 w-4" />}
          {saving ? 'Guardando...' : 'Guardar Configuración'}
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

      {/* Grid of Months */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {rules.map((rule) => (
          <div 
            key={rule.month_index} 
            className={`
              relative flex flex-col rounded-xl border transition-all duration-200
              ${rule.active ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-slate-200 opacity-75'}
            `}
          >
            {/* Card Header */}
            <div className={`
              px-5 py-4 border-b flex items-center justify-between rounded-t-xl
              ${rule.active ? 'bg-slate-50/50' : 'bg-slate-100'}
            `}>
              <div className="flex items-center gap-2">
                <Calendar className={`h-4 w-4 ${rule.active ? 'text-blue-600' : 'text-slate-400'}`} />
                <span className="font-bold text-slate-800">{MONTH_NAMES[rule.month_index]}</span>
              </div>
              
              {/* Active Toggle */}
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={rule.active} 
                  onChange={(e) => handleUpdateMonth(rule.month_index, 'active', e.target.checked)}
                  className="sr-only peer" 
                />
                <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Card Body */}
            <div className="p-5 flex-1 space-y-5">
              
              {/* Start Day Config */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Clock className="h-4 w-4 text-slate-400" />
                  <span>Día Vencimiento:</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-400 font-medium">Día</span>
                  <input 
                    type="number" 
                    min="1" 
                    max="31"
                    disabled={!rule.active}
                    value={rule.start_day}
                    onChange={(e) => handleUpdateMonth(rule.month_index, 'start_day', parseInt(e.target.value) || 1)}
                    className="w-16 text-center border border-slate-300 rounded-md py-1 text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
              </div>

              {/* Dynamic Steps */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Escalones de Mora</span>
                  {rule.active && (
                    <button 
                      onClick={() => handleAddStep(rule.month_index)}
                      className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                    >
                      <Plus className="h-3 w-3" /> Agregar
                    </button>
                  )}
                </div>

                {rule.steps.length === 0 ? (
                  <div className="text-center py-4 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-xs text-slate-400">
                    Sin recargos adicionales
                  </div>
                ) : (
                  <div className="space-y-2">
                    {rule.steps.map((step, idx) => {
                      // Validation: Check if day is <= previous step or start day
                      const prevDay = idx === 0 ? rule.start_day : rule.steps[idx - 1].day_trigger;
                      const isInvalid = step.day_trigger <= prevDay;

                      return (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5">
                            <span className="text-xs text-slate-400 w-8">Día &gt;</span>
                            <input
                              type="number"
                              min={prevDay + 1}
                              max="31"
                              value={step.day_trigger}
                              onChange={(e) => handleStepChange(rule.month_index, idx, 'day_trigger', parseInt(e.target.value) || 0)}
                              className={`w-full bg-transparent text-sm font-medium focus:outline-none ${isInvalid ? 'text-red-600' : 'text-slate-700'}`}
                            />
                            {isInvalid && (
                              <div title="Debe ser mayor al anterior">
                                <AlertCircle className="h-3 w-3 text-red-500" />
                              </div>
                            )}
                          </div>
                          
                          <div className="w-24 flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5">
                            <Percent className="h-3 w-3 text-slate-400" />
                            <input
                              type="number"
                              min="0"
                              value={step.surcharge_percentage}
                              onChange={(e) => handleStepChange(rule.month_index, idx, 'surcharge_percentage', parseFloat(e.target.value) || 0)}
                              className="w-full bg-transparent text-sm font-medium focus:outline-none text-slate-700 text-right"
                            />
                          </div>

                          <button 
                            onClick={() => handleRemoveStep(rule.month_index, idx)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            
            {!rule.active && (
              <div className="absolute inset-0 bg-slate-100/50 rounded-xl z-10 pointer-events-none" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}