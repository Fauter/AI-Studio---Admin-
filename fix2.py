import re
with open('components/hub/CashFlowHub.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

code = re.sub(r'expenses(?=\.filter|\.reduce|\.map|\.forEach)', 'partialCloseExpenses', code)
code = re.sub(r'gExpenses(?=\.filter|\.reduce|\.map|\.forEach)', 'gPartialCloseExpenses', code)
code = re.sub(r'gExpenses', 'gPartialCloseExpenses', code)

code = re.sub(r' \| \'egresos\'', '', code)
code = re.sub(r'\{activeSection === \'egresos\' && \(\s*<ExpensesSection[\s\S]*?/>\s*\)\}', '', code)

with open('components/hub/CashFlowHub.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
