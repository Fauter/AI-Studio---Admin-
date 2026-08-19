import re
with open('components/hub/CashFlowHub.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Store destructuring
code = re.sub(
    r"loadingTier1: loading, loadingProgress, loadingStep, error,\s*fetchTier1 \} = useCashFlowStore\(\);",
    "loadingTier1: loading, loadingProgress, loadingStep, error,\n        fetchTier1, peakStays, loadingPeakStays, peakStaysError, fetchPeakStays } = useCashFlowStore();",
    code, count=1)

# UseEffect
code = re.sub(
    r"useEffect\(\(\) => \{\s*if \(garages\.length === 0\) return;\s*fetchTier1\(garages, profile\?\.id\);\s*\}, \[garages, profile\?\.id, fetchTier1\]\);",
    "useEffect(() => {\n        if (garages.length === 0) return;\n        fetchTier1(garages, profile?.id);\n        fetchPeakStays(garages);\n    }, [garages, profile?.id, fetchTier1, fetchPeakStays]);",
    code, count=1)

# gPeakStays & activityAnalytics
code = re.sub(
    r"    const peakHoursData = useMemo\(\(\) => \{\s*const histogram = new Array\(24\).fill\(0\);[\s\S]*?return histogram;\s*\}, \[gAllStays, peakMode, now\]\);",
    "    const gPeakStays = useMemo(() => selectedGarageId === 'all' ? peakStays : peakStays.filter(s => s.garage_id === selectedGarageId), [peakStays, selectedGarageId]);\n\n    const activityAnalytics = useMemo(() => {\n        return calculateActivityAnalytics(gPeakStays, peakPeriod, now);\n    }, [gPeakStays, peakPeriod, now]);",
    code, count=1)

with open('components/hub/CashFlowHub.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
