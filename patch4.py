import re
with open('components/hub/CashFlowHub.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

code = re.sub(
    r"    const peakHoursData = useMemo\(\(\) => \{[\s\S]*?return histogram;\n\s*\}, \[gAllStays, peakMode\]\);",
    "    const gPeakStays = useMemo(() => selectedGarageId === 'all' ? peakStays : peakStays.filter(s => s.garage_id === selectedGarageId), [peakStays, selectedGarageId]);\n\n    const activityAnalytics = useMemo(() => {\n        return calculateActivityAnalytics(gPeakStays, peakPeriod, now);\n    }, [gPeakStays, peakPeriod, now]);",
    code, count=1)

with open('components/hub/CashFlowHub.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
