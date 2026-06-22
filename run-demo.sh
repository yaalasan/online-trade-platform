#!/usr/bin/env bash
# Launch the Fastflow demo server detached, so the shell returns immediately
# and the server keeps running in the background. Logs to /tmp/fastflow-demo.log.
set -euo pipefail

cd "$(dirname "$0")"
PORT="${PORT:-5000}"
PY="./.venv/bin/python"
LOG="/tmp/fastflow-demo.log"

# Stop any previous instance.
pkill -f "main.py" 2>/dev/null || true
sleep 1

# Start detached: nohup + background + disown so it survives the shell exiting.
nohup "$PY" main.py > "$LOG" 2>&1 &
PID=$!
disown 2>/dev/null || true

# Wait for it to answer (up to ~10s).
for i in $(seq 1 20); do
  if curl -s -o /dev/null "http://127.0.0.1:${PORT}/"; then
    echo "✅ Fastflow demo is running."
    echo "   URL:  http://localhost:${PORT}"
    echo "   PID:  ${PID}   (stop with: pkill -f main.py)"
    echo "   Logs: ${LOG}"
    exit 0
  fi
  sleep 0.5
done

echo "❌ Server did not come up. Last log lines:"
tail -20 "$LOG" || true
exit 1
