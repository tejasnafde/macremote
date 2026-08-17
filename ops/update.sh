#!/usr/bin/env bash
# macremote self-updater: runs via launchd timer. Pull new release tags,
# reinstall, restart, health-check; roll back + alert on failure.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UV="$(command -v uv || echo "$HOME/.local/bin/uv")"
UID_NUM="$(id -u)"
LOCKDIR="$HOME/.macremote/update.lock.d"

# webhook for alerts (never printed)
WEBHOOK="$(grep -m1 '^DISCORD_WEBHOOK_URL=' "$REPO/server/.env" 2>/dev/null | cut -d= -f2- || true)"

notify() { # $1 = message, $2 = color int
  [ -n "$WEBHOOK" ] || return 0
  curl -sf -m 5 -H 'Content-Type: application/json' \
    -d "{\"username\":\"macremote\",\"embeds\":[{\"title\":\"Server update\",\"description\":\"$1\",\"color\":$2}]}" \
    "$WEBHOOK" >/dev/null || true
}

# single-instance lock (macOS has no flock)
mkdir -p "$HOME/.macremote"
if ! mkdir "$LOCKDIR" 2>/dev/null; then
  OWNER="$(cat "$LOCKDIR/owner.pid" 2>/dev/null || true)"
  if [[ "$OWNER" =~ ^[0-9]+$ ]] && kill -0 "$OWNER" 2>/dev/null; then
    exit 0
  fi
  # The owning process is gone (power loss/SIGKILL). Remove only the known
  # marker and empty lock directory, then claim it again.
  rm -f "$LOCKDIR/owner.pid"
  rmdir "$LOCKDIR" 2>/dev/null || exit 0
  mkdir "$LOCKDIR"
fi
echo "$$" > "$LOCKDIR/owner.pid"
trap 'rm -f "$LOCKDIR/owner.pid"; rmdir "$LOCKDIR"' EXIT

cd "$REPO"
CURRENT="$(cat server/VERSION)"
git fetch --tags --force --quiet origin || exit 0
LATEST_TAG="$(git tag -l 'v*' --sort=-v:refname | head -1)"
[ -n "$LATEST_TAG" ] || exit 0
LATEST="${LATEST_TAG#v}"
NEWEST="$(printf '%s\n%s\n' "$CURRENT" "$LATEST" | sort -V | tail -1)"
if [ "$NEWEST" = "$CURRENT" ]; then exit 0; fi

echo "[$(date '+%F %T')] updating v$CURRENT -> v$LATEST"
PREVIOUS_REF="$(git rev-parse HEAD)"
git checkout --detach --quiet "$LATEST_TAG"
if [ "$(cat server/VERSION)" != "$LATEST" ]; then
  echo "release tag $LATEST_TAG contains mismatched server/VERSION" >&2
  git checkout --detach --quiet "$PREVIOUS_REF"
  notify "❌ update tag $LATEST_TAG has mismatched server/VERSION" 15158332
  exit 1
fi

restart_and_check() {
  EXPECTED="$1"
  (cd server && "$UV" sync --quiet)
  launchctl kickstart -k "gui/$UID_NUM/io.macremote.server"
  for i in $(seq 1 10); do
    sleep 1
    GOT="$(curl -sf -m 2 http://127.0.0.1:8484/version 2>/dev/null | tr -d '"' || true)"
    [ "$GOT" = "$EXPECTED" ] && return 0
  done
  return 1
}

if restart_and_check "$LATEST"; then
  notify "✅ updated v$CURRENT → v$LATEST" 3066993
else
  echo "health check failed — rolling back to v$CURRENT"
  git checkout --detach --quiet "$PREVIOUS_REF"
  if restart_and_check "$CURRENT"; then
    notify "❌ update to v$LATEST FAILED — rolled back to v$CURRENT (healthy)" 15158332
  else
    notify "🚨 update to v$LATEST failed AND rollback unhealthy — manual attention needed" 10038562
  fi
  exit 1
fi
