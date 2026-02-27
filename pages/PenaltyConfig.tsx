import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Save,
  Calendar,
  Plus,
  Trash2,
  Percent,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Settings2,
  RefreshCw,
  Info,
  ChevronRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SurchargeConfig, SurchargeRule, SurchargeStep } from '../types';

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const DEFAULT_RULE: SurchargeRule = {
  steps: []
};

const DEFAULT_CONFIG: SurchargeConfig = {
  global_default: { ...DEFAULT_RULE },
  monthly_overrides: {}
};

export default function PenaltyConfigPage() {
  const { garageId } = useParams<{ garageId: string }>();

  const [config, setConfig] = useState<SurchargeConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (!garageId) return;

    const fetchConfig = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('financial_configs')
          .select('surcharge_config')
          .eq('garage_id', garageId)
          .single();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        if (data?.surcharge_config) {
          const fetchedConfig = data.surcharge_config as unknown as SurchargeConfig;
          setConfig({
            global_default: fetchedConfig.global_default || { ...DEFAULT_RULE, steps: fetchedConfig.global_default?.steps || [] },
            monthly_overrides: fetchedConfig.monthly_overrides || {}
          });
        }
      } catch (err: any) {
        console.error('Error loading surcharge config:', err);
        setMessage({ type: 'error', text: 'Error al cargar configuración financiera.' });
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [garageId]);

  // --- Handlers ---
  const handleGlobalStepChange = (index: number, field: keyof SurchargeStep, value: number) => {
    setConfig(prev => {
      const newSteps = [...prev.global_default.steps];
      newSteps[index] = { ...newSteps[index], [field]: value };
      return {
        ...prev,
        global_default: { ...prev.global_default, steps: newSteps }
      };
    });
  };

  const addGlobalStep = () => {
    setConfig(prev => {
      const steps = prev.global_default.steps;
      const lastDay = steps.length > 0 ? steps[steps.length - 1].day : 0;
      return {
        ...prev,
        global_default: { ...prev.global_default, steps: [...steps, { day: lastDay + 5, percentage: 5 }] }
      };
    });
  };

  const removeGlobalStep = (index: number) => {
    setConfig(prev => {
      const newSteps = [...prev.global_default.steps];
      newSteps.splice(index, 1);
      return {
        ...prev,
        global_default: { ...prev.global_default, steps: newSteps }
      };
    });
  };

  const handleMonthOverrideToggle = (monthIndex: number, enable: boolean) => {
    setConfig(prev => {
      const newOverrides = { ...prev.monthly_overrides };
      if (enable) {
        newOverrides[monthIndex.toString()] = { steps: [...prev.global_default.steps] };
      } else {
        delete newOverrides[monthIndex.toString()];
      }
      return { ...prev, monthly_overrides: newOverrides };
    });
  };

  const handleMonthStepChange = (monthIndex: number, stepIndex: number, field: keyof SurchargeStep, value: number) => {
    setConfig(prev => {
      const monthKey = monthIndex.toString();
      const currentOverride = prev.monthly_overrides[monthKey];
      if (!currentOverride) return prev;

      const newSteps = [...currentOverride.steps];
      newSteps[stepIndex] = { ...newSteps[stepIndex], [field]: value };

      return {
        ...prev,
        monthly_overrides: {
          ...prev.monthly_overrides,
          [monthKey]: { ...currentOverride, steps: newSteps }
        }
      };
    });
  };

  const addMonthStep = (monthIndex: number) => {
    setConfig(prev => {
      const monthKey = monthIndex.toString();
      const currentOverride = prev.monthly_overrides[monthKey];
      if (!currentOverride) return prev;

      const steps = currentOverride.steps;
      const lastDay = steps.length > 0 ? steps[steps.length - 1].day : 0;

      return {
        ...prev,
        monthly_overrides: {
          ...prev.monthly_overrides,
          [monthKey]: { ...currentOverride, steps: [...steps, { day: lastDay + 5, percentage: 5 }] }
        }
      };
    });
  };

  const removeMonthStep = (monthIndex: number, stepIndex: number) => {
    setConfig(prev => {
      const monthKey = monthIndex.toString();
      const currentOverride = prev.monthly_overrides[monthKey];
      if (!currentOverride) return prev;

      const newSteps = [...currentOverride.steps];
      newSteps.splice(stepIndex, 1);

      return {
        ...prev,
        monthly_overrides: {
          ...prev.monthly_overrides,
          [monthKey]: { ...currentOverride, steps: newSteps }
        }
      };
    });
  };

  const cleanSteps = (steps: SurchargeStep[]): SurchargeStep[] => {
    return steps
      .filter(s => s.percentage >= 0) // Allow 0 occasionally if meant to just be a baseline step, but usually > 0
      .map(s => ({
        day: parseInt(s.day.toString(), 10) || 0,
        percentage: parseFloat(s.percentage.toString()) || 0
      }))
      .sort((a, b) => a.day - b.day);
  };

  const handleSave = async () => {
    if (!garageId) return;
    setSaving(true);
    setMessage(null);

    try {
      // Clean and prepare data
      const cleanedGlobalDefaults = {
        steps: cleanSteps(config.global_default.steps)
      };

      const cleanedOverrides: Record<string, SurchargeRule> = {};
      Object.entries(config.monthly_overrides).forEach(([monthKey, rule]) => {
        cleanedOverrides[monthKey] = {
          steps: cleanSteps(rule.steps)
        };
      });

      const finalConfig: SurchargeConfig = {
        global_default: cleanedGlobalDefaults,
        monthly_overrides: cleanedOverrides
      };

      // Ensure updated state reflects the cleaned and sorted data
      setConfig(finalConfig);

      const { error } = await supabase
        .from('financial_configs')
        .upsert({
          garage_id: garageId,
          surcharge_config: finalConfig as any
        }, { onConflict: 'garage_id' });

      if (error) throw error;

      setMessage({ type: 'success', text: 'Configuración de recargos actualizada con éxito.' });
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      console.error('Error saving:', err);
      setMessage({ type: 'error', text: 'Error al guardar los cambios.' });
    } finally {
      setSaving(false);
    }
  };

  const renderTimeline = (rule: SurchargeRule) => {
    const steps = [...(rule.steps || [])].sort((a, b) => a.day - b.day);
    if (steps.length === 0) {
      return (
        <div className="flex items-center text-sm text-slate-500 bg-slate-100/50 p-3 rounded-lg border border-dashed border-slate-200">
          <Info className="h-4 w-4 mr-2 text-slate-400" />
          No hay recargos configurados. El precio se mantiene base.
        </div>
      );
    }

    return (
      <div className="relative pt-6 pb-4 overflow-x-auto">
        {/* Base Timeline Line */}
        <div className="absolute top-8 left-4 right-4 h-1 bg-slate-200 rounded animate-in fade-in duration-500" />

        <div className="relative flex justify-between items-start min-w-[300px] px-4">
          {steps.map((step, idx) => (
            <div key={idx} className="flex flex-col items-center relative z-10 -mt-[14px]">
              <div className="bg-red-50 text-red-700 text-xs font-bold px-2 py-0.5 rounded shadow-sm border border-red-100 mb-2 whitespace-nowrap">
                +{step.percentage}%
              </div>
              <div className="w-4 h-4 rounded-full bg-red-100 border-2 border-red-500 shadow-sm" />
              <div className="mt-2 text-xs font-medium text-slate-600 whitespace-nowrap">Día {step.day}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderRuleEditor = (rule: SurchargeRule, isGlobal: boolean, monthIndex?: number) => {
    const handleStep = (idx: number, field: keyof SurchargeStep, val: number) => {
      if (isGlobal) handleGlobalStepChange(idx, field, val);
      else if (monthIndex !== undefined) handleMonthStepChange(monthIndex, idx, field, val);
    };

    const addStep = () => {
      if (isGlobal) addGlobalStep();
      else if (monthIndex !== undefined) addMonthStep(monthIndex);
    };

    const removeStep = (idx: number) => {
      if (isGlobal) removeGlobalStep(idx);
      else if (monthIndex !== undefined) removeMonthStep(monthIndex, idx);
    };

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 relative z-10">
        <div className="grid grid-cols-1 gap-6">
          {/* Timeline Visualizer */}
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
            <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              Progresión de Recargos
            </h4>
            {renderTimeline(rule)}
          </div>

          <div className="space-y-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm h-full">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-slate-700">Escalones de Mora</label>
                <button
                  onClick={addStep}
                  className="text-xs flex items-center gap-1.5 text-blue-600 font-medium hover:bg-blue-50 px-2 py-1.5 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                >
                  <Plus className="h-3.5 w-3.5" /> Añadir
                </button>
              </div>

              {rule.steps.length === 0 ? (
                <div className="text-center py-6 bg-slate-50 rounded-lg border border-dashed text-slate-500 text-sm">
                  Sin escalones. Agregue uno para empezar a cobrar recargos por mora.
                </div>
              ) : (
                <div className="space-y-3">
                  {rule.steps.map((step, idx) => {
                    const prevDay = idx === 0 ? 0 : rule.steps[idx - 1].day;
                    const isInvalid = step.day <= prevDay;

                    return (
                      <div key={idx} className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <div className="flex-1 flex items-center min-w-0">
                          <span className="text-xs text-slate-500 mr-2 whitespace-nowrap">Desde día</span>
                          <input
                            type="number"
                            min={prevDay + 1}
                            max="31"
                            value={step.day}
                            onChange={(e) => handleStep(idx, 'day', parseInt(e.target.value) || 0)}
                            className={`w-full max-w-[4rem] text-center border-slate-300 rounded focus:ring-blue-500 py-1.5 text-sm font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isInvalid ? 'text-red-600 border-red-300 focus:ring-red-500' : 'text-slate-700'}`}
                          />
                        </div>
                        <div className="flex items-center gap-2 min-w-0">
                          <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0 hidden sm:block" />
                          <div className="flex items-center bg-white border border-slate-300 rounded px-2 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={step.percentage}
                              onChange={(e) => handleStep(idx, 'percentage', parseFloat(e.target.value) || 0)}
                              className="w-16 text-right border-0 focus:ring-0 py-1.5 text-sm font-semibold text-slate-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <Percent className="h-3 w-3 text-slate-400 ml-1" />
                          </div>
                        </div>

                        <button
                          onClick={() => removeStep(idx)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors ml-auto flex-shrink-0"
                          title="Eliminar escalón"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>

                        {isInvalid && (
                          <div className="w-full mt-1 text-xs text-red-500 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> Debe ser mayor al día anterior
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 flex-col gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="font-medium animate-pulse">Cargando configuración financiera...</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-24 animate-in fade-in duration-500">
      {/* Header Overview */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none opacity-60"></div>
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold tracking-wide uppercase mb-3 border border-blue-100">
            <Settings2 className="w-3.5 h-3.5" />
            Configuración Core
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Gestión de Recargos
          </h1>
          <p className="text-slate-500 mt-2 max-w-xl text-sm leading-relaxed">
            Diseñe las reglas de punitorios estableciendo escalones de mora.
            Establezca una política general y adapte meses específicos si la estacionalidad lo requiere.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className={`
            relative z-10 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all w-full md:w-auto shadow-sm
            ${saving
              ? 'bg-blue-400 cursor-not-allowed shadow-none'
              : 'bg-blue-600 hover:bg-blue-700 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0'}
          `}
        >
          {saving ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
          {saving ? 'Guardando Cambios...' : 'Guardar Configuración'}
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 animate-in slide-in-from-top-2 ${message.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
          {message.type === 'success' ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <AlertCircle className="h-5 w-5 text-rose-500" />}
          <span className="font-medium">{message.text}</span>
        </div>
      )}

      {/* Global Rule Section */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Regla Global por Defecto</h2>
              <p className="text-sm text-slate-500">Esta regla se aplicará a todos los meses que no tengan una excepción definida.</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {renderRuleEditor(config.global_default, true)}
        </div>
      </section>

      {/* Monthly Exceptions Section */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 px-2">
          <Calendar className="w-5 h-5 text-slate-400" />
          <h3 className="text-xl font-bold text-slate-800 tracking-tight">Excepciones Mensuales</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {MONTH_NAMES.map((monthName, idx) => {
            const hasOverride = !!config.monthly_overrides[idx.toString()];
            const rule = hasOverride ? config.monthly_overrides[idx.toString()] : config.global_default;

            return (
              <div
                key={idx}
                className={`
                  relative rounded-2xl border transition-all duration-300 overflow-hidden
                  ${hasOverride ? 'bg-white border-blue-200 shadow-sm ring-1 ring-blue-50' : 'bg-slate-50/50 border-slate-200'}
                `}
              >
                {/* Header */}
                <div className={`
                  p-5 border-b flex items-center justify-between transition-colors
                  ${hasOverride ? 'bg-blue-50/30 border-blue-100' : 'bg-transparent border-slate-200'}
                `}>
                  <div className="flex items-center gap-3 relative z-10">
                    <span className={`text-lg font-bold ${hasOverride ? 'text-blue-900' : 'text-slate-600'}`}>
                      {monthName}
                    </span>
                    {hasOverride && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] uppercase font-bold tracking-wider rounded-full">
                        Excepción Activa
                      </span>
                    )}
                  </div>

                  {/* Toggle */}
                  <label className="relative inline-flex items-center cursor-pointer z-10">
                    <input
                      type="checkbox"
                      checked={hasOverride}
                      onChange={(e) => handleMonthOverrideToggle(idx, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 shadow-inner"></div>
                  </label>
                </div>

                {/* Body */}
                <div className="p-5 relative">
                  {!hasOverride ? (
                    <div className="flex flex-col items-center justify-center p-6 text-center">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                        <RefreshCw className="w-5 h-5 text-slate-400" />
                      </div>
                      <p className="text-sm font-medium text-slate-600">Sincronizado con Regla Global</p>
                      <p className="text-xs text-slate-400 mt-1 max-w-xs">
                        Este mes hereda automáticamente la configuración de la Regla Global por Defecto. Active el interruptor para crear una excepción.
                      </p>
                    </div>
                  ) : (
                    renderRuleEditor(rule, false, idx)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}