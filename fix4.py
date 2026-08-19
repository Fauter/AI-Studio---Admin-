import re
with open('components/hub/CashFlowHub.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

code = re.sub(
    r"const expensesMapped = gPartialCloseExpenses\.map\(e => \(\{[\s\S]*?\}\)\);",
    """const expensesMapped = gPartialCloseExpenses.map(e => ({
            id: e.id,
            source: 'partial_close_expense' as const,
            garage_id: e.garage_id,
            timestamp: e.timestamp,
            amount: -e.amount,
            description: 'Retiro/Gasto (Cierre Parcial)',
            plate: null,
            type: 'EGRESO',
            payment_method: 'EFECTIVO',
            operator: e.created_by_user_id
        }));""", code)

code = re.sub(r'const sortedExpenses = gPartialCloseExpenses\.sort\(\(a, b\) => new Date\(b\.expense_date\)\.getTime\(\) - new Date\(a\.expense_date\)\.getTime\(\)\);', '', code)

# Remove the line 594 error: Cannot find name 'expenses'
code = re.sub(r'expenses=\{expenses\}', 'expenses={[]}', code)

code = re.sub(r' \| \'egresos\'', '', code)

with open('components/hub/CashFlowHub.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
