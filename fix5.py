import re
with open('components/hub/CashFlowHub.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Fix branchBreakdown mapping
code = re.sub(
    r"const ts = new Date\(e\.expense_date\)\.getTime\(\);",
    "const ts = new Date(e.timestamp).getTime();",
    code, count=1)

# Fix dependencies
code = re.sub(
    r", expenses\]\);",
    ", partialCloseExpenses]);",
    code, count=1)

with open('components/hub/CashFlowHub.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
