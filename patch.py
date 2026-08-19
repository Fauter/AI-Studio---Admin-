import re
with open('components/hub/CashFlowHub.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Imports
code = re.sub(
    r"import \{\s*cn,", 
    "import { PeakPeriod, ActivityChartView, calculateActivityAnalytics } from './cash-flow/peakHoursUtils';\nimport {\n    cn,", 
    code, count=1)

# 2. State
code = re.sub(
    r"const \[peakMode, setPeakMode\] = useState<PeakMode>\('occupancy'\);",
    "const [peakMode, setPeakMode] = useState<PeakMode>('occupancy');\n    const [peakPeriod, setPeakPeriod] = useState<PeakPeriod>('today');\n    const [historicalChartView, setHistoricalChartView] = useState<ActivityChartView>('timeline');",
    code, count=1)

# 3. Store destructuring
code = re.sub(
    r"loadingTier1: loading, loadingProgress, loadingStep, error,\s*fetchTier1 \} = useCashFlowStore\(\);",
    "loadingTier1: loading, loadingProgress, loadingStep, error,\n        fetchTier1, peakStays, loadingPeakStays, peakStaysError, fetchPeakStays } = useCashFlowStore();",
    code, count=1)

# 4. UseEffect
code = re.sub(
    r"useEffect\(\(\) => \{\s*if \(garages\.length === 0\) return;\s*fetchTier1\(garages, profile\?\.id\);\s*\}, \[garages, profile\?\.id, fetchTier1\]\);",
    "useEffect(() => {\n        if (garages.length === 0) return;\n        fetchTier1(garages, profile?.id);\n        fetchPeakStays(garages);\n    }, [garages, profile?.id, fetchTier1, fetchPeakStays]);",
    code, count=1)

# 5. peakHoursData -> gPeakStays & activityAnalytics
code = re.sub(
    r"const peakHoursData = useMemo\(\(\) => \{[\s\S]*?return histogram;\s*\}, \[gAllStays, peakMode, now\]\);",
    "const gPeakStays = useMemo(() => selectedGarageId === 'all' ? peakStays : peakStays.filter(s => s.garage_id === selectedGarageId), [peakStays, selectedGarageId]);\n\n    const activityAnalytics = useMemo(() => {\n        return calculateActivityAnalytics(gPeakStays, peakPeriod, now);\n    }, [gPeakStays, peakPeriod, now]);",
    code, count=1)

# 6. Props to ChartsSection
code = re.sub(
    r"peakHoursData=\{peakHoursData\}\s*peakMode=\{peakMode\}\s*setPeakMode=\{setPeakMode\}\s*/>",
    "activityAnalytics={activityAnalytics}\n                            peakMode={peakMode}\n                            setPeakMode={setPeakMode}\n                            peakPeriod={peakPeriod}\n                            setPeakPeriod={setPeakPeriod}\n                            historicalChartView={historicalChartView}\n                            setHistoricalChartView={setHistoricalChartView}\n                            loadingPeakStays={loadingPeakStays}\n                            peakStaysError={peakStaysError}\n                        />",
    code, count=1)

with open('components/hub/CashFlowHub.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
