#!/usr/bin/env bash
# Release macremote: bump versions, tag, push. CI does the rest
# (tests -> signed APK -> GitHub Release -> Discord notification).
set -euo pipefail

# OTA fast lane: ship.sh --ota "message"  (JS-only changes, live in ~1 min.
# Native/dep/config changes still need a full X.Y.Z release.)
if [ "${1:-}" = "--ota" ]; then
  MSG="${2:?usage: ship.sh --ota \"what changed\"}"
  REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  cd "$REPO/app"
  EAS_NO_VCS=1 npx eas-cli update --channel production --message "$MSG" --non-interactive
  echo "==> OTA published. Installed apps (v0.2.1+) pick it up on next launch."
  exit 0
fi

V="${1:?usage: ship.sh X.Y.Z  |  ship.sh --ota \"message\"}"
[[ "$V" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "version must be X.Y.Z"; exit 1; }

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

git checkout main
git pull --no-rebase origin main   # merge, never rebase

echo "$V" > server/VERSION
if [ -f app/app.json ]; then
  jq --arg v "$V" '.expo.version = $v | .expo.android.versionCode = ((.expo.android.versionCode // 0) + 1)' \
    app/app.json > /tmp/app.json.$$ && mv /tmp/app.json.$$ app/app.json
fi

git add server/VERSION app/app.json 2>/dev/null || git add server/VERSION
git commit -m "Release v$V

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git tag "v$V"
git push origin main --tags
echo "==> v$V pushed. Watch: gh run watch  (Discord will announce the APK)"
