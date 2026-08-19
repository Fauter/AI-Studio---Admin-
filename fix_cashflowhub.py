import re
with open('components/hub/CashFlowHub.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Imports
code = re.sub(
    r"import \{\s*cn,", 
    "import { PeakPeriod, ActivityChartView, calculateActivityAnalytics } from './cash-flow/peakHoursUtils';\nimport {\n    cn,", 
    code, count=1)
code = re.sub(r'Expense,', 'PartialClose,', code)

# 2. Remove ExpensesSection import and other unused modals
code = re.sub(r'import ExpensesSection from \'\./cash-flow/ExpensesSection\';\n', '', code)
code = re.sub(r'import DailyIncomeModal from \'\./cash-flow/modals/DailyIncomeModal\';\n', '', code)

# 3. State
code = re.sub(
    r"const \[peakMode, setPeakMode\] = useState<PeakMode>\('occupancy'\);",
    "const [peakMode, setPeakMode] = useState<PeakMode>('occupancy');\n    const [peakPeriod, setPeakPeriod] = useState<PeakPeriod>('today');\n    const [historicalChartView, setHistoricalChartView] = useState<ActivityChartView>('timeline');",
    code, count=1)

# 4. Destructuring UseCashFlowStore
code = re.sub(
    r"cocheras, buildingLevels, expenses, tariffs,",
    "cocheras, buildingLevels, partialCloseExpenses, tariffs,",
    code, count=1)
code = re.sub(
    r"loadingTier1: loading, loadingTier2, loadingProgress, loadingStep, error,\n\s*fetchTier1, fetchTier2,\n\s*addExpense",
    "loadingTier1: loading, loadingProgress, loadingStep, error,\n        fetchTier1, peakStays, loadingPeakStays, peakStaysError, fetchPeakStays",
    code, count=1)

# 5. UseEffect
code = re.sub(
    r"useEffect\(\(\) => \{\n\s*if \(garages\.length === 0\) return;\n\s*fetchTier1\(garages, profile\?\.id\)\.then\(\(\) => \{\n\s*fetchTier2\(garages\);\n\s*\}\);\n\s*\}, \[garages, profile\?\.id, fetchTier1, fetchTier2\]\);",
    "useEffect(() => {\n        if (garages.length === 0) return;\n        fetchTier1(garages, profile?.id);\n        fetchPeakStays(garages);\n    }, [garages, profile?.id, fetchTier1, fetchPeakStays]);",
    code, count=1)

# 6. gExpenses -> gPartialCloseExpenses
code = re.sub(
    r"const gExpenses = useMemo\(\(\) => selectedGarageId === 'all' \? expenses : expenses\.filter\(e => e\.garage_id === selectedGarageId\), \[expenses, selectedGarageId\]\);",
    "const gPartialCloseExpenses = useMemo(() => selectedGarageId === 'all' ? partialCloseExpenses : partialCloseExpenses.filter(e => e.garage_id === selectedGarageId), [partialCloseExpenses, selectedGarageId]);",
    code, count=1)

# 7. peakHoursData -> activityAnalytics
code = re.sub(
    r"    const peakHoursData = useMemo\(\(\) => \{[\s\S]*?return histogram;\n\s*\}, \[gAllStays, peakMode\]\);",
    "    const gPeakStays = useMemo(() => selectedGarageId === 'all' ? peakStays : peakStays.filter(s => s.garage_id === selectedGarageId), [peakStays, selectedGarageId]);\n\n    const activityAnalytics = useMemo(() => {\n        const now = new Date();\n        return calculateActivityAnalytics(gPeakStays, peakPeriod, now);\n    }, [gPeakStays, peakPeriod]);",
    code, count=1)

# 8. Render ChartsSection
code = re.sub(
    r"peakHoursData=\{peakHoursData\}\s*peakMode=\{peakMode\}\s*setPeakMode=\{setPeakMode\}\s*/>",
    "activityAnalytics={activityAnalytics}\n                            peakMode={peakMode}\n                            setPeakMode={setPeakMode}\n                            peakPeriod={peakPeriod}\n                            setPeakPeriod={setPeakPeriod}\n                            historicalChartView={historicalChartView}\n                            setHistoricalChartView={setHistoricalChartView}\n                            loadingPeakStays={loadingPeakStays}\n                            peakStaysError={peakStaysError}\n                        />",
    code, count=1)

# 9. Remove egresos section
code = re.sub(r' \| \'egresos\'', '', code)
code = re.sub(r'\{activeSection === \'egresos\' && \(\n\s*<ExpensesSection[\s\S]*?/>\n\s*\)\}', '', code)

# 10. Update KpiGrid props (kpiIngresos & kpiFacturacion need dummy expenses for now since we don't have them)
code = re.sub(r'return \{\n\s*today: todayTotal,\n\s*yesterday: yesterdayTotal,\n\s*variation\n\s*\};', 'return { today: todayTotal, todayExpenses: 0, todayNet: todayTotal, yesterday: yesterdayTotal, variation };', code)
code = re.sub(r'return \{\n\s*current: currentTotal,\n\s*previous: prevTotal,\n\s*variation\n\s*\};', 'return { current: currentTotal, currentExpenses: 0, currentNet: currentTotal, previous: prevTotal, variation };', code)

# 11. Update modal props
code = re.sub(r'<HistoryModal\n\s*isOpen=\{isHistoryModalOpen\}[\s\S]*?/>', '<HistoryModal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} selectedGarageId={selectedGarageId} garages={garages} />', code)
# DailyIncomeModal was removed, let's remove its UI conditionally or update it
code = re.sub(r'<DailyIncomeModal\n\s*isOpen=\{isDailyIncomeModalOpen\}[\s\S]*?/>', '', code)


with open('components/hub/CashFlowHub.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

with open('components/hub/cash-flow/modals/OccupancyModal.tsx', 'r', encoding='utf-8') as f:
    occ = f.read()
occ = occ.replace('\"Disponible\"', '\"Libre\"')
with open('components/hub/cash-flow/modals/OccupancyModal.tsx', 'w', encoding='utf-8') as f:
    f.write(occ)
