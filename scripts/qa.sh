#!/usr/bin/env bash
# QA gate — lint + static checks. Reads .agentic/config.yml via _agentic_lib.sh.
# Degrades gracefully: before the app scaffold exists (no package.json) it
# passes with a notice so docs-only work isn't blocked.
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/_agentic_lib.sh

if [ ! -f package.json ]; then
  echo "[qa] no package.json yet (pre-scaffold) — PASS (nothing to lint)"
  exit 0
fi

PM="$(manifest_get package_manager)"; PM="${PM:-pnpm}"
echo "[qa] lint via $PM"
"$PM" run lint

echo "[qa] PASS"
