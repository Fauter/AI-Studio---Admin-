import re
with open('components/hub/CashFlowHub.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace expenses with partialCloseExpenses where applicable
code = re.sub(r'expenses(?=\.filter|\s*:\s*expenses)', 'partialCloseExpenses', code)
code = re.sub(r'const gExpenses = useMemo\(\(\) => selectedGarageId === \'all\' \? partialCloseExpenses : partialCloseExpenses\.filter\(e => e\.garage_id === selectedGarageId\), \[partialCloseExpenses, selectedGarageId\]\);', 'const gExpenses = useMemo(() => selectedGarageId === \'all\' ? partialCloseExpenses : partialCloseExpenses.filter(e => e.garage_id === selectedGarageId), [partialCloseExpenses, selectedGarageId]);', code)

# Remove addExpense
code = re.sub(r',\s*addExpense\b', '', code)

# Replace 'egresos' type with something else, or remove it entirely
code = re.sub(r' \| \'egresos\'', '', code)

# Fix kpiIngresos properties that didn't get caught
code = re.sub(r'return \{\n\s*today: todayTotal,\n\s*yesterday: yesterdayTotal,\n\s*variation\n\s*\};', 'return { today: todayTotal, todayExpenses: 0, todayNet: todayTotal, yesterday: yesterdayTotal, variation };', code)
code = re.sub(r'return \{\n\s*current: currentTotal,\n\s*previous: prevTotal,\n\s*variation\n\s*\};', 'return { current: currentTotal, currentExpenses: 0, currentNet: currentTotal, previous: prevTotal, variation };', code)

with open('components/hub/CashFlowHub.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

with open('components/hub/cash-flow/modals/OccupancyModal.tsx', 'r', encoding='utf-8') as f:
    occ = f.read()
occ = occ.replace('\"Disponible\"', '\"Libre\"')
with open('components/hub/cash-flow/modals/OccupancyModal.tsx', 'w', encoding='utf-8') as f:
    f.write(occ)
