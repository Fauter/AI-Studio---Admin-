import re
with open('components/hub/CashFlowHub.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

code = re.sub(r'\{ key: \'egresos\', label: \'Egresos\', icon: BadgeDollarSign \},\n', '', code)
code = re.sub(r'operator: e\.created_by_user_id \|\| null,', 'operator: null,', code)

with open('components/hub/CashFlowHub.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
