#!/bin/bash
# Auto-heal RVC Backstage (Kinsugi Task) — nyalain container kalau ada yang mati
# Cron: tiap 5 menit. Log: /home/wit/Documents/Kinsugi_task/.autoheal.log

PROJECT_DIR=/home/wit/Documents/Kinsugi_task
LOG=$PROJECT_DIR/.autoheal.log
PROJECT_NAME=kinsugi_task

# Cek apakah ada container project ini yang mati
DEAD=$(docker ps -a --filter "name=${PROJECT_NAME}" --format '{{.Names}} {{.Status}}' | grep -v "Up " || true)

if [ -n "$DEAD" ]; then
  echo "[$(date '+%F %T')] Container mati terdeteksi:" >> "$LOG"
  echo "$DEAD" >> "$LOG"
  echo "  -> Restart stack..." >> "$LOG"
  cd "$PROJECT_DIR" && docker compose up -d >> "$LOG" 2>&1
  echo "  -> Selesai. Status:" >> "$LOG"
  docker ps -a --filter "name=${PROJECT_NAME}" --format '  {{.Names}}: {{.Status}}' >> "$LOG"
else
  # Semua jalan — cek respon HTTP juga
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 http://localhost:3000/ 2>/dev/null)
  if [ "$CODE" != "307" ] && [ "$CODE" != "200" ] && [ "$CODE" != "302" ]; then
    echo "[$(date '+%F %T')] HTTP lokal aneh (code=$CODE), restart stack..." >> "$LOG"
    cd "$PROJECT_DIR" && docker compose up -d >> "$LOG" 2>&1
  fi
fi
