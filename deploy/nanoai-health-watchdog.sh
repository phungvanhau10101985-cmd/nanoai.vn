#!/bin/bash
# Restart thu-do-online when PM2 still says online but :3000 stops answering.
# A V8 heap spiral stays under the old RSS kill line, so shops (gudo.vn and
# every other site on this process) hang until something outside the process
# restarts it. Skip during deploy and right after a restart.
set -u

APP_DIR=/var/www/Thu-do-online
PM2=/usr/bin/pm2
LOCK=/tmp/nanoai-cron-locks/health-watchdog.lock
FAILS=/var/tmp/nanoai-health-watchdog.fails
LAST=/var/tmp/nanoai-health-watchdog.last-restart
LOG=/root/logs/nanoai-health-watchdog.log
NEED_FAILS=2
COOLDOWN_SEC=120

mkdir -p /tmp/nanoai-cron-locks /root/logs /var/tmp
exec 9>"$LOCK"
flock -n 9 || exit 0

if [[ -f "$APP_DIR/deploy/.deploy-in-progress.lock" ]]; then
  exit 0
fi

now=$(date +%s)
if [[ -f "$LAST" ]]; then
  prev=$(cat "$LAST" 2>/dev/null || echo 0)
  if [[ "$prev" =~ ^[0-9]+$ ]] && (( now - prev < COOLDOWN_SEC )); then
    exit 0
  fi
fi

pid=$("$PM2" pid thu-do-online 2>/dev/null | tr -d '[:space:]' || true)
if [[ -z "$pid" || "$pid" == "0" ]]; then
  echo "$(date -Is) thu-do-online not running, starting" >> "$LOG"
  "$PM2" start "$APP_DIR/ecosystem.config.cjs" --only thu-do-online >> "$LOG" 2>&1 || true
  echo "$now" > "$LAST"
  echo 0 > "$FAILS"
  exit 0
fi

if [[ -d "/proc/$pid" ]]; then
  start=$(stat -c %Y "/proc/$pid" 2>/dev/null || echo 0)
  if [[ "$start" =~ ^[0-9]+$ ]] && (( now - start < 45 )); then
    exit 0
  fi
fi

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 6 http://127.0.0.1:3000/api/ready || true)
if [[ "$code" == "404" ]]; then
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 http://127.0.0.1:3000/pw-shop-sw.js || true)
fi

if [[ "$code" == "200" ]]; then
  echo 0 > "$FAILS"
  exit 0
fi

fails=$(cat "$FAILS" 2>/dev/null || echo 0)
if ! [[ "$fails" =~ ^[0-9]+$ ]]; then
  fails=0
fi
fails=$((fails + 1))
echo "$fails" > "$FAILS"
echo "$(date -Is) health http=$code fails=$fails/$NEED_FAILS" >> "$LOG"

if (( fails < NEED_FAILS )); then
  exit 0
fi

echo "$(date -Is) restart thu-do-online after ${fails} failed probes (last http=$code)" >> "$LOG"
echo 0 > "$FAILS"
echo "$now" > "$LAST"
"$PM2" restart thu-do-online >> "$LOG" 2>&1 || true
