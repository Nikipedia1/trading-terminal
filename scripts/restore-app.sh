#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
echo "Restoring src/App.tsx from 8570fa4 + className fix..."
git show 8570fa4:src/App.tsx > src/App.tsx
python3 - <<'PY2'
from pathlib import Path
p = Path("src/App.tsx")
t = p.read_text()
fixed = t.replace(": ''`}>", ": ''}`}>", 1)
p.write_text(fixed)
print("App.tsx restored and fixed" if fixed != t else "WARNING: pattern not found")
PY2
npm run build
echo "OK — commit and push:"
echo "  git add src/App.tsx && git commit -m 'fix(build): restore App.tsx className template' && git push"
