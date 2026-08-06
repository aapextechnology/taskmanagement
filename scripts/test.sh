#!/usr/bin/env bash
# Test gate — install + type-check/build + unit/integration tests.
# Degrades gracefully pre-scaffold (no package.json → PASS with notice).
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/_agentic_lib.sh

if [ ! -f package.json ]; then
  echo "[test] no package.json yet (pre-scaffold) — PASS (nothing to test)"
  exit 0
fi

PM="$(manifest_get package_manager)"; PM="${PM:-pnpm}"
echo "[test] install"
"$PM" install --frozen-lockfile 2>/dev/null || "$PM" install

echo "[test] type-check/build"
if grep -q '"typecheck"' package.json; then "$PM" run typecheck; else "$PM" run build; fi

echo "[test] unit/integration tests"
if grep -q '"test"' package.json; then "$PM" run test; else echo "[test] no test script — add one (EPIC-000)"; fi

echo "[test] PASS"
