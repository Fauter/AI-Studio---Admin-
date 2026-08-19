import re
with open('components/hub/CashFlowHub.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

code = re.sub(
    r"            operator: e\.created_by \|\| null,\n\s*expense_type: e\.expense_type,\n\s*imputation: e\.imputation,\n\s*custom_garage_name: e\.custom_garage_name,",
    "            operator: e.created_by_user_id || null,\n            expense_type: 'OTRO',\n            imputation: 'OTROS',\n            custom_garage_name: null,",
    code, count=1)

code = re.sub(r' \| \'egresos\'', '', code)

with open('components/hub/CashFlowHub.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
