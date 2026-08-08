#!/usr/bin/env bash
# DEV-only deploy. Refuses anything that smells like production.
# Target: docker compose stack (app + postgres + nginx) built in EPIC-000.
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/_agentic_lib.sh

if [ "${DEPLOY_ENV:-dev}" != "dev" ]; then
  echo "[deploy] refusing: DEPLOY_ENV='${DEPLOY_ENV}' is not 'dev'. Production is human-only."
  exit 1
fi

if [ ! -f docker-compose.yml ] && [ ! -f compose.yml ]; then
  echo "[deploy] no compose file yet (pre-scaffold) — nothing to deploy (EPIC-000 T-002)"
  exit 0
fi

echo "[deploy] docker compose up (dev)"
docker compose up -d --build --wait

HEALTH="$(manifest_get deploy.health_url)"
if [ -n "$HEALTH" ]; then
  echo "[deploy] smoke: $HEALTH"
  for i in $(seq 1 20); do
    curl -fsS "$HEALTH" >/dev/null 2>&1 && { echo "[deploy] healthy"; exit 0; }
    sleep 3
  done
  echo "[deploy] FAIL: health check never passed"; exit 1
fi
echo "[deploy] done (no health_url configured)"
