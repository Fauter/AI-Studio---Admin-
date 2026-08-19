import re
with open('components/hub/CashFlowHub.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Fix unified expenses array
code = re.sub(
    r"const expensesMapped = gPartialCloseExpenses\.map\(e => \(\{\n\s*id: e\.id,\n\s*source: 'expense' as const,\n\s*garage_id: e\.garage_id,\n\s*timestamp: e\.expense_date,\n\s*amount: -e\.amount, // Egresos restan\n\s*description: e\.imputation \? \$\{e\.imputation\} - \$\{e\.description\} : e\.description,\n\s*plate: null,\n\s*type: 'EGRESO',\n\s*payment_method: 'EFECTIVO',\n\s*operator: e\.created_by,\n\s*expense_type: e\.expense_type,\n\s*imputation: e\.imputation,\n\s*custom_garage_name: e\.custom_garage_name\n\s*\}\)\);",
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

# Remove the remaining egresos from active section UI
code = re.sub(r' \| \'egresos\'', '', code)

with open('components/hub/CashFlowHub.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
