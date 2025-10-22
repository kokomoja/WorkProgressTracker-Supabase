#!/usr/bin/env bash
set -euo pipefail

# Install Husky & Gitleaks
npm pkg set scripts.prepare="husky"
npm i -D husky gitleaks

# Init husky
npx husky install

# Add pre-commit hook
HOOK=".husky/pre-commit"
npx husky add "$HOOK" "npx gitleaks protect --staged --redact"
echo "✅ Added pre-commit hook: $HOOK"

# Create default gitleaks.toml if missing
if [ ! -f gitleaks.toml ]; then
  cat > gitleaks.toml <<'TOML'
title = "Repo secret scan rules"
[extend]
useDefault = true
[allowlist]
description = "Allow common false positives"
paths = [ '''^tests?/''', '''^fixtures?/''' ]
TOML
  echo "✅ Created gitleaks.toml"
fi

echo "🎉 Done. Commit again to see gitleaks in action."
