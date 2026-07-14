#!/usr/bin/env bash
# macremote Mac-side installer. Idempotent — safe to re-run.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UV="$(command -v uv || echo "$HOME/.local/bin/uv")"
UID_NUM="$(id -u)"
AGENTS="$HOME/Library/LaunchAgents"
LOGDIR="$HOME/Library/Logs/macremote"

echo "==> macremote install from $REPO"
mkdir -p "$AGENTS" "$LOGDIR"

# 1. Python deps
(cd "$REPO/server" && "$UV" sync)

# 2. .env sanity
if [ ! -f "$REPO/server/.env" ]; then
  echo "!! server/.env missing — copy server/.env.example and fill it in." >&2
  exit 1
fi

# 3. Hammerspoon config: load our module (idempotent)
mkdir -p "$HOME/.hammerspoon"
LOAD_LINE="dofile(\"$REPO/hammerspoon/macremote.lua\")"
touch "$HOME/.hammerspoon/init.lua"
grep -qF "$LOAD_LINE" "$HOME/.hammerspoon/init.lua" || echo "$LOAD_LINE" >> "$HOME/.hammerspoon/init.lua"

# 4. Render + load launchd services
render() { sed -e "s|__REPO__|$REPO|g" -e "s|__HOME__|$HOME|g" -e "s|__UV__|$UV|g" "$1" > "$2"; }
for svc in server updater; do
  PLIST="$AGENTS/io.macremote.$svc.plist"
  render "$REPO/ops/io.macremote.$svc.plist.template" "$PLIST"
  launchctl bootout "gui/$UID_NUM/io.macremote.$svc" 2>/dev/null || true
  launchctl bootstrap "gui/$UID_NUM" "$PLIST"
done

# 5. Start Hammerspoon (grants prompt appears on first eventtap use)
open -ga Hammerspoon || true

# 6. Health check
sleep 2
for i in $(seq 1 10); do
  if curl -sf "http://127.0.0.1:8484/health" >/dev/null; then
    echo "==> macremote server is up: http://$(hostname -s).local:8484"
    exit 0
  fi
  sleep 1
done
echo "!! server did not come up — check $LOGDIR/server.stderr.log" >&2
exit 1
